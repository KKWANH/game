'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChipButton, ChipStack } from '@/components/chips/ChipStack'
import { submitBet } from '@/actions/game-actions'
import { formatChips } from '@/lib/utils'
import type { RoomConfigRow, SeatRow } from '@/lib/supabase/types'

const DENOMS = [10, 25, 50, 100, 500]

export function BetControls({
  roundId,
  seat,
  config,
}: {
  roundId: string
  seat: SeatRow
  config: RoomConfigRow
}) {
  const [amount, setAmount] = useState(config.min_bet)
  const [pending, setPending] = useState(false)

  const clamp = (n: number) => Math.min(config.max_bet, Math.max(config.min_bet, n))
  // Stack chips onto the bet, but never exceed the max or what you can afford.
  const add = (q: number) => setAmount((a) => Math.min(config.max_bet, seat.chip_stack, a + q))

  async function go(betAmount: number) {
    setPending(true)
    try {
      const res = await submitBet({ roundId, seatId: seat.id, amount: betAmount })
      if (res?.conflict) toast.info('차례가 지났어요.')
      else if (betAmount > 0) toast.success(`${formatChips(betAmount)} 베팅`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '베팅 실패')
    } finally {
      setPending(false)
    }
  }
  const submit = () => go(clamp(amount))

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-gold/20 bg-card/85 p-4 shadow-xl backdrop-blur">
      <div className="text-xs text-muted-foreground">
        한도 {formatChips(config.min_bet)}~{formatChips(config.max_bet)} · 보유{' '}
        <span className="font-bold text-gold">{formatChips(seat.chip_stack)}</span>
      </div>

      {/* Current bet as a chip stack */}
      <div className="flex min-h-[56px] items-end gap-3">
        <ChipStack amount={clamp(amount)} size="md" label={false} />
        <span className="pb-1 text-3xl font-black tabular-nums text-gold">{formatChips(clamp(amount))}</span>
      </div>

      {/* Chip denominations to stack */}
      <div className="flex items-center justify-center gap-2">
        {DENOMS.filter((q) => q <= config.max_bet).map((q) => (
          <ChipButton key={q} amount={q} disabled={pending || amount + q > seat.chip_stack} onClick={() => add(q)} />
        ))}
      </div>

      <div className="flex w-full items-center gap-2">
        <Button size="lg" variant="ghost" disabled={pending} onClick={() => go(0)}>
          패스
        </Button>
        <Button variant="gold" size="lg" className="flex-1" disabled={pending} onClick={submit}>
          베팅 확정
        </Button>
      </div>
    </div>
  )
}
