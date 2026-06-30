'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { PlayingCard } from './PlayingCard'
import { WinBurst } from '@/components/effects/WinBurst'
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
  busted: 'BUSTED',
  blackjack: 'BLACKJACK!',
  stood: 'STAND',
  surrendered: 'SURRENDER',
}

const OVERLAP = { sm: '-space-x-6', md: '-space-x-8', lg: '-space-x-10' }

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
  size?: 'sm' | 'md' | 'lg'
}) {
  const cards: Card[] = hand.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))
  const total = cards.length ? handTotal(cards) : null
  const showHole = holeFaceDown && hand.is_dealer && hand.cards.length === 1
  const badge = hand.outcome ? OUTCOME_LABEL[hand.outcome] : STATUS_LABEL[hand.status]
  const won = hand.outcome === 'win' || hand.outcome === 'blackjack'
  const lost = hand.outcome === 'lose' || hand.status === 'busted'

  return (
    <motion.div
      animate={
        won
          ? { boxShadow: '0 0 0 2px var(--gold), 0 0 28px 4px color-mix(in oklch, var(--gold) 45%, transparent)' }
          : { boxShadow: '0 0 0 0px transparent' }
      }
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-all',
        isActive && 'glow-gold ring-2 ring-gold',
        lost && 'opacity-70'
      )}
    >
      {won && <WinBurst big={hand.outcome === 'blackjack'} />}

      {/* Badge sits above the cards (its own row) — never overlaps them. */}
      {badge && (
        <motion.span
          initial={{ scale: 0.6, y: 4, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          className={cn(
            'z-10 rounded-full px-3.5 py-1 text-sm font-extrabold tracking-wide shadow-lg',
            won
              ? 'bg-gradient-to-r from-gold-bright to-gold text-primary-foreground'
              : lost
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-secondary text-secondary-foreground'
          )}
        >
          {badge}
        </motion.span>
      )}

      <div className={cn('flex', OVERLAP[size])}>
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
            'rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums',
            total.isBust ? 'bg-destructive text-destructive-foreground' : 'bg-black/50 text-foreground'
          )}
        >
          {total.best}
          {total.isSoft && total.best < 21 ? ' soft' : ''}
        </span>
      )}
    </motion.div>
  )
}
