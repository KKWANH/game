'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/game/auth'

export interface OpenRoom {
  id: string
  code: string
  name: string
  dealerType: 'ai' | 'human'
  status: 'lobby' | 'active'
  hostName: string
  humans: number
  ais: number
  maxSeats: number
  minBet: number
  maxBet: number
  /** true if the caller already has a (non-left) seat here */
  joined: boolean
}

/** Browse joinable rooms (소셜 — 친구 방 찾기). Lobby + active, newest first.
 *  Uses the service client so we can attach player counts + host name in one go,
 *  but only returns the non-sensitive lobby card fields. */
export async function listOpenRooms(): Promise<OpenRoom[]> {
  const user = await requireUser()
  const service = createServiceClient()

  const { data: rooms } = await service
    .from('rooms')
    .select('id, code, name, dealer_type, status, host_user_id, created_at')
    .in('status', ['lobby', 'active'])
    .order('created_at', { ascending: false })
    .limit(60)
  if (!rooms?.length) return []

  const ids = rooms.map((r) => r.id)
  const [{ data: seats }, { data: configs }] = await Promise.all([
    service
      .from('seats')
      .select('room_id, display_name, is_dealer, is_ai, user_id, status')
      .in('room_id', ids)
      .neq('status', 'left'),
    service.from('room_config').select('room_id, min_bet, max_bet, max_seats').in('room_id', ids),
  ])

  return rooms.map((r) => {
    const rs = (seats ?? []).filter((s) => s.room_id === r.id)
    const cfg = (configs ?? []).find((c) => c.room_id === r.id)
    const host = rs.find((s) => s.user_id === r.host_user_id)
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      dealerType: r.dealer_type,
      status: r.status as 'lobby' | 'active',
      hostName: host?.display_name ?? '호스트',
      humans: rs.filter((s) => !s.is_dealer && !s.is_ai && s.user_id).length,
      ais: rs.filter((s) => s.is_ai).length,
      maxSeats: cfg?.max_seats ?? 7,
      minBet: cfg?.min_bet ?? 10,
      maxBet: cfg?.max_bet ?? 1000,
      joined: rs.some((s) => s.user_id === user.id),
    }
  })
}
