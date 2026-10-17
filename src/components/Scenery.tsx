import { useMemo } from 'react'

export function Stars({ count = 90 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 70,
        size: Math.random() * 2.2 + 0.8,
        delay: Math.random() * 4,
        dur: 2 + Math.random() * 3,
      })),
    [count],
  )
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
        />
      ))}
    </div>
  )
}

export function Moon({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none ${className}`} aria-hidden>
      <div className="relative h-full w-full animate-float" style={{ animationDuration: '9s' }}>
        <div className="absolute -inset-10 rounded-full bg-amber-100/20 blur-3xl" />
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 35%, #fffbe8, #f6e3a6 60%, #e8cc7c)' }}
        />
        <div className="absolute left-[55%] top-[25%] h-[18%] w-[18%] rounded-full bg-amber-900/10" />
        <div className="absolute left-[30%] top-[58%] h-[12%] w-[12%] rounded-full bg-amber-900/10" />
        <div className="absolute left-[62%] top-[62%] h-[8%] w-[8%] rounded-full bg-amber-900/10" />
      </div>
    </div>
  )
}

/** Norrsken – soft animated curtains of green/teal/violet light. */
export function Aurora({ className = '' }: { className?: string }) {
  const bands = [
    { d: 'M0 260 C 220 140 420 330 720 220 S 1180 90 1440 210 L1440 300 C 1180 190 980 330 720 300 S 260 230 0 340 Z', c1: '#5cffb4', c2: '#2bd6c4', cls: 'aurora-a' },
    { d: 'M0 170 C 300 90 520 260 820 150 S 1240 60 1440 120 L1440 190 C 1220 140 1040 280 800 230 S 300 160 0 240 Z', c1: '#7dffcf', c2: '#8a7dff', cls: 'aurora-b' },
    { d: 'M0 330 C 260 260 560 390 900 300 S 1300 250 1440 300 L1440 350 C 1260 310 1060 400 860 360 S 320 320 0 390 Z', c1: '#3dffa0', c2: '#46b8ff', cls: 'aurora-c' },
  ]
  return (
    <svg viewBox="0 0 1440 480" preserveAspectRatio="none" className={`pointer-events-none absolute inset-x-0 top-0 h-[70%] w-full ${className}`} aria-hidden>
      <defs>
        {bands.map((b, i) => (
          <linearGradient key={i} id={`aur-${i}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={b.c1} stopOpacity="0" />
            <stop offset="0.3" stopColor={b.c1} stopOpacity="0.85" />
            <stop offset="0.7" stopColor={b.c2} stopOpacity="0.7" />
            <stop offset="1" stopColor={b.c2} stopOpacity="0" />
          </linearGradient>
        ))}
        <filter id="aur-blur" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      <g filter="url(#aur-blur)" style={{ mixBlendMode: 'screen' }}>
        {bands.map((b, i) => (
          <path key={i} d={b.d} fill={`url(#aur-${i})`} className={b.cls} />
        ))}
      </g>
    </svg>
  )
}

// deterministic pseudo-random so the forest looks the same every render
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

/** Tall, narrow Lapland spruce ("pelargran"). */
function Spruce({ x, y, h, fill = '#0a1726', snow = true }: { x: number; y: number; h: number; fill?: string; snow?: boolean }) {
  const w = h * 0.26
  const p = (fx: number, fy: number) => `${(x + fx * w).toFixed(1)} ${(y - fy * h).toFixed(1)}`
  const d = `M${p(0, 1)} L${p(0.22, 0.72)} L${p(0.1, 0.72)} L${p(0.36, 0.44)} L${p(0.18, 0.44)} L${p(0.5, 0.08)} L${p(0.06, 0.08)} L${p(0.06, 0)} L${p(-0.06, 0)} L${p(-0.06, 0.08)} L${p(-0.5, 0.08)} L${p(-0.18, 0.44)} L${p(-0.36, 0.44)} L${p(-0.1, 0.72)} L${p(-0.22, 0.72)} Z`
  return (
    <g>
      <path d={d} fill={fill} />
      {snow && (
        <path
          d={`M${p(-0.2, 0.72)} L${p(0, 0.78)} L${p(0.2, 0.72)} M${p(-0.34, 0.44)} L${p(0, 0.5)} L${p(0.34, 0.44)} M${p(-0.46, 0.09)} L${p(0, 0.15)} L${p(0.46, 0.09)}`}
          stroke="#e8f0ff"
          strokeWidth={Math.max(1.2, h * 0.03)}
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
      )}
    </g>
  )
}

const TORCHES = [
  { x: 752, y: 388 },
  { x: 790, y: 388 },
  { x: 828, y: 388 },
]

/** Fjäll, granskog, snow, Tomtens verkstad and destilleri with marschaller between them. */
export function Lappland({ className = '' }: { className?: string }) {
  const farForest = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: i * 21 + rand(i) * 14, h: 26 + rand(i + 100) * 22 })), [])
  const nearForest = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ x: i * 58 + rand(i + 300) * 30, h: 60 + rand(i + 400) * 70 })).filter((t) => t.x < 600 || t.x > 1040),
    [],
  )

  return (
    <svg viewBox="0 0 1440 460" preserveAspectRatio="xMidYMax slice" className={`pointer-events-none block w-full ${className}`} aria-hidden>
      <defs>
        <linearGradient id="fjall-far" gradientUnits="userSpaceOnUse" x1="0" y1="110" x2="0" y2="300">
          <stop offset="0" stopColor="#e3ecfa" />
          <stop offset="0.35" stopColor="#9fb4d6" />
          <stop offset="1" stopColor="#2c4268" />
        </linearGradient>
        <linearGradient id="fjall-near" gradientUnits="userSpaceOnUse" x1="0" y1="185" x2="0" y2="330">
          <stop offset="0" stopColor="#f4f8ff" />
          <stop offset="0.3" stopColor="#b5c6e4" />
          <stop offset="1" stopColor="#24375a" />
        </linearGradient>
        <linearGradient id="snowfield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d3e0f4" />
          <stop offset="1" stopColor="#f7f9ff" />
        </linearGradient>
        <radialGradient id="warm" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* far fjäll */}
      <path
        d="M0 270 L90 230 Q130 205 170 222 L300 160 Q350 132 400 158 L520 225 L640 175 Q700 145 760 172 L900 128 Q960 105 1020 136 L1160 205 L1270 170 Q1320 150 1370 172 L1440 190 V460 H0Z"
        fill="url(#fjall-far)"
        opacity="0.85"
      />
      {/* nearer fjäll */}
      <path
        d="M0 300 Q120 250 230 268 L380 210 Q430 192 480 214 L600 262 Q700 235 780 250 L930 200 Q990 182 1050 206 L1200 262 Q1320 236 1440 250 V460 H0Z"
        fill="url(#fjall-near)"
      />
      {/* far forest band */}
      <path d="M0 330 Q360 300 720 318 T1440 312 V460 H0Z" fill="#132640" />
      {farForest.map((t, i) => (
        <Spruce key={i} x={t.x} y={332 - Math.sin(t.x / 230) * 8} h={t.h} fill="#0e1e33" snow={false} />
      ))}

      {/* snowfield */}
      <path d="M0 360 Q300 330 620 352 T1440 340 V460 H0Z" fill="url(#snowfield)" />

      {/* destilleri – timber shed with a copper dome venting warm steam */}
      <g transform="translate(640 318)">
        <ellipse cx="45" cy="56" rx="80" ry="26" fill="url(#warm)" opacity="0.35" />
        <rect x="0" y="16" width="92" height="40" fill="#4a2c1c" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="0" y={18 + i * 10} width="92" height="1.5" fill="#2e1a10" />
        ))}
        <path d="M-8 20 L46 -8 L100 20 Z" fill="#2e1a10" />
        <path d="M-10 22 Q20 4 46 -11 Q72 4 102 22 Q72 12 46 -1 Q20 12 -10 22 Z" fill="#f4f8ff" />
        {/* copper dome + pipe */}
        <rect x="64" y="-14" width="6" height="16" fill="#b5562a" />
        <path d="M56 -14 Q56 -32 67 -34 Q78 -32 78 -14 Z" fill="#d9783f" />
        <path d="M60 -18 Q61 -28 66 -30" stroke="#ffd2a1" strokeWidth="1.5" fill="none" opacity="0.8" />
        <g className="stuga-smoke">
          <circle cx="67" cy="-44" r="5" fill="#ffd9a8" opacity="0.4" />
          <circle cx="72" cy="-58" r="8" fill="#ffd9a8" opacity="0.25" />
          <circle cx="66" cy="-76" r="10" fill="#ffd9a8" opacity="0.12" />
        </g>
        <rect x="12" y="28" width="20" height="16" fill="#ffb347" className="window-flicker" />
        <rect x="12" y="28" width="20" height="16" fill="none" stroke="#d9c3a5" strokeWidth="2" />
        <rect x="52" y="30" width="22" height="26" fill="#2a170e" />
        <path d="M52 30 h22" stroke="#d9c3a5" strokeWidth="2" />
        <path d="M-4 56 H96" stroke="#f4f8ff" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Tomtens verkstad */}
      <g transform="translate(838 296)">
        <ellipse cx="85" cy="78" rx="150" ry="44" fill="url(#warm)" opacity="0.45" />
        <rect x="0" y="22" width="170" height="56" fill="#8e2a1f" />
        <path d="M-14 26 L85 -26 L184 26 Z" fill="#4a1a14" />
        <path d="M-17 28 Q30 4 85 -29 Q140 4 187 28 Q140 16 85 -16 Q30 16 -17 28 Z" fill="#f4f8ff" />
        <rect x="128" y="-20" width="14" height="28" fill="#3a1410" />
        <rect x="125" y="-24" width="20" height="6" rx="3" fill="#f4f8ff" />
        <g className="stuga-smoke">
          <circle cx="135" cy="-34" r="6" fill="#dfe8f7" opacity="0.35" />
          <circle cx="141" cy="-50" r="9" fill="#dfe8f7" opacity="0.22" />
          <circle cx="133" cy="-70" r="12" fill="#dfe8f7" opacity="0.12" />
        </g>
        {/* sign */}
        <rect x="52" y="0" width="66" height="14" rx="3" fill="#fff3dc" />
        <text x="85" y="10.5" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="8.5" fontWeight="700" fill="#a92529" letterSpacing="0.6">
          VERKSTAD
        </text>
        {[12, 44, 104, 136].map((wx) => (
          <g key={wx}>
            <rect x={wx} y="36" width="24" height="22" fill="#ffcf6b" className="window-flicker" />
            <path d={`M${wx + 12} 36 V58 M${wx} 47 H${wx + 24}`} stroke="#f4f8ff" strokeWidth="2.2" />
            <rect x={wx} y="36" width="24" height="22" fill="none" stroke="#f4f8ff" strokeWidth="2.6" />
          </g>
        ))}
        <rect x="73" y="44" width="24" height="34" fill="#f4f8ff" />
        <rect x="76" y="47" width="18" height="31" fill="#5a1c14" />
        <circle cx="85" cy="34" r="6" fill="none" stroke="#2fa36b" strokeWidth="3.5" />
        <circle cx="85" cy="29" r="1.8" fill="#e5383b" />
        <path d="M-6 78 H176" stroke="#f4f8ff" strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* marschaller between the two */}
      {TORCHES.map((t, i) => (
        <g key={i}>
          <circle cx={t.x} cy={t.y - 14} r="16" fill="url(#warm)" className="torch" style={{ animationDelay: `${i * 0.37}s` }} />
          <rect x={t.x - 2} y={t.y - 12} width="4" height="12" fill="#5a3b22" />
          <ellipse cx={t.x} cy={t.y - 15} rx="3" ry="5" fill="#ffd27a" className="torch" style={{ animationDelay: `${i * 0.37}s` }} />
        </g>
      ))}

      {/* a nisse with a lantern carrying a brew from the destilleri to the verkstad */}
      <g>
        <animateMotion dur="11s" repeatCount="indefinite" path="M705 372 L760 376 L820 376 L922 374" />
        <animate attributeName="opacity" dur="11s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.06;0.86;0.92;1" />
        <g className="nisse-walk">
          <ellipse cx="0" cy="0" rx="7" ry="2" fill="#000" opacity="0.15" />
          <rect x="-4" y="-12" width="8" height="10" rx="3" fill="#6b7a8f" />
          <rect x="-4" y="-3" width="3" height="4" fill="#2b2b33" />
          <rect x="1" y="-3" width="3" height="4" fill="#2b2b33" />
          <circle cx="0" cy="-15" r="3.6" fill="#ffd7b5" />
          <path d="M-3.5 -14 Q0 -8 3.5 -14 Z" fill="#fff" />
          <path d="M-4.5 -16 L3 -27 L5 -15 Z" fill="#d93a3d" />
          <circle cx="3" cy="-27" r="1.4" fill="#fff" />
          <line x1="4" y1="-8" x2="8" y2="-6" stroke="#2b2b33" strokeWidth="1.2" />
          <circle cx="8.5" cy="-4" r="7" fill="url(#warm)" />
          <rect x="7" y="-6" width="3.5" height="4.5" rx="1" fill="#ffd27a" />
        </g>
      </g>

      {/* near spruces */}
      {nearForest.map((t, i) => (
        <Spruce key={i} x={t.x} y={388 + rand(i + 700) * 30} h={t.h} />
      ))}

      {/* foreground drift */}
      <path d="M0 432 Q240 398 520 420 T1100 412 T1440 406 V460 H0Z" fill="#f7f9ff" />
    </svg>
  )
}
