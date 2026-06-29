'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const SUIT_GLYPH: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }

export interface PlayingCardProps {
  rank?: string
  suit?: string
  faceDown?: boolean
  index?: number
  size?: 'sm' | 'md'
}

/** A single flashy playing card with a deal-in animation. */
export function PlayingCard({ rank, suit, faceDown, index = 0, size = 'md' }: PlayingCardProps) {
  const red = suit === 'H' || suit === 'D'
  const dims = size === 'sm' ? 'w-10 h-14 text-sm' : 'w-14 h-20 sm:w-16 sm:h-24 text-base'

  return (
    <motion.div
      initial={{ y: -40, opacity: 0, rotateY: 90, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: index * 0.08 }}
      className={cn('relative shrink-0 rounded-lg select-none', dims)}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {faceDown ? (
        <div className="absolute inset-0 rounded-lg border border-gold/40 bg-gradient-to-br from-felt-deep to-background overflow-hidden">
          <div className="absolute inset-1 rounded-md border border-gold/30 [background:repeating-linear-gradient(45deg,transparent,transparent_4px,color-mix(in_oklch,var(--gold)_25%,transparent)_4px,color-mix(in_oklch,var(--gold)_25%,transparent)_6px)]" />
        </div>
      ) : (
        <div className="absolute inset-0 overflow-hidden rounded-lg border border-black/10 bg-gradient-to-br from-white to-neutral-100 text-neutral-900 shadow-md">
          <motion.div
            className="pointer-events-none absolute inset-0 -skew-x-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)' }}
            initial={{ x: '-150%' }}
            animate={{ x: '150%' }}
            transition={{ delay: index * 0.08 + 0.2, duration: 0.5, ease: 'easeOut' }}
          />
          <div className={cn('absolute top-1 left-1.5 font-bold leading-none', red && 'text-rose-600')}>
            <div>{rank}</div>
            <div className="text-xs">{suit ? SUIT_GLYPH[suit] : ''}</div>
          </div>
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center text-2xl sm:text-3xl',
              red ? 'text-rose-600' : 'text-neutral-900'
            )}
          >
            {suit ? SUIT_GLYPH[suit] : ''}
          </div>
          <div
            className={cn(
              'absolute bottom-1 right-1.5 font-bold leading-none rotate-180',
              red && 'text-rose-600'
            )}
          >
            <div>{rank}</div>
            <div className="text-xs">{suit ? SUIT_GLYPH[suit] : ''}</div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
