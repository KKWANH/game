'use client'

import { cn } from '@/lib/utils'
import type { RoundPhase, RoomStatus } from '@/lib/supabase/types'

const PHASE_LABEL: Record<string, string> = {
  betting: '베팅 단계',
  dealing: '카드 분배 중',
  player_turns: '플레이어 턴',
  dealer_turn: '딜러 턴',
  settlement: '정산 중',
  complete: '라운드 종료',
}

export function PhaseBanner({
  phase,
  status,
  secondsLeft,
}: {
  phase: RoundPhase | null
  status: RoomStatus | null
  secondsLeft: number | null
}) {
  const label =
    status === 'lobby'
      ? '대기실'
      : status === 'settled'
        ? '최종 정산'
        : phase
          ? PHASE_LABEL[phase]
          : '대기 중'

  return (
    <div className="flex items-center gap-3">
      <span className="shimmer-gold text-sm font-bold uppercase tracking-widest">{label}</span>
      {secondsLeft !== null && phase === 'player_turns' && (
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums',
            secondsLeft <= 5 ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-black/40 text-gold'
          )}
        >
          {secondsLeft}
        </span>
      )}
    </div>
  )
}
