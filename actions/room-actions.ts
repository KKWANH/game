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
  currency: z.string().min(1).max(3).default('KRW'),
  unitChips: z.coerce.number().int().min(1).default(1),
  unitAmount: z.coerce.number().min(0).default(1),
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

  // Real-money stake (migration 0008). Best-effort so room creation never breaks
  // if the columns aren't there yet — the stake just defaults to 1코인 = 1원.
  if (p.currency !== 'KRW' || p.unitChips !== 1 || p.unitAmount !== 1) {
    await service
      .from('rooms')
      .update({
        currency: p.currency.toUpperCase(),
        unit_chips: p.unitChips,
        unit_amount: p.unitAmount,
      })
      .eq('id', room.id)
  }

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
  const { data: seat } = await service.from('seats').select('room_id').eq('id', seatId).single()
  await service.from('seats').update({ status: 'left', user_id: null }).eq('id', seatId)

  // If that was the last human in the room, close it so it stops showing as open.
  if (seat) {
    const { data: remaining } = await service
      .from('seats')
      .select('id, is_ai, user_id')
      .eq('room_id', seat.room_id)
      .neq('status', 'left')
    const humansLeft = (remaining ?? []).some((s) => !s.is_ai && s.user_id)
    if (!humansLeft) await service.from('rooms').update({ status: 'closed' }).eq('id', seat.room_id)
  }
  return { ok: true }
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

async function requireHost(roomId: string) {
  const user = await requireUser()
  const service = createServiceClient()
  const { data: room } = await service.from('rooms').select('host_user_id').eq('id', roomId).single()
  if (!room || room.host_user_id !== user.id) throw new Error('호스트만 가능합니다.')
  return service
}

/** Pause/resume the auto-next loop so the host can change settings between rounds. */
export async function setRoomPaused(roomId: string, paused: boolean) {
  const service = await requireHost(roomId)
  const { error } = await service.from('rooms').update({ paused }).eq('id', roomId)
  if (error) throw new Error('일시정지 실패 — 마이그레이션 0009를 먼저 적용하세요. (' + error.message + ')')
  return { ok: true, paused }
}

/** Guard: dealer/role changes only allowed between rounds. */
async function assertBetweenRounds(service: ReturnType<typeof createServiceClient>, roomId: string) {
  const { data: room } = await service.from('rooms').select('current_round_id').eq('id', roomId).single()
  if (!room?.current_round_id) return
  const { data: round } = await service.from('game_rounds').select('phase').eq('id', room.current_round_id).maybeSingle()
  if (round && round.phase !== 'complete') {
    throw new Error('라운드 진행 중에는 바꿀 수 없습니다. 라운드를 끝낸 뒤(또는 멈춘 뒤) 하세요.')
  }
}

/** Host takes (or gives up) the dealer/bank role. Their own seat becomes the
 *  dealer — the dealer hand still auto-plays; they just hold the bank. Applies
 *  from the next round. */
export async function setDealerRole(roomId: string, beDealer: boolean) {
  const service = await requireHost(roomId)
  await assertBetweenRounds(service, roomId)
  const { data: room } = await service.from('rooms').select('host_user_id').eq('id', roomId).single()
  if (!room) throw new Error('방을 찾을 수 없습니다.')

  const { data: hostSeat } = await service
    .from('seats')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', room.host_user_id)
    .neq('status', 'left')
    .maybeSingle()
  if (!hostSeat) throw new Error('먼저 자리에 앉아주세요.')

  if (beDealer) {
    // Only one dealer: demote any current dealer seat back to a player.
    await service.from('seats').update({ is_dealer: false }).eq('room_id', roomId).eq('is_dealer', true)
    await service.from('seats').update({ is_dealer: true }).eq('id', hostSeat.id)
    await service.from('rooms').update({ dealer_type: 'human', dealer_seat_id: hostSeat.id }).eq('id', roomId)
  } else {
    await service.from('seats').update({ is_dealer: false }).eq('id', hostSeat.id)
    await service.from('rooms').update({ dealer_type: 'ai', dealer_seat_id: null }).eq('id', roomId)
  }
  return { ok: true, beDealer }
}

const RoomSettingsSchema = z.object({
  minBet: z.coerce.number().int().min(1).optional(),
  maxBet: z.coerce.number().int().min(1).optional(),
  numDecks: z.coerce.number().int().min(1).max(8).optional(),
  turnTimer: z.coerce.number().int().min(5).max(120).optional(),
})

/** Host updates game settings — takes effect on the NEXT round (each round
 *  snapshots its own config, so a live round is never disturbed). */
export async function updateRoomSettings(roomId: string, input: z.input<typeof RoomSettingsSchema>) {
  const service = await requireHost(roomId)
  const p = RoomSettingsSchema.parse(input)
  const patch: Partial<{ min_bet: number; max_bet: number; num_decks: number; turn_timer_seconds: number }> = {}
  if (p.minBet != null) patch.min_bet = p.minBet
  if (p.maxBet != null) patch.max_bet = p.maxBet
  if (p.numDecks != null) patch.num_decks = p.numDecks
  if (p.turnTimer != null) patch.turn_timer_seconds = p.turnTimer
  if (patch.min_bet != null && patch.max_bet != null && patch.min_bet > patch.max_bet) {
    throw new Error('최소 베팅이 최대 베팅보다 큽니다.')
  }
  if (Object.keys(patch).length === 0) return { ok: true }
  const { error } = await service.from('room_config').update(patch).eq('room_id', roomId)
  if (error) throw new Error('설정 저장 실패: ' + error.message)
  return { ok: true }
}
