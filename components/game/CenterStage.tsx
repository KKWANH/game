'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { RoundPhase, RoomStatus } from '@/lib/supabase/types'

/** The middle-of-table focal point: makes the felt feel alive and tells every
 *  player exactly what's happening right now. */
export function CenterStage({
  status,
  phase,
  secondsLeft,
  turnSeconds,
  activePlayerName,
  isMyTurn,
}: {
  status: RoomStatus | null
  phase: RoundPhase | null
  secondsLeft: number | null
  turnSeconds: number
  activePlayerName: string | null
  isMyTurn: boolean
}) {
  let title = ''
  let subtitle = ''
  let tone: 'idle' | 'bet' | 'turn' | 'dealer' | 'done' = 'idle'

  if (status === 'lobby' || !phase) {
    title = '대기 중'
    subtitle = '호스트가 게임을 시작하면 베팅이 열립니다'
    tone = 'idle'
  } else if (phase === 'betting') {
    title = isMyTurn ? '베팅하세요!' : `${activePlayerName ?? '플레이어'} 베팅 중`
    subtitle = isMyTurn ? '칩을 걸거나 패스하세요' : '차례를 기다리는 중…'
    tone = 'bet'
  } else if (phase === 'dealing') {
    title = '카드 분배'
    subtitle = '딜링 중…'
    tone = 'dealer'
  } else if (phase === 'player_turns') {
    title = isMyTurn ? '당신의 차례!' : `${activePlayerName ?? '플레이어'}의 차례`
    subtitle = isMyTurn ? '행동을 선택하세요' : '기다리는 중…'
    tone = 'turn'
  } else if (phase === 'dealer_turn') {
    title = '딜러 차례'
    subtitle = '딜러가 카드를 받는 중…'
    tone = 'dealer'
  } else if (phase === 'settlement' || phase === 'complete') {
    title = '라운드 종료'
    subtitle = '결과 정산 완료'
    tone = 'done'
  }

  const showTimer = (phase === 'player_turns' || phase === 'betting') && secondsLeft !== null

  return (
    <div className="pointer-events-none flex flex-col items-center justify-center gap-3 text-center">
      <motion.div
        key={title}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center gap-1"
      >
        <span
          className={cn(
            'text-2xl font-extrabold tracking-tight sm:text-3xl',
            tone === 'turn' && isMyTurn ? 'shimmer-gold' : 'text-foreground/90'
          )}
        >
          {title}
        </span>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </motion.div>

      {showTimer && (
        <TimerRing seconds={secondsLeft!} max={turnSeconds} urgent={secondsLeft! <= 5} />
      )}
    </div>
  )
}

function TimerRing({ seconds, max, urgent }: { seconds: number; max: number; urgent: boolean }) {
  const pct = Math.max(0, Math.min(1, seconds / Math.max(1, max)))
  const R = 22
  const C = 2 * Math.PI * R
  return (
    <div className="relative h-14 w-14">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={R} fill="none" stroke="color-mix(in oklch, var(--foreground) 12%, transparent)" strokeWidth="4" />
        <motion.circle
          cx="26"
          cy="26"
          r={R}
          fill="none"
          stroke={urgent ? 'var(--destructive)' : 'var(--gold)'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={false}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 0.25, ease: 'linear' }}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums',
          urgent ? 'text-destructive' : 'text-gold'
        )}
      >
        {seconds}
      </span>
    </div>
  )
}
