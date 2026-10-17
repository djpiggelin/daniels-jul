import { useMemo } from 'react'
import { Reindeer } from './Reindeer'
import { SantaSleigh } from './Santa'
import { useDaypart, type Daypart } from '../lib/daypart'

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
    <div className="stars pointer-events-none absolute inset-0" aria-hidden>
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
    <div className={`moon pointer-events-none ${className}`} aria-hidden>
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

const SUN: Record<Exclude<Daypart, 'natt'>, { pos: string; core: string; glow: string }> = {
  dag: { pos: 'right-[14%] top-[12%] h-14 w-14 sm:h-20 sm:w-20', core: 'radial-gradient(circle at 40% 40%, #fffdf2, #fff1c4 60%, #ffe19a)', glow: 'rgba(255, 240, 190, 0.45)' },
  morgon: { pos: 'left-[16%] top-[58%] h-16 w-16 sm:h-24 sm:w-24', core: 'radial-gradient(circle at 45% 40%, #fff3d6, #ffc37a 60%, #ff9a5a)', glow: 'rgba(255, 170, 120, 0.55)' },
  kvall: { pos: 'right-[16%] top-[58%] h-16 w-16 sm:h-24 sm:w-24', core: 'radial-gradient(circle at 45% 40%, #ffe2b8, #ff9a52 55%, #e8603a)', glow: 'rgba(255, 120, 70, 0.5)' },
}

/** The low winter sun – only out when it isn't night. */
export function Sun({ daypart }: { daypart: Daypart }) {
  if (daypart === 'natt') return null
  const s = SUN[daypart]
  return (
    <div className={`pointer-events-none absolute ${s.pos}`} aria-hidden>
      <div className="absolute -inset-[120%] rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${s.glow}, transparent 65%)` }} />
      <div className="absolute inset-0 rounded-full" style={{ background: s.core }} />
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
    <svg viewBox="0 0 1440 480" preserveAspectRatio="none" className={`aurora-layer pointer-events-none absolute inset-x-0 top-0 h-[70%] w-full ${className}`} aria-hidden>
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
  { x: 702, y: 390 },
  { x: 748, y: 390 },
  { x: 898, y: 390 },
  { x: 946, y: 390 },
]

/** Where each event building's little house number sits, by its front door (SVG units). */
const DOOR_NUMBERS: { building: Building; x: number; y: number }[] = [
  { building: 'julafton', x: 465, y: 349 },
  { building: 'destilleri', x: 583, y: 341.5 },
  { building: 'verkstad', x: 739, y: 351 },
  { building: 'julbord', x: 921, y: 345 },
]

/** A small painted wooden house number, part of the facade. */
function HouseNumber({ x, y, n }: { x: number; y: number; n: string }) {
  const w = 4 + n.length * 3.6
  return (
    <g pointerEvents="none">
      <rect x={x - w / 2} y={y - 3.6} width={w} height="7.2" rx="1.4" fill="#efe3c8" stroke="#5a3b22" strokeWidth="0.7" />
      <text x={x} y={y + 2.3} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="6.4" fontWeight="700" fill="#3a2418">
        {n}
      </text>
    </g>
  )
}

export type Building = 'verkstad' | 'destilleri' | 'spel' | 'julbord' | 'julafton' | 'ritningar'

type HouseProps = {
  x: number
  base: number
  w: number
  h: number
  wall: string
  roof?: string
  windows?: number
  sign?: string
  signColor?: string
  building?: Building
  title?: string
  onEnter?: (b: Building, e: React.MouseEvent) => void
  /** Seed for chimney smoke – leave out for a cold chimney. */
  smoke?: number
}

/**
 * A soft, continuous plume: blurred puffs that rise, swell, thin out and drift
 * downwind. `seed` gives each chimney its own pace and phase so none are in sync.
 */
function Smoke({ x, y, seed, color = '#d9e1ee', size = 1 }: { x: number; y: number; seed: number; color?: string; size?: number }) {
  const dur = 7 + rand(seed) * 4 // 7–11 s per puff
  const offset = rand(seed + 50) * dur
  const puffs = 6
  return (
    <g filter="url(#smoke-blur)" pointerEvents="none">
      {Array.from({ length: puffs }, (_, i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx={4.4 * size}
          ry={3.4 * size}
          fill={color}
          className="smoke-puff"
          style={{
            animationDuration: `${dur}s`,
            animationDelay: `${-((i * dur) / puffs + offset)}s`,
            ['--drift' as string]: `${(10 + rand(seed + i) * 10) * size}px`,
          }}
        />
      ))}
    </g>
  )
}

/** Red brick chimney with mortar lines and a fat snow cap. x/y = bottom-left, in the parent's units. */
function BrickChimney({ x, y, w = 11, h = 20, smoke }: { x: number; y: number; w?: number; h?: number; smoke?: number }) {
  const rows = Math.floor(h / 3.4)
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill="#9a3f2c" />
      {Array.from({ length: rows }, (_, r) => (
        <g key={r} stroke="#d9b8a0" strokeWidth="0.5" opacity="0.75">
          <line x1={x} y1={y - h + 3.4 * (r + 1)} x2={x + w} y2={y - h + 3.4 * (r + 1)} />
          {[0, 1, 2].map((k) => {
            const bx = x + (r % 2 ? 1.8 : 3.6) + k * 3.7
            return bx < x + w - 0.5 ? <line key={k} x1={bx} y1={y - h + 3.4 * r} x2={bx} y2={y - h + 3.4 * (r + 1)} /> : null
          })}
        </g>
      ))}
      <rect x={x} y={y - h} width={w * 0.3} height={h} fill="#000" opacity="0.12" />
      <path d={`M${x - 2} ${y - h + 1} Q${x - 2} ${y - h - 4} ${x + w / 2} ${y - h - 4.5} Q${x + w + 2} ${y - h - 4} ${x + w + 2} ${y - h + 1} Q${x + w / 2} ${y - h + 3} ${x - 2} ${y - h + 1} Z`} fill="#f4f8ff" />
      {smoke !== undefined && <Smoke x={x + w / 2} y={y - h - 5} seed={smoke} />}
    </g>
  )
}

/** A snowy little house for Tomtens by. Optionally clickable. */
function House({ x, base, w, h, wall, roof = '#3a1410', windows = 2, sign, signColor = '#a92529', building, title, onEnter, smoke }: HouseProps) {
  const clickable = !!(onEnter && building)
  const peak = Math.min(34, w * 0.32)
  const doorW = Math.max(10, w * 0.14)
  const winW = Math.min(18, (w - doorW - 16) / Math.max(windows, 1) - 6)
  const half = Math.ceil(windows / 2)
  const slots = Array.from({ length: windows }, (_, i) => {
    const left = i < half
    const n = left ? half : windows - half
    const k = left ? i : i - half
    const span = (w - doorW) / 2 - 8
    const x0 = left ? 6 : w / 2 + doorW / 2 + 2
    return x0 + ((k + 0.5) * span) / n - winW / 2
  })
  return (
    <g
      transform={`translate(${x} ${base - h})`}
      className={clickable ? 'building' : undefined}
      onClick={clickable ? (e) => onEnter!(building!, e) : undefined}
    >
      {clickable && title && <title>{title}</title>}
      {clickable && <rect x={-12} y={-peak - 14} width={w + 24} height={h + peak + 20} fill="transparent" />}
      <ellipse cx={w / 2} cy={h} rx={w * 0.8} ry={h * 0.5} fill="url(#warm)" opacity="0.3" />
      <rect x="0" y="0" width={w} height={h} fill={wall} />
      {w >= 56 && <BrickChimney x={w * 0.68} y={-peak * 0.38} w={Math.min(12, w * 0.1)} h={peak * 0.62 + 6} smoke={smoke} />}
      <path d={`M-8 4 L${w / 2} ${-peak} L${w + 8} 4 Z`} fill={roof} />
      {/* thick, soft snow with lumps hanging over the eaves */}
      <path
        d={`M-13 8 Q-14 2 -8 1 Q${w * 0.2} -10 ${w / 2} ${-peak - 6} Q${w * 0.8} -10 ${w + 8} 1 Q${w + 14} 2 ${w + 13} 8 Q${w + 6} 12 ${w * 0.82} 5 Q${w / 2} ${-peak + 15} ${w * 0.18} 5 Q-6 12 -13 8 Z`}
        fill="#f4f8ff"
      />
      <path d={`M-8 1 Q${w * 0.2} -10 ${w / 2} ${-peak - 6}`} stroke="#ffffff" strokeWidth="1.6" fill="none" opacity="0.9" />
      {[0.08, 0.26, 0.74, 0.92].map((t) => (
        <ellipse key={t} cx={-8 + t * (w + 16)} cy={t < 0.5 ? 4 + (0.5 - t) * 8 : 4 + (t - 0.5) * 8} rx="2.2" ry="3.2" fill="#f4f8ff" />
      ))}
      {slots.map((wx, i) => (
        <g key={i}>
          <rect x={wx} y={h * 0.3} width={winW} height={winW * 0.85} fill="#ffcf6b" className="window-flicker" style={{ animationDelay: `${i * 0.7}s` }} />
          <rect x={wx} y={h * 0.3} width={winW} height={winW * 0.85} fill="none" stroke="#f4f8ff" strokeWidth="2" />
        </g>
      ))}
      <rect x={w / 2 - doorW / 2} y={h * 0.38} width={doorW} height={h * 0.62} fill="#2a150d" />
      <rect x={w / 2 - doorW / 2} y={h * 0.38} width={doorW} height={h * 0.62} fill="none" stroke="#f4f8ff" strokeWidth="1.6" />
      {sign && (
        <g>
          <rect x={w / 2 - sign.length * 3.4 - 6} y={-peak + 12} width={sign.length * 6.8 + 12} height="12" rx="2.5" fill="#fff3dc" />
          <text x={w / 2} y={-peak + 21} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="8" fontWeight="700" fill={signColor} letterSpacing="0.5">
            {sign}
          </text>
        </g>
      )}
      <path d={`M-4 ${h} H${w + 4}`} stroke="#f4f8ff" strokeWidth="5" strokeLinecap="round" />
    </g>
  )
}

type NisseProp = 'lantern' | 'sack' | 'gifts' | 'shovel' | 'brush' | 'wave'

/**
 * A proper Swedish tomtenisse: long drooping red cap over the eyes, big woolly
 * beard, round nose, red coat with a belt. With `path` it walks it (fading in
 * and out at the ends); `carry` decides what it's holding or doing.
 */
function Nisse({ path, dur = 12, delay = 0, flip, carry, x = 0, y = 0 }: { path?: string; dur?: number; delay?: number; flip?: boolean; carry?: NisseProp; x?: number; y?: number }) {
  const walking = !!path
  return (
    <g transform={path ? undefined : `translate(${x} ${y})`} opacity={path ? 0 : 1}>
      {path && (
        <>
          <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
          <animate attributeName="opacity" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.06;0.86;0.93;1" />
        </>
      )}
      <g transform={flip ? 'scale(-1 1)' : undefined}>
        <ellipse cx="0" cy="0.5" rx="8" ry="2" fill="#1b2a44" opacity="0.18" />
        {carry === 'sack' && <path d="M-5 -16 Q-15 -22 -13 -9 Q-11 -3 -5 -6 Z" fill="#8b5a2b" />}
        <g className={walking ? 'nisse-walk' : undefined}>
          {/* boots + trousers */}
          <ellipse className={walking ? 'nisse-foot-a' : undefined} cx="-3" cy="-1" rx="3.4" ry="1.8" fill="#3a2418" />
          <ellipse className={walking ? 'nisse-foot-b' : undefined} cx="3.4" cy="-1" rx="3.4" ry="1.8" fill="#3a2418" />
          <rect x="-4.5" y="-8" width="9" height="7" rx="2" fill="#5d6b80" />
          {/* coat + belt */}
          <path d="M-7 -6.5 Q-7.5 -15 -4.5 -19 L4.5 -19 Q7.5 -15 7 -6.5 Z" fill="#c1272d" />
          <rect x="-7.2" y="-11" width="14.4" height="2" fill="#3a2418" />
          <rect x="-1.2" y="-11.3" width="2.4" height="2.6" fill="#f6c453" />
          {/* beard */}
          <path d="M-6.2 -21 Q-7.2 -13 0 -8.5 Q7.2 -13 6.2 -21 Z" fill="#ece7dc" />
          <path d="M-3 -18 Q-2.5 -13 -1 -11 M2.6 -18 Q2.4 -13 1.2 -11" stroke="#cfc8b8" strokeWidth="0.7" fill="none" />
          {/* nose */}
          <circle cx="0" cy="-20.6" r="2.5" fill="#f2a08a" />
          <circle cx="-0.8" cy="-21.3" r="0.7" fill="#fff" opacity="0.6" />
          {/* drooping cap pulled down over the eyes */}
          <path d="M-7.2 -20.5 Q-7.4 -25 -5 -29 Q-1 -39 6.5 -38.5 Q10 -37.5 10.8 -33 Q8 -35.5 5.4 -33.6 Q6.6 -27 7.2 -20.5 Z" fill="#d93a3d" />
          <path d="M-7.8 -21 Q0 -24.2 7.8 -21 L7.8 -19.2 Q0 -22 -7.8 -19.2 Z" fill="#a92529" />
          <circle cx="10.8" cy="-33" r="1.3" fill="#a92529" />
        </g>

        {carry === 'lantern' && (
          <g>
            <circle cx="7.5" cy="-11" r="2" fill="#c1272d" />
            <line x1="8.5" y1="-10" x2="10" y2="-6" stroke="#2b2b33" strokeWidth="1" />
            <circle cx="10.5" cy="-3" r="8" fill="url(#warm)" className="torch" />
            <rect x="8.6" y="-6" width="4" height="5" rx="1" fill="#ffd27a" stroke="#2b2b33" strokeWidth="0.6" />
          </g>
        )}
        {carry === 'gifts' && (
          <g>
            <rect x="-5.5" y="-17" width="11" height="7.5" rx="0.8" fill="#d93a3d" />
            <rect x="-0.8" y="-17" width="1.8" height="7.5" fill="#f6c453" />
            <rect x="-3.8" y="-23.5" width="8" height="6.5" rx="0.8" fill="#23885a" />
            <rect x="-0.4" y="-23.5" width="1.5" height="6.5" fill="#fbf7ef" />
            <path d="M0.3 -23.5 q-3 -3 -3.5 0 M0.4 -23.5 q3 -3 3.5 0" stroke="#fbf7ef" strokeWidth="1" fill="none" />
            <circle cx="-6" cy="-12.5" r="1.8" fill="#c1272d" />
            <circle cx="6" cy="-12.5" r="1.8" fill="#c1272d" />
          </g>
        )}
        {carry === 'shovel' && (
          <g>
            <g className="shovel-dig">
              <line x1="4" y1="-15" x2="14" y2="-1" stroke="#8b5a2b" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M12 -2 L19 0.5 L18 3 L11 1 Z" fill="#9aa3b5" />
              <circle cx="5.5" cy="-13" r="1.9" fill="#c1272d" />
            </g>
            {[0, 1, 2].map((k) => (
              <circle key={k} cx="17" cy="-1" r={1.6 - k * 0.3} fill="#f4f8ff" className="snow-toss" style={{ animationDelay: `${k * 0.12}s` }} />
            ))}
          </g>
        )}
        {carry === 'brush' && (
          <g className="dab">
            <line x1="5" y1="-14" x2="14" y2="-22" stroke="#8b5a2b" strokeWidth="1.6" strokeLinecap="round" />
            <ellipse cx="15.5" cy="-23.5" rx="3.6" ry="3" fill="url(#checker-paint)" stroke="#3a2418" strokeWidth="0.5" transform="rotate(-40 15.5 -23.5)" />
            <circle cx="5.5" cy="-13.5" r="1.9" fill="#c1272d" />
          </g>
        )}
        {carry === 'wave' && <line x1="5" y1="-15" x2="9" y2="-23" stroke="#c1272d" strokeWidth="3" strokeLinecap="round" className="nisse-wave" />}
      </g>
    </g>
  )
}

/**
 * A nod to the painting nisse in Tomtens verkstad on Kalle Anka: the paint in his
 * bucket is already checkered, so every stroke leaves orange-and-black squares.
 * The board is half done and stays that way – he just keeps on dabbing.
 */
function PaintingNisse({ x, base, asleep }: { x: number; base: number; asleep?: boolean }) {
  const cell = 5.2
  const size = 8 * cell
  const squares = Array.from({ length: 64 }, (_, i) => ({ r: Math.floor(i / 8), c: i % 8 })).filter(({ r, c }) => (r + c) % 2 === 1)
  // the painted part: left side done, ragged brush edge towards the right
  const painted = `M0 ${-size} H${size * 0.62} q4 4 -1 8 q6 5 1 10 q7 4 2 9 q6 5 4 13 L${size * 0.78} 0 H0 Z`
  return (
    <g>
      <defs>
        <pattern id="checker-paint" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#f6a623" />
          <rect width="2" height="2" fill="#14141a" />
          <rect x="2" y="2" width="2" height="2" fill="#14141a" />
        </pattern>
        <clipPath id="checker-done">
          <path d={painted} />
        </clipPath>
      </defs>

      {/* the board, leaning back slightly */}
      <g transform={`translate(${x} ${base}) skewX(-7)`}>
        <rect x="-2" y={-size - 2} width={size + 4} height={size + 4} rx="1" fill="#8b5a2b" />
        <rect x="0" y={-size} width={size} height={size} fill="#ecd3ac" />
        <g clipPath="url(#checker-done)">
          <rect x="0" y={-size} width={size} height={size} fill="#f6a623" />
          {squares.map(({ r, c }, i) => (
            <rect key={i} x={c * cell} y={-size + r * cell} width={cell} height={cell} fill="#14141a" />
          ))}
        </g>
        {/* wet checkered drips at the brush edge */}
        <path d={`M${size * 0.64} ${-size + 9} q1.6 5 0 8 q-1.6 -3 0 -8`} fill="url(#checker-paint)" />
        <path d={`M${size * 0.7} ${-size + 26} q1.6 5 0 8 q-1.6 -3 0 -8`} fill="url(#checker-paint)" />
      </g>

      {/* the bucket – the paint inside is already checkered */}
      <g transform={`translate(${x + size + 22} ${base + 2})`}>
        <path d="M-5.5 -10 L5.5 -10 L4.4 0 L-4.4 0 Z" fill="#5a3b22" />
        <ellipse cx="0" cy="-10" rx="5.5" ry="1.9" fill="url(#checker-paint)" />
        <path d="M-4.6 -9 q1 4 -0.2 5.5 q-1.2 -1.5 0.2 -5.5 M2.6 -9 q1 3 0 4.5 q-1 -1.2 0 -4.5" fill="url(#checker-paint)" />
        <path d="M-5.5 -10 Q0 -15 5.5 -10" stroke="#3a2418" strokeWidth="0.8" fill="none" />
      </g>
      {!asleep && <Nisse x={x + size + 12} y={base + 4} carry="brush" flip />}
    </g>
  )
}

/** Red & white North Pole with a sign. */
function NorthPole({ x, base }: { x: number; base: number }) {
  return (
    <g transform={`translate(${x} ${base})`}>
      <rect x="-3.5" y="-78" width="7" height="78" fill="#fff" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M-3.5 ${-74 + i * 9} l7 -4 v4 l-7 4 z`} fill="#d93a3d" />
      ))}
      <circle cx="0" cy="-82" r="6" fill="#f6c453" />
      <circle cx="-2" cy="-84" r="2" fill="#fff" opacity="0.7" />
      <path d="M4 -62 h44 l6 6 l-6 6 h-44 z" fill="#fff3dc" />
      <text x="26" y="-53" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="7.5" fontWeight="700" fill="#a92529">
        NORDPOLEN
      </text>
      <path d="M-6 0 H6" stroke="#f4f8ff" strokeWidth="5" strokeLinecap="round" />
    </g>
  )
}

const TREE_LIGHTS = [
  [-6, -78], [8, -70], [-14, -58], [12, -50], [-4, -46], [-20, -34], [18, -30], [4, -26], [-10, -18], [22, -12], [-24, -10],
]
const LIGHT_COLORS = ['#ffd27a', '#ff6b6b', '#7fd1ff', '#9bff9b']

/** The village Christmas tree with twinkling lights. */
function VillageTree({ x, base }: { x: number; base: number }) {
  return (
    <g>
      <ellipse cx={x} cy={base} rx="46" ry="12" fill="url(#warm)" opacity="0.35" />
      <Spruce x={x} y={base} h={104} fill="#123a2a" />
      {TREE_LIGHTS.map(([dx, dy], i) => (
        <circle
          key={i}
          cx={x + dx}
          cy={base + dy}
          r="2.2"
          fill={LIGHT_COLORS[i % 4]}
          className="animate-twinkle"
          style={{ animationDelay: `${i * 0.27}s`, animationDuration: '1.6s', transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      ))}
      <path d={`M${x} ${base - 114} l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.7 5.4 -.6z`} fill="#f6c453" />
      <rect x={x - 22} y={base - 8} width="12" height="9" fill="#d93a3d" />
      <rect x={x - 17} y={base - 8} width="2" height="9" fill="#f6c453" />
      <rect x={x + 10} y={base - 7} width="10" height="8" fill="#2f5fb8" />
      <rect x={x + 14} y={base - 7} width="2" height="8" fill="#fff" />
    </g>
  )
}

/** A sled loaded with gifts. */
function Sled({ x, base }: { x: number; base: number }) {
  return (
    <g transform={`translate(${x} ${base})`}>
      <path d="M-18 -2 H14 Q20 -2 20 -8" stroke="#9aa3b5" strokeWidth="2" fill="none" />
      <rect x="-16" y="-9" width="30" height="6" rx="1.5" fill="#8b5a2b" />
      <rect x="-14" y="-19" width="11" height="10" fill="#23885a" />
      <rect x="-9.5" y="-19" width="2" height="10" fill="#d93a3d" />
      <rect x="-1" y="-16" width="12" height="7" fill="#f6c453" />
      <rect x="4" y="-16" width="2" height="7" fill="#d93a3d" />
    </g>
  )
}


// door (x, y) of every house → where its little path joins the main path
const MAIN_PATH = 'M30 400 Q 180 390 330 398 T 620 396 T 900 394 T 1180 398 T 1430 396'
const BRANCHES = [
  'M71 358 Q 74 380 86 396', // yellow cottage
  'M158 380 Q 160 390 166 396', // Spelstugan
  'M283 358 Q 300 380 312 397', // white cottage
  'M465 380 Q 466 390 470 396', // Tomtens stuga
  'M583 374 Q 586 388 594 396', // destilleri
  'M725 374 Q 724 386 725 395', // verkstad
  'M921 380 Q 920 390 924 395', // långhuset
  'M1091 358 Q 1086 380 1080 397', // yellow cottage right
  'M1205 380 Q 1204 390 1200 397', // Arkitektkontoret
  'M1305 358 Q 1300 380 1296 397', // cottage right
  'M1385 362 Q 1382 382 1378 396', // small red cottage
]
const SNOW_LANTERNS = [130, 205, 365, 528, 655, 830, 1010, 1140, 1250, 1340]

/** A snölykta: a little pyramid of snowballs with a candle inside. */
function SnowLantern({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.35)`}>
      <circle cx="0" cy="-6" r="12" fill="url(#warm)" className="torch" style={{ animationDelay: `${i * 0.31}s` }} />
      {[
        [-6, 0], [0, 0], [6, 0], [-3, -5], [3, -5], [0, -10],
      ].map(([cx, cy], k) => (
        <circle key={k} cx={cx} cy={cy} r="3.3" fill="#f4f8ff" stroke="#c9d6ea" strokeWidth="0.6" />
      ))}
      <ellipse cx="0" cy="-3.5" rx="1.6" ry="2.4" fill="#ffcf6b" className="torch" style={{ animationDelay: `${i * 0.31}s` }} />
    </g>
  )
}


// rough height of the main path at x – good enough to stand things along it
const PATH_POINTS = [[30, 400], [330, 398], [620, 396], [900, 394], [1180, 398], [1430, 396]]
const pathY = (x: number) => {
  for (let i = 1; i < PATH_POINTS.length; i++) {
    const [x0, y0] = PATH_POINTS[i - 1]
    const [x1, y1] = PATH_POINTS[i]
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return PATH_POINTS[PATH_POINTS.length - 1][1]
}
// leave gaps where the little paths come in from the doors
const JUNCTIONS = [86, 166, 312, 470, 594, 725, 924, 1080, 1200, 1296, 1378]
const CANES = Array.from({ length: 23 }, (_, i) => 58 + i * 60)
  .filter((x) => JUNCTIONS.every((j) => Math.abs(j - x) > 16))
  .map((x) => ({ x, y: pathY(x) - 9 }))
const GARLAND = ['#ffd27a', '#ff5a5a', '#7fd1ff', '#9bff9b', '#ffb3f0']

/** A little candy cane stuck in the snow. */
function CandyCane({ x, y, flip }: { x: number; y: number; flip?: boolean }) {
  const d = 'M0 0 V-15 q0 -5 4.5 -5 q4.5 0 4.5 4.5'
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1.3 : 1.3} 1.3)`}>
      <path d={d} stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d={d} stroke="#e5383b" strokeWidth="2.8" strokeLinecap="butt" strokeDasharray="2.4 2.6" fill="none" />
      <ellipse cx="0" cy="0.5" rx="3" ry="1" fill="#9fb2d2" opacity="0.6" />
    </g>
  )
}

/** Candy canes along the path with a twinkling string of lights between them. */
function CandyCaneGarland() {
  return (
    <g>
      {CANES.slice(1).map((b, i) => {
        const a = CANES[i]
        if (b.x - a.x > 70) return null // no garland across a doorway
        const ax = a.x + 2
        const ay = a.y - 23
        const bx = b.x + 2
        const by = b.y - 23
        const cx = (ax + bx) / 2
        const cy = (ay + by) / 2 + 8
        const at = (t: number) => [(1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t * t * by]
        return (
          <g key={a.x}>
            <path d={`M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`} stroke="#14321f" strokeWidth="1" fill="none" />
            {[0.2, 0.4, 0.6, 0.8].map((t, k) => {
              const [lx, ly] = at(t)
              const c = GARLAND[(i * 4 + k) % GARLAND.length]
              return (
                <circle
                  key={t}
                  cx={lx}
                  cy={ly + 1.6}
                  r="2.3"
                  fill={c}
                  className="animate-twinkle"
                  style={{ animationDelay: `${((i * 4 + k) * 0.23) % 2.2}s`, animationDuration: '1.8s', transformBox: 'fill-box', transformOrigin: 'center', filter: `drop-shadow(0 0 2px ${c})` }}
                />
              )
            })}
          </g>
        )
      })}
      {CANES.map((c, i) => (
        <CandyCane key={c.x} x={c.x} y={c.y} flip={i % 2 === 1} />
      ))}
    </g>
  )
}


const COOKIE_SHAPES = {
  heart: 'M0 2.6 C -5 -1 -3.4 -5 0 -2.6 C 3.4 -5 5 -1 0 2.6 Z',
  star: 'M0 -4 L1.2 -1.2 L4 -1.2 L1.8 0.6 L2.6 3.6 L0 1.8 L-2.6 3.6 L-1.8 0.6 L-4 -1.2 L-1.2 -1.2 Z',
  round: 'M-3.6 0 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0 Z',
  man: 'M0 -4.2 a1.4 1.4 0 1 1 0.01 0 Z M-1.4 -2.4 H1.4 L3.6 -1.8 L3.4 -0.6 L1.4 -0.8 L2.2 3.6 L0.8 3.8 L0 1.2 L-0.8 3.8 L-2.2 3.6 L-1.4 -0.8 L-3.4 -0.6 L-3.6 -1.8 Z',
} as const
const COOKIE_ORDER = ['man', 'heart', 'star', 'round'] as const

/** Gingerbread-cookie stepping stones along every little path to a door. */
function CookieStones() {
  return (
    <g>
      {BRANCHES.flatMap((d, bi) => {
        const [x0, y0, cx, cy, x1, y1] = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
        return [0.22, 0.5, 0.78].map((t, k) => {
          const px = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1
          const py = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1
          const shape = COOKIE_SHAPES[COOKIE_ORDER[(bi + k) % COOKIE_ORDER.length]]
          return (
            <g key={`${bi}-${k}`} transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(1.05 0.62)`}>
              <path d={shape} fill="#9a5a2a" transform="translate(0 1)" />
              <path d={shape} fill="#c27c40" />
              <path d={shape} fill="none" stroke="#fffaf0" strokeWidth="0.6" strokeDasharray="1 0.9" />
            </g>
          )
        })
      })}
    </g>
  )
}

/** Trodden snow paths between the houses: footprints, candy canes, a string of lights and snow lanterns. */
function VillagePaths() {
  return (
    <g>
      {/* soft trodden edge, then the packed middle */}
      <path d={MAIN_PATH} stroke="#9fb2d2" strokeWidth="17" strokeLinecap="round" fill="none" opacity="0.7" />
      {BRANCHES.map((d) => (
        <path key={d} d={d} stroke="#9fb2d2" strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.7" />
      ))}
      <path d={MAIN_PATH} stroke="#c7d5ec" strokeWidth="10" strokeLinecap="round" fill="none" />
      {BRANCHES.map((d) => (
        <path key={`${d}-in`} d={d} stroke="#c7d5ec" strokeWidth="6" strokeLinecap="round" fill="none" />
      ))}
      {/* footprints */}
      <path d={MAIN_PATH} stroke="#8197bd" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 9" fill="none" transform="translate(0 -1.5)" />
      <path d={MAIN_PATH} stroke="#8197bd" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 9" strokeDashoffset="4.5" fill="none" transform="translate(0 1.5)" />
      <CookieStones />
      <CandyCaneGarland />
      {SNOW_LANTERNS.map((x, i) => (
        <SnowLantern key={x} x={x} y={409 - Math.sin(x / 140) * 3} i={i} />
      ))}
    </g>
  )
}

/** A snowman with a top hat, carrot nose, red scarf and twig arms. */
function Snowman({ x, base }: { x: number; base: number }) {
  return (
    <g transform={`translate(${x} ${base}) scale(1.25)`}>
      <ellipse cx="0" cy="0" rx="13" ry="3" fill="#9fb2d2" opacity="0.5" />
      {/* twig arms */}
      <g stroke="#6b4423" strokeWidth="1.3" strokeLinecap="round" fill="none">
        <path d="M-6 -27 L-17 -34 M-13 -31.5 L-15 -36.5 M-13 -31.5 L-18 -31" />
        <path d="M6 -27 L16 -36 M12.5 -32.5 L16 -31 M12.5 -32.5 L12 -37.5" className="snowman-wave" />
      </g>
      <circle cx="0" cy="-9" r="10" fill="#f8fbff" stroke="#d5e0f0" strokeWidth="0.8" />
      <circle cx="0" cy="-25" r="7.5" fill="#f8fbff" stroke="#d5e0f0" strokeWidth="0.8" />
      <circle cx="0" cy="-37.5" r="5.6" fill="#f8fbff" stroke="#d5e0f0" strokeWidth="0.8" />
      <circle cx="-3" cy="-12" r="3" fill="#ffffff" opacity="0.7" />
      {/* coal buttons, eyes and smile */}
      {[-27, -23, -12, -7].map((cy) => (
        <circle key={cy} cx="0" cy={cy} r="0.9" fill="#1b1b22" />
      ))}
      <circle cx="-2" cy="-39" r="0.85" fill="#1b1b22" />
      <circle cx="2" cy="-39" r="0.85" fill="#1b1b22" />
      {[-2.4, -0.8, 0.8, 2.4].map((dx) => (
        <circle key={dx} cx={dx} cy={-34.6 + Math.abs(dx) * -0.25} r="0.45" fill="#1b1b22" />
      ))}
      <path d="M0.5 -37.4 L8 -36.4 L0.5 -35.6 Z" fill="#f28c28" />
      {/* scarf */}
      <path d="M-5.6 -32.4 Q0 -29.6 5.6 -32.4 L5.6 -30 Q0 -27.4 -5.6 -30 Z" fill="#c1272d" />
      <path d="M3 -30.6 L5 -22 L2 -22.5 L1 -30 Z" fill="#c1272d" className="scarf-sway" />
      <path d="M2 -24 L5 -24" stroke="#fbf7ef" strokeWidth="0.6" />
      {/* top hat */}
      <rect x="-6.4" y="-43" width="12.8" height="1.8" rx="0.6" fill="#1b1b22" />
      <rect x="-4.2" y="-50.5" width="8.4" height="7.8" rx="0.8" fill="#1b1b22" />
      <rect x="-4.2" y="-45" width="8.4" height="1.6" fill="#c1272d" />
      <circle cx="3" cy="-44.2" r="1" fill="#2f7a4f" />
    </g>
  )
}

// where Santa parks in front of each house: sleigh first, then the reindeer facing right
const LANDING: Partial<Record<Building, number>> = { julafton: 428, verkstad: 652, julbord: 846 }

/** Santa's sleigh parked in the snow in front of a house, with two reindeer waiting. */
function LandedTeam({ at }: { at: Building }) {
  const x = LANDING[at]
  if (x === undefined) return null
  const base = 426
  const sleigh = 74
  const deer = 46
  return (
    <g pointerEvents="none">
      <ellipse cx={x + 70} cy={base} rx="80" ry="4" fill="#9fb2d2" opacity="0.45" />
      <g transform={`translate(${x} ${base - (sleigh * 150) / 220})`}>
        <SantaSleigh size={sleigh} />
      </g>
      <path d={`M${x + sleigh * 0.8} ${base - 30} Q ${x + sleigh + 20} ${base - 22} ${x + sleigh + 48} ${base - 26}`} stroke="#e9c46a" strokeWidth="0.9" fill="none" />
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${x + sleigh + 6 + i * 40} ${base - (deer * 128) / 150 + 2})`}>
          <Reindeer size={deer} rudolf={i === 1} scarf={i ? '#f6c453' : '#2fa36b'} />
        </g>
      ))}
    </g>
  )
}

const NEAR_SPRUCES = [
  { x: 14, h: 118 },
  { x: 44, h: 84 },
  { x: 1030, h: 84 },
  { x: 1404, h: 110 },
  { x: 1432, h: 86 },
]

/** Fjäll, granskog and – with `village` – Tomtens by on the snow. */

export function Lappland({
  className = '',
  village = true,
  onEnter,
  numbers,
  landedAt,
}: {
  className?: string
  /** Show Tomtens by: houses, the verkstad, destilleri, julgran and nissar. */
  village?: boolean
  /** Makes the buildings clickable. */
  onEnter?: (b: Building, e: React.MouseEvent) => void
  /** House number to paint by each event building's door – the day in December. */
  numbers?: Partial<Record<Building, string>>
  /** Park Santa's sleigh in front of this house. */
  landedAt?: Building
}) {
  // who's out and about: everyone by day and evening, a few early risers, one lantern at night
  const daypart = useDaypart()
  const busy = daypart === 'dag' || daypart === 'kvall'
  const awake = daypart !== 'natt'
  const working = daypart === 'dag' || daypart === 'morgon'
  const farForest = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: i * 21 + rand(i) * 14, h: 26 + rand(i + 100) * 22 })), [])
  const nearForest = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ x: i * 58 + rand(i + 300) * 30, h: 60 + rand(i + 400) * 70 })),
    [],
  )

  return (
    <svg viewBox="0 0 1440 460" preserveAspectRatio="xMidYMax slice" className={`lappland pointer-events-none block w-full ${className}`} aria-hidden>
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
        <filter id="smoke-blur" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
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

      {village && (
        <>
          <VillagePaths />
          {/* back row: small cottages */}
          <House x={40} base={358} w={62} h={28} wall="#d9a441" windows={2} />
          <House x={250} base={358} w={66} h={30} wall="#e9e4d8" roof="#2e3b55" windows={2} smoke={11} />
          <House x={1060} base={358} w={62} h={28} wall="#d9a441" windows={2} />
          <House x={1270} base={358} w={70} h={30} wall="#e9e4d8" roof="#2e3b55" windows={2} />
          <House x={1360} base={362} w={50} h={24} wall="#8e2a1f" windows={1} />
        </>
      )}

      {village && (
        <>
          {/* front row, left: Spelstugan, the painting nisse, the North Pole and the julgran */}
          <House x={100} base={380} w={116} h={44} wall="#2f6b4f" windows={2} sign="SPELSTUGAN" signColor="#1d6e48" building="spel" title="Kliv in i Spelstugan" onEnter={onEnter} />
          <PaintingNisse x={236} base={388} asleep={!busy} />
          <NorthPole x={338} base={384} />
          <VillageTree x={394} base={382} />
          {busy && <Nisse x={372} y={388} carry="wave" />}
          {/* centre: Tomtens stuga (Julafton), destilleri + verkstad (Julbak), långhuset (Julbord) */}
          <House x={425} base={380} w={80} h={38} wall="#a8322a" windows={2} sign="TOMTEN" building="julafton" title="Kliv in hos Tomten – julafton" onEnter={onEnter} smoke={3} />
          <House x={836} base={380} w={170} h={46} wall="#8e2a1f" windows={4} sign="JULBORD" building="julbord" title="Kliv in i långhuset – julbordet" onEnter={onEnter} smoke={7} />
          {/* right */}
          <House x={1145} base={380} w={120} h={40} wall="#c98a2b" windows={4} sign="ARKITEKTKONTORET" signColor="#5a3b22" building="ritningar" title="Kliv in på Arkitektkontoret – Pepparkaksarkitekten" onEnter={onEnter} smoke={31} />
          <Sled x={1100} base={388} />
      {/* destilleri – timber shed with a copper dome venting warm steam */}
      <g
        transform="translate(520 318)"
        className={onEnter ? 'building' : undefined}
        onClick={onEnter ? (e) => onEnter('destilleri', e) : undefined}
      >
        {onEnter && <title>Kliv in i Tomtens destilleri</title>}
        {onEnter && <rect x="-14" y="-40" width="120" height="100" fill="transparent" />}
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
        <Smoke x={67} y={-37} seed={23} color="#f3dcc0" size={0.8} />
        <rect x="14" y="4" width="64" height="12" rx="2.5" fill="#fff3dc" />
        <text x="46" y="12.8" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="7.4" fontWeight="700" fill="#8a3d1d" letterSpacing="0.5">
          DESTILLERI
        </text>
        <rect x="12" y="28" width="20" height="16" fill="#ffb347" className="window-flicker" />
        <rect x="12" y="28" width="20" height="16" fill="none" stroke="#d9c3a5" strokeWidth="2" />
        <rect x="52" y="30" width="22" height="26" fill="#2a170e" />
        <path d="M52 30 h22" stroke="#d9c3a5" strokeWidth="2" />
        <path d="M-4 56 H96" stroke="#f4f8ff" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Tomtens verkstad */}
      <g
        transform="translate(640 296)"
        className={onEnter ? 'building' : undefined}
        onClick={onEnter ? (e) => onEnter('verkstad', e) : undefined}
      >
        {onEnter && <title>Kliv in i Tomtens verkstad</title>}
        {onEnter && <rect x="-18" y="-34" width="206" height="116" fill="transparent" />}
        <ellipse cx="85" cy="78" rx="150" ry="44" fill="url(#warm)" opacity="0.45" />
        <rect x="0" y="22" width="170" height="56" fill="#8e2a1f" />
        <path d="M-14 26 L85 -26 L184 26 Z" fill="#4a1a14" />
        <path d="M-20 30 Q-22 24 -15 24 Q30 2 85 -32 Q140 2 185 24 Q192 24 190 30 Q180 34 150 22 Q118 6 85 -12 Q52 6 20 22 Q-10 34 -20 30 Z" fill="#f4f8ff" />
        {[-10, 10, 160, 178].map((dx) => (
          <ellipse key={dx} cx={dx} cy={dx < 85 ? 27 - (dx + 10) * 0.25 : 22 + (dx - 160) * 0.25} rx="2.6" ry="3.6" fill="#f4f8ff" />
        ))}
        <BrickChimney x={127} y={8} w={15} h={28} smoke={19} />
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

      {/* the verkstad's drawing board – house plans for the gingerbread competition */}
      {village && (
        <g
          transform="translate(770 360)"
          className={onEnter ? 'building' : undefined}
          onClick={onEnter ? (e) => onEnter('ritningar', e) : undefined}
        >
          {onEnter && <title>Rita ert pepparkakshus</title>}
          {onEnter && <rect x="-4" y="-6" width="30" height="34" fill="transparent" />}
          <path d="M4 26 L9 -2 M20 26 L15 -2 M12 26 L12 8" stroke="#5a3b22" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="1" y="0" width="22" height="16" rx="0.8" fill="#fbf3e4" stroke="#5a3b22" strokeWidth="1" transform="rotate(-3 12 8)" />
          <g transform="rotate(-3 12 8)" fill="none" stroke="#a8322a" strokeWidth="0.8" strokeLinejoin="round">
            <path d="M6 13 V8 L12 4 L18 8 V13 Z" />
            <path d="M10.5 13 V10 H13.5 V13" />
            <path d="M4.5 14.5 H19.5" stroke="#5a3b22" strokeDasharray="1 0.8" strokeWidth="0.5" />
          </g>
          <path d="M-1 -1 Q12 -5 25 -1 Q12 -2 -1 -1Z" fill="#f4f8ff" />
          <ellipse cx="12" cy="26.5" rx="11" ry="2" fill="#f4f8ff" />
        </g>
      )}

      {/* marschaller between the two */}
      {TORCHES.map((t, i) => (
        <g key={i}>
          <circle cx={t.x} cy={t.y - 14} r="16" fill="url(#warm)" className="torch" style={{ animationDelay: `${i * 0.37}s` }} />
          <rect x={t.x - 2} y={t.y - 12} width="4" height="12" fill="#5a3b22" />
          <ellipse cx={t.x} cy={t.y - 15} rx="3" ry="5" fill="#ffd27a" className="torch" style={{ animationDelay: `${i * 0.37}s` }} />
        </g>
      ))}

      {/* house numbers by the doors */}
          {numbers &&
            DOOR_NUMBERS.map((d) => (numbers[d.building] ? <HouseNumber key={d.building} x={d.x} y={d.y} n={numbers[d.building]!} /> : null))}
      {/* nissar walking the paths between the houses */}
          <Nisse path="M583 374 Q586 388 594 396 L725 395 Q724 386 725 374" dur={12} carry="lantern" />
          {awake && <Nisse path="M725 374 Q724 386 725 395 L470 396 Q466 390 465 380" dur={14} delay={3} carry="gifts" flip />}
          {busy && <Nisse path="M725 374 Q724 386 725 395 L924 395 Q920 390 921 380" dur={13} delay={6} carry="sack" />}
          {busy && <Nisse path="M158 380 Q160 390 166 396 L312 397 Q300 380 283 358" dur={11} delay={1} carry="lantern" />}
          {busy && <Nisse path="M921 380 Q920 390 924 395 L1200 397 Q1204 390 1205 380" dur={12} delay={2} carry="gifts" />}
          {/* someone has to keep the paths clear */}
          <g>
            <ellipse cx="802" cy="401" rx="9" ry="3.5" fill="#f4f8ff" />
            <ellipse cx="804" cy="399" rx="5" ry="2.5" fill="#ffffff" />
          </g>
          {working && <Nisse x={782} y={402} carry="shovel" />}
          <Snowman x={618} base={430} />
          {landedAt && <LandedTeam at={landedAt} />}
        </>
      )}

      {/* near spruces */}
      {(village ? NEAR_SPRUCES : nearForest).map((t, i) => (
        <Spruce key={i} x={t.x} y={village ? 412 + (i % 2) * 8 : 388 + rand(i + 700) * 30} h={t.h} />
      ))}

      {/* foreground drift */}
      <path d="M0 432 Q240 398 520 420 T1100 412 T1440 406 V460 H0Z" fill="#f7f9ff" />
    </svg>
  )
}
