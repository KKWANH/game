import { describe, it, expect } from 'vitest'
import { Card, Rank, Suit } from '../cards'
import { legalActions, isPair, insuranceOffered } from '../rules'
import { ActionContext, DEFAULT_RULES, HandView, RoundRules } from '../types'

function h(...specs: string[]): Card[] {
  return specs.map((s) => ({ rank: s.slice(0, s.length - 1) as Rank, suit: s.slice(-1) as Suit }))
}

function hand(partial: Partial<HandView> & { cards: Card[] }): HandView {
  return {
    bet: 100,
    splitDepth: 0,
    isDoubled: false,
    fromSplit: false,
    isSplitAces: false,
    ...partial,
  }
}

function ctx(partial: Partial<ActionContext> = {}): ActionContext {
  return {
    availableChips: 1000,
    currentSplitCount: 1,
    dealerUpcard: h('7S')[0],
    ...partial,
  }
}

const rules: RoundRules = DEFAULT_RULES

describe('legalActions', () => {
  it('offers hit/stand/double/surrender on a fresh two-card hand', () => {
    const a = legalActions(hand({ cards: h('10S', '6H') }), rules, ctx())
    expect(a).toEqual(expect.arrayContaining(['hit', 'stand', 'double', 'surrender']))
    expect(a).not.toContain('split')
  })

  it('offers split on a pair', () => {
    const a = legalActions(hand({ cards: h('8S', '8H') }), rules, ctx())
    expect(a).toContain('split')
  })

  it('treats ten-valued cards as a splittable pair', () => {
    const a = legalActions(hand({ cards: h('KS', '10H') }), rules, ctx())
    expect(a).toContain('split')
  })

  it('no double/split/surrender after the first action (3 cards)', () => {
    const a = legalActions(hand({ cards: h('5S', '4H', '3D') }), rules, ctx())
    expect(a).toEqual(['hit', 'stand'])
  })

  it('auto-stands at 21 (no actions)', () => {
    expect(legalActions(hand({ cards: h('10S', '5H', '6D') }), rules, ctx())).toEqual([])
  })

  it('no actions when busted', () => {
    expect(legalActions(hand({ cards: h('10S', '6H', '9D') }), rules, ctx())).toEqual([])
  })

  it('no actions on a natural blackjack', () => {
    expect(legalActions(hand({ cards: h('AS', 'KH') }), rules, ctx())).toEqual([])
  })

  it('drops double/split when chips insufficient', () => {
    const a = legalActions(hand({ cards: h('8S', '8H'), bet: 100 }), rules, ctx({ availableChips: 50 }))
    expect(a).not.toContain('double')
    expect(a).not.toContain('split')
  })

  it('respects maxSplits cap', () => {
    const a = legalActions(
      hand({ cards: h('8S', '8H'), splitDepth: 3 }),
      { ...rules, maxSplits: 3 },
      ctx({ currentSplitCount: 5 })
    )
    expect(a).not.toContain('split')
  })

  it('no surrender on split hands', () => {
    const a = legalActions(hand({ cards: h('10S', '6H'), splitDepth: 1 }), rules, ctx())
    expect(a).not.toContain('surrender')
  })

  it('split aces with one-card rule are terminal', () => {
    const a = legalActions(
      hand({ cards: h('AS', '7H'), isSplitAces: true, splitDepth: 1 }),
      rules,
      ctx()
    )
    expect(a).toEqual([])
  })

  it('honors surrender:none', () => {
    const a = legalActions(hand({ cards: h('10S', '6H') }), { ...rules, surrender: 'none' }, ctx())
    expect(a).not.toContain('surrender')
  })

  it('honors allowDouble:false', () => {
    const a = legalActions(hand({ cards: h('10S', '6H') }), { ...rules, allowDouble: false }, ctx())
    expect(a).not.toContain('double')
  })
})

describe('isPair', () => {
  it('true for equal ranks', () => expect(isPair(h('8S', '8H'))).toBe(true))
  it('true for mixed ten-values', () => expect(isPair(h('JS', 'KH'))).toBe(true))
  it('false for unequal', () => expect(isPair(h('8S', '9H'))).toBe(false))
})

describe('insuranceOffered', () => {
  it('true on dealer ace when allowed', () => {
    expect(insuranceOffered(h('AS')[0], rules)).toBe(true)
  })
  it('false on non-ace', () => {
    expect(insuranceOffered(h('10S')[0], rules)).toBe(false)
  })
  it('false when insurance disabled', () => {
    expect(insuranceOffered(h('AS')[0], { ...rules, allowInsurance: false })).toBe(false)
  })
})
