'use client'

import { cn, formatChips } from '@/lib/utils'
import { HandView } from '@/components/cards/Hand'
import type { HandWithCards } from '@/store/room-store'
import type { SeatRow } from '@/lib/supabase/types'

export function Seat({
  seat,
  hands,
  activeHandId,
  isMe,
  present,
}: {
  seat: SeatRow
  hands: HandWithCards[]
  activeHandId: string | null
  isMe: boolean
  present: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex min-h-[80px] items-end gap-2">
        {hands.length === 0 ? (
          <div className="h-20 w-16 rounded-lg border border-dashed border-border/60" />
        ) : (
          hands.map((h) => (
            <div key={h.id} className="flex flex-col items-center">
              <HandView hand={h} isActive={h.id === activeHandId} size="sm" />
              {h.bet_amount > 0 && (
                <span className="mt-0.5 text-[10px] font-bold text-gold">
                  {formatChips(h.bet_amount)}
                  {h.insurance_bet > 0 ? ` (+ins ${formatChips(h.insurance_bet)})` : ''}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div
        className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
          isMe ? 'border-gold/60 bg-gold/10' : 'border-border bg-card/70',
          activeHandId && hands.some((h) => h.id === activeHandId) && 'glow-gold'
        )}
      >
        <span
          className={cn('h-2 w-2 rounded-full', present ? 'bg-accent' : 'bg-muted-foreground/40')}
        />
        <span className="max-w-[8rem] truncate font-medium">{seat.display_name}</span>
        {seat.is_dealer && <span className="text-xs text-gold">딜러</span>}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        💰 {formatChips(seat.chip_stack)}
      </span>
    </div>
  )
}
