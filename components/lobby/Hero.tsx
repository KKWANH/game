// Lobby hero — two fanned Aces (A♥ + A♠) over a few chips. Standard cards,
// pure CSS (framer mount animations are unreliable for the lobby's islands).

import { Suit } from '@/components/cards/Suit'

function HeroCard({ suit, rotate, x, z }: { suit: 'H' | 'S'; rotate: number; x: number; z: number }) {
  const red = suit === 'H'
  return (
    <div
      className="absolute bottom-0 left-1/2 h-32 w-24 rounded-xl border border-black/10 bg-gradient-to-br from-white to-neutral-200 shadow-2xl"
      style={{ marginLeft: -48, transformOrigin: 'bottom center', transform: `translateX(${x}px) rotate(${rotate}deg)`, zIndex: z }}
    >
      <div className={`absolute left-2 top-1.5 flex flex-col items-center leading-none ${red ? 'text-rose-600' : 'text-neutral-900'}`}>
        <span className="text-2xl font-black">A</span>
        <Suit suit={suit} className="w-3.5" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Suit suit={suit} className="w-11 opacity-95" />
      </div>
      <div className={`absolute bottom-1.5 right-2 flex rotate-180 flex-col items-center leading-none ${red ? 'text-rose-600' : 'text-neutral-900'}`}>
        <span className="text-2xl font-black">A</span>
        <Suit suit={suit} className="w-3.5" />
      </div>
    </div>
  )
}

function Chip({ color, x }: { color: string; x: number }) {
  return (
    <div
      className="absolute bottom-1 left-1/2 h-11 w-11 rounded-full border-[3px] sm:h-12 sm:w-12"
      style={{ marginLeft: -22, transform: `translateX(${x}px)`, background: color, borderColor: 'rgba(255,255,255,0.55)', boxShadow: '0 6px 16px rgba(0,0,0,0.45)' }}
    >
      <div className="absolute inset-1 rounded-full border-2 border-dashed border-white/40" />
    </div>
  )
}

export function Hero() {
  return (
    <div className="relative h-44 w-72 animate-[heroFloat_4s_ease-in-out_infinite] sm:h-48 sm:w-80" aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_36%,transparent),transparent)] blur-xl" />
      <Chip color="var(--chip-red)" x={-104} />
      <Chip color="var(--chip-green)" x={104} />
      <Chip color="var(--chip-blue)" x={84} />
      <HeroCard suit="H" rotate={-14} x={-30} z={1} />
      <HeroCard suit="S" rotate={14} x={30} z={2} />
    </div>
  )
}
