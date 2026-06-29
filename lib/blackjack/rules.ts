import { Card } from './cards'
import { handTotal, isBlackjack } from './totals'
import { Action, ActionContext, HandView, RoundRules } from './types'

/**
 * Legal actions for a player hand under the given rules + context.
 * Drives both UI button enabling AND server-side validation — there must be
 * exactly one source of truth for what a player may do.
 */
export function legalActions(
  hand: HandView,
  rules: RoundRules,
  ctx: ActionContext
): Action[] {
  const total = handTotal(hand.cards)

  // Terminal states: no actions.
  if (total.isBust) return []
  if (isBlackjack(hand.cards)) return []
  if (total.best === 21) return [] // auto-stand at 21

  // Split aces that drew their one card are done.
  if (hand.isSplitAces && rules.splitAcesOneCard && hand.cards.length >= 2) {
    return []
  }

  const actions: Action[] = ['hit', 'stand']
  const isFirstAction = hand.cards.length === 2 && !hand.isDoubled
  const canAfford = ctx.availableChips >= hand.bet

  // Double down: first action only, must be able to escrow another bet.
  if (isFirstAction && canAfford) {
    const allowedDouble =
      hand.splitDepth === 0 ? rules.allowDouble : rules.allowDoubleAfterSplit
    // Split aces normally cannot double.
    if (allowedDouble && !(hand.isSplitAces && rules.splitAcesOneCard)) {
      actions.push('double')
    }
  }

  // Split: a pair on the first two cards, under the split cap, affordable.
  if (
    rules.allowSplit &&
    isFirstAction &&
    canAfford &&
    hand.cards.length === 2 &&
    isPair(hand.cards) &&
    ctx.currentSplitCount <= rules.maxSplits
  ) {
    actions.push('split')
  }

  // Surrender: first action of the original hand only (late/early).
  if (
    rules.surrender !== 'none' &&
    isFirstAction &&
    hand.splitDepth === 0 &&
    hand.cards.length === 2
  ) {
    actions.push('surrender')
  }

  return actions
}

/** Two cards of equal blackjack value form a splittable pair (10-J-Q-K all 10). */
export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false
  return tenValue(cards[0].rank) === tenValue(cards[1].rank)
}

function tenValue(rank: string): string {
  if (rank === 'J' || rank === 'Q' || rank === 'K') return '10'
  return rank
}

/** Whether insurance should be offered: dealer up-card is an Ace and rules allow. */
export function insuranceOffered(dealerUpcard: Card, rules: RoundRules): boolean {
  return rules.allowInsurance && dealerUpcard.rank === 'A'
}
