'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/game/auth'
import { minCashFlow, SeatNet } from '@/lib/settlement/min-cash-flow'
import type { SeatRow } from '@/lib/supabase/types'

export interface Standing {
  seatId: string
  displayName: string
  buyIn: number
  stack: number
  net: number
  isDealer: boolean
}

export interface SettlementResult {
  netBySeat: Standing[]
  transfers: { fromSeat: string; toSeat: string; amount: number }[]
}

/** Compute current standings + (for human dealer) the who-pays-whom transfers. */
function computeStandings(seats: SeatRow[], dealerType: string): SettlementResult {
  const netBySeat: Standing[] = seats.map((s) => ({
    seatId: s.id,
    displayName: s.display_name,
    buyIn: s.total_buy_in,
    stack: s.chip_stack,
    net: s.chip_stack - s.total_buy_in,
    isDealer: s.is_dealer,
  }))

  let transfers: { fromSeat: string; toSeat: string; amount: number }[] = []
  if (dealerType === 'human') {
    const nets: SeatNet[] = netBySeat.map((n) => ({ seatId: n.seatId, net: n.net }))
    transfers = minCashFlow(nets)
  }
  return { netBySeat, transfers }
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

/** Read-only current standings — does NOT close the room. For 중간정산. */
export async function interimSettlement(roomId: string): Promise<SettlementResult> {
  const user = await requireUser()
  const { service, room } = await loadHostRoom(roomId, user.id)
  const seats = await activeSeats(service, roomId)
  return computeStandings(seats, room.dealer_type)
}

/** Final settlement — computes, records, and closes the room. */
export async function computeSettlement(roomId: string) {
  const user = await requireUser()
  const { service, room } = await loadHostRoom(roomId, user.id)
  const seats = await activeSeats(service, roomId)
  const result = computeStandings(seats, room.dealer_type)

  const { data: settlement, error } = await service
    .from('settlements')
    .insert({ room_id: roomId, net_by_seat: result.netBySeat, transfers: result.transfers })
    .select('*')
    .single()
  if (error) throw new Error('정산 실패: ' + error.message)

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
