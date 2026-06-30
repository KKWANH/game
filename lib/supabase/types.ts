// Hand-written DB types mirroring supabase/migrations. When the project is
// live you can regenerate with `supabase gen types typescript`.
//
// NOTE: Row/Insert/Update types MUST be `type` aliases (object literals), not
// `interface`s — interfaces lack an implicit index signature and therefore do
// not satisfy supabase-js's `extends Record<string, unknown>` constraint, which
// silently collapses every query result to `never`.

export type RoomStatus = 'lobby' | 'active' | 'settled' | 'closed'
export type DealerType = 'ai' | 'human'
export type SeatStatus = 'seated' | 'sitting_out' | 'left'
export type RoundPhase =
  | 'betting'
  | 'dealing'
  | 'player_turns'
  | 'dealer_turn'
  | 'settlement'
  | 'complete'
export type HandStatus =
  | 'betting'
  | 'active'
  | 'stood'
  | 'busted'
  | 'blackjack'
  | 'surrendered'
  | 'settled'
export type LedgerType =
  | 'buy_in'
  | 'bet'
  | 'payout'
  | 'insurance'
  | 'insurance_payout'
  | 'refund'
  | 'adjustment'

export type RoomRow = {
  id: string
  code: string
  name: string
  host_user_id: string
  status: RoomStatus
  dealer_type: DealerType
  dealer_seat_id: string | null
  current_round_id: string | null
  /** real-money value of one chip in KRW; 0 = off (chips only). (migration 0007) */
  chip_value_krw: number
  created_at: string
  updated_at: string
}

export type RoomConfigRow = {
  room_id: string
  num_decks: number
  min_bet: number
  max_bet: number
  blackjack_payout_num: number
  blackjack_payout_den: number
  dealer_hits_soft_17: boolean
  allow_double: boolean
  allow_double_after_split: boolean
  allow_split: boolean
  max_splits: number
  surrender: 'none' | 'late' | 'early'
  allow_insurance: boolean
  split_aces_one_card: boolean
  turn_timer_seconds: number
  max_seats: number
  play_direction: 'cw' | 'ccw'
}

export type SeatRow = {
  id: string
  room_id: string
  seat_index: number
  user_id: string | null
  display_name: string
  is_dealer: boolean
  is_ai: boolean
  ai_difficulty: 'easy' | 'normal' | 'hard'
  chip_stack: number
  total_buy_in: number
  status: SeatStatus
  joined_at: string
}

export type GameRoundRow = {
  id: string
  room_id: string
  round_number: number
  phase: RoundPhase
  active_hand_id: string | null
  turn_deadline: string | null
  config_snapshot: RoomConfigRow
  dealer_hand_id: string | null
  version: number
  created_at: string
}

export type HandRow = {
  id: string
  round_id: string
  seat_id: string | null
  is_dealer: boolean
  parent_hand_id: string | null
  split_depth: number
  bet_amount: number
  insurance_bet: number
  is_doubled: boolean
  is_split_aces: boolean
  status: HandStatus
  outcome: 'win' | 'lose' | 'push' | 'blackjack' | 'surrender' | null
  payout: number | null
  seat_order: number
  created_at: string
}

export type HandCardRow = {
  id: string
  hand_id: string
  card_index: number
  rank: string
  suit: string
  created_at: string
}

export type ChipLedgerRow = {
  id: string
  room_id: string
  seat_id: string
  round_id: string | null
  hand_id: string | null
  type: LedgerType
  amount: number
  balance_after: number
  created_at: string
}

export type SettlementRow = {
  id: string
  room_id: string
  /** 'interim' = mid-game snapshot, 'final' = room closed. (migration 0007) */
  kind?: 'interim' | 'final'
  /** KRW per chip at compute time; 0 = chips only. (migration 0007) */
  chip_value_krw?: number
  computed_at: string
  net_by_seat: {
    seatId: string
    displayName: string
    net: number
    buyIn: number
    stack: number
    /** Net used for who-owes-whom after AI seats are squared out. Older rows omit it. */
    settleNet?: number
    isDealer?: boolean
    isAi?: boolean
  }[]
  transfers: { fromSeat: string; toSeat: string; amount: number }[]
  /** Combined net held by AI seats, spread evenly across humans. Older rows omit it. */
  aiNet?: number
}

export type RoundSecretRow = {
  round_id: string
  deck: { rank: string; suit: string }[]
  deck_cursor: number
  dealer_hole_card: { rank: string; suit: string } | null
  shuffle_seed: string | null
}

type Tbl<R> = {
  Row: R
  Insert: Partial<R>
  Update: Partial<R>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      rooms: Tbl<RoomRow>
      room_config: Tbl<RoomConfigRow>
      seats: Tbl<SeatRow>
      game_rounds: Tbl<GameRoundRow>
      hands: Tbl<HandRow>
      hand_cards: Tbl<HandCardRow>
      chip_ledger: Tbl<ChipLedgerRow>
      settlements: Tbl<SettlementRow>
    }
    Views: Record<string, never>
    Functions: {
      apply_buy_in: { Args: { p_seat_id: string; p_amount: number }; Returns: number }
      record_chip_movement: {
        Args: {
          p_seat_id: string
          p_round_id: string | null
          p_hand_id: string | null
          p_type: string
          p_amount: number
        }
        Returns: number
      }
      commit_round_mutation: {
        Args: { p_round_id: string; p_expected_version: number; p_patch: unknown }
        Returns: { version: number }
      }
      is_room_member: { Args: { p_room_id: string }; Returns: boolean }
      create_round_secret: { Args: { p_round_id: string; p_deck: unknown }; Returns: undefined }
      get_round_secret: {
        Args: { p_round_id: string }
        Returns: {
          deck: { rank: string; suit: string }[]
          deck_cursor: number
          dealer_hole_card: { rank: string; suit: string } | null
        } | null
      }
      set_dealer_hole_card: { Args: { p_round_id: string; p_card: unknown }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  private: {
    Tables: {
      round_secrets: Tbl<RoundSecretRow>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
