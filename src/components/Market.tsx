import { useMemo } from 'react'
import { PARTICIPANTS } from '../data'
import { Reindeer } from './Reindeer'
import { SantaSleigh } from './Santa'

export const WOOD = 'repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 9px), linear-gradient(180deg, #7a4c2a, #4a2c1c)'

/** Striped market-stall awning with scalloped edge. */
export function Awning({ a = '#d93a3d', b = '#fbf7ef', stripes = 9, className = '' }: { a?: string; b?: string; stripes?: number; className?: string }) {
  const w = 100 / stripes
  return (
    <svg viewBox="0 0 100 22" preserveAspectRatio="none" className={`block w-full ${className}`} aria-hidden>
      {Array.from({ length: stripes }, (_, i) => (
        <g key={i} fill={i % 2 ? b : a}>
          <rect x={i * w} y="0" width={w + 0.2} height="15" />
          <path d={`M${i * w} 15 a${w / 2} 6 0 0 0 ${w} 0 Z`} />
        </g>
      ))}
      <rect x="0" y="0" width="100" height="3" fill="#000" opacity="0.15" />
    </svg>
  )
}

const BULB_COLORS = ['#ffd27a', '#ff6b6b', '#7fd1ff', '#9bff9b', '#ffb3f0']

/** A sagging string of twinkling bulbs. */
export function StringLights({ count = 12, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`pointer-events-none relative h-6 ${className}`} aria-hidden>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M0 1 Q25 9 50 4 T100 1" stroke="#1b1b22" strokeWidth="0.6" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: count }, (_, i) => {
        const t = (i + 0.5) / count
        // follow the sag of the wire roughly
        const sag = t < 0.5 ? Math.sin(t * 2 * Math.PI) * 70 : Math.sin((t - 0.5) * 2 * Math.PI) * 35
        return (
          <span
            key={i}
            className="absolute h-2.5 w-2 -translate-x-1/2 rounded-full animate-twinkle"
            style={{
              left: `${t * 100}%`,
              top: `${10 + sag}%`,
              background: BULB_COLORS[i % BULB_COLORS.length],
              boxShadow: `0 0 10px 2px ${BULB_COLORS[i % BULB_COLORS.length]}`,
              animationDelay: `${(i * 0.37) % 2}s`,
              animationDuration: '2.2s',
            }}
          />
        )
      })}
    </div>
  )
}

/** Dark green chalkboard in a wooden frame. */
export function Chalkboard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-md border-[7px] border-[#6b4423] p-4 font-chalk text-[#f2efe6] shadow-[inset_0_0_30px_rgba(0,0,0,0.6),0_0_0_1px_#3a2418] ${className}`}
      style={{
        background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.07), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05), transparent 45%), #1e2b25',
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Animated previews for each game's stall                             */
/* ------------------------------------------------------------------ */

function MiniGift({ color, ribbon }: { color: string; ribbon: string }) {
  return (
    <svg viewBox="0 0 20 20" className="h-full w-full">
      <rect x="2" y="7" width="16" height="12" rx="1.5" fill={color} />
      <rect x="1" y="5" width="18" height="4" rx="1" fill={color} />
      <rect x="9" y="5" width="2.5" height="14" fill={ribbon} />
      <path d="M10 5 C 5 0, 2 4, 6 5 Z M10.5 5 C 15 0, 18 4, 14 5 Z" fill={ribbon} />
    </svg>
  )
}

function KlappPreview() {
  const drops = [
    { left: '18%', delay: 0, kind: 'gift', c: '#d93a3d', r: '#f6c453' },
    { left: '48%', delay: 0.9, kind: 'coal' },
    { left: '72%', delay: 0.4, kind: 'gift', c: '#23885a', r: '#d93a3d' },
    { left: '34%', delay: 1.6, kind: 'gift', c: '#2f5fb8', r: '#fbf7ef' },
  ]
  return (
    <>
      {drops.map((d, i) => (
        <span key={i} className="pv-fall absolute top-0 h-7 w-7" style={{ left: d.left, animationDelay: `${d.delay}s` }}>
          {d.kind === 'coal' ? <span className="block h-6 w-6 rounded-[40%] bg-[#1b1b22] shadow-[0_0_8px_rgba(255,90,40,0.6)]" /> : <MiniGift color={d.c!} ribbon={d.r!} />}
        </span>
      ))}
      <span className="pv-slide absolute bottom-1 left-0">
        <SantaSleigh size={92} />
      </span>
    </>
  )
}

function FlygPreview() {
  return (
    <>
      {[0, 1].map((i) => (
        <span key={i} className="pv-scroll absolute inset-y-0 w-7" style={{ animationDelay: `${i * -1.6}s` }}>
          <span className="candy-pole absolute inset-x-0 top-0 h-[34%] rounded-b-md" />
          <span className="candy-pole absolute inset-x-0 bottom-0 h-[30%] rounded-t-md" />
        </span>
      ))}
      <span className="pv-flap absolute left-[18%] top-[34%]">
        <Reindeer size={66} mode="gallop" rudolf />
      </span>
    </>
  )
}

function MemoryPreview() {
  const faces = useMemo(() => PARTICIPANTS.filter((p) => p.image).slice(0, 6), [])
  return (
    <div className="absolute inset-3 grid grid-cols-3 gap-2" style={{ perspective: 400 }}>
      {faces.map((p, i) => (
        <span key={p.name} className="pv-flip relative block" style={{ animationDelay: `${(i % 3) * 0.5 + Math.floor(i / 3) * 1.2}s`, transformStyle: 'preserve-3d' }}>
          <span className="candy-border absolute inset-0 flex items-center justify-center rounded-md text-sm" style={{ backfaceVisibility: 'hidden' }}>
            🎄
          </span>
          <img
            src={p.image!}
            alt=""
            className="absolute inset-0 h-full w-full rounded-md bg-white object-cover ring-2 ring-jul-gold"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          />
        </span>
      ))}
    </div>
  )
}

export function GamePreview({ id }: { id: string }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gradient-to-b from-[#061229] to-[#133a5c] shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]">
      {[12, 30, 55, 78, 88, 40, 66].map((x, i) => (
        <span key={i} className="absolute h-0.5 w-0.5 rounded-full bg-white animate-twinkle" style={{ left: `${x}%`, top: `${8 + ((i * 23) % 40)}%`, animationDelay: `${i * 0.4}s` }} />
      ))}
      {id === 'klappfangst' && <KlappPreview />}
      {id === 'renflyg' && <FlygPreview />}
      {id === 'tomtememory' && <MemoryPreview />}
    </div>
  )
}
