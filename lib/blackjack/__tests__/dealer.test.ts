import { describe, it, expect } from 'vitest'
import { Card, Rank, Suit } from '../cards'
import { playDealer, shouldDealerHit } from '../dealer'
import { handTotal } from '../totals'
import { DEFAULT_RULES, RoundRules } from '../types'

function h(...specs: string[]): Card[] {
  return specs.map((s) => ({ rank: s.slice(0, s.length - 1) as Rank, suit: s.slice(-1) as Suit }))
}

/** Deterministic drawer pulling from a fixed list. */
function drawer(cards: Card[]) {
  let i = 0
  return () => {
    if (i >= cards.length) throw new Error('out of cards')
    return cards[i++]
  }
}

const standsSoft17: RoundRules = { ...DEFAULT_RULES, dealerHitsSoft17: false }
const hitsSoft17: RoundRules = { ...DEFAULT_RULES, dealerHitsSoft17: true }

describe('shouldDealerHit', () => {
  it('hits below 17', () => {
    expect(shouldDealerHit(handTotal(h('10S', '6H')), standsSoft17)).toBe(true)
  })
  it('stands on hard 17', () => {
    expect(shouldDealerHit(handTotal(h('10S', '7H')), standsSoft17)).toBe(false)
  })
  it('stands on soft 17 when configured to stand', () => {
    expect(shouldDealerHit(handTotal(h('AS', '6H')), standsSoft17)).toBe(false)
  })
  it('hits soft 17 when configured to hit', () => {
    expect(shouldDealerHit(handTotal(h('AS', '6H')), hitsSoft17)).toBe(true)
  })
  it('stands on 18+', () => {
    expect(shouldDealerHit(handTotal(h('10S', '8H')), hitsSoft17)).toBe(false)
  })
})

describe('playDealer', () => {
  it('draws to 17 and stops', () => {
    const draw = drawer(h('5D', '4C')) // 16 -> hit -> 21? 10+6=16, +5=21 stop
    const res = playDealer(h('10S', '6H'), draw, standsSoft17)
    expect(res.total.best).toBe(21)
  })

  it('stops immediately on a pat hand', () => {
    const draw = drawer(h('2D'))
    const res = playDealer(h('10S', '8H'), draw, standsSoft17)
    expect(res.cards).toHaveLength(2)
    expect(res.total.best).toBe(18)
  })

  it('can bust', () => {
    const draw = drawer(h('10D')) // 16 -> +10 = 26 bust
    const res = playDealer(h('10S', '6H'), draw, standsSoft17)
    expect(res.total.isBust).toBe(true)
  })

  it('hits soft 17 then stands hard', () => {
    // A,6 = soft17 -> hit 10 -> 17 hard -> stand
    const draw = drawer(h('10D'))
    const res = playDealer(h('AS', '6H'), draw, hitsSoft17)
    expect(res.total.best).toBe(17)
    expect(res.cards).toHaveLength(3)
  })
})
