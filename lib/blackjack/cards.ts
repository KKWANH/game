// Pure card primitives. No I/O, fully deterministic.

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'

export type Suit = 'S' | 'H' | 'D' | 'C'

export interface Card {
  rank: Rank
  suit: Suit
}

export const RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
]

export const SUITS: Suit[] = ['S', 'H', 'D', 'C']

/** Base value of a rank. Aces count as 11 here; soft/hard handled in totals. */
export function cardValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`
}
