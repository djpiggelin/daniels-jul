import { Reindeer } from './Reindeer'

/** Santa in his sleigh with a sack of gifts. Facing right. */
export function SantaSleigh({ size = 220, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 220 150" width={size} height={(size * 150) / 220} className={className} aria-hidden>
      {/* sack */}
      <path d="M22 70 Q10 30 44 22 Q60 18 70 34 Q80 54 72 74 Z" fill="#8b5a2b" />
      <path d="M40 26 Q48 18 60 22" stroke="#6b4423" strokeWidth="3" fill="none" />
      <rect x="30" y="34" width="18" height="16" rx="2" fill="#2fa36b" transform="rotate(-12 39 42)" />
      <rect x="37" y="34" width="4" height="16" fill="#f6c453" transform="rotate(-12 39 42)" />
      <rect x="50" y="28" width="16" height="14" rx="2" fill="#4f7dff" transform="rotate(10 58 35)" />
      <rect x="56" y="28" width="4" height="14" fill="#fff" transform="rotate(10 58 35)" />

      {/* Santa */}
      <g>
        {/* body */}
        <ellipse cx="108" cy="72" rx="28" ry="26" fill="#e5383b" />
        <rect x="84" y="70" width="48" height="8" fill="#2b1a10" />
        <rect x="102" y="69" width="12" height="10" rx="2" fill="#f6c453" />
        {/* waving arm */}
        <g className="santa-wave">
          <path d="M128 62 Q142 48 146 34" stroke="#e5383b" strokeWidth="11" strokeLinecap="round" fill="none" />
          <circle cx="147" cy="31" r="7" fill="#2b1a10" />
        </g>
        {/* head */}
        <circle cx="110" cy="40" r="17" fill="#ffd7b5" />
        {/* beard */}
        <path d="M92 40 Q92 70 110 72 Q128 70 128 40 Q120 52 110 50 Q100 52 92 40 Z" fill="#fff" />
        <path d="M100 47 Q110 42 120 47 Q110 52 100 47 Z" fill="#fff" />
        {/* eyes + cheeks */}
        <path d="M102 36 Q104 33 106 36" stroke="#2b1a10" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M114 36 Q116 33 118 36" stroke="#2b1a10" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="100" cy="42" r="3" fill="#ff8a8a" opacity="0.6" />
        <circle cx="120" cy="42" r="3" fill="#ff8a8a" opacity="0.6" />
        <circle cx="110" cy="42" r="3" fill="#f2a08a" />
        {/* hat */}
        <path d="M92 30 Q100 6 124 10 Q138 14 140 30 Z" fill="#e5383b" />
        <rect x="90" y="26" width="40" height="8" rx="4" fill="#fff" />
        <circle cx="141" cy="31" r="6" fill="#fff" />
      </g>

      {/* sleigh */}
      <path
        d="M16 66 L150 66 Q166 66 170 50 Q174 40 184 42 Q172 46 174 60 Q172 104 136 108 L40 108 Q16 106 16 84 Z"
        fill="#c1272d"
      />
      <path d="M16 66 L150 66 Q166 66 170 50" stroke="#f6c453" strokeWidth="4" fill="none" />
      <path d="M30 80 Q60 72 90 82 Q120 92 150 80" stroke="#f6c453" strokeWidth="2.5" fill="none" opacity="0.8" />
      <circle cx="60" cy="88" r="4" fill="#f6c453" />
      <circle cx="110" cy="92" r="4" fill="#f6c453" />
      {/* runners */}
      <path d="M36 108 L40 124 M130 108 L126 124" stroke="#9aa3b5" strokeWidth="4" />
      <path d="M8 128 Q4 120 14 122 L176 124 Q200 124 204 108" stroke="#d6dbe6" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Santa + four reindeer as one flying team. */
export function SleighTeam({ scale = 1, className = '' }: { scale?: number; className?: string }) {
  const rd = 92 * scale
  return (
    <div className={`flex items-end ${className}`} style={{ gap: 0 }}>
      <SantaSleigh size={170 * scale} />
      <div className="relative flex items-end" style={{ marginLeft: -6 * scale }}>
        {/* reins */}
        <svg className="absolute left-0 top-[38%] w-full overflow-visible" height="10" aria-hidden>
          <line x1="0" y1="10" x2="100%" y2="0" stroke="#f6c453" strokeWidth={2} strokeDasharray="1 0" />
        </svg>
        {['#2fa36b', '#4f7dff', '#e5383b'].map((c, i) => (
          <Reindeer key={i} size={rd} mode="gallop" scarf={c} className="-ml-3" />
        ))}
        <Reindeer size={rd} mode="gallop" rudolf scarf="#f6c453" className="-ml-3" />
      </div>
    </div>
  )
}
