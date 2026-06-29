import type {
  GameRoundRow,
  HandCardRow,
  HandRow,
  RoomConfigRow,
  RoomRow,
  SeatRow,
} from '@/lib/supabase/types'
import type { RoundRules } from '@/lib/blackjack'

/** A hand plus its visible cards, as assembled for the engine. */
export interface LoadedHand extends HandRow {
  cards: HandCardRow[]
}

/** Everything the server engine needs about a round to compute the next state. */
export interface RoundState {
  room: RoomRow
  config: RoomConfigRow
  round: GameRoundRow
  seats: SeatRow[]
  hands: LoadedHand[]
  /** Secret shoe — server-only, never sent to clients. */
  deck: { rank: string; suit: string }[]
  deckCursor: number
  dealerHoleCard: { rank: string; suit: string } | null
}

/** Mirrors the jsonb patch consumed by public.commit_round_mutation. */
export interface RoundPatch {
  round?: {
    phase?: string
    active_hand_id?: string | null
    turn_deadline?: string | null
    dealer_hand_id?: string | null
  }
  deck_cursor?: number
  reveal_hole?: boolean
  insert_hands?: Record<string, unknown>[]
  update_hands?: Record<string, unknown>[]
  insert_cards?: { hand_id: string; card_index: number; rank: string; suit: string }[]
  ledger?: {
    seat_id: string
    round_id?: string | null
    hand_id?: string | null
    type: string
    amount: number
  }[]
  seat_status?: { id: string; status: string }[]
}

export function rulesFromConfig(c: RoomConfigRow): RoundRules {
  return {
    numDecks: c.num_decks,
    dealerHitsSoft17: c.dealer_hits_soft_17,
    blackjackPayout: { num: c.blackjack_payout_num, den: c.blackjack_payout_den },
    allowDouble: c.allow_double,
    allowDoubleAfterSplit: c.allow_double_after_split,
    allowSplit: c.allow_split,
    maxSplits: c.max_splits,
    surrender: c.surrender,
    allowInsurance: c.allow_insurance,
    splitAcesOneCard: c.split_aces_one_card,
  }
}
