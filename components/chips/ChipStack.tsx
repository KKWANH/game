'use client'

import { motion } from 'framer-motion'
import { cn, formatChips } from '@/lib/utils'

// Casino-style chip denominations, highest first.
const DENOMS = [
  { v: 1000, bg: 'var(--chip-black)', ring: 'oklch(0.55 0.02 260)' },
  { v: 500, bg: 'oklch(0.5 0.18 300)', ring: 'oklch(0.78 0.16 300)' },
  { v: 100, bg: 'var(--chip-green)', ring: 'oklch(0.86 0.14 150)' },
  { v: 50, bg: 'oklch(0.62 0.17 55)', ring: 'oklch(0.85 0.15 70)' },
  { v: 25, bg: 'var(--chip-red)', ring: 'oklch(0.86 0.16 25)' },
  { v: 10, bg: 'var(--chip-blue)', ring: 'oklch(0.82 0.14 250)' },
  { v: 1, bg: 'oklch(0.85 0.02 250)', ring: 'oklch(0.6 0.02 250)' },
]

/** Break an amount into up to `max` chip discs by denomination (visual only). */
function toChips(amount: number, max = 5) {
  const chips: (typeof DENOMS)[number][] = []
  let rest = amount
  for (const d of DENOMS) {
    while (rest >= d.v && chips.length < max) {
      chips.push(d)
      rest -= d.v
    }
  }
  if (chips.length === 0 && amount > 0) chips.push(DENOMS[DENOMS.length - 1])
  return chips
}

const SIZE = { sm: 18, md: 26 }

/** A small stacked pile of casino chips representing an amount. */
export function ChipStack({ amount, size = 'sm', label = true }: { amount: number; size?: 'sm' | 'md'; label?: boolean }) {
  if (amount <= 0) return null
  const chips = toChips(amount)
  const d = SIZE[size]
  const overlap = Math.round(d * 0.72)

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: d, height: overlap * (chips.length - 1) + d }}>
        {chips.map((c, i) => (
          <motion.div
            key={i}
            initial={{ y: -16, scale: 0.6, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24, delay: i * 0.05 }}
            className="absolute left-0 rounded-full"
            style={{
              width: d,
              height: d,
              bottom: i * (d - overlap),
              background: `radial-gradient(circle at 50% 35%, color-mix(in oklch, ${c.bg} 80%, white 20%), ${c.bg})`,
              border: `2px solid ${c.ring}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            <div className="absolute inset-[3px] rounded-full border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.35)' }} />
          </motion.div>
        ))}
      </div>
      {label && <span className={cn('mt-0.5 font-bold tabular-nums text-gold', size === 'sm' ? 'text-[10px]' : 'text-xs')}>{formatChips(amount)}</span>}
    </div>
  )
}

/** A single chip disc with a value printed on it (for bet buttons). */
export function ChipButton({ amount, onClick, disabled }: { amount: number; onClick: () => void; disabled?: boolean }) {
  const c = toChips(amount, 1)[0] ?? DENOMS[DENOMS.length - 1]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative h-11 w-11 shrink-0 rounded-full text-xs font-extrabold text-white transition active:scale-90 disabled:opacity-40"
      style={{
        background: `radial-gradient(circle at 50% 32%, color-mix(in oklch, ${c.bg} 78%, white 22%), ${c.bg})`,
        border: `2px solid ${c.ring}`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      <span className="absolute inset-[3px] rounded-full border border-dashed border-white/40" />
      <span className="relative drop-shadow">{amount}</span>
    </button>
  )
}
