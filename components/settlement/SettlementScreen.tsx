'use client'

import { motion } from 'framer-motion'
import { Panel } from '@/components/ui/input'
import { formatChips, formatWon, cn } from '@/lib/utils'
import type { SettlementRow } from '@/lib/supabase/types'

export function SettlementScreen({ settlement }: { settlement: SettlementRow }) {
  const nets = [...settlement.net_by_seat].sort((a, b) => b.net - a.net)
  const aiNet =
    settlement.aiNet ?? nets.filter((n) => n.isAi).reduce((s, n) => s + n.net, 0)
  const humanCount = nets.filter((n) => !n.isAi).length
  const krw = settlement.chip_value_krw ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl space-y-6 p-4"
    >
      <h1 className="text-center text-3xl font-extrabold">
        <span className="shimmer-gold">최종 정산</span>
      </h1>
      {krw > 0 && (
        <p className="-mt-4 text-center text-sm text-gold">1칩 = {formatChips(krw)}원 기준</p>
      )}

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
                바이인 {formatChips(n.buyIn)} → 잔액 {formatChips(n.stack)}
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
                {formatChips(n.net)}
              </div>
              {krw > 0 && (
                <div className="text-sm font-semibold opacity-90">
                  {n.net > 0 ? '+' : ''}
                  {formatWon(n.net, krw)}
                </div>
              )}
            </div>
          </div>
        ))}
      </Panel>

      {aiNet !== 0 && humanCount > 0 && (
        <p className="rounded-xl bg-neon-cyan/10 px-4 py-3 text-center text-sm leading-relaxed text-neon-cyan">
          🤖 AI 손익 {aiNet > 0 ? '+' : ''}
          {formatChips(aiNet)}은(는) 실제 사람이 아니므로 사람 {humanCount}명에게 공평하게 나눠
          아래 송금에 반영했습니다.
        </p>
      )}

      {settlement.transfers.length > 0 ? (
        <Panel className="space-y-2 p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gold">정산 송금</h2>
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
                  {krw > 0 ? formatWon(t.amount, krw) : formatChips(t.amount)}
                  {krw > 0 && (
                    <span className="ml-1 text-xs font-normal opacity-60">({formatChips(t.amount)}칩)</span>
                  )}
                </span>
              </div>
            )
          })}
        </Panel>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          AI 딜러 게임은 각자 하우스 대비 손익만 표시됩니다.
        </p>
      )}
    </motion.div>
  )
}
