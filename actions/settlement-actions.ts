'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/game/auth'
import { minCashFlow, SeatNet } from '@/lib/settlement/min-cash-flow'

/**
 * Host ends the room and computes the final settlement. Each seat's net is
 * (current stack − total buy-in). For a human dealer the dealer seat is part of
 * the transfer graph; for an AI dealer players are simply up/down vs the house
 * and no peer-to-peer transfers are produced.
 */
export async function computeSettlement(roomId: string) {
  const user = await requireUser()
  const service = createServiceClient()

  const { data: room } = await service.from('rooms').select('*').eq('id', roomId).single()
  if (!room) throw new Error('방을 찾을 수 없습니다.')
  if (room.host_user_id !== user.id) throw new Error('호스트만 정산할 수 있습니다.')

  const { data: seats } = await service
    .from('seats')
    .select('*')
    .eq('room_id', roomId)
    .neq('status', 'left')
  if (!seats) throw new Error('자리를 불러올 수 없습니다.')

  const netBySeat = seats.map((s) => ({
    seatId: s.id,
    displayName: s.display_name,
    buyIn: s.total_buy_in,
    stack: s.chip_stack,
    net: s.chip_stack - s.total_buy_in,
    isDealer: s.is_dealer,
  }))

  let transfers: { fromSeat: string; toSeat: string; amount: number }[] = []
  if (room.dealer_type === 'human') {
    const nets: SeatNet[] = netBySeat.map((n) => ({ seatId: n.seatId, net: n.net }))
    transfers = minCashFlow(nets)
  }

  const { data: settlement, error } = await service
    .from('settlements')
    .insert({
      room_id: roomId,
      net_by_seat: netBySeat,
      transfers,
    })
    .select('*')
    .single()
  if (error) throw new Error('정산 실패: ' + error.message)

  await service.from('rooms').update({ status: 'settled' }).eq('id', roomId)

  return { settlementId: settlement.id, netBySeat, transfers }
}
