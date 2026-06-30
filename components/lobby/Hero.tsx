// Pure-CSS animated hero (framer mount animations are unreliable for client
// islands rendered by the server-component lobby, so we avoid them here).

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' } as const

function HeroCard({ rank, suit, rotate, x, z }: { rank: string; suit: keyof typeof SUIT; rotate: number; x: number; z: number }) {
  const red = suit === 'H' || suit === 'D'
  return (
    <div
      className="absolute bottom-0 left-1/2 h-28 w-20 rounded-xl border border-black/10 bg-gradient-to-br from-white to-neutral-100 shadow-2xl sm:h-32 sm:w-24"
      style={{ marginLeft: -40, transformOrigin: 'bottom center', transform: `translateX(${x}px) rotate(${rotate}deg)`, zIndex: z }}
    >
      <div className={`absolute left-2 top-1.5 leading-none ${red ? 'text-rose-600' : 'text-neutral-900'}`}>
        <div className="text-lg font-bold sm:text-xl">{rank}</div>
        <div className="text-sm">{SUIT[suit]}</div>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center text-4xl sm:text-5xl ${red ? 'text-rose-600' : 'text-neutral-900'}`}>
        {SUIT[suit]}
      </div>
    </div>
  )
}

function Chip({ color, x }: { color: string; x: number }) {
  return (
    <div
      className="absolute bottom-1 left-1/2 h-10 w-10 rounded-full border-[3px] sm:h-12 sm:w-12"
      style={{ marginLeft: -20, transform: `translateX(${x}px)`, background: color, borderColor: 'rgba(255,255,255,0.55)', boxShadow: '0 6px 16px rgba(0,0,0,0.45)' }}
    >
      <div className="absolute inset-1 rounded-full border-2 border-dashed border-white/40" />
    </div>
  )
}

/** Blackjack hero — a fanned Ace+King ("21") over a few chips. */
export function Hero() {
  return (
    <div className="relative h-40 w-72 animate-[heroFloat_4s_ease-in-out_infinite] sm:h-44 sm:w-80" aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_34%,transparent),transparent)] blur-xl" />
      <Chip color="var(--chip-red)" x={-104} />
      <Chip color="var(--chip-green)" x={104} />
      <Chip color="var(--chip-blue)" x={84} />
      <HeroCard rank="A" suit="S" rotate={-15} x={-30} z={1} />
      <HeroCard rank="K" suit="H" rotate={15} x={30} z={2} />
    </div>
  )
}
