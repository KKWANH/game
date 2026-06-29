'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { playerAction } from '@/actions/game-actions'
import {
  legalActions,
  type Action,
  type Card,
  type Rank,
  type Suit,
  type HandView,
} from '@/lib/blackjack'
import type { HandWithCards } from '@/store/room-store'
import type { RoomConfigRow, SeatRow } from '@/lib/supabase/types'
import { rulesFromConfig } from '@/lib/game/types'

const LABELS: Record<Action, string> = {
  hit: '히트',
  stand: '스탠드',
  double: '더블',
  split: '스플릿',
  surrender: '서렌더',
  insurance: '인슈어런스',
}

export function ActionBar({
  roundId,
  hand,
  seat,
  config,
  dealerUpcard,
  splitCount,
  insuranceOffered,
}: {
  roundId: string
  hand: HandWithCards
  seat: SeatRow
  config: RoomConfigRow
  dealerUpcard: Card | null
  splitCount: number
  insuranceOffered: boolean
}) {
  const [pending, setPending] = useState<Action | null>(null)

  const cards: Card[] = hand.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))
  const view: HandView = {
    cards,
    bet: hand.bet_amount,
    splitDepth: hand.split_depth,
    isDoubled: hand.is_doubled,
    fromSplit: hand.split_depth > 0,
    isSplitAces: hand.is_split_aces,
  }
  const rules = rulesFromConfig(config)
  const actions = legalActions(view, rules, {
    availableChips: seat.chip_stack,
    currentSplitCount: splitCount,
    dealerUpcard: dealerUpcard ?? { rank: '2', suit: 'S' },
  })

  // Insurance is shown separately when offered and not yet taken.
  const showInsurance = insuranceOffered && hand.insurance_bet === 0

  async function act(action: Action) {
    setPending(action)
    try {
      const res = await playerAction({ roundId, handId: hand.id, action })
      if (res?.conflict) toast.info('상태가 변경됐어요. 다시 시도하세요.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '행동 실패')
    } finally {
      setPending(null)
    }
  }

  const order: Action[] = ['hit', 'stand', 'double', 'split', 'surrender']

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {showInsurance && (
        <Button variant="gold" size="lg" disabled={pending !== null} onClick={() => act('insurance')}>
          {LABELS.insurance}
        </Button>
      )}
      {order
        .filter((a) => actions.includes(a))
        .map((a) => (
          <Button
            key={a}
            size="lg"
            variant={a === 'hit' ? 'primary' : a === 'stand' ? 'secondary' : 'ghost'}
            disabled={pending !== null}
            onClick={() => act(a)}
          >
            {LABELS[a]}
          </Button>
        ))}
    </div>
  )
}
