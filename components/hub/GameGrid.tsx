'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/provider'

interface Game {
  key: string
  name: string
  emoji: string
  tagline: string
  href?: string
  accent: string // css color var
}

const GAMES: Game[] = [
  { key: 'blackjack', name: 'Blackjack', emoji: '🃏', tagline: '친구끼리 실시간 블랙잭', href: '/blackjack', accent: 'var(--gold)' },
  { key: 'holdem', name: "Hold'em", emoji: '♠️', tagline: '곧 출시', accent: 'var(--neon-cyan)' },
  { key: 'baccarat', name: 'Baccarat', emoji: '🎴', tagline: '곧 출시', accent: 'var(--accent)' },
]

export function GameGrid() {
  const t = useT()
  return (
    <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {GAMES.map((g, i) => {
        const disabled = !g.href
        const card = (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
            whileHover={disabled ? undefined : { y: -6, scale: 1.02 }}
            whileTap={disabled ? undefined : { scale: 0.99 }}
            className={cn(
              'group relative flex h-52 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border p-6 text-center',
              disabled
                ? 'cursor-not-allowed border-border/50 bg-card/40 opacity-60'
                : 'cursor-pointer border-border bg-card/70'
            )}
            style={{ boxShadow: disabled ? undefined : `0 0 0 0 transparent` }}
          >
            {/* Glow wash that brightens on hover */}
            {!disabled && (
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `radial-gradient(70% 60% at 50% 0%, color-mix(in oklch, ${g.accent} 22%, transparent), transparent 70%)` }}
              />
            )}
            <motion.span
              className="text-6xl drop-shadow"
              animate={disabled ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
            >
              {g.emoji}
            </motion.span>
            <div className="relative">
              <div className="text-2xl font-extrabold tracking-tight">{g.name}</div>
              <div className="text-sm text-muted-foreground">{t(g.tagline)}</div>
            </div>
            {disabled ? (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-secondary-foreground">
                {t('COMING SOON')}
              </span>
            ) : (
              <span className="rounded-full bg-gradient-to-r from-gold-bright to-gold px-3 py-1 text-xs font-extrabold text-primary-foreground shadow">
                {t('입장 →')}
              </span>
            )}
          </motion.div>
        )
        return disabled ? (
          <div key={g.key}>{card}</div>
        ) : (
          <Link key={g.key} href={g.href!} aria-label={g.name}>
            {card}
          </Link>
        )
      })}
    </div>
  )
}
