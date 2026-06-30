import type { Suit as SuitT } from '@/lib/blackjack'

const PATHS: Record<string, string> = {
  S: 'M16 3C16 3 27 12 27 19.2C27 23 24.2 25.2 21.4 25.2C19.9 25.2 18.6 24.5 17.7 23.4C17.8 26 18.8 28.2 21 29.5H11C13.2 28.2 14.2 26 14.3 23.4C13.4 24.5 12.1 25.2 10.6 25.2C7.8 25.2 5 23 5 19.2C5 12 16 3 16 3Z',
  H: 'M16 28C16 28 3.5 20 3.5 11.6C3.5 7.6 6.6 4.8 10.2 4.8C12.7 4.8 14.9 6.1 16 8.1C17.1 6.1 19.3 4.8 21.8 4.8C25.4 4.8 28.5 7.6 28.5 11.6C28.5 20 16 28 16 28Z',
  D: 'M16 2.5L28 16L16 29.5L4 16Z',
  C: 'M16 3.6C18.7 3.6 20.9 5.8 20.9 8.5C20.9 9 20.8 9.5 20.7 9.9C21.5 9.4 22.5 9.1 23.5 9.1C26.2 9.1 28.4 11.3 28.4 14C28.4 16.7 26.2 18.9 23.5 18.9C21.9 18.9 20.5 18.1 19.6 16.9C19.9 19.9 20.9 22.3 23 23.6H9C11.1 22.3 12.1 19.9 12.4 16.9C11.5 18.1 10.1 18.9 8.5 18.9C5.8 18.9 3.6 16.7 3.6 14C3.6 11.3 5.8 9.1 8.5 9.1C9.5 9.1 10.5 9.4 11.3 9.9C11.2 9.5 11.1 9 11.1 8.5C11.1 5.8 13.3 3.6 16 3.6Z',
}

/** Crisp SVG suit icon, scales cleanly and takes the suit color. */
export function Suit({ suit, className }: { suit: SuitT | string; className?: string }) {
  const red = suit === 'H' || suit === 'D'
  return (
    <svg viewBox="0 0 32 32" className={className} fill={red ? '#dc2626' : '#18181b'} aria-hidden>
      <path d={PATHS[suit] ?? PATHS.S} />
    </svg>
  )
}
