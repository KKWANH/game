'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { formatChips, cn } from '@/lib/utils'
import { formatMoney, describeStake, CURRENCIES } from '@/lib/money'
import { useT, useLocale } from '@/lib/i18n/provider'
import {
  interimSettlement,
  recordInterimSettlement,
  setRoomMoney,
  roomLedgerSummary,
  transferChips,
  rebalanceChips,
  computeSettlement,
  type SettlementResult,
  type SeatLedger,
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
  const t = useT()
  const en = useLocale() === 'en'
  const playerSeats = seats.filter((s) => s.status !== 'left')

  const refresh = async () => {
    try {
      setStandings(await interimSettlement(roomId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('불러오기 실패'))
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
      toast.error(e instanceof Error ? e.message : t('실패'))
    } finally {
      setBusy(false)
    }
  }

  const [fromSeat, setFromSeat] = useState('')
  const [toSeat, setToSeat] = useState('')
  const [amount, setAmount] = useState(100)
  const [target, setTarget] = useState(1000)
  const [currency, setCurrency] = useState('KRW')
  const [unitChips, setUnitChips] = useState(1)
  const [unitAmount, setUnitAmount] = useState(1)
  const [moneySynced, setMoneySynced] = useState(false)
  const [ledger, setLedger] = useState<SeatLedger[] | null>(null)

  const nets = standings ? [...standings.netBySeat].sort((a, b) => b.net - a.net) : []
  const money = standings?.money ?? { currency: 'KRW', unitChips: 1, unitAmount: 1 }
  const won = (chips: number) => formatMoney(chips, money)

  // Seed the stake inputs once from the loaded room value.
  useEffect(() => {
    if (standings && !moneySynced) {
      setCurrency(standings.money.currency)
      setUnitChips(standings.money.unitChips)
      setUnitAmount(standings.money.unitAmount)
      setMoneySynced(true)
    }
  }, [standings, moneySynced])

  const toggleLedger = async () => {
    if (ledger) return setLedger(null)
    try {
      setLedger(await roomLedgerSummary(roomId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('내역 불러오기 실패'))
    }
  }

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
              <span className="shimmer-gold">{t('정산 / 재배분')}</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('닫기')} ✕
            </Button>
          </div>

          {/* Real-money stake: unit_chips coins = unit_amount of currency. */}
          <div className="mb-4 space-y-2 rounded-2xl border border-gold/30 bg-gold/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <Label>{t('현실 머니 — 코인 환율')}</Label>
              <span className="text-xs text-gold">{t('현재')} {describeStake(money)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                type="number"
                className="w-20"
                value={unitChips}
                min={1}
                onChange={(e) => setUnitChips(Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">{t('코인 =')}</span>
              <Input
                type="number"
                className="w-20"
                value={unitAmount}
                min={0}
                step="any"
                onChange={(e) => setUnitAmount(Number(e.target.value))}
              />
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
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  busy ||
                  (currency === money.currency &&
                    unitChips === money.unitChips &&
                    unitAmount === money.unitAmount)
                }
                onClick={() =>
                  run(
                    () => setRoomMoney(roomId, { currency, unitChips, unitAmount }),
                    `${t('환율 적용')}: ${unitChips}${t('코인')} = ${unitAmount} ${currency}`
                  )
                }
              >
                {t('적용')}
              </Button>
            </div>
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
                  {n.isDealer && <span className="text-xs text-gold">{t('딜러')}</span>}
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
                      'w-24 text-right font-bold tabular-nums',
                      n.net > 0 ? 'text-accent' : n.net < 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    <span className="block">
                      {n.net > 0 ? '+' : ''}
                      {formatChips(n.net)}
                    </span>
                    <span className="block text-[11px] opacity-90">
                      {n.net > 0 ? '+' : ''}
                      {won(n.net)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {standings && standings.aiNet !== 0 && (
            <p className="mb-3 rounded-xl bg-neon-cyan/10 px-3 py-2 text-xs leading-relaxed text-neon-cyan">
              {en
                ? `🤖 AI's net ${standings.aiNet > 0 ? '+' : ''}${formatChips(standings.aiNet)} isn't a real person, so it's split evenly among the ${nets.filter((n) => !n.isAi).length} humans in the transfers below.`
                : `🤖 AI 손익 ${standings.aiNet > 0 ? '+' : ''}${formatChips(standings.aiNet)}은(는) 실제 사람이 아니므로 사람 ${nets.filter((n) => !n.isAi).length}명에게 공평하게 나눠 아래 송금에 반영했습니다.`}
            </p>
          )}

          {standings && !nets.some((n) => n.isDealer) && (
            <p className="mb-3 rounded-xl bg-neon-cyan/10 px-3 py-2 text-xs leading-relaxed text-neon-cyan">
              {en ? (
                <>🤖 AI-dealer (house) game — set aside the shared result vs the bot; friends settle <b>only the differences</b>.</>
              ) : (
                <>🤖 AI 딜러(하우스) 게임 — 봇과의 공동 손익은 빼고 친구끼리 <b>차이만</b> 정산합니다.</>
              )}
            </p>
          )}

          {standings && standings.transfers.length > 0 && (
            <div className="mb-5 space-y-1 rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-bold uppercase tracking-widest text-gold">{t('제안 송금')}</div>
              {standings.transfers.map((tx, i) => {
                const f = nets.find((n) => n.seatId === tx.fromSeat)
                const to = nets.find((n) => n.seatId === tx.toSeat)
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      <span className="text-destructive">{f?.displayName}</span> →{' '}
                      <span className="text-accent">{to?.displayName}</span>
                    </span>
                    <span className="font-bold text-gold">
                      {won(tx.amount)}
                      <span className="ml-1 text-[11px] font-normal opacity-60">
                        ({formatChips(tx.amount)}{t('코인')})
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Transfer */}
          <div className="mb-4 space-y-2 rounded-2xl border border-border p-3">
            <Label>{t('칩 이체 (재배분)')}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <SeatSelect seats={playerSeats} value={fromSeat} onChange={setFromSeat} placeholder={t('보내는 사람')} />
              <span className="text-muted-foreground">→</span>
              <SeatSelect seats={playerSeats} value={toSeat} onChange={setToSeat} placeholder={t('받는 사람')} />
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
                onClick={() => run(() => transferChips(roomId, fromSeat, toSeat, amount), t('이체 완료'))}
              >
                {t('이체')}
              </Button>
            </div>
          </div>

          {/* Rebalance */}
          <div className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-border p-3">
            <div className="space-y-1">
              <Label>{t('전원 리밸런스')}</Label>
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
              onClick={() => run(() => rebalanceChips(roomId, target), en ? `Reset everyone to ${formatChips(target)}` : `전원 ${formatChips(target)}로 리셋`)}
            >
              {en ? `Set all to ${formatChips(target)}` : `모두 ${formatChips(target)}로 맞추기`}
            </Button>
          </div>

          {/* Buy-in / top-up ledger (장부) */}
          <div className="mb-4 rounded-2xl border border-border p-3">
            <button
              onClick={toggleLedger}
              className="flex w-full items-center justify-between text-sm font-semibold"
            >
              <span>{t('바이인 / 충전 내역')}</span>
              <span className="text-muted-foreground">{ledger ? '▲' : '▼'}</span>
            </button>
            {ledger && (
              <div className="mt-2 space-y-1.5">
                {ledger.map((l) => (
                  <div key={l.seatId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      {l.displayName}
                      {l.isAi && <span className="text-[10px] text-neon-cyan">🤖</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {t('바이인')} <span className="font-semibold text-foreground">{formatChips(l.buyIn)}</span>
                      {l.topUps !== 0 && (
                        <>
                          {' · '}{t('충전/조정')}{' '}
                          <span className={cn('font-semibold', l.topUps > 0 ? 'text-accent' : 'text-destructive')}>
                            {l.topUps > 0 ? '+' : ''}
                            {formatChips(l.topUps)}
                          </span>
                        </>
                      )}
                      <span className="ml-1 text-[11px] text-gold">({won(l.buyIn + l.topUps)})</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="mb-2 w-full"
            disabled={busy}
            onClick={() => run(() => recordInterimSettlement(roomId), t('중간정산 기록 완료 — 모두에게 표시됩니다'))}
          >
            {t('💰 중간정산 확정 (방 유지)')}
          </Button>

          <Button
            variant="danger"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={() => {
              if (confirm(en ? 'Finalize settlement and close the room?' : '최종 정산하고 방을 종료할까요?')) {
                run(() => computeSettlement(roomId), t('최종 정산 완료'))
              }
            }}
          >
            {t('최종 정산하고 방 종료')}
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
