'use client'

import { motion } from 'framer-motion'
import { cn, formatChips } from '@/lib/utils'
import { HandView } from '@/components/cards/Hand'
import { ChipStack } from '@/components/chips/ChipStack'
import type { HandWithCards } from '@/store/room-store'
import type { SeatRow } from '@/lib/supabase/types'

/** One seat position on the table — occupied (player) or an empty slot. */
export function SeatPod({
  seat,
  hands,
  activeHandId,
  isMe,
  present,
  canJoin,
  canRemove,
  onRemove,
  onJoin,
  cardSize = 'sm',
}: {
  seat: SeatRow | null
  hands: HandWithCards[]
  activeHandId: string | null
  isMe: boolean
  present: boolean
  canJoin: boolean
  canRemove?: boolean
  onRemove?: () => void
  onJoin?: () => void
  cardSize?: 'sm' | 'md'
}) {
  const isActive = !!activeHandId && hands.some((h) => h.id === activeHandId)

  if (!seat) {
    // Mirror the occupied pod's structure (card area on top, nameplate-height
    // control at the bottom) so empty and occupied seats bottom-align.
    return (
      <div className="flex w-24 flex-col items-center gap-2 sm:w-28">
        <div className="flex min-h-[112px] items-end justify-center">
          <div className="h-[4.5rem] w-12 rounded-lg border-2 border-dashed border-border/30" />
        </div>
        <button
          disabled={!canJoin}
          onClick={onJoin}
          className={cn(
            'w-full rounded-2xl border border-dashed border-border/50 px-2 py-2.5 text-xs text-muted-foreground transition',
            canJoin && 'cursor-pointer hover:border-gold/60 hover:bg-gold/5 hover:text-gold'
          )}
        >
          {canJoin ? '＋ 여기 앉기' : '빈 자리'}
        </button>
      </div>
    )
  }

  return (
    <div className={cn('relative flex flex-col items-center gap-2', cardSize === 'md' ? 'w-28 sm:w-32' : 'w-24 sm:w-28')}>
      {canRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1 right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/80 text-[10px] font-bold text-destructive-foreground hover:bg-destructive"
          title="AI 내보내기"
        >
          ✕
        </button>
      )}
      {/* Cards */}
      <div className="flex min-h-[112px] items-end justify-center">
        {hands.length === 0 ? (
          <div className="h-[4.5rem] w-12 rounded-lg border-2 border-dashed border-border/40" />
        ) : (
          <div className="flex flex-wrap items-end justify-center gap-1">
            {hands.map((h) => (
              <div key={h.id} className="flex flex-col items-center gap-0.5">
                <HandView hand={h} isActive={h.id === activeHandId} size={cardSize} />
                {h.bet_amount > 0 && <ChipStack amount={h.bet_amount} size="sm" />}
                {h.insurance_bet > 0 && (
                  <span className="text-[9px] font-bold text-neon-cyan">ins {formatChips(h.insurance_bet)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nameplate */}
      <motion.div
        animate={isActive ? { scale: 1.05 } : { scale: 1 }}
        className={cn(
          'flex w-full flex-col items-center gap-0.5 rounded-2xl border px-2 py-1.5 text-center',
          isMe ? 'border-gold/60 bg-gold/10' : 'border-border bg-card/70',
          isActive && 'active-glow'
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', present ? 'bg-accent' : 'bg-muted-foreground/40')} />
          <span className="max-w-[6.5rem] truncate text-sm font-semibold">{seat.display_name}</span>
        </div>
        <motion.span
          key={seat.chip_stack}
          initial={{ scale: 1.25, color: 'var(--gold-bright)' }}
          animate={{ scale: 1, color: 'var(--gold)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-xs font-bold tabular-nums"
        >
          {formatChips(seat.chip_stack)}
        </motion.span>
      </motion.div>
    </div>
  )
}
