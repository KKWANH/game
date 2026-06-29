'use client'

import { cn } from '@/lib/utils'
import { formatChips } from '@/lib/utils'

const CHIP_TIERS = [
  { v: 1000, color: 'var(--chip-black)', ring: 'oklch(0.5 0.02 260)' },
  { v: 500, color: 'var(--chip-blue)', ring: 'oklch(0.8 0.1 250)' },
  { v: 100, color: 'var(--chip-green)', ring: 'oklch(0.85 0.12 150)' },
  { v: 25, color: 'var(--chip-red)', ring: 'oklch(0.85 0.15 25)' },
]

/** A small stack of casino chips representing an amount (visual approximation). */
export function ChipStack({ amount, className }: { amount: number; className?: string }) {
  if (amount <= 0) return null
  const tier = CHIP_TIERS.find((t) => amount >= t.v) ?? CHIP_TIERS[CHIP_TIERS.length - 1]
  const count = Math.min(5, Math.max(1, Math.round(amount / tier.v) || 1))

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div className="relative" style={{ height: 8 + count * 4 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border-2"
            style={{
              bottom: i * 4,
              background: tier.color,
              borderColor: tier.ring,
              boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          />
        ))}
      </div>
      <span className="mt-1 text-xs font-bold tabular-nums text-gold">{formatChips(amount)}</span>
    </div>
  )
}
