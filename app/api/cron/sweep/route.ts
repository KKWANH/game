import { NextResponse } from 'next/server'
import { sweepExpiredTurns } from '@/lib/game/sweep'

export const dynamic = 'force-dynamic'

/**
 * Turn-timeout safety net. Called by pg_cron (or Vercel Cron) every ~15s.
 * Guarded by a shared secret so it can't be triggered by random clients.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const advanced = await sweepExpiredTurns()
  return NextResponse.json({ advanced })
}

export const GET = POST
