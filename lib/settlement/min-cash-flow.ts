// Per-room final settlement: turn each seat's net into a minimal set of
// "who pays whom" transfers. Greedy min-cash-flow (<= n-1 transfers).

export interface SeatNet {
  seatId: string
  /** chips up (+) or down (-): current stack minus total buy-in. */
  net: number
}

export interface Transfer {
  fromSeat: string
  toSeat: string
  amount: number
}

/**
 * Greedy minimum-cash-flow settlement.
 * Repeatedly matches the largest creditor with the largest debtor, emitting a
 * transfer of min(|debtor|, creditor). Produces at most n-1 transfers.
 *
 * Nets are expected to (approximately) sum to zero; any rounding remainder is
 * left unsettled rather than invented.
 */
export function minCashFlow(nets: SeatNet[]): Transfer[] {
  const transfers: Transfer[] = []

  // Work on a mutable copy keyed by index.
  const balances = nets.map((n) => ({ seatId: n.seatId, net: n.net }))

  while (true) {
    // Largest creditor (most positive) and largest debtor (most negative).
    let maxCreditor = -1
    let maxDebtor = -1
    for (let i = 0; i < balances.length; i++) {
      if (maxCreditor === -1 || balances[i].net > balances[maxCreditor].net) {
        maxCreditor = i
      }
      if (maxDebtor === -1 || balances[i].net < balances[maxDebtor].net) {
        maxDebtor = i
      }
    }

    if (maxCreditor === -1 || maxDebtor === -1) break

    const credit = balances[maxCreditor].net
    const debit = balances[maxDebtor].net

    // Nothing meaningful left to settle.
    if (credit <= 0 || debit >= 0) break

    const amount = Math.min(credit, -debit)
    if (amount <= 0) break

    transfers.push({
      fromSeat: balances[maxDebtor].seatId,
      toSeat: balances[maxCreditor].seatId,
      amount,
    })

    balances[maxCreditor].net -= amount
    balances[maxDebtor].net += amount
  }

  return transfers
}
