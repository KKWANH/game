import { describe, it, expect } from 'vitest'
import { Card, Rank, Suit } from '../cards'
import { settleHand, settleInsurance } from '../payout'
import { DEFAULT_RULES, RoundRules } from '../types'

function h(...specs: string[]): Card[] {
  return specs.map((s) => ({ rank: s.slice(0, s.length - 1) as Rank, suit: s.slice(-1) as Suit }))
}

const rules: RoundRules = DEFAULT_RULES // blackjack 3:2
const sixToFive: RoundRules = { ...rules, blackjackPayout: { num: 6, den: 5 } }

describe('settleHand', () => {
  it('player win pays 2x bet (stake + equal winnings)', () => {
    const r = settleHand({ cards: h('10S', '9H'), bet: 100, splitDepth: 0 }, { cards: h('10D', '7C') }, rules)
    expect(r).toEqual({ outcome: 'win', payout: 200 })
  })

  it('player loss pays 0', () => {
    const r = settleHand({ cards: h('10S', '6H'), bet: 100, splitDepth: 0 }, { cards: h('10D', '8C') }, rules)
    expect(r).toEqual({ outcome: 'lose', payout: 0 })
  })

  it('push returns the bet', () => {
    const r = settleHand({ cards: h('10S', '8H'), bet: 100, splitDepth: 0 }, { cards: h('10D', '8C') }, rules)
    expect(r).toEqual({ outcome: 'push', payout: 100 })
  })

  it('player bust always loses, even if dealer also busts', () => {
    const r = settleHand({ cards: h('10S', '6H', '9D'), bet: 100, splitDepth: 0 }, { cards: h('10D', '6C', '9S') }, rules)
    expect(r).toEqual({ outcome: 'lose', payout: 0 })
  })

  it('dealer bust pays 2x', () => {
    const r = settleHand({ cards: h('10S', '8H'), bet: 100, splitDepth: 0 }, { cards: h('10D', '6C', '9S') }, rules)
    expect(r).toEqual({ outcome: 'win', payout: 200 })
  })

  it('blackjack pays 3:2 (stake + 150)', () => {
    const r = settleHand({ cards: h('AS', 'KH'), bet: 100, splitDepth: 0 }, { cards: h('10D', '7C') }, rules)
    expect(r).toEqual({ outcome: 'blackjack', payout: 250 })
  })

  it('blackjack pays 6:5 when configured (stake + 120)', () => {
    const r = settleHand({ cards: h('AS', 'KH'), bet: 100, splitDepth: 0 }, { cards: h('10D', '7C') }, sixToFive)
    expect(r).toEqual({ outcome: 'blackjack', payout: 220 })
  })

  it('player blackjack vs dealer blackjack pushes', () => {
    const r = settleHand({ cards: h('AS', 'KH'), bet: 100, splitDepth: 0 }, { cards: h('AD', 'QC') }, rules)
    expect(r).toEqual({ outcome: 'push', payout: 100 })
  })

  it('dealer blackjack beats non-blackjack 21', () => {
    const r = settleHand({ cards: h('10S', '5H', '6D'), bet: 100, splitDepth: 0 }, { cards: h('AD', 'QC') }, rules)
    expect(r).toEqual({ outcome: 'lose', payout: 0 })
  })

  it('a 21 made from a split is NOT a natural blackjack (pays 2x not 3:2)', () => {
    const r = settleHand({ cards: h('AS', 'KH'), bet: 100, splitDepth: 1 }, { cards: h('10D', '7C') }, rules)
    expect(r).toEqual({ outcome: 'win', payout: 200 })
  })

  it('surrender returns half the bet', () => {
    const r = settleHand({ cards: h('10S', '6H'), bet: 100, splitDepth: 0, surrendered: true }, { cards: h('10D', '7C') }, rules)
    expect(r).toEqual({ outcome: 'surrender', payout: 50 })
  })

  it('doubled bet scales the win', () => {
    const r = settleHand({ cards: h('10S', '9H', '2C'), bet: 200, splitDepth: 0 }, { cards: h('10D', '7C') }, rules)
    expect(r).toEqual({ outcome: 'win', payout: 400 })
  })
})

describe('settleInsurance', () => {
  it('pays 2:1 (3x gross) when dealer has blackjack', () => {
    expect(settleInsurance(50, true)).toBe(150)
  })
  it('loses when dealer has no blackjack', () => {
    expect(settleInsurance(50, false)).toBe(0)
  })
})
