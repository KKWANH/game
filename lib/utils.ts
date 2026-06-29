import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a chip amount with thousands separators. */
export function formatChips(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}
