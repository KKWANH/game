// Lobby hero — the 🃏 emoji over a few chips. (No hand-made artwork.)

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

export function Hero() {
  return (
    <div className="relative flex h-40 w-72 items-center justify-center sm:h-44 sm:w-80" aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--gold)_36%,transparent),transparent)] blur-xl" />
      <Chip color="var(--chip-red)" x={-100} />
      <Chip color="var(--chip-green)" x={100} />
      <Chip color="var(--chip-blue)" x={80} />
      <div className="relative animate-[heroFloat_4s_ease-in-out_infinite] text-8xl drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)] sm:text-9xl">
        🃏
      </div>
    </div>
  )
}
