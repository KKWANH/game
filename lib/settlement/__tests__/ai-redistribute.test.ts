import { describe, it, expect } from 'vitest'
import { redistributeAiNet, type NetRow } from '../ai-redistribute'
import { minCashFlow } from '../min-cash-flow'

describe('redistributeAiNet', () => {
  it('leaves nets untouched when there are no AI seats', () => {
    const rows: NetRow[] = [
      { seatId: 'a', net: 100, isAi: false },
      { seatId: 'b', net: -100, isAi: false },
    ]
    const { settleNet, aiNet } = redistributeAiNet(rows)
    expect(aiNet).toBe(0)
    expect(settleNet).toEqual({ a: 100, b: -100 })
  })

  it('spreads an AI winner across the humans and zeroes the AI seat', () => {
    // Human dealer game, zero-sum. AI player won 60 off the dealer.
    // A: -100, dealer: +40, AI: +60  → sum 0.
    const rows: NetRow[] = [
      { seatId: 'A', net: -100, isAi: false },
      { seatId: 'D', net: 40, isAi: false },
      { seatId: 'X', net: 60, isAi: true },
    ]
    const { settleNet, aiNet } = redistributeAiNet(rows)
    expect(aiNet).toBe(60)
    expect(settleNet.X).toBe(0) // bot is squared out
    // +60 split across the 2 humans → +30 each
    expect(settleNet.A).toBe(-70)
    expect(settleNet.D).toBe(70)
    // humans now net to zero → settles cleanly between real people
    expect(settleNet.A + settleNet.D).toBe(0)
  })

  it('makes the AI-adjusted human nets settle with no bot in the transfers', () => {
    const rows: NetRow[] = [
      { seatId: 'A', net: -100, isAi: false },
      { seatId: 'D', net: 40, isAi: false },
      { seatId: 'X', net: 60, isAi: true },
    ]
    const { settleNet } = redistributeAiNet(rows)
    const transfers = minCashFlow(
      rows.filter((r) => !r.isAi).map((r) => ({ seatId: r.seatId, net: settleNet[r.seatId] }))
    )
    expect(transfers).toEqual([{ fromSeat: 'A', toSeat: 'D', amount: 70 }])
    expect(transfers.every((t) => t.fromSeat !== 'X' && t.toSeat !== 'X')).toBe(true)
  })

  it('shares an AI loss as a refund the humans split', () => {
    // AI lost 100 to the players: A +60, B +40, X -100 → sum 0.
    const rows: NetRow[] = [
      { seatId: 'A', net: 60, isAi: false },
      { seatId: 'B', net: 40, isAi: false },
      { seatId: 'X', net: -100, isAi: true },
    ]
    const { settleNet, aiNet } = redistributeAiNet(rows)
    expect(aiNet).toBe(-100)
    // −100 split across 2 humans → −50 each (they give back the phantom winnings)
    expect(settleNet.A).toBe(10)
    expect(settleNet.B).toBe(-10)
    expect(settleNet.A + settleNet.B).toBe(0)
  })

  it('does not crash when every seat is an AI', () => {
    const rows: NetRow[] = [
      { seatId: 'X', net: 50, isAi: true },
      { seatId: 'Y', net: -50, isAi: true },
    ]
    const { settleNet, aiNet } = redistributeAiNet(rows)
    expect(aiNet).toBe(0)
    // nothing to absorb the AI net → raw nets preserved
    expect(settleNet).toEqual({ X: 50, Y: -50 })
  })
})
