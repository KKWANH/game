'use client'

import { motion } from 'framer-motion'

const PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2
  return { dx: Math.cos(angle) * 60, dy: Math.sin(angle) * 60, delay: i * 0.015 }
})

/** A one-shot gold coin/spark burst, rendered when a hand wins. */
export function WinBurst({ big = false }: { big?: boolean }) {
  const scale = big ? 1.4 : 1
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden>
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{ background: i % 2 ? 'var(--gold-bright)' : 'var(--neon-cyan)' }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.dx * scale, y: p.dy * scale, opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.7, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        className="absolute rounded-full"
        style={{ boxShadow: '0 0 30px 8px color-mix(in oklch, var(--gold) 60%, transparent)' }}
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: big ? 3 : 2, opacity: 0 }}
        transition={{ duration: 0.6 }}
      />
    </div>
  )
}
