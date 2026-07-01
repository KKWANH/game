'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Suit } from './Suit'

export interface PlayingCardProps {
  rank?: string
  suit?: string
  faceDown?: boolean
  index?: number
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: { card: 'w-12 h-[4.5rem] rounded-lg', rank: 'text-lg', corner: 'w-2.5', center: 'w-7' },
  md: { card: 'w-16 h-24 rounded-xl', rank: 'text-2xl', corner: 'w-3.5', center: 'w-9' },
  lg: { card: 'w-[5.5rem] h-32 rounded-2xl', rank: 'text-3xl', corner: 'w-4', center: 'w-12' },
}

/** A chunky, Balatro-style playing card with a deal-in animation. */
export function PlayingCard({ rank, suit, faceDown, index = 0, size = 'md' }: PlayingCardProps) {
  const red = suit === 'H' || suit === 'D'
  const s = SIZES[size]

  return (
    <motion.div
      initial={{ y: -34, x: index % 2 ? 12 : -12, rotate: index % 2 ? 7 : -7, scale: 0.9 }}
      animate={{ y: 0, x: 0, rotate: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24, delay: index * 0.08 }}
      className={cn('relative shrink-0 select-none', s.card)}
    >
      {faceDown ? (
        <div className={cn('absolute inset-0 overflow-hidden border-2 border-gold/40 bg-gradient-to-br from-felt to-felt-deep', s.card)}>
          <div className="absolute inset-1.5 rounded-md border-2 border-gold/30 [background:repeating-linear-gradient(45deg,transparent,transparent_5px,color-mix(in_oklch,var(--gold)_30%,transparent)_5px,color-mix(in_oklch,var(--gold)_30%,transparent)_8px)]" />
          <div className="absolute inset-0 flex items-center justify-center text-gold/70">
            <span className="text-xl font-black">♣</span>
          </div>
        </div>
      ) : (
        <div className={cn('absolute inset-0 border border-black/10 bg-gradient-to-br from-white to-neutral-200 shadow-[0_4px_10px_rgba(0,0,0,0.45)]', s.card)}>
          {/* top-left */}
          <div className={cn('absolute left-1.5 top-1 flex flex-col items-center leading-none', red ? 'text-rose-600' : 'text-neutral-900')}>
            <span className={cn('font-black', s.rank)}>{rank}</span>
            <Suit suit={suit ?? 'S'} className={s.corner} />
          </div>
          {/* center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Suit suit={suit ?? 'S'} className={cn(s.center, 'opacity-95 drop-shadow-sm')} />
          </div>
          {/* bottom-right (rotated) */}
          <div className={cn('absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none', red ? 'text-rose-600' : 'text-neutral-900')}>
            <span className={cn('font-black', s.rank)}>{rank}</span>
            <Suit suit={suit ?? 'S'} className={s.corner} />
          </div>
        </div>
      )}
    </motion.div>
  )
}
