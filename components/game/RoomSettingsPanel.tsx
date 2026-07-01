'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { CURRENCIES, describeStake } from '@/lib/money'
import { updateRoomSettings, setRoomPaused, setDealerRole } from '@/actions/room-actions'
import { setRoomMoney } from '@/actions/settlement-actions'
import { useT } from '@/lib/i18n/provider'
import type { RoomConfigRow, RoomRow } from '@/lib/supabase/types'

/** Host-only game settings. Changes take effect on the NEXT round (each round
 *  snapshots its own config). Pause first to stop a new round from starting. */
export function RoomSettingsPanel({
  room,
  config,
  iAmDealer,
  onClose,
}: {
  room: RoomRow
  config: RoomConfigRow
  iAmDealer: boolean
  onClose: () => void
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(room.paused ?? false)
  const [dealer, setDealer] = useState(iAmDealer)
  const [name, setName] = useState(room.name)
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
      toast.error(e instanceof Error ? e.message : t('실패'))
    } finally {
      setBusy(false)
    }
  }

  const togglePause = async () => {
    const next = !paused
    await run(() => setRoomPaused(room.id, next), next ? t('방을 멈췄습니다') : t('게임을 재개합니다'))
    setPaused(next)
  }

  const toggleDealer = async () => {
    const next = !dealer
    await run(
      () => setDealerRole(room.id, next),
      next ? t('다음 판부터 딜러(뱅크)가 됩니다') : t('다음 판부터 플레이어로 돌아갑니다')
    )
    setDealer(next)
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
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
              <span className="shimmer-gold">{t('방 설정')}</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('닫기')} ✕
            </Button>
          </div>

          {/* Pause */}
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
            <div className="min-w-0">
              <div className="font-semibold">{paused ? t('⏸ 멈춤') : t('▶ 진행 중')}</div>
              <div className="text-xs text-muted-foreground">{t('멈추면 다음 판이 시작되지 않아 설정을 바꿀 수 있어요.')}</div>
            </div>
            <Button size="sm" variant={paused ? 'gold' : 'secondary'} disabled={busy} onClick={togglePause}>
              {paused ? t('재개') : t('멈춤')}
            </Button>
          </div>

          {/* Dealer role — host takes/gives up the bank. Applies next round. */}
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
            <div className="min-w-0">
              <div className="font-semibold">{dealer ? t('🎩 내가 딜러(뱅크)') : t('🙂 플레이어')}</div>
              <div className="text-xs text-muted-foreground">{t('딜러가 되면 뱅크 역할만 맡고 손패는 자동 진행돼요. (다음 판 적용)')}</div>
            </div>
            <Button size="sm" variant={dealer ? 'secondary' : 'gold'} disabled={busy} onClick={toggleDealer}>
              {dealer ? t('플레이어로') : t('딜러 되기')}
            </Button>
          </div>

          {/* Room name (applies immediately) + game settings (next round) */}
          <div className="mb-2 space-y-3 rounded-2xl border border-border p-3">
            <div className="space-y-1">
              <Label>{t('방 이름')}</Label>
              <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Num label={t('최소 베팅')} value={minBet} onChange={setMinBet} />
              <Num label={t('최대 베팅')} value={maxBet} onChange={setMaxBet} />
              <Num label={t('덱 수')} value={numDecks} onChange={setNumDecks} min={1} max={8} />
              <Num label={t('턴 제한(초)')} value={turnTimer} onChange={setTurnTimer} min={5} max={120} />
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            className="mb-4 w-full"
            disabled={busy}
            onClick={() =>
              run(
                () => updateRoomSettings(room.id, { name, minBet, maxBet, numDecks, turnTimer }),
                t('설정 저장 — 다음 판부터 적용')
              )
            }
          >
            {t('설정 저장 (다음 판 적용)')}
          </Button>

          {/* Currency */}
          <div className="space-y-2 rounded-2xl border border-gold/30 bg-gold/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <Label>{t('현실 머니 환율')}</Label>
              <span className="text-xs text-gold">
                {t('현재')}{' '}
                {describeStake({ currency: room.currency ?? 'KRW', unitChips: room.unit_chips ?? 1, unitAmount: room.unit_amount ?? 1 })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input type="number" className="w-20" min={1} value={unitChips} onChange={(e) => setUnitChips(Number(e.target.value))} />
              <span className="text-sm text-muted-foreground">{t('코인 =')}</span>
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
              onClick={() => run(() => setRoomMoney(room.id, { currency, unitChips, unitAmount }), t('환율 적용'))}
            >
              {t('환율 저장')}
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
