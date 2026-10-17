import { useEffect, useId, useState } from 'react'
import { blip } from '../lib/fx'

const PALETTES = [
  { box: '#d93a3d', dark: '#a92529', lid: '#e8474a', ribbon: '#f6c453' },
  { box: '#23885a', dark: '#17643f', lid: '#2c9c69', ribbon: '#e5383b' },
  { box: '#f4f1ea', dark: '#cfc8b8', lid: '#ffffff', ribbon: '#d93a3d' },
  { box: '#2f5fb8', dark: '#22468a', lid: '#3a6fd0', ribbon: '#f4f1ea' },
]

/** A floating present. Tap → lid pops, sparks fly, then a new one appears. */
export function Gift({ variant = 0, size = 48, delay = 0, className = '' }: { variant?: number; size?: number; delay?: number; className?: string }) {
  const c = PALETTES[variant % PALETTES.length]
  const clip = useId()
  const [state, setState] = useState<'idle' | 'open' | 'gone' | 'back'>('idle')

  useEffect(() => {
    if (state === 'open') {
      const t = setTimeout(() => setState('gone'), 750)
      return () => clearTimeout(t)
    }
    if (state === 'gone') {
      const t = setTimeout(() => setState('back'), 6000)
      return () => clearTimeout(t)
    }
  }, [state])

  if (state === 'gone') return null

  return (
    <button
      tabIndex={-1}
      aria-hidden
      className={`relative cursor-pointer ${state === 'back' ? 'gift-respawn' : ''} ${className}`}
      onClick={() => {
        if (state === 'open') return
        blip(880, 0.12, 'triangle', 0.06)
        setTimeout(() => blip(1320, 0.15, 'triangle', 0.05), 90)
        setState('open')
      }}
    >
      <svg
        viewBox="0 0 60 66"
        width={size}
        height={(size * 66) / 60}
        className={`gift block drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] ${state === 'open' ? 'open' : ''}`}
        style={{ animationDelay: state === 'open' ? '0s' : `${delay}s` }}
      >
        <defs>
          <clipPath id={clip}>
            <rect x="8" y="28" width="44" height="34" rx="3" />
          </clipPath>
        </defs>
        {/* box */}
        <rect x="8" y="28" width="44" height="34" rx="3" fill={c.box} />
        <rect x="38" y="28" width="14" height="34" rx="3" fill={c.dark} opacity="0.55" />
        <rect x="27" y="28" width="7" height="34" fill={c.ribbon} />
        <g clipPath={`url(#${clip})`}>
          <rect className="gift-shine" x="10" y="20" width="10" height="50" fill="white" opacity="0.35" />
        </g>
        {/* lid + bow */}
        <g className="gift-lid">
          <rect x="5" y="20" width="50" height="11" rx="3" fill={c.lid} />
          <rect x="26.5" y="20" width="8" height="11" fill={c.ribbon} />
          <g className="gift-bow">
            <path d="M30 20 C 18 6, 8 14, 16 20 Z" fill={c.ribbon} />
            <path d="M31 20 C 43 6, 53 14, 45 20 Z" fill={c.ribbon} />
            <path d="M30 20 L 24 27 M31 20 L 37 27" stroke={c.ribbon} strokeWidth="3" strokeLinecap="round" />
            <circle cx="30.5" cy="19" r="3.6" fill={c.ribbon} />
            <circle cx="29.5" cy="18" r="1.2" fill="white" opacity="0.6" />
          </g>
        </g>
      </svg>
      {state === 'open' &&
        Array.from({ length: 10 }, (_, i) => <span key={i} className="spark" style={{ ['--a' as string]: `${i * 36}deg`, animationDelay: `${(i % 3) * 0.03}s` }} />)}
    </button>
  )
}
