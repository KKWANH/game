// Per-room real-money model. Friends agree on a stake like "1 coin = 1 won" or
// "100 coins = 1 euro"; we store it as a faithful ratio (unitChips coins =
// unitAmount of `currency`) so the exact agreement round-trips, and convert
// chip amounts to money for the settlement screens.

export interface MoneyConfig {
  /** ISO 4217 code, e.g. 'KRW', 'EUR', 'USD'. */
  currency: string
  /** how many chips equal `unitAmount` of the currency (the "X" in X코인 = Y원) */
  unitChips: number
  /** the currency amount that `unitChips` chips are worth (the "Y") */
  unitAmount: number
}

export const DEFAULT_MONEY: MoneyConfig = { currency: 'KRW', unitChips: 1, unitAmount: 1 }

/** Currencies offered in the room settings dropdown. */
export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'KRW', label: '₩ 원 (KRW)' },
  { code: 'USD', label: '$ 달러 (USD)' },
  { code: 'EUR', label: '€ 유로 (EUR)' },
  { code: 'JPY', label: '¥ 엔 (JPY)' },
  { code: 'GBP', label: '£ 파운드 (GBP)' },
  { code: 'CNY', label: '¥ 위안 (CNY)' },
]

/** Convert a chip amount to its money value under a room's stake. */
export function moneyValue(chips: number, m: MoneyConfig): number {
  if (!m.unitChips) return 0
  return (chips / m.unitChips) * m.unitAmount
}

/** Format a chip amount as localized currency (symbol + sign + sensible decimals). */
export function formatMoney(chips: number, m: MoneyConfig): string {
  const v = moneyValue(chips, m)
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: m.currency,
      // KRW/JPY have no minor unit; others show cents only when present.
      maximumFractionDigits: 2,
    }).format(v)
  } catch {
    const sign = v < 0 ? '-' : ''
    return `${sign}${Math.abs(v).toLocaleString('ko-KR')} ${m.currency}`
  }
}

/** Human-readable stake, e.g. "100코인 = €1" or "1코인 = ₩1". */
export function describeStake(m: MoneyConfig): string {
  return `${m.unitChips.toLocaleString('ko-KR')}코인 = ${formatMoney(m.unitChips, m)}`
}
