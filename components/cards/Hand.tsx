'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { PlayingCard } from './PlayingCard'
import { handTotal, type Card, type Rank, type Suit } from '@/lib/blackjack'
import { cn } from '@/lib/utils'
import type { HandWithCards } from '@/store/room-store'

const OUTCOME_LABEL: Record<string, string> = {
  win: 'WIN',
  lose: 'LOSE',
  push: 'PUSH',
  blackjack: 'BLACKJACK!',
  surrender: 'SURRENDER',
}

const STATUS_LABEL: Record<string, string> = {
  busted: 'BUST',
  blackjack: 'BLACKJACK!',
  stood: 'STAND',
  surrendered: 'SURRENDER',
}

export function HandView({
  hand,
  isActive,
  holeFaceDown,
  size = 'md',
}: {
  hand: HandWithCards
  isActive?: boolean
  /** When true, render a face-down placeholder for the dealer's missing 2nd card. */
  holeFaceDown?: boolean
  size?: 'sm' | 'md'
}) {
  const cards: Card[] = hand.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))
  const total = cards.length ? handTotal(cards) : null
  const showHole = holeFaceDown && hand.is_dealer && hand.cards.length === 1
  const badge = hand.outcome
    ? OUTCOME_LABEL[hand.outcome]
    : STATUS_LABEL[hand.status]

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-1 rounded-2xl p-2 transition-all',
        isActive && 'glow-gold ring-2 ring-gold'
      )}
    >
      <div className="flex -space-x-5 sm:-space-x-6">
        <AnimatePresence>
          {hand.cards.map((c, i) => (
            <PlayingCard key={c.id} rank={c.rank} suit={c.suit} index={i} size={size} />
          ))}
          {showHole && <PlayingCard key="hole" faceDown index={1} size={size} />}
        </AnimatePresence>
      </div>

      {total && !showHole && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
            total.isBust ? 'bg-destructive text-destructive-foreground' : 'bg-black/40 text-foreground'
          )}
        >
          {total.best}
          {total.isSoft && !total.isBust ? ' soft' : ''}
        </span>
      )}

      {badge && (
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-extrabold tracking-wide shadow-lg',
            hand.outcome === 'win' || hand.outcome === 'blackjack'
              ? 'bg-gradient-to-r from-gold-bright to-gold text-primary-foreground'
              : hand.outcome === 'lose' || hand.status === 'busted'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-secondary text-secondary-foreground'
          )}
        >
          {badge}
        </motion.span>
      )}
    </div>
  )
}
