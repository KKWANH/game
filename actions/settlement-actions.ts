'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/game/auth'
import { minCashFlow, SeatNet } from '@/lib/settlement/min-cash-flow'
import { redistributeAiNet } from '@/lib/settlement/ai-redistribute'
import { DEFAULT_MONEY, type MoneyConfig } from '@/lib/money'
import type { RoomRow, SeatRow } from '@/lib/supabase/types'

export interface Standing {
  seatId: string
  displayName: string
  buyIn: number
  stack: number
  /** raw chip net (current stack − total buy-in) */
  net: number
  /** net actually used for who-owes-whom after AI seats are squared out */
  settleNet: number
  isDealer: boolean
  isAi: boolean
}

export interface SettlementResult {
  netBySeat: Standing[]
  transfers: { fromSeat: string; toSeat: string; amount: number }[]
  /** combined net held by AI seats — spread evenly across the human players */
  aiNet: number
  /** real-money stake (unit_chips coins = unit_amount of currency) */
  money: MoneyConfig
}

/** Read a room's real-money stake, defaulting to 1 coin = 1 KRW for rooms that
 *  predate migration 0008. */
function moneyFromRoom(room: RoomRow): MoneyConfig {
  return {
    currency: room.currency ?? DEFAULT_MONEY.currency,
    unitChips: room.unit_chips ?? DEFAULT_MONEY.unitChips,
    unitAmount: room.unit_amount ?? DEFAULT_MONEY.unitAmount,
  }
}

/** Compute current standings + (for human dealer) the who-pays-whom transfers.
 *
 *  AI seats hold real chips but aren't real people, so their combined net is
 *  spread evenly across the humans before settling — nobody ends up owing (or
 *  being owed by) a bot. "ai가 번 것은 공평하게 분배." */
function computeStandings(
  seats: SeatRow[],
  dealerType: string,
  money: MoneyConfig = DEFAULT_MONEY
): SettlementResult {
  const netBySeat: Standing[] = seats.map((s) => {
    const net = s.chip_stack - s.total_buy_in
    return {
      seatId: s.id,
      displayName: s.display_name,
      buyIn: s.total_buy_in,
      stack: s.chip_stack,
      net,
      settleNet: net,
      isDealer: s.is_dealer,
      isAi: s.is_ai,
    }
  })

  const { settleNet, aiNet } = redistributeAiNet(netBySeat)
  netBySeat.forEach((n) => (n.settleNet = settleNet[n.seatId]))

  let transfers: { fromSeat: string; toSeat: string; amount: number }[] = []
  if (dealerType === 'human') {
    // Human dealer is the bank: the table is zero-sum, so settle the humans
    // directly on their AI-adjusted nets.
    const nets: SeatNet[] = netBySeat
      .filter((n) => !n.isAi)
      .map((n) => ({ seatId: n.seatId, net: n.settleNet }))
    transfers = minCashFlow(nets)
  } else {
    // AI dealer = a virtual house (no real banker). The collective win/loss vs
    // the bot isn't real money, so friends settle only the DIFFERENCES between
    // each other: pool the result and bring everyone to the group average. The
    // luckier players compensate the unluckier ones; nobody pays a bot.
    const players = netBySeat.filter((n) => !n.isAi && !n.isDealer)
    if (players.length > 1) {
      const avg = players.reduce((sum, n) => sum + n.settleNet, 0) / players.length
      const pooled: SeatNet[] = players.map((n) => ({ seatId: n.seatId, net: Math.round(avg - n.settleNet) }))
      transfers = minCashFlow(pooled)
    }
  }
  return { netBySeat, transfers, aiNet, money }
}

async function loadHostRoom(roomId: string, userId: string) {
  const service = createServiceClient()
  const { data: room } = await service.from('rooms').select('*').eq('id', roomId).single()
  if (!room) throw new Error('방을 찾을 수 없습니다.')
  if (room.host_user_id !== userId) throw new Error('호스트만 가능합니다.')
  return { service, room }
}

async function activeSeats(service: ReturnType<typeof createServiceClient>, roomId: string) {
  const { data: seats } = await service
    .from('seats')
    .select('*')
    .eq('room_id', roomId)
    .neq('status', 'left')
  if (!seats) throw new Error('자리를 불러올 수 없습니다.')
  return seats
}

/** Insert a settlement row, gracefully degrading if migrations 0007/0008 (kind,
 *  currency, …) haven't been applied yet — never break the final-settlement path
 *  over a not-yet-applied column. */
async function insertSettlement(
  service: ReturnType<typeof createServiceClient>,
  row: {
    room_id: string
    net_by_seat: SettlementResult['netBySeat']
    transfers: SettlementResult['transfers']
    kind: 'interim' | 'final'
    currency: string
    unit_chips: number
    unit_amount: number
  }
) {
  const full = await service.from('settlements').insert(row).select('*').single()
  if (!full.error) return full.data
  // Likely the 0007/0008 columns don't exist yet — retry with the base shape.
  const { kind: _k, currency: _c, unit_chips: _uc, unit_amount: _ua, ...legacy } = row
  const { data, error } = await service.from('settlements').insert(legacy).select('*').single()
  if (error) throw new Error('정산 저장 실패: ' + error.message)
  return data
}

/** Read-only current standings — does NOT close the room. For 중간정산. */
export async function interimSettlement(roomId: string): Promise<SettlementResult> {
  const user = await requireUser()
  const { service, room } = await loadHostRoom(roomId, user.id)
  const seats = await activeSeats(service, roomId)
  return computeStandings(seats, room.dealer_type, moneyFromRoom(room))
}

/** Record a mid-game settlement so "중간 정산 완료" is visible to everyone —
 *  computes + persists (kind='interim') but does NOT close the room. */
export async function recordInterimSettlement(roomId: string): Promise<SettlementResult> {
  const user = await requireUser()
  const { service, room } = await loadHostRoom(roomId, user.id)
  await assertBetweenRounds(service, room.current_round_id)
  const seats = await activeSeats(service, roomId)
  const result = computeStandings(seats, room.dealer_type, moneyFromRoom(room))
  await insertSettlement(service, {
    room_id: roomId,
    net_by_seat: result.netBySeat,
    transfers: result.transfers,
    kind: 'interim',
    currency: result.money.currency,
    unit_chips: result.money.unitChips,
    unit_amount: result.money.unitAmount,
  })
  return result
}

/** Host sets the room's real-money stake: unit_chips coins = unit_amount of currency. */
export async function setRoomMoney(
  roomId: string,
  money: { currency: string; unitChips: number; unitAmount: number }
) {
  const user = await requireUser()
  const { service } = await loadHostRoom(roomId, user.id)
  const currency = (money.currency || 'KRW').slice(0, 3).toUpperCase()
  const unit_chips = Math.max(1, Math.floor(money.unitChips || 1))
  const unit_amount = Math.max(0, money.unitAmount || 0)
  const { error } = await service
    .from('rooms')
    .update({ currency, unit_chips, unit_amount })
    .eq('id', roomId)
  if (error) throw new Error('화폐 설정 실패 — 마이그레이션 0008을 먼저 적용하세요. (' + error.message + ')')
  return { ok: true, currency, unitChips: unit_chips, unitAmount: unit_amount }
}

export interface SeatLedger {
  seatId: string
  displayName: string
  isAi: boolean
  buyIn: number
  topUps: number
  entries: { type: string; amount: number; at: string }[]
}

/** Per-seat buy-in + top-up history (the 장부) — "각자 얼마를 걸고 충전했는지". */
export async function roomLedgerSummary(roomId: string): Promise<SeatLedger[]> {
  const user = await requireUser()
  const { service } = await loadHostRoom(roomId, user.id)
  const seats = await activeSeats(service, roomId)
  const { data: rows } = await service
    .from('chip_ledger')
    .select('seat_id, type, amount, created_at')
    .eq('room_id', roomId)
    .in('type', ['buy_in', 'adjustment'])
    .order('created_at', { ascending: true })

  return seats.map((s) => {
    const mine = (rows ?? []).filter((r) => r.seat_id === s.id)
    return {
      seatId: s.id,
      displayName: s.display_name,
      isAi: s.is_ai,
      buyIn: mine.filter((r) => r.type === 'buy_in').reduce((n, r) => n + r.amount, 0),
      topUps: mine.filter((r) => r.type === 'adjustment').reduce((n, r) => n + r.amount, 0),
      entries: mine.map((r) => ({ type: r.type, amount: r.amount, at: r.created_at })),
    }
  })
}

/** Final settlement — computes, records, and closes the room. */
export async function computeSettlement(roomId: string) {
  const user = await requireUser()
  const { service, room } = await loadHostRoom(roomId, user.id)
  const seats = await activeSeats(service, roomId)
  const result = computeStandings(seats, room.dealer_type, moneyFromRoom(room))

  const settlement = await insertSettlement(service, {
    room_id: roomId,
    net_by_seat: result.netBySeat,
    transfers: result.transfers,
    kind: 'final',
    currency: result.money.currency,
    unit_chips: result.money.unitChips,
    unit_amount: result.money.unitAmount,
  })

  await service.from('rooms').update({ status: 'settled' }).eq('id', roomId)
  return { settlementId: settlement.id, ...result }
}

/** Guard: redistribution is only allowed between hands (not mid-round). */
async function assertBetweenRounds(
  service: ReturnType<typeof createServiceClient>,
  currentRoundId: string | null
) {
  if (!currentRoundId) return
  const { data: round } = await service
    .from('game_rounds')
    .select('phase')
    .eq('id', currentRoundId)
    .maybeSingle()
  if (round && round.phase !== 'complete') {
    throw new Error('라운드 진행 중에는 재배분할 수 없습니다. 라운드를 끝낸 뒤 하세요.')
  }
}

/** Host transfers chips from one seat to another (재배분). */
export async function transferChips(
  roomId: string,
  fromSeatId: string,
  toSeatId: string,
  amount: number
) {
  const user = await requireUser()
  const { service, room } = await loadHostRoom(roomId, user.id)
  await assertBetweenRounds(service, room.current_round_id)

  const amt = Math.floor(amount)
  if (amt <= 0) throw new Error('금액은 0보다 커야 합니다.')
  if (fromSeatId === toSeatId) throw new Error('같은 자리로는 이체할 수 없습니다.')

  const seats = await activeSeats(service, roomId)
  const from = seats.find((s) => s.id === fromSeatId)
  const to = seats.find((s) => s.id === toSeatId)
  if (!from || !to) throw new Error('자리를 찾을 수 없습니다.')
  if (from.chip_stack < amt) throw new Error(`${from.display_name}의 칩이 부족합니다.`)

  await service.rpc('record_chip_movement', {
    p_seat_id: fromSeatId, p_round_id: null, p_hand_id: null, p_type: 'adjustment', p_amount: -amt,
  })
  await service.rpc('record_chip_movement', {
    p_seat_id: toSeatId, p_round_id: null, p_hand_id: null, p_type: 'adjustment', p_amount: amt,
  })
  return { ok: true }
}

/** Host rebalances every seat's stack to a target amount (재배분/리셋). */
export async function rebalanceChips(roomId: string, targetAmount: number) {
  const user = await requireUser()
  const { service, room } = await loadHostRoom(roomId, user.id)
  await assertBetweenRounds(service, room.current_round_id)

  const target = Math.floor(targetAmount)
  if (target < 0) throw new Error('목표 금액이 올바르지 않습니다.')

  const seats = await activeSeats(service, roomId)
  for (const s of seats) {
    if (s.is_dealer) continue // dealer/bank keeps its own stack
    const delta = target - s.chip_stack
    if (delta !== 0) {
      await service.rpc('record_chip_movement', {
        p_seat_id: s.id, p_round_id: null, p_hand_id: null, p_type: 'adjustment', p_amount: delta,
      })
    }
  }
  return { ok: true }
}
