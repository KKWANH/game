import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a chip amount with thousands separators. */
export function formatChips(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

/** Format a chip amount as KRW given a per-chip rate (e.g. 12 chips × 100 → ₩1,200). */
export function formatWon(chips: number, ratePerChip: number): string {
  const won = Math.round(chips * ratePerChip)
  const sign = won < 0 ? '-' : ''
  return `${sign}₩${new Intl.NumberFormat('ko-KR').format(Math.abs(won))}`
}
