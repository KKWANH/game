import { Card, cardValue } from './cards'

export interface HandTotal {
  /** Total counting every ace as 1. */
  hard: number
  /**
   * The best total <= 21 when one ace is counted as 11, or null if no ace
   * can be counted high without busting.
   */
  soft: number | null
  /** The total the hand actually plays as (soft if available, else hard). */
  best: number
  /** True when an ace is currently counted as 11 in `best`. */
  isSoft: boolean
  /** True when even the hard total exceeds 21. */
  isBust: boolean
}

/**
 * Compute hard/soft/best totals for a hand.
 * Aces are 11 unless that busts, in which case they drop to 1.
 */
export function handTotal(cards: Card[]): HandTotal {
  let total = 0
  let aces = 0
  for (const c of cards) {
    total += cardValue(c.rank)
    if (c.rank === 'A') aces++
  }

  const hard = total - aces * 10 // every ace as 1

  // Reduce aces from 11 to 1 until <= 21.
  let best = total
  let acesAsEleven = aces
  while (best > 21 && acesAsEleven > 0) {
    best -= 10
    acesAsEleven--
  }

  const isSoft = acesAsEleven > 0 && best <= 21
  const soft = isSoft ? best : null
  const isBust = hard > 21

  return { hard, soft, best, isSoft, isBust }
}

/** True for a two-card 21 (a "natural"). */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards).best === 21
}

export function isBust(cards: Card[]): boolean {
  return handTotal(cards).isBust
}
