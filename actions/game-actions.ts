'use server'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'
import { requireUser } from '@/lib/game/auth'
import { loadRoundState } from '@/lib/game/load'
import { commitRound, freshShoe, VersionConflict } from '@/lib/game/commit'
import {
  computeActionPatch,
  computeDealPatch,
  computeDealerSettlePatch,
} from '@/lib/game/engine'
import type { Action } from '@/lib/blackjack'
import { SEAT_ORDER_GAP } from '@/lib/game/engine'

type Service = SupabaseClient<Database>

// ---------------------------------------------------------------------
// Round lifecycle
// ---------------------------------------------------------------------

/** Host starts a fresh betting round. Creates the round + secret shoe. */
export async function startRound(roomId: string) {
  const user = await requireUser()
  const service = createServiceClient()

  const { data: room } = await service.from('rooms').select('*').eq('id', roomId).single()
  if (!room) throw new Error('방을 찾을 수 없습니다.')
  if (room.host_user_id !== user.id) throw new Error('호스트만 시작할 수 있습니다.')

  const { data: config } = await service
    .from('room_config')
    .select('*')
    .eq('room_id', roomId)
    .single()
  if (!config) throw new Error('방 설정이 없습니다.')

  const { data: lastRound } = await service
    .from('game_rounds')
    .select('round_number')
    .eq('room_id', roomId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const roundNumber = (lastRound?.round_number ?? 0) + 1

  const { data: round, error } = await service
    .from('game_rounds')
    .insert({
      room_id: roomId,
      round_number: roundNumber,
      phase: 'betting',
      config_snapshot: config,
      version: 0,
    })
    .select('*')
    .single()
  if (error || !round) throw new Error('라운드 생성 실패: ' + error?.message)

  // Shuffle a fresh shoe (server-only) and stash it via the definer RPC.
  const shoe = freshShoe(config.num_decks)
  await service.rpc('create_round_secret', { p_round_id: round.id, p_deck: shoe })

  await service
    .from('rooms')
    .update({ status: 'active', current_round_id: round.id })
    .eq('id', roomId)

  return { roundId: round.id }
}

const BetSchema = z.object({
  roundId: z.string().uuid(),
  seatId: z.string().uuid(),
  amount: z.coerce.number().int().positive(),
})

/** Place (or update) a bet during the betting phase. */
export async function placeBet(input: z.input<typeof BetSchema>) {
  const user = await requireUser()
  const p = BetSchema.parse(input)
  const service = createServiceClient()

  const state = await loadRoundState(service, p.roundId)
  if (state.round.phase !== 'betting') throw new Error('베팅 단계가 아닙니다.')

  const seat = state.seats.find((s) => s.id === p.seatId)
  if (!seat || seat.user_id !== user.id) throw new Error('본인 자리에만 베팅할 수 있습니다.')
  if (seat.is_dealer) throw new Error('딜러는 베팅하지 않습니다.')

  const cfg = state.config
  if (p.amount < cfg.min_bet || p.amount > cfg.max_bet) {
    throw new Error(`베팅은 ${cfg.min_bet}~${cfg.max_bet} 사이여야 합니다.`)
  }

  const existing = state.hands.find((h) => h.seat_id === p.seatId && !h.is_dealer)
  const prev = existing?.bet_amount ?? 0
  const delta = p.amount - prev
  if (delta > seat.chip_stack) throw new Error('칩이 부족합니다.')

  let handId = existing?.id
  if (!existing) {
    const { data: hand, error } = await service
      .from('hands')
      .insert({
        round_id: p.roundId,
        seat_id: p.seatId,
        is_dealer: false,
        bet_amount: p.amount,
        status: 'betting',
        seat_order: seat.seat_index * SEAT_ORDER_GAP,
      })
      .select('id')
      .single()
    if (error || !hand) throw new Error('베팅 실패: ' + error?.message)
    handId = hand.id
  } else {
    await service.from('hands').update({ bet_amount: p.amount }).eq('id', existing.id)
  }

  // Escrow the chip delta (negative = chips leave the stack).
  await service.rpc('record_chip_movement', {
    p_seat_id: p.seatId,
    p_round_id: p.roundId,
    p_hand_id: handId!,
    p_type: 'bet',
    p_amount: -delta,
  })

  return { ok: true }
}

/** Host deals once at least one bet is in. Transitions betting -> player_turns. */
export async function deal(roundId: string) {
  const user = await requireUser()
  const service = createServiceClient()
  const state = await loadRoundState(service, roundId)

  if (state.room.host_user_id !== user.id) throw new Error('호스트만 딜할 수 있습니다.')
  if (state.round.phase !== 'betting') throw new Error('베팅 단계가 아닙니다.')

  const bettingHands = state.hands.filter((h) => !h.is_dealer && h.bet_amount > 0)
  if (bettingHands.length === 0) throw new Error('베팅한 플레이어가 없습니다.')

  const dealerHandId = crypto.randomUUID()
  const { patch, holeCard } = computeDealPatch(state, dealerHandId)

  // Add the dealer hand row to the patch.
  patch.insert_hands = [
    {
      id: dealerHandId,
      round_id: roundId,
      seat_id: state.room.dealer_seat_id ?? null,
      is_dealer: true,
      status: 'active',
      seat_order: 999999,
    },
    ...(patch.insert_hands ?? []),
  ]

  // Stash the secret hole card before committing public state.
  await service.rpc('set_dealer_hole_card', { p_round_id: roundId, p_card: holeCard })

  await commitRound(service, roundId, state.round.version, patch)

  // If everyone had a natural, jump straight to dealer + settlement.
  if (patch.round?.phase === 'dealer_turn') {
    await runDealerSettle(service, roundId, dealerHandId)
  }
  return { ok: true }
}

const ActionSchema = z.object({
  roundId: z.string().uuid(),
  handId: z.string().uuid(),
  action: z.enum(['hit', 'stand', 'double', 'split', 'surrender', 'insurance']),
  insuranceBet: z.coerce.number().int().nonnegative().optional(),
})

/** A seated player acts on their active hand. */
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

  const { patch, enterDealer } = computeActionPatch(state, p.handId, p.action as Action, {
    insuranceBet: p.insuranceBet,
  })

  // Split needs the original hand's stale index-1 card overwritten — the engine
  // emits an upsert card for that, handled by the RPC.
  try {
    await commitRound(service, p.roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return { conflict: true }
    throw e
  }

  if (enterDealer) {
    const dealerHandId = state.round.dealer_hand_id
    if (dealerHandId) await runDealerSettle(service, p.roundId, dealerHandId)
  }
  return { ok: true }
}

/** Any client may fire this once the server-side deadline has passed. */
export async function timeoutTurn(roundId: string) {
  await requireUser()
  const service = createServiceClient()
  const state = await loadRoundState(service, roundId)

  if (state.round.phase !== 'player_turns' || !state.round.active_hand_id) return { ok: true }
  if (!state.round.turn_deadline) return { ok: true }
  // Trust the DB-authored deadline, never the client clock.
  if (Date.now() < new Date(state.round.turn_deadline).getTime()) {
    return { tooEarly: true }
  }

  const { patch, enterDealer } = computeActionPatch(
    state,
    state.round.active_hand_id,
    'stand'
  )
  try {
    await commitRound(service, roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return { conflict: true } // someone already acted
    throw e
  }
  if (enterDealer && state.round.dealer_hand_id) {
    await runDealerSettle(service, roundId, state.round.dealer_hand_id)
  }
  return { ok: true }
}

/** Internal: reveal hole, auto-play the dealer, settle, pay out. */
async function runDealerSettle(service: Service, roundId: string, dealerHandId: string) {
  // Reload to get the freshest version after the action that entered dealer turn.
  const state = await loadRoundState(service, roundId)
  if (state.round.phase !== 'dealer_turn') return
  const { patch } = computeDealerSettlePatch(state, dealerHandId)
  try {
    await commitRound(service, roundId, state.round.version, patch)
  } catch (e) {
    if (e instanceof VersionConflict) return // a retry/cron already settled
    throw e
  }
}

/** Host begins the next hand after settlement. */
export async function nextRound(roomId: string) {
  return startRound(roomId)
}
