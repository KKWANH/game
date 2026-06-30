'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { formatChips, cn } from '@/lib/utils'
import {
  interimSettlement,
  transferChips,
  rebalanceChips,
  computeSettlement,
  type SettlementResult,
} from '@/actions/settlement-actions'
import type { SeatRow } from '@/lib/supabase/types'

export function HostSettlementPanel({
  roomId,
  seats,
  onClose,
}: {
  roomId: string
  seats: SeatRow[]
  onClose: () => void
}) {
  const [standings, setStandings] = useState<SettlementResult | null>(null)
  const [busy, setBusy] = useState(false)
  const playerSeats = seats.filter((s) => s.status !== 'left')

  const refresh = async () => {
    try {
      setStandings(await interimSettlement(roomId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패')
    }
  }
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '실패')
    } finally {
      setBusy(false)
    }
  }

  const [fromSeat, setFromSeat] = useState('')
  const [toSeat, setToSeat] = useState('')
  const [amount, setAmount] = useState(100)
  const [target, setTarget] = useState(1000)

  const nets = standings ? [...standings.netBySeat].sort((a, b) => b.net - a.net) : []

  // Portal to <body> so the modal escapes the fixed host-dock stacking context.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-gold/30 bg-card p-5 shadow-2xl"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">
              <span className="shimmer-gold">정산 / 재배분</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              닫기 ✕
            </Button>
          </div>

          {/* Standings */}
          <div className="mb-5 overflow-hidden rounded-2xl border border-border">
            {nets.map((n) => (
              <div
                key={n.seatId}
                className="flex items-center justify-between border-b border-border/60 px-3 py-2 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.displayName}</span>
                  {n.isDealer && <span className="text-xs text-gold">딜러</span>}
                  {n.isAi && (
                    <span className="rounded bg-neon-cyan/15 px-1.5 py-0.5 text-[10px] font-bold text-neon-cyan">
                      🤖 AI
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {formatChips(n.stack)}
                    <span className="opacity-50"> / {formatChips(n.buyIn)}</span>
                  </span>
                  <span
                    className={cn(
                      'w-16 text-right font-bold tabular-nums',
                      n.net > 0 ? 'text-accent' : n.net < 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {n.net > 0 ? '+' : ''}
                    {formatChips(n.net)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {standings && standings.aiNet !== 0 && (
            <p className="mb-3 rounded-xl bg-neon-cyan/10 px-3 py-2 text-xs leading-relaxed text-neon-cyan">
              🤖 AI 손익 {standings.aiNet > 0 ? '+' : ''}
              {formatChips(standings.aiNet)}은(는) 실제 사람이 아니므로 사람{' '}
              {nets.filter((n) => !n.isAi).length}명에게 공평하게 나눠 아래 송금에 반영했습니다.
            </p>
          )}

          {standings && standings.transfers.length > 0 && (
            <div className="mb-5 space-y-1 rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-bold uppercase tracking-widest text-gold">제안 송금</div>
              {standings.transfers.map((t, i) => {
                const f = nets.find((n) => n.seatId === t.fromSeat)
                const to = nets.find((n) => n.seatId === t.toSeat)
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      <span className="text-destructive">{f?.displayName}</span> →{' '}
                      <span className="text-accent">{to?.displayName}</span>
                    </span>
                    <span className="font-bold text-gold">{formatChips(t.amount)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Transfer */}
          <div className="mb-4 space-y-2 rounded-2xl border border-border p-3">
            <Label>칩 이체 (재배분)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <SeatSelect seats={playerSeats} value={fromSeat} onChange={setFromSeat} placeholder="보내는 사람" />
              <span className="text-muted-foreground">→</span>
              <SeatSelect seats={playerSeats} value={toSeat} onChange={setToSeat} placeholder="받는 사람" />
              <Input
                type="number"
                className="w-24"
                value={amount}
                min={1}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <Button
                size="sm"
                variant="primary"
                disabled={busy || !fromSeat || !toSeat}
                onClick={() => run(() => transferChips(roomId, fromSeat, toSeat, amount), '이체 완료')}
              >
                이체
              </Button>
            </div>
          </div>

          {/* Rebalance */}
          <div className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-border p-3">
            <div className="space-y-1">
              <Label>전원 리밸런스</Label>
              <Input
                type="number"
                className="w-32"
                value={target}
                min={0}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => run(() => rebalanceChips(roomId, target), `전원 ${formatChips(target)}로 리셋`)}
            >
              모두 {formatChips(target)}로 맞추기
            </Button>
          </div>

          <Button
            variant="danger"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={() => {
              if (confirm('최종 정산하고 방을 종료할까요?')) {
                run(() => computeSettlement(roomId), '최종 정산 완료')
              }
            }}
          >
            최종 정산하고 방 종료
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

function SeatSelect({
  seats,
  value,
  onChange,
  placeholder,
}: {
  seats: SeatRow[]
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-input bg-background/60 px-2 text-sm"
    >
      <option value="">{placeholder}</option>
      {seats.map((s) => (
        <option key={s.id} value={s.id}>
          {s.display_name}
        </option>
      ))}
    </select>
  )
}
