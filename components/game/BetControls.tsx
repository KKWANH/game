'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ChipButton, ChipStack } from '@/components/chips/ChipStack'
import { submitBet } from '@/actions/game-actions'
import { sound } from '@/lib/sound'
import { formatChips } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'
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
  // Build the bet up from 0 — clicking a 100 chip means exactly 100.
  const [amount, setAmount] = useState(0)
  const [pending, setPending] = useState(false)
  const t = useT()

  const add = (q: number) => {
    sound.chip()
    setAmount((a) => Math.min(config.max_bet, seat.chip_stack, a + q))
  }
  const canConfirm = amount >= config.min_bet && amount <= seat.chip_stack

  // Keyboard betting: 1–5 add chips, Enter confirms, P passes, Esc clears.
  const live = useRef<{ amount: number; canConfirm: boolean; pending: boolean }>(null!)
  live.current = { amount, canConfirm, pending }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const { amount, canConfirm, pending } = live.current
      if (pending) return
      const k = e.key.toLowerCase()
      const denomIdx = ['1', '2', '3', '4', '5'].indexOf(e.key)
      if (denomIdx >= 0 && DENOMS[denomIdx] <= config.max_bet) {
        e.preventDefault()
        add(DENOMS[denomIdx])
      } else if (e.key === 'Enter' && canConfirm) {
        e.preventDefault()
        go(amount)
      } else if (k === 'p') {
        e.preventDefault()
        go(0)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setAmount(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function go(betAmount: number) {
    setPending(true)
    try {
      const res = (await submitBet({ roundId, seatId: seat.id, amount: betAmount })) as {
        conflict?: boolean
      }
      if (res?.conflict) toast.info(t('잠시 후 다시 시도해주세요.'))
      else if (betAmount > 0) toast.success(`${formatChips(betAmount)}${t(' 베팅')}`)
      else toast.success(t('이번 판 패스'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('베팅 실패'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-gold/20 bg-card/85 p-4 shadow-xl backdrop-blur">
      <div className="text-xs text-muted-foreground">
        {t('한도 ')}{formatChips(config.min_bet)}~{formatChips(config.max_bet)} · {t('보유')}{' '}
        <span className="font-bold text-gold">{formatChips(seat.chip_stack)}</span>
      </div>

      {/* Current bet (built up from 0) */}
      <button
        type="button"
        onClick={() => setAmount(0)}
        title="눌러서 초기화"
        className="flex min-h-[56px] items-end gap-3"
      >
        <ChipStack amount={amount} size="md" label={false} />
        <span className="pb-1 text-3xl font-black tabular-nums text-gold">{formatChips(amount)}</span>
      </button>

      {/* Chip denominations to stack */}
      <div className="flex items-center justify-center gap-2">
        {DENOMS.filter((q) => q <= config.max_bet).map((q) => (
          <ChipButton key={q} amount={q} disabled={pending || amount + q > seat.chip_stack} onClick={() => add(q)} />
        ))}
      </div>

      <div className="flex w-full items-center gap-2">
        <Button size="lg" variant="ghost" disabled={pending} onClick={() => setAmount(0)}>
          {t('초기화')}
        </Button>
        <Button size="lg" variant="ghost" disabled={pending} onClick={() => go(0)}>
          {t('패스')} <kbd className="ml-1 opacity-60">P</kbd>
        </Button>
        <Button variant="gold" size="lg" className="flex-1" disabled={pending || !canConfirm} onClick={() => go(amount)}>
          {t('베팅 확정')} <kbd className="ml-1 opacity-60">⏎</kbd>
        </Button>
      </div>
    </div>
  )
}
