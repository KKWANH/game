// Pure-CSS animated hero (framer mount animations are unreliable for client
// islands rendered by the server-component lobby, so we avoid them here).

import { JokerCard } from './JokerCard'

function Chip({ color, x }: { color: string; x: number }) {
  return (
    <div
      className="absolute bottom-2 left-1/2 h-11 w-11 rounded-full border-[3px] sm:h-12 sm:w-12"
      style={{ marginLeft: -22, transform: `translateX(${x}px)`, background: color, borderColor: 'rgba(255,255,255,0.55)', boxShadow: '0 6px 16px rgba(0,0,0,0.45)' }}
    >
      <div className="absolute inset-1 rounded-full border-2 border-dashed border-white/40" />
    </div>
  )
}

/** Blackjack hero — a Joker card mascot over a few chips. */
export function Hero() {
  return (
    <div className="relative h-44 w-72 sm:h-52 sm:w-80" aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_38%,transparent),transparent)] blur-xl" />
      <Chip color="var(--chip-red)" x={-96} />
      <Chip color="var(--chip-green)" x={96} />
      <Chip color="var(--chip-blue)" x={76} />
      <div className="absolute left-1/2 top-0 -translate-x-1/2 animate-[heroFloat_4s_ease-in-out_infinite]">
        <JokerCard className="h-40 w-auto drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)] sm:h-48" />
      </div>
    </div>
  )
}
