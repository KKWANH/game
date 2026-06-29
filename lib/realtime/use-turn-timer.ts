'use client'

import { useEffect, useState } from 'react'
import { timeoutTurn } from '@/actions/game-actions'

/**
 * Renders a live countdown to the server-authored `turn_deadline` and, once it
 * passes, fires the timeout action. Any connected client may fire it; the server
 * re-validates against the DB clock and the version guard makes it idempotent.
 */
export function useTurnTimer(
  roundId: string | null,
  deadlineIso: string | null,
  phase: string | null
) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!roundId || !deadlineIso || phase !== 'player_turns') {
      setSecondsLeft(null)
      return
    }
    const deadline = new Date(deadlineIso).getTime()
    let fired = false

    const tick = () => {
      const ms = deadline - Date.now()
      const s = Math.max(0, Math.ceil(ms / 1000))
      setSecondsLeft(s)
      if (ms <= 0 && !fired) {
        fired = true
        // Small jitter so not every client hammers at once.
        setTimeout(() => {
          timeoutTurn(roundId).catch(() => {})
        }, 150 + Math.floor(Math.random() * 400))
      }
    }

    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [roundId, deadlineIso, phase])

  return secondsLeft
}
