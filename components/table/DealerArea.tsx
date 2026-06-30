'use client'

import { HandView } from '@/components/cards/Hand'
import type { HandWithCards } from '@/store/room-store'

export function DealerArea({
  dealerHand,
  phase,
}: {
  dealerHand: HandWithCards | null
  phase: string | null
}) {
  const holeFaceDown = phase === 'player_turns'
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="rounded-full bg-black/30 px-3 py-0.5 text-xs font-semibold uppercase tracking-widest text-gold">
        Dealer
      </span>
      {dealerHand ? (
        <HandView hand={dealerHand} holeFaceDown={holeFaceDown} size="lg" />
      ) : (
        <div className="flex gap-2">
          <div className="h-28 w-[4.5rem] rounded-xl border-2 border-dashed border-border/40" />
          <div className="h-28 w-[4.5rem] rounded-xl border-2 border-dashed border-border/40" />
        </div>
      )}
    </div>
  )
}
