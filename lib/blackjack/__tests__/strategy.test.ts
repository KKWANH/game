import { describe, it, expect } from 'vitest'
import { Card, Rank, Suit } from '../cards'
import { decidePlay, decideBet } from '../strategy'
import { DEFAULT_RULES, type Action, type HandView } from '../types'

function h(...specs: string[]): Card[] {
  return specs.map((s) => ({ rank: s.slice(0, s.length - 1) as Rank, suit: s.slice(-1) as Suit }))
}
function hand(cards: Card[], extra: Partial<HandView> = {}): HandView {
  return { cards, bet: 100, splitDepth: 0, isDoubled: false, fromSplit: false, isSplitAces: false, ...extra }
}
const card = (s: string) => h(s)[0]
const ALL: Action[] = ['hit', 'stand', 'double', 'split', 'surrender']
const noMistake = () => 0.9 // above the slip thresholds

describe('decidePlay (hard difficulty = basic strategy)', () => {
  it('hits hard 16 vs dealer 10', () => {
    expect(decidePlay(hand(h('10S', '6H')), card('10D'), ALL, 'hard', noMistake)).toBe('hit')
  })
  it('stands hard 16 vs dealer 6', () => {
    expect(decidePlay(hand(h('10S', '6H')), card('6D'), ALL, 'hard', noMistake)).toBe('stand')
  })
  it('stands hard 12 vs dealer 6', () => {
    expect(decidePlay(hand(h('7S', '5H')), card('6D'), ALL, 'hard', noMistake)).toBe('stand')
  })
  it('hits 12 vs dealer 2', () => {
    expect(decidePlay(hand(h('7S', '5H')), card('2D'), ALL, 'hard', noMistake)).toBe('hit')
  })
  it('doubles 11', () => {
    expect(decidePlay(hand(h('6S', '5H')), card('9D'), ALL, 'hard', noMistake)).toBe('double')
  })
  it('splits a pair of 8s', () => {
    expect(decidePlay(hand(h('8S', '8H')), card('10D'), ALL, 'hard', noMistake)).toBe('split')
  })
  it('splits aces', () => {
    expect(decidePlay(hand(h('AS', 'AH')), card('6D'), ALL, 'hard', noMistake)).toBe('split')
  })
  it('does not split a pair of 5s (treats as 10 → double vs 9)', () => {
    expect(decidePlay(hand(h('5S', '5H')), card('9D'), ALL, 'hard', noMistake)).toBe('double')
  })
  it('stands soft 19', () => {
    expect(decidePlay(hand(h('AS', '8H')), card('6D'), ALL, 'hard', noMistake)).toBe('stand')
  })
})

describe('decidePlay (fallbacks + easy)', () => {
  it('falls back to hit when double is not legal', () => {
    expect(decidePlay(hand(h('6S', '5H')), card('9D'), ['hit', 'stand'], 'hard', noMistake)).toBe('hit')
  })
  it('easy: hits below 17, stands at 17+', () => {
    expect(decidePlay(hand(h('10S', '6H')), card('6D'), ALL, 'easy', noMistake)).toBe('hit')
    expect(decidePlay(hand(h('10S', '7H')), card('6D'), ALL, 'easy', noMistake)).toBe('stand')
  })
  it('easy never splits/doubles', () => {
    const a = decidePlay(hand(h('8S', '8H')), card('6D'), ALL, 'easy', noMistake)
    expect(['hit', 'stand']).toContain(a)
  })
  it('returns a legal action even with an empty-ish set', () => {
    expect(decidePlay(hand(h('10S', '7H')), card('6D'), ['stand'], 'hard', noMistake)).toBe('stand')
  })
})

describe('decideBet', () => {
  it('stays within [min, min(max, stack)]', () => {
    for (const diff of ['easy', 'normal', 'hard'] as const) {
      const b = decideBet(DEFAULT_RULES, 1000, 10, 500, diff, () => 0.5)
      expect(b).toBeGreaterThanOrEqual(10)
      expect(b).toBeLessThanOrEqual(500)
    }
  })
  it('returns 0 when the stack is below the minimum', () => {
    expect(decideBet(DEFAULT_RULES, 5, 10, 500, 'normal', () => 0.5)).toBe(0)
  })
})
