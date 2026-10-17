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

function Tree({ x, y, s, light }: { x: number; y: number; s: number; light?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3" y="0" width="6" height="10" fill="#3b2416" />
      <path d="M0 -60 L22 -20 L12 -20 L28 0 L-28 0 L-12 -20 L-22 -20 Z" fill="#14533a" />
      <path d="M0 -60 L22 -20 L12 -20 L18 -12 L-6 -26 Z" fill="#1d6e48" opacity="0.7" />
      <path d="M-12 -20 L-6 -24 L0 -20 L6 -24 L12 -20 M-28 0 L-20 -4 L-10 0 L0 -4 L10 0 L20 -4 L28 0" stroke="#fff" strokeWidth="3" fill="none" opacity="0.85" />
      {light && (
        <>
          <circle cx="-8" cy="-12" r="2.4" fill="#f6c453" className="animate-twinkle" />
          <circle cx="9" cy="-30" r="2.4" fill="#e5383b" className="animate-twinkle" style={{ animationDelay: '0.7s' }} />
          <circle cx="12" cy="-8" r="2.4" fill="#4fd1ff" className="animate-twinkle" style={{ animationDelay: '1.3s' }} />
          <path d="M0 -66 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0z" fill="#f6c453" />
        </>
      )}
    </g>
  )
}

/** Snowy hills with a glowing cottage and pine trees. */
export function Hills({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" className={`pointer-events-none block w-full ${className}`} aria-hidden>
      <path d="M0 200 Q240 120 480 170 T960 150 T1440 160 V320 H0Z" fill="#c9d6f2" opacity="0.35" />
      <Tree x={160} y={185} s={0.9} />
      <Tree x={210} y={178} s={0.7} />
      <Tree x={1250} y={170} s={0.85} />
      <Tree x={1310} y={176} s={0.65} />
      <path d="M0 240 Q300 170 620 220 T1200 210 T1440 220 V320 H0Z" fill="#e4ecfb" />
      {/* cottage */}
      <g transform="translate(980 150)">
        <rect x="0" y="20" width="110" height="60" fill="#7b3b2a" />
        <path d="M-12 24 L55 -24 L122 24 Z" fill="#5b2a1e" />
        <path d="M-14 26 Q20 6 55 -26 Q90 6 124 26 Q100 14 55 -14 Q10 14 -14 26 Z" fill="#fff" />
        <rect x="78" y="-20" width="14" height="28" fill="#5b2a1e" />
        <rect x="76" y="-24" width="18" height="6" rx="3" fill="#fff" />
        <rect x="14" y="36" width="24" height="22" rx="2" fill="#ffd36b" />
        <rect x="14" y="36" width="24" height="22" rx="2" fill="#ffb347" className="animate-twinkle" style={{ animationDuration: '4s' }} />
        <path d="M26 36 V58 M14 47 H38" stroke="#5b2a1e" strokeWidth="2.5" />
        <rect x="60" y="44" width="22" height="36" rx="2" fill="#3b2416" />
        <circle cx="77" cy="63" r="2" fill="#f6c453" />
        <circle cx="71" cy="40" r="7" fill="none" stroke="#2fa36b" strokeWidth="4" />
        <circle cx="71" cy="34" r="2" fill="#e5383b" />
        <g className="animate-float" style={{ animationDuration: '5s' }}>
          <circle cx="86" cy="-34" r="6" fill="#fff" opacity="0.35" />
          <circle cx="94" cy="-48" r="8" fill="#fff" opacity="0.25" />
        </g>
      </g>
      <Tree x={920} y={226} s={1.1} light />
      <Tree x={1140} y={222} s={0.9} />
      <Tree x={380} y={226} s={1.2} light />
      <Tree x={440} y={232} s={0.8} />
      <path d="M0 280 Q360 230 720 270 T1440 260 V320 H0Z" fill="#f7f9ff" />
    </svg>
  )
}
