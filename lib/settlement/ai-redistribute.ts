// AI seats hold real chips but aren't real people. Before settling who-owes-whom
// we spread their combined net evenly across the human seats, so nobody ends up
// owing (or being owed by) a bot. "ai가 번 것은 공평하게 분배."

export interface NetRow {
  seatId: string
  /** raw chip net (current stack − total buy-in) */
  net: number
  isAi: boolean
}

export interface Redistributed {
  /** per-seat net to settle on: humans get their share of the AI net, AI seats → 0 */
  settleNet: Record<string, number>
  /** combined net that was held by AI seats (spread across humans) */
  aiNet: number
}

/**
 * Spread AI seats' combined net evenly across the human seats.
 *
 * With a human dealer the table is zero-sum (sum of all nets = 0), so after
 * redistribution the humans' settle-nets sum to ~0 and minCashFlow balances.
 * Any 1-chip rounding remainder is left unsettled rather than invented.
 *
 * If there are no AI seats (or no humans to absorb them) every seat settles on
 * its raw net.
 */
export function redistributeAiNet(rows: NetRow[]): Redistributed {
  const aiRows = rows.filter((r) => r.isAi)
  const humanRows = rows.filter((r) => !r.isAi)
  const aiNet = aiRows.reduce((sum, r) => sum + r.net, 0)

  const settleNet: Record<string, number> = {}
  for (const r of rows) settleNet[r.seatId] = r.net

  if (aiRows.length > 0 && humanRows.length > 0) {
    const share = aiNet / humanRows.length
    for (const h of humanRows) settleNet[h.seatId] = Math.round(h.net + share)
    for (const a of aiRows) settleNet[a.seatId] = 0
  }

  return { settleNet, aiNet }
}
