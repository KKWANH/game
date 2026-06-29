import { Card } from './cards'

export type SurrenderRule = 'none' | 'late' | 'early'

/** Frozen per-round rule configuration (a snapshot of room_config). */
export interface RoundRules {
  numDecks: number
  dealerHitsSoft17: boolean
  /** Blackjack payout as a fraction, e.g. {num:3,den:2} (3:2) or {num:6,den:5}. */
  blackjackPayout: { num: number; den: number }
  allowDouble: boolean
  /** Double after split allowed. */
  allowDoubleAfterSplit: boolean
  allowSplit: boolean
  /** Max number of times a hand may be split (3 → up to 4 hands). */
  maxSplits: number
  surrender: SurrenderRule
  allowInsurance: boolean
  /** Split aces draw only one card each and cannot be hit further. */
  splitAcesOneCard: boolean
}

export const DEFAULT_RULES: RoundRules = {
  numDecks: 6,
  dealerHitsSoft17: false,
  blackjackPayout: { num: 3, den: 2 },
  allowDouble: true,
  allowDoubleAfterSplit: true,
  allowSplit: true,
  maxSplits: 3,
  surrender: 'late',
  allowInsurance: true,
  splitAcesOneCard: true,
}

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'insurance'

export type HandStatus =
  | 'active'
  | 'stood'
  | 'busted'
  | 'blackjack'
  | 'surrendered'

export type Outcome = 'win' | 'lose' | 'push' | 'blackjack' | 'surrender'

/** Minimal view of a player hand the rules engine reasons about. */
export interface HandView {
  cards: Card[]
  bet: number
  /** Number of splits performed to reach this hand (0 = original). */
  splitDepth: number
  /** Already doubled. */
  isDoubled: boolean
  /** Result of a split that produced this hand (for split-ace one-card rule). */
  fromSplit: boolean
  isSplitAces: boolean
}

/** Context the rules engine needs to decide legal actions for a hand. */
export interface ActionContext {
  /** Chips the player still has available to escrow (for double/split). */
  availableChips: number
  /** How many hands the player's original position is currently split into. */
  currentSplitCount: number
  /** Dealer's visible up-card (for early-surrender / insurance gating). */
  dealerUpcard: Card
}
