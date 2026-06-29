import { describe, it, expect } from 'vitest'
import { Card, Rank, Suit } from '../cards'
import { handTotal, isBlackjack, isBust } from '../totals'

function h(...specs: string[]): Card[] {
  return specs.map((s) => {
    const rank = s.slice(0, s.length - 1) as Rank
    const suit = s.slice(-1) as Suit
    return { rank, suit }
  })
}

describe('handTotal', () => {
  it('sums simple hard hands', () => {
    const t = handTotal(h('10S', '7H'))
    expect(t).toMatchObject({ hard: 17, soft: null, best: 17, isSoft: false, isBust: false })
  })

  it('treats a single ace as 11 (soft)', () => {
    const t = handTotal(h('AS', '6H'))
    expect(t).toMatchObject({ hard: 7, soft: 17, best: 17, isSoft: true })
  })

  it('drops ace to 1 when 11 would bust', () => {
    const t = handTotal(h('AS', '6H', '10D'))
    expect(t).toMatchObject({ hard: 17, soft: null, best: 17, isSoft: false, isBust: false })
  })

  it('handles two aces as one-high-one-low', () => {
    const t = handTotal(h('AS', 'AH'))
    expect(t.best).toBe(12)
    expect(t.isSoft).toBe(true)
  })

  it('counts multiple face cards as 10 each', () => {
    const t = handTotal(h('KS', 'QH', '2D'))
    expect(t.best).toBe(22)
    expect(t.isBust).toBe(true)
  })

  it('soft 17 is flagged soft', () => {
    expect(handTotal(h('AS', '6H')).isSoft).toBe(true)
  })

  it('hard 17 from ace-six-ten is not soft', () => {
    expect(handTotal(h('AS', '6H', 'AD')).best).toBe(18) // 11+6+1
  })
})

describe('isBlackjack', () => {
  it('true for two-card 21', () => {
    expect(isBlackjack(h('AS', 'KH'))).toBe(true)
  })
  it('false for three-card 21', () => {
    expect(isBlackjack(h('7S', '7H', '7D'))).toBe(false)
  })
  it('false for non-21 pair', () => {
    expect(isBlackjack(h('AS', '9H'))).toBe(false)
  })
})

describe('isBust', () => {
  it('true above 21', () => {
    expect(isBust(h('KS', 'QH', 'JD'))).toBe(true)
  })
  it('false at exactly 21', () => {
    expect(isBust(h('KS', 'QH', 'AD'))).toBe(false)
  })
})
