import { describe, it, expect } from 'vitest'
import { minCashFlow, SeatNet, Transfer } from '../min-cash-flow'

function sumByDebtor(transfers: Transfer[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of transfers) {
    out[t.fromSeat] = (out[t.fromSeat] ?? 0) + t.amount
    out[t.toSeat] = (out[t.toSeat] ?? 0) - t.amount
  }
  return out
}

describe('minCashFlow', () => {
  it('settles a simple two-party case', () => {
    const nets: SeatNet[] = [
      { seatId: 'a', net: -100 },
      { seatId: 'b', net: 100 },
    ]
    expect(minCashFlow(nets)).toEqual([{ fromSeat: 'a', toSeat: 'b', amount: 100 }])
  })

  it('produces at most n-1 transfers and balances everyone', () => {
    const nets: SeatNet[] = [
      { seatId: 'a', net: -50 },
      { seatId: 'b', net: -30 },
      { seatId: 'c', net: 20 },
      { seatId: 'd', net: 60 },
    ]
    const transfers = minCashFlow(nets)
    expect(transfers.length).toBeLessThanOrEqual(nets.length - 1)

    // Net effect of transfers must exactly offset each seat's starting net.
    const effect = sumByDebtor(transfers)
    for (const n of nets) {
      expect((effect[n.seatId] ?? 0) + n.net).toBe(0)
    }
  })

  it('emits no transfers when everyone is square', () => {
    expect(minCashFlow([{ seatId: 'a', net: 0 }, { seatId: 'b', net: 0 }])).toEqual([])
  })

  it('handles a single big winner against many small losers', () => {
    const nets: SeatNet[] = [
      { seatId: 'w', net: 90 },
      { seatId: 'x', net: -30 },
      { seatId: 'y', net: -30 },
      { seatId: 'z', net: -30 },
    ]
    const transfers = minCashFlow(nets)
    expect(transfers.every((t) => t.toSeat === 'w')).toBe(true)
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBe(90)
  })
})
