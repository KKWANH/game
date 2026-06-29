'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { placeBet } from '@/actions/game-actions'
import { formatChips } from '@/lib/utils'
import type { RoomConfigRow, SeatRow } from '@/lib/supabase/types'

const QUICK = [10, 25, 50, 100, 500]

export function BetControls({
  roundId,
  seat,
  config,
  currentBet,
}: {
  roundId: string
  seat: SeatRow
  config: RoomConfigRow
  currentBet: number
}) {
  const [amount, setAmount] = useState(Math.max(config.min_bet, currentBet))
  const [pending, setPending] = useState(false)

  const clamp = (n: number) => Math.min(config.max_bet, Math.max(config.min_bet, n))

  async function submit() {
    setPending(true)
    try {
      await placeBet({ roundId, seatId: seat.id, amount: clamp(amount) })
      toast.success(`${formatChips(clamp(amount))} 베팅`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '베팅 실패')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/80 p-4 backdrop-blur">
      <div className="text-sm text-muted-foreground">
        베팅 한도 {formatChips(config.min_bet)} ~ {formatChips(config.max_bet)} · 보유{' '}
        <span className="font-bold text-gold">{formatChips(seat.chip_stack)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {QUICK.filter((q) => q >= config.min_bet && q <= config.max_bet).map((q) => (
          <Button key={q} size="sm" variant="secondary" onClick={() => setAmount(clamp(q))}>
            +{q}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setAmount(config.min_bet)}>
          리셋
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-extrabold tabular-nums text-gold">
          {formatChips(clamp(amount))}
        </span>
        <Button variant="gold" size="lg" disabled={pending} onClick={submit}>
          베팅 확정
        </Button>
      </div>
    </div>
  )
}
