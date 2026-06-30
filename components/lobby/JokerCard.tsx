// A stylized Joker card (Balatro-ish jester) drawn as SVG. Used as the lobby
// hero mascot. Self-contained — no external assets.

export function JokerCard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 168" className={className} aria-hidden>
      <defs>
        <linearGradient id="jk-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="1" stopColor="#ece6d6" />
        </linearGradient>
        <linearGradient id="jk-hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="jk-hat2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f43f6e" />
          <stop offset="1" stopColor="#d6204e" />
        </linearGradient>
      </defs>

      {/* card body */}
      <rect x="2" y="2" width="116" height="164" rx="14" fill="url(#jk-card)" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      <rect x="8" y="8" width="104" height="152" rx="10" fill="none" stroke="#d6204e" strokeWidth="1.5" opacity="0.35" />

      {/* corner marks */}
      <text x="13" y="26" fontSize="16" fontWeight="900" fill="#7c3aed" fontFamily="sans-serif">J</text>
      <text x="107" y="146" fontSize="16" fontWeight="900" fill="#7c3aed" fontFamily="sans-serif" textAnchor="end" transform="rotate(180 107 140)">J</text>

      {/* jester hat — three drooping points with gold bells */}
      <g transform="translate(60 74)">
        <path d="M-34 -2 Q-40 -34 -20 -30 Q-22 -16 -8 -16" fill="url(#jk-hat2)" />
        <circle cx="-40" cy="-34" r="6" fill="#ffd54a" stroke="#caa12a" strokeWidth="1.5" />
        <path d="M0 -10 Q0 -44 0 -44 Q14 -40 4 -14" fill="url(#jk-hat)" />
        <circle cx="0" cy="-46" r="6" fill="#ffd54a" stroke="#caa12a" strokeWidth="1.5" />
        <path d="M34 -2 Q40 -34 20 -30 Q22 -16 8 -16" fill="url(#jk-hat2)" />
        <circle cx="40" cy="-34" r="6" fill="#ffd54a" stroke="#caa12a" strokeWidth="1.5" />
        {/* hat band */}
        <rect x="-26" y="-16" width="52" height="12" rx="6" fill="url(#jk-hat)" />

        {/* face */}
        <circle cx="0" cy="14" r="22" fill="#fff7ee" stroke="#e8d9c4" strokeWidth="2" />
        <circle cx="-8" cy="11" r="3" fill="#2b2b2b" />
        <circle cx="8" cy="11" r="3" fill="#2b2b2b" />
        <circle cx="-13" cy="18" r="4" fill="#ff9db0" opacity="0.7" />
        <circle cx="13" cy="18" r="4" fill="#ff9db0" opacity="0.7" />
        <path d="M-9 21 Q0 28 9 21" fill="none" stroke="#2b2b2b" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* JOKER ribbon */}
      <rect x="22" y="132" width="76" height="18" rx="9" fill="#7c3aed" />
      <text x="60" y="145" fontSize="11" fontWeight="900" letterSpacing="2" fill="#fff" fontFamily="sans-serif" textAnchor="middle">JOKER</text>
    </svg>
  )
}
