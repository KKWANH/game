'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requireUser } from '@/lib/game/auth'

function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(40),
  dealerType: z.enum(['ai', 'human']),
  hostRole: z.enum(['player', 'dealer']),
  numDecks: z.coerce.number().int().min(1).max(8).default(6),
  minBet: z.coerce.number().int().positive().default(10),
  maxBet: z.coerce.number().int().positive().default(1000),
  blackjackPayout: z.enum(['3:2', '6:5']).default('3:2'),
  dealerHitsSoft17: z.coerce.boolean().default(false),
  maxSeats: z.coerce.number().int().min(1).max(7).default(6),
  turnTimer: z.coerce.number().int().min(5).max(120).default(30),
  startingChips: z.coerce.number().int().min(0).default(1000),
})

export type CreateRoomInput = z.input<typeof CreateRoomSchema>

export async function createRoom(input: CreateRoomInput) {
  const user = await requireUser()
  const p = CreateRoomSchema.parse(input)
  const service = createServiceClient()

  const code = makeRoomCode()
  const [bjNum, bjDen] = p.blackjackPayout === '6:5' ? [6, 5] : [3, 2]

  const { data: room, error: roomErr } = await service
    .from('rooms')
    .insert({
      code,
      name: p.name,
      host_user_id: user.id,
      status: 'lobby',
      dealer_type: p.dealerType,
    })
    .select('*')
    .single()
  if (roomErr || !room) throw new Error('방 생성 실패: ' + roomErr?.message)

  await service.from('room_config').insert({
    room_id: room.id,
    num_decks: p.numDecks,
    min_bet: p.minBet,
    max_bet: p.maxBet,
    blackjack_payout_num: bjNum,
    blackjack_payout_den: bjDen,
    dealer_hits_soft_17: p.dealerHitsSoft17,
    max_seats: p.maxSeats,
    turn_timer_seconds: p.turnTimer,
  })

  // Seat the host.
  const isDealer = p.dealerType === 'human' && p.hostRole === 'dealer'
  const { data: seat } = await service
    .from('seats')
    .insert({
      room_id: room.id,
      seat_index: isDealer ? 0 : 0,
      user_id: user.id,
      display_name: user.displayName,
      is_dealer: isDealer,
      chip_stack: 0,
    })
    .select('*')
    .single()

  if (seat) {
    if (isDealer) {
      await service.from('rooms').update({ dealer_seat_id: seat.id }).eq('id', room.id)
    }
    if (p.startingChips > 0) {
      await service.rpc('apply_buy_in', { p_seat_id: seat.id, p_amount: p.startingChips })
    }
  }

  return { roomId: room.id, code: room.code }
}

export async function joinRoomByCode(code: string) {
  await requireUser()
  const service = createServiceClient()
  const { data: room } = await service
    .from('rooms')
    .select('id, code, status')
    .eq('code', code.toUpperCase())
    .maybeSingle()
  if (!room) throw new Error('방을 찾을 수 없습니다.')
  if (room.status === 'closed') throw new Error('이미 종료된 방입니다.')
  return { roomId: room.id, code: room.code }
}

const TakeSeatSchema = z.object({
  roomId: z.string().uuid(),
  seatIndex: z.number().int().min(0).max(6).optional(),
  asDealer: z.boolean().default(false),
  startingChips: z.coerce.number().int().min(0).default(1000),
})

export async function takeSeat(input: z.input<typeof TakeSeatSchema>) {
  const user = await requireUser()
  const p = TakeSeatSchema.parse(input)
  const service = createServiceClient()

  const { data: config } = await service
    .from('room_config')
    .select('max_seats')
    .eq('room_id', p.roomId)
    .single()
  if (!config) throw new Error('방 설정을 찾을 수 없습니다.')

  const { data: seats } = await service.from('seats').select('*').eq('room_id', p.roomId)
  const existing = (seats ?? []).find((s) => s.user_id === user.id && s.status !== 'left')
  if (existing) return { seatId: existing.id }

  // Choose a free seat index.
  const taken = new Set((seats ?? []).filter((s) => s.status !== 'left').map((s) => s.seat_index))
  let index = p.seatIndex
  if (index === undefined || taken.has(index)) {
    index = undefined
    for (let i = 0; i < config.max_seats; i++) {
      if (!taken.has(i)) {
        index = i
        break
      }
    }
  }
  if (index === undefined) throw new Error('빈 자리가 없습니다.')

  const { data: seat, error } = await service
    .from('seats')
    .insert({
      room_id: p.roomId,
      seat_index: index,
      user_id: user.id,
      display_name: user.displayName,
      is_dealer: p.asDealer,
      chip_stack: 0,
    })
    .select('*')
    .single()
  if (error || !seat) throw new Error('착석 실패: ' + error?.message)

  if (p.asDealer) {
    await service.from('rooms').update({ dealer_seat_id: seat.id }).eq('id', p.roomId)
  }
  if (p.startingChips > 0) {
    await service.rpc('apply_buy_in', { p_seat_id: seat.id, p_amount: p.startingChips })
  }
  return { seatId: seat.id }
}

export async function buyIn(seatId: string, amount: number) {
  await requireUser()
  const service = createServiceClient()
  const { data, error } = await service.rpc('apply_buy_in', {
    p_seat_id: seatId,
    p_amount: Math.floor(amount),
  })
  if (error) throw new Error('충전 실패: ' + error.message)
  return { stack: data as number }
}

export async function leaveSeat(seatId: string) {
  await requireUser()
  const service = createServiceClient()
  await service.from('seats').update({ status: 'left', user_id: null }).eq('id', seatId)
}

const DIFF_LABEL: Record<string, string> = { easy: '쉬움', normal: '보통', hard: '어려움' }

/** Host adds an AI player to an empty seat. */
export async function addAiSeat(roomId: string, difficulty: 'easy' | 'normal' | 'hard' = 'normal', startingChips = 1000) {
  const user = await requireUser()
  const service = createServiceClient()

  const { data: room } = await service.from('rooms').select('host_user_id').eq('id', roomId).single()
  if (!room || room.host_user_id !== user.id) throw new Error('호스트만 AI를 추가할 수 있습니다.')

  const { data: config } = await service.from('room_config').select('max_seats').eq('room_id', roomId).single()
  const { data: seats } = await service.from('seats').select('seat_index, status').eq('room_id', roomId)
  const taken = new Set((seats ?? []).filter((s) => s.status !== 'left').map((s) => s.seat_index))
  let index: number | undefined
  for (let i = 0; i < (config?.max_seats ?? 6); i++) {
    if (!taken.has(i)) { index = i; break }
  }
  if (index === undefined) throw new Error('빈 자리가 없습니다.')

  const { data: seat, error } = await service
    .from('seats')
    .insert({
      room_id: roomId,
      seat_index: index,
      user_id: null,
      display_name: `🤖 AI (${DIFF_LABEL[difficulty]})`,
      is_dealer: false,
      is_ai: true,
      ai_difficulty: difficulty,
      chip_stack: 0,
    })
    .select('id')
    .single()
  if (error || !seat) throw new Error('AI 추가 실패: ' + error?.message)
  if (startingChips > 0) await service.rpc('apply_buy_in', { p_seat_id: seat.id, p_amount: startingChips })
  return { seatId: seat.id }
}

/** Host removes a seat (AI or, as a kick, a player). */
export async function removeSeat(roomId: string, seatId: string) {
  const user = await requireUser()
  const service = createServiceClient()
  const { data: room } = await service.from('rooms').select('host_user_id').eq('id', roomId).single()
  if (!room || room.host_user_id !== user.id) throw new Error('호스트만 가능합니다.')
  await service.from('seats').update({ status: 'left', user_id: null }).eq('id', seatId)
  return { ok: true }
}

export async function closeRoom(roomId: string) {
  const user = await requireUser()
  const service = createServiceClient()
  const { data: room } = await service.from('rooms').select('host_user_id').eq('id', roomId).single()
  if (!room || room.host_user_id !== user.id) throw new Error('호스트만 방을 닫을 수 있습니다.')
  await service.from('rooms').update({ status: 'closed' }).eq('id', roomId)
  revalidatePath(`/rooms`)
}
