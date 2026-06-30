// AI decision-making: basic blackjack strategy with difficulty tiers.
// Pure functions — easy to unit-test, run server-side to drive AI seats.

import { Card, cardValue } from './cards'
import { handTotal } from './totals'
import { isPair } from './rules'
import type { Action, HandView, RoundRules } from './types'

export type Difficulty = 'easy' | 'normal' | 'hard'

function upValue(c: Card): number {
  return c.rank === 'A' ? 11 : cardValue(c.rank)
}

/** Textbook basic-strategy move for a hand vs the dealer up-card. */
function basicAction(view: HandView, dealerUp: Card): Action {
  const cards = view.cards
  const total = handTotal(cards)
  const up = upValue(dealerUp)
  const isFirst = cards.length === 2 && !view.isDoubled

  // Pairs
  if (isFirst && isPair(cards)) {
    const r = cards[0].rank
    if (r === 'A' || r === '8') return 'split'
    if ((r === '2' || r === '3' || r === '7') && up >= 2 && up <= 7) return 'split'
    if (r === '6' && up >= 2 && up <= 6) return 'split'
    if (r === '9' && up <= 9 && up !== 7) return 'split'
    // 4s, 5s, 10s: never split → fall through to totals
  }

  // Soft totals (a counted ace)
  if (total.isSoft) {
    const best = total.best
    if (best >= 19) return 'stand'
    if (best === 18) {
      if (isFirst && up >= 3 && up <= 6) return 'double'
      return up >= 2 && up <= 8 ? 'stand' : 'hit'
    }
    if (isFirst && best >= 15 && best <= 17 && up >= 4 && up <= 6) return 'double'
    if (isFirst && best >= 13 && best <= 14 && up >= 5 && up <= 6) return 'double'
    return 'hit'
  }

  // Hard totals
  const t = total.best
  if (t >= 17) return 'stand'
  if (t >= 13 && t <= 16) return up >= 2 && up <= 6 ? 'stand' : 'hit'
  if (t === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit'
  if (t === 11) return isFirst ? 'double' : 'hit'
  if (t === 10) return isFirst && up <= 9 ? 'double' : 'hit'
  if (t === 9) return isFirst && up >= 3 && up <= 6 ? 'double' : 'hit'
  return 'hit'
}

/**
 * Pick a legal action for an AI hand. `difficulty` shapes how sharp it plays:
 *  - easy: naive (hit < 17, else stand); never doubles/splits/surrenders, and
 *    sometimes makes a mistake.
 *  - normal: basic strategy, occasional slip, no surrender.
 *  - hard: full basic strategy.
 * `rng` defaults to Math.random (server-side).
 */
export function decidePlay(
  view: HandView,
  dealerUp: Card,
  legal: Action[],
  difficulty: Difficulty,
  rng: () => number = Math.random
): Action {
  if (legal.length === 0) return 'stand'
  const can = (a: Action) => legal.includes(a)

  if (difficulty === 'easy') {
    const t = handTotal(view.cards).best
    // 15% of the time, do the "wrong" obvious thing.
    const flip = rng() < 0.15
    const wantHit = flip ? t >= 17 : t < 17
    return wantHit && can('hit') ? 'hit' : can('stand') ? 'stand' : legal[0]
  }

  let ideal = basicAction(view, dealerUp)
  if (difficulty === 'normal' && rng() < 0.1) {
    // occasional slip: hit/stand by total only
    ideal = handTotal(view.cards).best < 17 ? 'hit' : 'stand'
  }
  if (difficulty !== 'hard' && ideal === 'surrender') ideal = 'hit'

  if (can(ideal)) return ideal
  // Fall back when the ideal move isn't available here.
  if (ideal === 'double') return can('hit') ? 'hit' : 'stand'
  if (ideal === 'split') {
    const t = handTotal(view.cards).best
    return t < 17 && can('hit') ? 'hit' : can('stand') ? 'stand' : legal[0]
  }
  if (ideal === 'surrender') return can('hit') ? 'hit' : 'stand'
  return can('stand') ? 'stand' : legal[0]
}

/** How much an AI bets this round. */
export function decideBet(rules: RoundRules, stack: number, minBet: number, maxBet: number, difficulty: Difficulty, rng: () => number = Math.random): number {
  if (stack < minBet) return 0
  const cap = Math.min(maxBet, stack)
  let target: number
  if (difficulty === 'easy') target = minBet * (1 + Math.floor(rng() * 3)) // 1-3x min
  else if (difficulty === 'normal') target = minBet * (2 + Math.floor(rng() * 4)) // 2-5x min
  else target = Math.max(minBet, Math.round((stack * 0.05) / minBet) * minBet) // ~5% of stack
  return Math.max(minBet, Math.min(cap, target))
}
