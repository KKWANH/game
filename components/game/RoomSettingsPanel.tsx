'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { CURRENCIES, describeStake } from '@/lib/money'
import { updateRoomSettings, setRoomPaused } from '@/actions/room-actions'
import { setRoomMoney } from '@/actions/settlement-actions'
import type { RoomConfigRow, RoomRow } from '@/lib/supabase/types'

/** Host-only game settings. Changes take effect on the NEXT round (each round
 *  snapshots its own config). Pause first to stop a new round from starting. */
export function RoomSettingsPanel({
  room,
  config,
  onClose,
}: {
  room: RoomRow
  config: RoomConfigRow
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(room.paused ?? false)
  const [minBet, setMinBet] = useState(config.min_bet)
  const [maxBet, setMaxBet] = useState(config.max_bet)
  const [numDecks, setNumDecks] = useState(config.num_decks)
  const [turnTimer, setTurnTimer] = useState(config.turn_timer_seconds)
  const [currency, setCurrency] = useState(room.currency ?? 'KRW')
  const [unitChips, setUnitChips] = useState(room.unit_chips ?? 1)
  const [unitAmount, setUnitAmount] = useState(room.unit_amount ?? 1)

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '실패')
    } finally {
      setBusy(false)
    }
  }

  const togglePause = async () => {
    const next = !paused
    await run(() => setRoomPaused(room.id, next), next ? '방을 멈췄습니다' : '게임을 재개합니다')
    setPaused(next)
  }

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
          className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-gold/30 bg-card p-5 shadow-2xl"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">
              <span className="shimmer-gold">방 설정</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              닫기 ✕
            </Button>
          </div>

          {/* Pause */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border p-3">
            <div>
              <div className="font-semibold">{paused ? '⏸ 멈춤' : '▶ 진행 중'}</div>
              <div className="text-xs text-muted-foreground">
                멈추면 다음 판이 시작되지 않아 설정을 바꿀 수 있어요.
              </div>
            </div>
            <Button size="sm" variant={paused ? 'gold' : 'secondary'} disabled={busy} onClick={togglePause}>
              {paused ? '재개' : '멈춤'}
            </Button>
          </div>

          {/* Game settings — apply next round */}
          <div className="mb-2 grid grid-cols-2 gap-3 rounded-2xl border border-border p-3">
            <Num label="최소 베팅" value={minBet} onChange={setMinBet} />
            <Num label="최대 베팅" value={maxBet} onChange={setMaxBet} />
            <Num label="덱 수" value={numDecks} onChange={setNumDecks} min={1} max={8} />
            <Num label="턴 제한(초)" value={turnTimer} onChange={setTurnTimer} min={5} max={120} />
          </div>
          <Button
            size="sm"
            variant="primary"
            className="mb-4 w-full"
            disabled={busy}
            onClick={() =>
              run(
                () => updateRoomSettings(room.id, { minBet, maxBet, numDecks, turnTimer }),
                '설정 저장 — 다음 판부터 적용'
              )
            }
          >
            게임 설정 저장 (다음 판 적용)
          </Button>

          {/* Currency */}
          <div className="space-y-2 rounded-2xl border border-gold/30 bg-gold/5 p-3">
            <div className="flex items-center justify-between">
              <Label>현실 머니 환율</Label>
              <span className="text-xs text-gold">
                현재 {describeStake({ currency: room.currency ?? 'KRW', unitChips: room.unit_chips ?? 1, unitAmount: room.unit_amount ?? 1 })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input type="number" className="w-20" min={1} value={unitChips} onChange={(e) => setUnitChips(Number(e.target.value))} />
              <span className="text-sm text-muted-foreground">코인 =</span>
              <Input type="number" className="w-20" min={0} step="any" value={unitAmount} onChange={(e) => setUnitAmount(Number(e.target.value))} />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background/60 px-2 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => run(() => setRoomMoney(room.id, { currency, unitChips, unitAmount }), '환율 적용')}
            >
              환율 저장
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

function Num({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}
