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
  { x: 640, y: 414 },
  { x: 695, y: 402 },
  { x: 745, y: 391 },
  { x: 790, y: 382 },
]

/** Fjäll, granskog, snow and a falu-red stuga with marschaller. */
export function Lappland({ className = '' }: { className?: string }) {
  const farForest = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: i * 21 + rand(i) * 14, h: 26 + rand(i + 100) * 22 })), [])
  const nearForest = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ x: i * 58 + rand(i + 300) * 30, h: 60 + rand(i + 400) * 70 })).filter((t) => t.x < 600 || t.x > 990),
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

      {/* stuga */}
      <g transform="translate(830 300)">
        <ellipse cx="60" cy="74" rx="120" ry="40" fill="url(#warm)" opacity="0.45" />
        <rect x="0" y="22" width="120" height="52" fill="#8e2a1f" />
        <path d="M-12 26 L60 -18 L132 26 Z" fill="#4a1a14" />
        <path d="M-15 28 Q20 6 60 -21 Q100 6 135 28 Q100 16 60 -10 Q20 16 -15 28 Z" fill="#f4f8ff" />
        <rect x="88" y="-16" width="14" height="26" fill="#3a1410" />
        <rect x="85" y="-20" width="20" height="6" rx="3" fill="#f4f8ff" />
        <g className="stuga-smoke">
          <circle cx="96" cy="-30" r="6" fill="#dfe8f7" opacity="0.35" />
          <circle cx="102" cy="-46" r="9" fill="#dfe8f7" opacity="0.22" />
          <circle cx="94" cy="-66" r="12" fill="#dfe8f7" opacity="0.12" />
        </g>
        {[14, 78].map((wx) => (
          <g key={wx}>
            <rect x={wx} y="36" width="28" height="22" fill="#ffcf6b" className="window-flicker" />
            <path d={`M${wx + 14} 36 V58 M${wx} 47 H${wx + 28}`} stroke="#f4f8ff" strokeWidth="2.5" />
            <rect x={wx} y="36" width="28" height="22" fill="none" stroke="#f4f8ff" strokeWidth="3" />
          </g>
        ))}
        <rect x="50" y="46" width="22" height="28" fill="#f4f8ff" />
        <rect x="53" y="49" width="16" height="25" fill="#5a1c14" />
        <path d="M-6 74 H126" stroke="#f4f8ff" strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* marschaller leading to the door */}
      {TORCHES.map((t, i) => (
        <g key={i}>
          <circle cx={t.x} cy={t.y - 14} r="16" fill="url(#warm)" className="torch" style={{ animationDelay: `${i * 0.37}s` }} />
          <rect x={t.x - 2} y={t.y - 12} width="4" height="12" fill="#5a3b22" />
          <ellipse cx={t.x} cy={t.y - 15} rx="3" ry="5" fill="#ffd27a" className="torch" style={{ animationDelay: `${i * 0.37}s` }} />
        </g>
      ))}

      {/* near spruces */}
      {nearForest.map((t, i) => (
        <Spruce key={i} x={t.x} y={388 + rand(i + 700) * 30} h={t.h} />
      ))}

      {/* foreground drift */}
      <path d="M0 432 Q240 398 520 420 T1100 412 T1440 406 V460 H0Z" fill="#f7f9ff" />
    </svg>
  )
}
