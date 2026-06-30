'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

export interface AdminRoom {
  id: string
  code: string
  name: string
  status: string
  dealerType: string
  hostName: string
  humans: number
  ais: number
  phase: string | null
  createdAt: string
}

async function requireAdmin() {
  const user = await getUser()
  if (!user || !isAdmin(user.email)) throw new Error('관리자만 접근할 수 있습니다.')
  return createServiceClient()
}

/** Every room (any status), newest first, with player counts + host name. */
export async function listAllRooms(): Promise<AdminRoom[]> {
  const service = await requireAdmin()
  const { data: rooms } = await service
    .from('rooms')
    .select('id, code, name, status, dealer_type, host_user_id, current_round_id, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (!rooms?.length) return []

  const ids = rooms.map((r) => r.id)
  const roundIds = rooms.map((r) => r.current_round_id).filter(Boolean) as string[]
  const [{ data: seats }, { data: rounds }] = await Promise.all([
    service.from('seats').select('room_id, display_name, is_dealer, is_ai, user_id, status').in('room_id', ids).neq('status', 'left'),
    roundIds.length
      ? service.from('game_rounds').select('id, phase').in('id', roundIds)
      : Promise.resolve({ data: [] as { id: string; phase: string }[] }),
  ])

  return rooms.map((r) => {
    const rs = (seats ?? []).filter((s) => s.room_id === r.id)
    const host = rs.find((s) => s.user_id === r.host_user_id)
    const round = (rounds ?? []).find((x) => x.id === r.current_round_id)
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      status: r.status,
      dealerType: r.dealer_type,
      hostName: host?.display_name ?? '—',
      humans: rs.filter((s) => !s.is_dealer && !s.is_ai && s.user_id).length,
      ais: rs.filter((s) => s.is_ai).length,
      phase: round?.phase ?? null,
      createdAt: r.created_at,
    }
  })
}

/** Close a room (keeps the record, removes it from the open browser). */
export async function adminCloseRoom(roomId: string) {
  const service = await requireAdmin()
  await service.from('rooms').update({ status: 'closed' }).eq('id', roomId)
  return { ok: true }
}

/** Permanently delete a room and all its rows (cascade). */
export async function adminDeleteRoom(roomId: string) {
  const service = await requireAdmin()
  await service.from('rooms').delete().eq('id', roomId)
  return { ok: true }
}

/** Bulk close rooms that look abandoned: lobby/active with zero human seats. */
export async function adminCloseEmptyRooms() {
  const service = await requireAdmin()
  const rooms = await listAllRooms()
  const empty = rooms.filter((r) => (r.status === 'lobby' || r.status === 'active') && r.humans === 0)
  for (const r of empty) await service.from('rooms').update({ status: 'closed' }).eq('id', r.id)
  return { closed: empty.length }
}
