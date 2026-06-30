import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Best-effort "free my seat on tab close", hit via navigator.sendBeacon. Frees
 * only the caller's own seat, and closes the room if that was the last human —
 * so abandoned rooms stop showing as open. Safe to fail (the explicit 나가기
 * button is the reliable path).
 */
export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })
    const { seatId } = (await request.json().catch(() => ({}))) as { seatId?: string }
    if (!seatId) return NextResponse.json({ ok: false }, { status: 400 })

    const service = createServiceClient()
    const { data: seat } = await service.from('seats').select('room_id, user_id').eq('id', seatId).single()
    if (!seat || seat.user_id !== user.id) return NextResponse.json({ ok: false }, { status: 403 })

    await service.from('seats').update({ status: 'left', user_id: null }).eq('id', seatId)
    const { data: remaining } = await service
      .from('seats')
      .select('is_ai, user_id')
      .eq('room_id', seat.room_id)
      .neq('status', 'left')
    const humansLeft = (remaining ?? []).some((s) => !s.is_ai && s.user_id)
    if (!humansLeft) await service.from('rooms').update({ status: 'closed' }).eq('id', seat.room_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
