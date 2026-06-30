'use server'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'
import { requireUser } from '@/lib/game/auth'
import { loadRoundState } from '@/lib/game/load'
import { rulesFromConfig, type RoundState } from '@/lib/game/types'
import { legalActions, decideBet, decidePlay, type HandView, type Rank, type Suit } from '@/lib/blackjack'
import { dealerUpcard } from '@/lib/game/engine'
import { commitRound, freshShoe, VersionConflict } from '@/lib/game/commit'
import {
  computeActionPatch,
  computeDealPatch,
  computeDealerSettlePatch,
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
  await service.from('hands').insert(handRows)
  // Simultaneous betting: no per-seat turn — everyone bets at once against a
  // single shared deadline, so active_hand_id stays null during betting.

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
// Simultaneous betting — everyone bets at once against one shared deadline.
// Concurrent bets are serialized by reload+retry on the version guard, so two
// players locking in at the same moment never error out.
// ---------------------------------------------------------------------

const BetSchema = z.object({
  roundId: z.string().uuid(),
  seatId: z.string().uuid(),
  amount: z.coerce.number().int().nonnegative(), // 0 = pass (sit the round out)
})

/** A hand that has neither bet nor passed yet. */
function isUnacted(h: { is_dealer: boolean; status: string; bet_amount: number }) {
  return !h.is_dealer && h.status === 'betting' && h.bet_amount === 0
}

/** Lock in one hand's bet (or pass), retrying through version conflicts. When it
 *  was the last hand to act, flips the round to dealing and deals. */
async function commitBet(service: Service, roundId: string, handId: string, amount: number) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = await loadRoundState(service, roundId)
    if (state.round.phase !== 'betting') return { ok: true }
    const hand = state.hands.find((h) => h.id === handId)
    if (!hand || hand.is_dealer) return { ok: true }
    if (!isUnacted(hand)) return { ok: true } // already bet/passed — idempotent

    if (amount > 0) {
      const seat = state.seats.find((s) => s.id === hand.seat_id)
      if (seat && amount > seat.chip_stack) throw new Error('칩이 부족합니다.')
    }

    const patch: Parameters<typeof commitRound>[3] = { update_hands: [], round: {} }
    if (amount > 0) {
      patch.update_hands = [{ id: hand.id, bet_amount: amount }]
      patch.ledger = [{ seat_id: hand.seat_id!, round_id: roundId, hand_id: hand.id, type: 'bet', amount: -amount }]
    } else {
      patch.update_hands = [{ id: hand.id, status: 'settled' }] // passed → sits out
    }
    // Everyone (besides this hand) has acted → deal.
    const stillWaiting = state.hands.some((h) => h.id !== hand.id && isUnacted(h))
    if (!stillWaiting) patch.round = { phase: 'dealing', active_hand_id: null, turn_deadline: null }

    try {
      await commitRound(service, roundId, state.round.version, patch)
    } catch (e) {
      if (e instanceof VersionConflict) continue // reload + retry
      throw e
    }
    if (!stillWaiting) await dealOrVoid(service, roundId)
    return { ok: true }
  }
  return { conflict: true }
}

/** Place a bet (or pass with amount 0). No turn order — bet anytime in betting. */
export async function submitBet(input: z.input<typeof BetSchema>) {
  const user = await requireUser()
  const p = BetSchema.parse(input)
  const service = createServiceClient()
  const state = await loadRoundState(service, p.roundId)

  if (state.round.phase !== 'betting') throw new Error('베팅 단계가 아닙니다.')
  const seat = state.seats.find((s) => s.id === p.seatId)
  if (!seat || seat.user_id !== user.id) throw new Error('본인 자리가 아닙니다.')
  const hand = state.hands.find((h) => h.seat_id === p.seatId && !h.is_dealer)
  if (!hand) throw new Error('베팅할 핸드가 없습니다.')
  if (!isUnacted(hand)) return { ok: true } // already locked in

  if (p.amount > 0) {
    const cfg = state.config
    if (p.amount < cfg.min_bet || p.amount > cfg.max_bet) throw new Error(`베팅은 ${cfg.min_bet}~${cfg.max_bet} 사이여야 합니다.`)
    if (p.amount > seat.chip_stack) throw new Error('칩이 부족합니다.')
  }
  return commitBet(service, p.roundId, hand.id, p.amount)
}

/** Any client may fire this once the shared betting deadline has passed —
 *  auto-passes everyone who hasn't acted, then deals. */
export async function bettingTimeout(roundId: string) {
  await requireUser()
  const service = createServiceClient()
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = await loadRoundState(service, roundId)
    if (state.round.phase !== 'betting' || !state.round.turn_deadline) return { ok: true }
    if (Date.now() < new Date(state.round.turn_deadline).getTime()) return { tooEarly: true }
    const pending = state.hands.filter(isUnacted)
    const patch: Parameters<typeof commitRound>[3] = {
      update_hands: pending.map((h) => ({ id: h.id, status: 'settled' })),
      round: { phase: 'dealing', active_hand_id: null, turn_deadline: null },
    }
    try {
      await commitRound(service, roundId, state.round.version, patch)
    } catch (e) {
      if (e instanceof VersionConflict) continue
      throw e
    }
    await dealOrVoid(service, roundId)
    return { ok: true }
  }
  return { conflict: true }
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

/** Enter the dealer turn: the dealer hand ALWAYS auto-plays by fixed casino
 *  rules (stand on 17, no draw when every player has busted), for both AI and
 *  human "bank" dealers — the human dealer never manually hits/stands, they only
 *  hold the bank for settlement. */
async function runDealerSettle(service: Service, roundId: string, dealerHandId: string) {
  const state = await loadRoundState(service, roundId)
  if (state.round.phase !== 'dealer_turn') return
  const { patch } = computeDealerSettlePatch(state, dealerHandId)
  try {
    await commitRound(service, roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return
    throw e
  }
}

/** Drive the AI seat whose turn it is (betting or playing). Any client fires
 *  this when the active turn belongs to an AI; the server validates + applies. */
export async function aiAct(roundId: string) {
  await requireUser()
  const service = createServiceClient()
  const state = await loadRoundState(service, roundId)

  // Simultaneous betting: lock in every AI seat's bet (no turn order).
  if (state.round.phase === 'betting') {
    const aiHands = state.hands.filter(
      (h) => isUnacted(h) && state.seats.find((s) => s.id === h.seat_id)?.is_ai
    )
    for (const h of aiHands) {
      const seat = state.seats.find((s) => s.id === h.seat_id)!
      const amount = decideBet(rulesFromConfig(state.config), seat.chip_stack, state.config.min_bet, state.config.max_bet, seat.ai_difficulty)
      await commitBet(service, roundId, h.id, amount)
    }
    return { ok: true }
  }

  const activeId = state.round.active_hand_id
  if (!activeId) return { ok: true }
  const hand = state.hands.find((h) => h.id === activeId)
  const seat = state.seats.find((s) => s.id === hand?.seat_id)
  if (!hand || !seat || !seat.is_ai || seat.is_dealer) return { ok: true } // not an AI's turn
  const difficulty = seat.ai_difficulty

  if (state.round.phase === 'player_turns') {
    const cards = [...hand.cards]
      .sort((a, b) => a.card_index - b.card_index)
      .map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))
    const view: HandView = {
      cards,
      bet: hand.bet_amount,
      splitDepth: hand.split_depth,
      isDoubled: hand.is_doubled,
      fromSplit: hand.split_depth > 0,
      isSplitAces: hand.is_split_aces,
    }
    const rules = rulesFromConfig(state.config)
    const splitCount = state.hands.filter((h) => h.seat_id === seat.id && !h.is_dealer).length
    const legal = legalActions(view, rules, {
      availableChips: seat.chip_stack,
      currentSplitCount: splitCount,
      dealerUpcard: dealerUpcard(state),
    })
    const action = legal.length === 0 ? 'stand' : decidePlay(view, dealerUpcard(state), legal, difficulty)
    const { patch, enterDealer } = computeActionPatch(state, hand.id, action as Action)
    try {
      await commitRound(service, roundId, state.round.version, patch)
    } catch (e) {
      if (e instanceof VersionConflict) return { conflict: true }
      throw e
    }
    if (enterDealer && state.round.dealer_hand_id) await runDealerSettle(service, roundId, state.round.dealer_hand_id)
    return { ok: true }
  }
  return { ok: true }
}

