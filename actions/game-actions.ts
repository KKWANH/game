'use server'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'
import { requireUser } from '@/lib/game/auth'
import { loadRoundState } from '@/lib/game/load'
import type { RoundState } from '@/lib/game/types'
import { commitRound, freshShoe, VersionConflict } from '@/lib/game/commit'
import {
  computeActionPatch,
  computeDealPatch,
  computeDealerSettlePatch,
  computeDealerRevealPatch,
  computeDealerHitPatch,
  computeDealerStandPatch,
  hasHumanDealer,
  SEAT_ORDER_GAP,
} from '@/lib/game/engine'
import type { Action } from '@/lib/blackjack'

type Service = SupabaseClient<Database>

function deadline(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

// ---------------------------------------------------------------------
// Round lifecycle — turn-based & automatic.
//
// A round flows on its own: each seated player gets a TIMED betting turn in
// seat order (bet or pass), then the deal happens automatically, player turns
// run with their own timer, the dealer auto-plays, and after settlement the
// next round auto-starts. No host "deal"/"next" clicks.
// ---------------------------------------------------------------------

/** Internal: open a fresh betting round with a timed betting turn per seat. */
async function openBettingRound(service: Service, roomId: string) {
  const { data: room } = await service.from('rooms').select('*').eq('id', roomId).single()
  if (!room) throw new Error('방을 찾을 수 없습니다.')

  const { data: config } = await service.from('room_config').select('*').eq('room_id', roomId).single()
  if (!config) throw new Error('방 설정이 없습니다.')

  const { data: seats } = await service
    .from('seats')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_dealer', false)
    .neq('status', 'left')
  const players = (seats ?? []).sort((a, b) => a.seat_index - b.seat_index)
  if (players.length === 0) throw new Error('플레이어가 없습니다.')

  const { data: lastRound } = await service
    .from('game_rounds')
    .select('round_number')
    .eq('room_id', roomId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const roundNumber = (lastRound?.round_number ?? 0) + 1

  // Set the betting deadline in the INSERT so there's never a null-deadline
  // window for a client to misread as already-expired.
  const { data: round, error } = await service
    .from('game_rounds')
    .insert({
      room_id: roomId,
      round_number: roundNumber,
      phase: 'betting',
      config_snapshot: config,
      version: 0,
      turn_deadline: deadline(config.turn_timer_seconds),
    })
    .select('*')
    .single()
  if (error || !round) throw new Error('라운드 생성 실패: ' + error?.message)

  await service.rpc('create_round_secret', { p_round_id: round.id, p_deck: freshShoe(config.num_decks) })

  // One betting hand per seated player (bet 0 until they act).
  const handRows = players.map((s) => ({
    round_id: round.id,
    seat_id: s.id,
    is_dealer: false,
    bet_amount: 0,
    status: 'betting' as const,
    seat_order: s.seat_index * SEAT_ORDER_GAP,
  }))
  const { data: hands } = await service.from('hands').insert(handRows).select('*')
  const first = (hands ?? []).sort((a, b) => a.seat_order - b.seat_order)[0]

  await service.from('game_rounds').update({ active_hand_id: first?.id ?? null }).eq('id', round.id)

  await service.from('rooms').update({ status: 'active', current_round_id: round.id }).eq('id', roomId)
  return { roundId: round.id as string }
}

/** Host kicks off the auto-running game (the first betting round). */
export async function startRound(roomId: string) {
  const user = await requireUser()
  const service = createServiceClient()
  const { data: room } = await service.from('rooms').select('host_user_id, current_round_id').eq('id', roomId).single()
  if (!room) throw new Error('방을 찾을 수 없습니다.')
  if (room.host_user_id !== user.id) throw new Error('호스트만 시작할 수 있습니다.')
  return openBettingRound(service, roomId)
}

/** After a round completes, any client fires this to auto-start the next one. */
export async function autoNextRound(roomId: string) {
  await requireUser()
  const service = createServiceClient()
  const { data: room } = await service.from('rooms').select('status, current_round_id').eq('id', roomId).single()
  if (!room || room.status !== 'active') return { ok: true }
  if (room.current_round_id) {
    const { data: cur } = await service
      .from('game_rounds')
      .select('phase, dealer_hand_id')
      .eq('id', room.current_round_id)
      .maybeSingle()
    if (cur && cur.phase !== 'complete') return { ok: true } // a round is still live
    // Only auto-continue after a PLAYED round. A void (nobody bet → no deal)
    // stops the loop so the host restarts deliberately — no runaway.
    if (cur && !cur.dealer_hand_id) return { ok: true }
  }
  try {
    await openBettingRound(service, roomId)
  } catch {
    // no players / race — ignore
  }
  return { ok: true }
}

// ---------------------------------------------------------------------
// Sequential betting
// ---------------------------------------------------------------------

const BetSchema = z.object({
  roundId: z.string().uuid(),
  seatId: z.string().uuid(),
  amount: z.coerce.number().int().nonnegative(), // 0 = pass
})

/** Place a bet (or pass with amount 0) on your timed betting turn. */
export async function submitBet(input: z.input<typeof BetSchema>) {
  const user = await requireUser()
  const p = BetSchema.parse(input)
  const service = createServiceClient()
  const state = await loadRoundState(service, p.roundId)

  if (state.round.phase !== 'betting') throw new Error('베팅 단계가 아닙니다.')
  const hand = state.hands.find((h) => h.id === state.round.active_hand_id)
  if (!hand || hand.seat_id !== p.seatId) throw new Error('당신의 베팅 차례가 아닙니다.')

  const seat = state.seats.find((s) => s.id === p.seatId)
  if (!seat || seat.user_id !== user.id) throw new Error('본인 자리가 아닙니다.')

  if (p.amount > 0) {
    const cfg = state.config
    if (p.amount < cfg.min_bet || p.amount > cfg.max_bet) throw new Error(`베팅은 ${cfg.min_bet}~${cfg.max_bet} 사이여야 합니다.`)
    if (p.amount > seat.chip_stack) throw new Error('칩이 부족합니다.')
  }
  return advanceBetting(service, state, hand.id, p.amount)
}

/** Any client may fire this once the betting turn deadline has passed. */
export async function bettingTimeout(roundId: string) {
  await requireUser()
  const service = createServiceClient()
  const state = await loadRoundState(service, roundId)
  if (state.round.phase !== 'betting' || !state.round.active_hand_id || !state.round.turn_deadline) return { ok: true }
  if (Date.now() < new Date(state.round.turn_deadline).getTime()) return { tooEarly: true }
  return advanceBetting(service, state, state.round.active_hand_id, 0) // auto-pass
}

/** Record this seat's bet/pass and move to the next bettor — or deal. */
async function advanceBetting(service: Service, state: RoundState, actingHandId: string, amount: number) {
  const acting = state.hands.find((h) => h.id === actingHandId)
  if (!acting) throw new Error('핸드를 찾을 수 없습니다.')

  const next = state.hands
    .filter((h) => h.status === 'betting' && !h.is_dealer && h.seat_order > acting.seat_order)
    .sort((a, b) => a.seat_order - b.seat_order)[0]

  const patch: Parameters<typeof commitRound>[3] = { update_hands: [], round: {} }
  if (amount > 0) {
    patch.update_hands = [{ id: acting.id, bet_amount: amount }]
    patch.ledger = [{ seat_id: acting.seat_id!, round_id: state.round.id, hand_id: acting.id, type: 'bet', amount: -amount }]
  }
  if (next) {
    patch.round = { active_hand_id: next.id, turn_deadline: deadline(state.config.turn_timer_seconds) }
  } else {
    patch.round = { phase: 'dealing', active_hand_id: null, turn_deadline: null }
  }

  try {
    await commitRound(service, state.round.id, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return { conflict: true }
    throw e
  }

  if (!next) await dealOrVoid(service, state.round.id)
  return { ok: true }
}

/** Betting finished: deal to everyone who bet, or void the round if nobody did. */
async function dealOrVoid(service: Service, roundId: string) {
  const state = await loadRoundState(service, roundId)
  if (state.round.phase !== 'dealing') return

  const betHands = state.hands.filter((h) => !h.is_dealer && h.bet_amount > 0)
  if (betHands.length === 0) {
    // Nobody bet — end the round; auto-next will reopen betting.
    await commitRound(service, roundId, state.round.version, { round: { phase: 'complete' } }).catch(() => {})
    return
  }

  const dealerHandId = crypto.randomUUID()
  const { patch, holeCard } = computeDealPatch(state, dealerHandId)
  patch.insert_hands = [
    { id: dealerHandId, round_id: roundId, seat_id: state.room.dealer_seat_id ?? null, is_dealer: true, status: 'active', seat_order: 999999 },
    ...(patch.insert_hands ?? []),
  ]
  // Non-betting hands sit this round out.
  const sitOut = state.hands.filter((h) => !h.is_dealer && h.bet_amount === 0).map((h) => ({ id: h.id, status: 'settled' }))
  patch.update_hands = [...(patch.update_hands ?? []), ...sitOut]

  await service.rpc('set_dealer_hole_card', { p_round_id: roundId, p_card: holeCard })
  try {
    await commitRound(service, roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return
    throw e
  }
  if (patch.round?.phase === 'dealer_turn') await runDealerSettle(service, roundId, dealerHandId)
}

// ---------------------------------------------------------------------
// Player turns (unchanged)
// ---------------------------------------------------------------------

const ActionSchema = z.object({
  roundId: z.string().uuid(),
  handId: z.string().uuid(),
  action: z.enum(['hit', 'stand', 'double', 'split', 'surrender', 'insurance']),
  insuranceBet: z.coerce.number().int().nonnegative().optional(),
})

export async function playerAction(input: z.input<typeof ActionSchema>) {
  const user = await requireUser()
  const p = ActionSchema.parse(input)
  const service = createServiceClient()
  const state = await loadRoundState(service, p.roundId)

  if (state.round.phase !== 'player_turns') throw new Error('지금은 행동할 수 없습니다.')
  if (state.round.active_hand_id !== p.handId) throw new Error('당신의 턴이 아닙니다.')

  const hand = state.hands.find((h) => h.id === p.handId)
  const seat = state.seats.find((s) => s.id === hand?.seat_id)
  if (!hand || !seat || seat.user_id !== user.id) throw new Error('본인 핸드가 아닙니다.')

  const { patch, enterDealer } = computeActionPatch(state, p.handId, p.action as Action, { insuranceBet: p.insuranceBet })
  try {
    await commitRound(service, p.roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return { conflict: true }
    throw e
  }
  if (enterDealer && state.round.dealer_hand_id) await runDealerSettle(service, p.roundId, state.round.dealer_hand_id)
  return { ok: true }
}

export async function timeoutTurn(roundId: string) {
  await requireUser()
  const service = createServiceClient()
  const state = await loadRoundState(service, roundId)
  if (state.round.phase !== 'player_turns' || !state.round.active_hand_id || !state.round.turn_deadline) return { ok: true }
  if (Date.now() < new Date(state.round.turn_deadline).getTime()) return { tooEarly: true }

  const { patch, enterDealer } = computeActionPatch(state, state.round.active_hand_id, 'stand')
  try {
    await commitRound(service, roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return { conflict: true }
    throw e
  }
  if (enterDealer && state.round.dealer_hand_id) await runDealerSettle(service, roundId, state.round.dealer_hand_id)
  return { ok: true }
}

/** Enter the dealer turn: AI dealer auto-plays & settles; a HUMAN dealer gets
 *  the hole revealed and their own timed hit/stand turn. */
async function runDealerSettle(service: Service, roundId: string, dealerHandId: string) {
  const state = await loadRoundState(service, roundId)
  if (state.round.phase !== 'dealer_turn') return
  const { patch } = hasHumanDealer(state)
    ? computeDealerRevealPatch(state, dealerHandId)
    : computeDealerSettlePatch(state, dealerHandId)
  try {
    await commitRound(service, roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return
    throw e
  }
}

const DealerActionSchema = z.object({
  roundId: z.string().uuid(),
  action: z.enum(['hit', 'stand']),
})

/** A human dealer plays their own hand (hit/stand) during the dealer turn. */
export async function dealerAction(input: z.input<typeof DealerActionSchema>) {
  const user = await requireUser()
  const p = DealerActionSchema.parse(input)
  const service = createServiceClient()
  const state = await loadRoundState(service, p.roundId)

  const dealerHandId = state.round.dealer_hand_id
  if (state.round.phase !== 'dealer_turn' || !dealerHandId) throw new Error('지금은 딜러 차례가 아닙니다.')
  if (state.round.active_hand_id !== dealerHandId) throw new Error('딜러 차례가 아닙니다.')
  const dealerSeat = state.seats.find((s) => s.id === state.room.dealer_seat_id)
  if (!dealerSeat || dealerSeat.user_id !== user.id) throw new Error('딜러만 조작할 수 있습니다.')

  if (p.action === 'stand') {
    const { patch } = computeDealerStandPatch(state, dealerHandId)
    try {
      await commitRound(service, p.roundId, state.round.version, patch)
    } catch (e) {
      if (e instanceof VersionConflict) return { conflict: true }
      throw e
    }
    return { ok: true }
  }

  // hit
  const { patch, bust } = computeDealerHitPatch(state, dealerHandId)
  try {
    await commitRound(service, p.roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return { conflict: true }
    throw e
  }
  if (bust) {
    const fresh = await loadRoundState(service, p.roundId)
    if (fresh.round.phase === 'dealer_turn') {
      const { patch: sp } = computeDealerStandPatch(fresh, dealerHandId)
      await commitRound(service, p.roundId, fresh.round.version, sp).catch(() => {})
    }
  }
  return { ok: true }
}

/** Any client fires this if the human dealer's turn deadline passes — auto-stand. */
export async function dealerTimeout(roundId: string) {
  await requireUser()
  const service = createServiceClient()
  const state = await loadRoundState(service, roundId)
  const dealerHandId = state.round.dealer_hand_id
  if (state.round.phase !== 'dealer_turn' || !dealerHandId || state.round.active_hand_id !== dealerHandId) return { ok: true }
  if (!state.round.turn_deadline || Date.now() < new Date(state.round.turn_deadline).getTime()) return { tooEarly: true }
  const { patch } = computeDealerStandPatch(state, dealerHandId)
  try {
    await commitRound(service, roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return { conflict: true }
    throw e
  }
  return { ok: true }
}
