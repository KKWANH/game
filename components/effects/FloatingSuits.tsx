'use client'

import { motion } from 'framer-motion'

const SUITS = ['♠', '♥', '♦', '♣']
// Fixed positions/delays (no RNG → no hydration mismatch).
const SEEDS = [
  { x: '8%', s: 42, d: 0, dur: 14, suit: 0, o: 0.05 },
  { x: '22%', s: 28, d: 3, dur: 18, suit: 1, o: 0.045 },
  { x: '37%', s: 56, d: 6, dur: 16, suit: 2, o: 0.04 },
  { x: '52%', s: 34, d: 1.5, dur: 20, suit: 3, o: 0.05 },
  { x: '67%', s: 48, d: 4.5, dur: 15, suit: 0, o: 0.04 },
  { x: '81%', s: 30, d: 2, dur: 19, suit: 1, o: 0.05 },
  { x: '92%', s: 52, d: 7, dur: 17, suit: 2, o: 0.04 },
]

/** Subtle ambient backdrop of drifting card suits. */
export function FloatingSuits() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {SEEDS.map((p, i) => (
        <motion.span
          key={i}
          className="absolute select-none font-serif"
          style={{
            left: p.x,
            fontSize: p.s,
            color: p.suit === 1 || p.suit === 2 ? 'var(--neon-magenta)' : 'var(--neon-cyan)',
            opacity: p.o,
          }}
          initial={{ y: '110vh', rotate: 0 }}
          animate={{ y: '-20vh', rotate: 360 }}
          transition={{ duration: p.dur, delay: p.d, repeat: Infinity, ease: 'linear' }}
        >
          {SUITS[p.suit]}
        </motion.span>
      ))}
    </div>
  )
}
