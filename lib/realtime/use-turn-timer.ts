'use client'

import { useEffect, useState } from 'react'
import { timeoutTurn, bettingTimeout, autoNextRound } from '@/actions/game-actions'

const AUTO_NEXT_MS = 4000 // pause on the result before the next round opens

/**
 * Drives the automatic game loop from the client:
 *  - renders a countdown to the server-authored deadline (betting + player turns)
 *  - fires the matching timeout action when the deadline passes
 *  - after a round completes, auto-starts the next one
 *
 * Any connected client may fire these; the server re-validates against the DB
 * clock and the version guard makes duplicates idempotent.
 */
export function useTurnTimer(
  roundId: string | null,
  roomId: string,
  deadlineIso: string | null,
  phase: string | null
) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  // Countdown + timeout for betting / player turns.
  useEffect(() => {
    const timed = phase === 'player_turns' || phase === 'betting'
    if (!roundId || !deadlineIso || !timed) {
      setSecondsLeft(null)
      return
    }
    const deadline = new Date(deadlineIso).getTime()
    let fired = false
    let sawPositive = false
    const fire = () => {
      const action = phase === 'betting' ? bettingTimeout : timeoutTurn
      setTimeout(() => action(roundId).catch(() => {}), 150 + Math.floor(Math.random() * 400))
    }
    const tick = () => {
      const ms = deadline - Date.now()
      setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)))
      if (ms > 0) sawPositive = true
      // Only fire after we've actually watched it count down — a stale/past
      // deadline on mount must NOT instantly trigger a timeout.
      if (ms <= 0 && sawPositive && !fired) {
        fired = true
        fire()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [roundId, deadlineIso, phase])

  // Auto-start the next round a few seconds after one completes.
  useEffect(() => {
    if (phase !== 'complete') return
    const id = setTimeout(
      () => autoNextRound(roomId).catch(() => {}),
      AUTO_NEXT_MS + Math.floor(Math.random() * 600)
    )
    return () => clearTimeout(id)
  }, [phase, roomId])

  return secondsLeft
}
