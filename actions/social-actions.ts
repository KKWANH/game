'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/game/auth'

// ---------------------------------------------------------------------
// Social phase 2 — profiles (member directory) + friendships. All writes go
// through the service client (RLS only grants SELECT). Everything tolerates the
// 0010 tables being absent so the UI degrades to empty instead of crashing.
// ---------------------------------------------------------------------

type Svc = ReturnType<typeof createServiceClient>

/** Canonical ordered pair so each relationship is a single row. */
function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export interface PlayerStats {
  hands: number
  wins: number
  losses: number
  pushes: number
  blackjacks: number
  net: number
}

const ZERO_STATS: PlayerStats = { hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, net: 0 }

/** Lifetime stats for the caller (or a given user). Tolerates 0011 absent. */
export async function getStats(userId?: string): Promise<PlayerStats> {
  try {
    const user = await requireUser()
    const service = createServiceClient()
    const { data, error } = await service
      .from('player_stats')
      .select('*')
      .eq('user_id', userId ?? user.id)
      .maybeSingle()
    if (error || !data) return ZERO_STATS
    return { hands: data.hands, wins: data.wins, losses: data.losses, pushes: data.pushes, blackjacks: data.blackjacks, net: data.net }
  } catch {
    return ZERO_STATS
  }
}

/** Upsert the caller's public profile (called on lobby load). Best-effort. */
export async function ensureProfile() {
  try {
    const user = await requireUser()
    const service = createServiceClient()
    await service.from('profiles').upsert({
      id: user.id,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      updated_at: new Date().toISOString(),
    })
  } catch {
    // table missing (pre-0010) or transient — ignore
  }
  return { ok: true }
}

export type FriendStatus = 'none' | 'friends' | 'incoming' | 'outgoing'

export interface Member {
  id: string
  name: string
  avatar: string | null
  status: FriendStatus
}

export interface Friend {
  id: string
  name: string
  avatar: string | null
  /** code of a joinable room they're currently in, if any */
  roomCode: string | null
}

/** Map each user id → code of a lobby/active room they occupy (for "join"). */
async function currentRooms(service: Svc, userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  const { data: seats } = await service
    .from('seats')
    .select('user_id, room_id')
    .in('user_id', userIds)
    .neq('status', 'left')
  const roomIds = Array.from(new Set((seats ?? []).map((s) => s.room_id)))
  if (roomIds.length === 0) return {}
  const { data: rooms } = await service
    .from('rooms')
    .select('id, code, status')
    .in('id', roomIds)
    .in('status', ['lobby', 'active'])
  const codeByRoom = new Map((rooms ?? []).map((r) => [r.id, r.code]))
  const out: Record<string, string> = {}
  for (const s of seats ?? []) {
    if (s.user_id && codeByRoom.has(s.room_id)) out[s.user_id] = codeByRoom.get(s.room_id)!
  }
  return out
}

/** The caller's friends (accepted) + pending requests in/out, with live room. */
export async function listFriends(): Promise<{ friends: Friend[]; incoming: Member[]; outgoing: Member[] }> {
  const empty = { friends: [], incoming: [], outgoing: [] }
  try {
    const user = await requireUser()
    const service = createServiceClient()
    const { data: rows, error } = await service
      .from('friendships')
      .select('*')
      .or(`user_low.eq.${user.id},user_high.eq.${user.id}`)
    if (error || !rows) return empty

    const otherOf = (r: (typeof rows)[number]) => (r.user_low === user.id ? r.user_high : r.user_low)
    const ids = rows.map(otherOf)
    const { data: profs } = await service.from('profiles').select('*').in('id', ids.length ? ids : ['x'])
    const p = new Map((profs ?? []).map((x) => [x.id, x]))
    const name = (id: string) => p.get(id)?.display_name ?? '플레이어'
    const avatar = (id: string) => p.get(id)?.avatar_url ?? null

    const acceptedIds = rows.filter((r) => r.status === 'accepted').map(otherOf)
    const rooms = await currentRooms(service, acceptedIds)

    const friends: Friend[] = rows
      .filter((r) => r.status === 'accepted')
      .map((r) => ({ id: otherOf(r), name: name(otherOf(r)), avatar: avatar(otherOf(r)), roomCode: rooms[otherOf(r)] ?? null }))
    const incoming: Member[] = rows
      .filter((r) => r.status === 'pending' && r.requested_by !== user.id)
      .map((r) => ({ id: otherOf(r), name: name(otherOf(r)), avatar: avatar(otherOf(r)), status: 'incoming' as const }))
    const outgoing: Member[] = rows
      .filter((r) => r.status === 'pending' && r.requested_by === user.id)
      .map((r) => ({ id: otherOf(r), name: name(otherOf(r)), avatar: avatar(otherOf(r)), status: 'outgoing' as const }))
    return { friends, incoming, outgoing }
  } catch {
    return empty
  }
}

/** Directory of other members, with the caller's relationship to each. */
export async function listMembers(query?: string): Promise<Member[]> {
  try {
    const user = await requireUser()
    const service = createServiceClient()
    let q = service.from('profiles').select('*').neq('id', user.id).order('updated_at', { ascending: false }).limit(60)
    if (query && query.trim()) q = q.ilike('display_name', `%${query.trim()}%`)
    const { data: profs, error } = await q
    if (error || !profs) return []

    const { data: rels } = await service
      .from('friendships')
      .select('*')
      .or(`user_low.eq.${user.id},user_high.eq.${user.id}`)
    const relOf = (otherId: string): FriendStatus => {
      const [low, high] = pair(user.id, otherId)
      const r = (rels ?? []).find((x) => x.user_low === low && x.user_high === high)
      if (!r) return 'none'
      if (r.status === 'accepted') return 'friends'
      return r.requested_by === user.id ? 'outgoing' : 'incoming'
    }
    return profs.map((x) => ({ id: x.id, name: x.display_name, avatar: x.avatar_url, status: relOf(x.id) }))
  } catch {
    return []
  }
}

/** Send (or auto-accept a reciprocal) friend request. */
export async function sendFriendRequest(targetId: string) {
  const user = await requireUser()
  if (targetId === user.id) throw new Error('본인에게는 보낼 수 없습니다.')
  const service = createServiceClient()
  const [low, high] = pair(user.id, targetId)
  const { data: existing } = await service.from('friendships').select('*').eq('user_low', low).eq('user_high', high).maybeSingle()
  if (existing) {
    // A pending request from the other person → accept it.
    if (existing.status === 'pending' && existing.requested_by !== user.id) {
      await service.from('friendships').update({ status: 'accepted' }).eq('user_low', low).eq('user_high', high)
    }
    return { ok: true }
  }
  const { error } = await service.from('friendships').insert({ user_low: low, user_high: high, status: 'pending', requested_by: user.id })
  if (error) throw new Error('친구 요청 실패 — 마이그레이션 0010을 먼저 적용하세요.')
  return { ok: true }
}

/** Accept or decline an incoming request. */
export async function respondFriend(otherId: string, accept: boolean) {
  const user = await requireUser()
  const service = createServiceClient()
  const [low, high] = pair(user.id, otherId)
  if (accept) {
    await service.from('friendships').update({ status: 'accepted' }).eq('user_low', low).eq('user_high', high)
  } else {
    await service.from('friendships').delete().eq('user_low', low).eq('user_high', high)
  }
  return { ok: true }
}

/** Remove a friend (or cancel an outgoing request). */
export async function removeFriend(otherId: string) {
  const user = await requireUser()
  const service = createServiceClient()
  const [low, high] = pair(user.id, otherId)
  await service.from('friendships').delete().eq('user_low', low).eq('user_high', high)
  return { ok: true }
}

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

  const mapped = rooms.map((r) => {
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

  // Auto-close rooms nobody is in anymore (catches ghosts from dropped tabs /
  // failed leave beacons) so the browser only ever lists live rooms.
  const dead = mapped.filter((r) => r.humans === 0 && !r.joined)
  for (const r of dead) {
    await service.from('rooms').update({ status: 'closed' }).eq('id', r.id)
  }
  return mapped.filter((r) => r.humans > 0 || r.joined)
}
