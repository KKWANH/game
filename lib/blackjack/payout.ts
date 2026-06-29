import { Card } from './cards'
import { handTotal, isBlackjack } from './totals'
import { Outcome, RoundRules } from './types'

export interface SettleHandInput {
  cards: Card[]
  /** Total chips escrowed for this hand (includes the doubled amount). */
  bet: number
  /** 0 for the original hand; > 0 for split-off hands. */
  splitDepth: number
  /** Player chose to surrender this hand. */
  surrendered?: boolean
}

export interface SettleResult {
  outcome: Outcome
  /**
   * Gross chips returned to the player's stack at settlement, written as a
   * positive `payout` ledger row. The original bet was already escrowed as a
   * negative `bet` row, so net = payout - bet.
   *   loss → 0, push → bet, win → 2*bet, blackjack → bet + bet*num/den,
   *   surrender → floor(bet/2).
   */
  payout: number
}

/**
 * Settle a single player hand against the resolved dealer hand. Pure.
 */
export function settleHand(
  player: SettleHandInput,
  dealer: { cards: Card[] },
  rules: RoundRules
): SettleResult {
  const bet = player.bet

  if (player.surrendered) {
    return { outcome: 'surrender', payout: Math.floor(bet / 2) }
  }

  const playerTotal = handTotal(player.cards)
  if (playerTotal.isBust) {
    return { outcome: 'lose', payout: 0 }
  }

  // A natural blackjack only counts on the original (unsplit) two-card hand.
  const playerBJ = player.splitDepth === 0 && isBlackjack(player.cards)
  const dealerBJ = isBlackjack(dealer.cards)

  if (playerBJ && dealerBJ) return { outcome: 'push', payout: bet }
  if (playerBJ) {
    const winnings = Math.floor(
      (bet * rules.blackjackPayout.num) / rules.blackjackPayout.den
    )
    return { outcome: 'blackjack', payout: bet + winnings }
  }
  if (dealerBJ) return { outcome: 'lose', payout: 0 }

  const dealerTotal = handTotal(dealer.cards)
  if (dealerTotal.isBust) return { outcome: 'win', payout: bet * 2 }

  if (playerTotal.best > dealerTotal.best) {
    return { outcome: 'win', payout: bet * 2 }
  }
  if (playerTotal.best < dealerTotal.best) {
    return { outcome: 'lose', payout: 0 }
  }
  return { outcome: 'push', payout: bet }
}

/**
 * Settle an insurance side bet. Pays 2:1 when the dealer has blackjack:
 * the player gets their stake back plus twice the stake (3x gross). Otherwise
 * the insurance stake is lost (0 returned).
 */
export function settleInsurance(
  insuranceBet: number,
  dealerHasBlackjack: boolean
): number {
  return dealerHasBlackjack ? insuranceBet * 3 : 0
}
