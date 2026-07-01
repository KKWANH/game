'use client'

import { motion } from 'framer-motion'
import { Panel } from '@/components/ui/input'
import { formatChips, cn } from '@/lib/utils'
import { formatMoney, describeStake, DEFAULT_MONEY, type MoneyConfig } from '@/lib/money'
import { useT, useLocale } from '@/lib/i18n/provider'
import type { SettlementRow } from '@/lib/supabase/types'

/** Reconstruct the stake from a stored settlement, tolerating older rows that
 *  predate 0008 (chip_value_krw) or 0007 (nothing → default 1코인 = 1원). */
function moneyFromSettlement(s: SettlementRow): MoneyConfig {
  if (s.currency != null) {
    return { currency: s.currency, unitChips: s.unit_chips ?? 1, unitAmount: s.unit_amount ?? 1 }
  }
  if (s.chip_value_krw && s.chip_value_krw > 0) {
    return { currency: 'KRW', unitChips: 1, unitAmount: s.chip_value_krw }
  }
  return DEFAULT_MONEY
}

export function SettlementScreen({ settlement }: { settlement: SettlementRow }) {
  const nets = [...settlement.net_by_seat].sort((a, b) => b.net - a.net)
  const aiNet =
    settlement.aiNet ?? nets.filter((n) => n.isAi).reduce((s, n) => s + n.net, 0)
  const humanCount = nets.filter((n) => !n.isAi).length
  const money = moneyFromSettlement(settlement)
  const tt = useT()
  const en = useLocale() === 'en'
  // No dealer seat → the dealer was a virtual AI house (players pooled the result).
  const aiDealerGame = !nets.some((n) => n.isDealer)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl space-y-6 p-4"
    >
      <h1 className="text-center text-3xl font-extrabold">
        <span className="shimmer-gold">{tt('최종 정산')}</span>
      </h1>
      <p className="-mt-4 text-center text-sm text-gold">{describeStake(money)} {tt('기준')}</p>

      <Panel className="divide-y divide-border">
        {nets.map((n) => (
          <div key={n.seatId} className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                {n.displayName}
                {n.isAi && (
                  <span className="rounded bg-neon-cyan/15 px-1.5 py-0.5 text-[10px] font-bold text-neon-cyan">
                    🤖 AI
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {tt('바이인')} {formatChips(n.buyIn)} → {tt('잔액')} {formatChips(n.stack)}
              </div>
            </div>
            <div
              className={cn(
                'text-right tabular-nums',
                n.net > 0 ? 'text-accent' : n.net < 0 ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              <div className="text-xl font-extrabold">
                {n.net > 0 ? '+' : ''}
                {formatMoney(n.net, money)}
              </div>
              <div className="text-xs font-medium opacity-70">
                {n.net > 0 ? '+' : ''}
                {formatChips(n.net)}{tt('코인')}
              </div>
            </div>
          </div>
        ))}
      </Panel>

      {aiNet !== 0 && humanCount > 0 && (
        <p className="rounded-xl bg-neon-cyan/10 px-4 py-3 text-center text-sm leading-relaxed text-neon-cyan">
          {en
            ? `🤖 AI's net of ${aiNet > 0 ? '+' : ''}${formatChips(aiNet)} coins isn't a real person, so it was split evenly among the ${humanCount} humans in the transfers below.`
            : `🤖 AI 손익 ${aiNet > 0 ? '+' : ''}${formatChips(aiNet)}코인은(는) 실제 사람이 아니므로 사람 ${humanCount}명에게 공평하게 나눠 아래 송금에 반영했습니다.`}
        </p>
      )}

      {aiDealerGame && (
        <p className="rounded-xl bg-neon-cyan/10 px-4 py-3 text-center text-sm leading-relaxed text-neon-cyan">
          {en ? (
            <>🤖 AI-dealer (house) game — the shared win/loss vs the bot isn&apos;t real money, so friends settle <b>only the differences</b> (everyone to the group average).</>
          ) : (
            <>🤖 AI 딜러(하우스) 게임 — 봇과의 공동 손익은 실제 돈이 아니므로, 친구끼리 <b>서로의 차이만</b> 정산합니다 (모두 평균에 맞춰 정산).</>
          )}
        </p>
      )}

      {settlement.transfers.length > 0 ? (
        <Panel className="space-y-2 p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gold">{tt('정산 송금')}</h2>
          {settlement.transfers.map((t, i) => {
            const from = settlement.net_by_seat.find((s) => s.seatId === t.fromSeat)
            const to = settlement.net_by_seat.find((s) => s.seatId === t.toSeat)
            return (
              <div key={i} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
                <span>
                  <span className="font-semibold text-destructive">{from?.displayName}</span>
                  {' → '}
                  <span className="font-semibold text-accent">{to?.displayName}</span>
                </span>
                <span className="font-bold tabular-nums text-gold">
                  {formatMoney(t.amount, money)}
                  <span className="ml-1 text-xs font-normal opacity-60">({formatChips(t.amount)}{tt('코인')})</span>
                </span>
              </div>
            )
          })}
        </Panel>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{tt('서로 정산할 차액이 없습니다.')}</p>
      )}
    </motion.div>
  )
}
