import { Card } from './cards'
import { handTotal, HandTotal } from './totals'
import { RoundRules } from './types'

/**
 * Auto-play the dealer hand under fixed casino rules.
 * The dealer hits until reaching 17+; on soft 17 it hits only when
 * `dealerHitsSoft17` is set. Used for both AI dealers and human "bank" dealers
 * (the human never chooses — the server plays the dealer hand identically).
 *
 * `drawNext` pulls the next card from the (server-only) shoe.
 */
export function playDealer(
  initialCards: Card[],
  drawNext: () => Card,
  rules: RoundRules
): { cards: Card[]; total: HandTotal } {
  const cards = initialCards.slice()
  // Safety bound: a hand can't exceed ~11 cards before busting/standing.
  for (let guard = 0; guard < 32; guard++) {
    const total = handTotal(cards)
    if (shouldDealerHit(total, rules)) {
      cards.push(drawNext())
    } else {
      return { cards, total }
    }
  }
  return { cards, total: handTotal(cards) }
}

/** Pure predicate: should the dealer take another card at this total? */
export function shouldDealerHit(total: HandTotal, rules: RoundRules): boolean {
  if (total.isBust) return false
  if (total.best < 17) return true
  if (total.best === 17 && total.isSoft && rules.dealerHitsSoft17) return true
  return false
}
