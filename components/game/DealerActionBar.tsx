'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { dealerAction } from '@/actions/game-actions'
import { handTotal, type Card, type Rank, type Suit } from '@/lib/blackjack'
import type { HandWithCards } from '@/store/room-store'

/** Hit/stand controls shown to a HUMAN dealer on their turn. */
export function DealerActionBar({ roundId, dealerHand }: { roundId: string; dealerHand: HandWithCards }) {
  const [pending, setPending] = useState(false)
  const cards: Card[] = dealerHand.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))
  const total = cards.length ? handTotal(cards) : null
  const canHit = !!total && total.best < 21

  async function act(action: 'hit' | 'stand') {
    setPending(true)
    try {
      const res = await dealerAction({ roundId, action })
      if (res?.conflict) toast.info('상태가 변경됐어요.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '실패')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-muted-foreground">
        딜러 패: <span className="font-bold text-gold">{total?.best ?? '-'}</span> · 직접 진행하세요
      </span>
      <div className="flex items-center gap-2">
        <Button size="lg" variant="primary" disabled={pending || !canHit} onClick={() => act('hit')}>
          히트
        </Button>
        <Button size="lg" variant="secondary" disabled={pending} onClick={() => act('stand')}>
          스탠드
        </Button>
      </div>
    </div>
  )
}
