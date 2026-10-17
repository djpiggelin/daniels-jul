import { useId } from 'react'

/** Cog outline centred on (cx, cy). */
function gear(cx: number, cy: number, r: number, teeth: number) {
  const pts: string[] = []
  const inner = r * 0.78
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2
    const rr = i % 2 ? inner : r
    pts.push(`${(cx + Math.cos(a0) * rr).toFixed(1)} ${(cy + Math.sin(a0) * rr).toFixed(1)}`)
    pts.push(`${(cx + Math.cos(a1) * rr).toFixed(1)} ${(cy + Math.sin(a1) * rr).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}

const WINDOWS = [
  { x: 62, label: 'Bageriet' },
  { x: 168, label: 'Leksakerna' },
  { x: 382, label: 'Glitterlagret' },
  { x: 488, label: 'Postkontoret' },
]

/** Tomtens verkstad – a gingerbread workshop with four busy rooms. */
export function Verkstad({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 -24 640 314" className={className} role="img" aria-label="Tomtens verkstad – bageriet, leksakerna, glitterlagret och postkontoret">
      <defs>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="1" stopColor="#ff9a3c" />
        </linearGradient>
        <radialGradient id={`${id}-frost`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#eef6ff" stopOpacity="0.75" />
        </radialGradient>
        {WINDOWS.map((w, i) => (
          <clipPath key={i} id={`${id}-w${i}`}>
            <rect x={w.x} y="138" width="90" height="70" rx="6" />
          </clipPath>
        ))}
      </defs>

      {/* stars */}
      {[30, 120, 250, 410, 560, 610, 80, 520].map((x, i) => (
        <circle key={i} cx={x} cy={14 + ((i * 37) % 50)} r={1.4} fill="#fff" className="animate-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}

      {/* chimney + smoke */}
      <rect x="452" y="38" width="30" height="50" fill="#8a4f24" />
      <rect x="446" y="32" width="42" height="10" rx="5" fill="#fff" />
      <g className="stuga-smoke">
        <circle cx="467" cy="18" r="7" fill="#dfe8f7" opacity="0.4" />
        <circle cx="474" cy="2" r="10" fill="#dfe8f7" opacity="0.25" />
        <circle cx="466" cy="-16" r="13" fill="#dfe8f7" opacity="0.12" />
      </g>

      {/* walls */}
      <rect x="36" y="108" width="568" height="150" rx="4" fill="#b5713a" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={50 + ((i * 53) % 540)} cy={118 + ((i * 29) % 130)} r="1.6" fill="#8a4f24" opacity="0.55" />
      ))}
      {/* roof */}
      <path d="M14 116 L320 34 L626 116 Z" fill="#8a4f24" />
      <path d="M8 118 Q120 92 320 28 Q520 92 632 118 Q600 100 320 46 Q40 100 8 118 Z" fill="#fff" />
      {/* icing scallops under the roof */}
      <path
        d={`M24 116 ${Array(30).fill('q 10 14 20 0').join(' ')}`}
        stroke="#fff"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {/* candy cane corners */}
      {[30, 600].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="108" width="12" height="150" fill="#fff" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${x - 6} ${118 + i * 19} l12 -8 v7 l-12 8 z`} fill="#d93a3d" />
          ))}
        </g>
      ))}

      {/* sign */}
      <g>
        <rect x="212" y="80" width="216" height="32" rx="6" fill="#fff3dc" stroke="#fff" strokeWidth="3" />
        <text x="320" y="102" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="14" fontWeight="600" fill="#a92529" letterSpacing="0.5">
          TOMTENS VERKSTAD
        </text>
      </g>

      {/* door */}
      <path d="M290 258 V192 Q320 168 350 192 V258 Z" fill="#5a2a14" />
      <path d="M290 258 V192 Q320 168 350 192 V258" stroke="#fff" strokeWidth="4" fill="none" />
      <circle cx="340" cy="228" r="3" fill="#f6c453" />
      <circle cx="320" cy="160" r="12" fill="none" stroke="#23885a" strokeWidth="6" />
      <circle cx="320" cy="150" r="3" fill="#d93a3d" />
      <rect x="276" y="258" width="88" height="8" rx="3" fill="#fff" />

      {/* windows */}
      {WINDOWS.map((w, i) => (
        <g key={i}>
          <rect x={w.x - 5} y="133" width="100" height="80" rx="9" fill="#fff" />
          <rect x={w.x} y="138" width="90" height="70" rx="6" fill={`url(#${id}-glow)`} />
          <g clipPath={`url(#${id}-w${i})`}>
            {i === 0 && <Bakery x={w.x} />}
            {i === 1 && <Toys x={w.x} />}
            {i === 2 && <Glitter x={w.x} />}
            {i === 3 && <Post x={w.x} />}
            <rect x={w.x} y="138" width="90" height="70" fill={`url(#${id}-frost)`} />
          </g>
          <text x={w.x + 45} y="234" textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontSize="12" fontWeight="600" fill="#fff3dc">
            {w.label}
          </text>
        </g>
      ))}

      {/* snow */}
      <path d="M0 262 Q160 250 320 262 T640 258 V290 H0 Z" fill="#f4f8ff" />
    </svg>
  )
}

function Bakery({ x }: { x: number }) {
  return (
    <g>
      <path d={`M${x + 18} 208 V178 Q${x + 45} 150 ${x + 72} 178 V208 Z`} fill="#4a2a1c" />
      <path d={`M${x + 28} 208 V186 Q${x + 45} 168 ${x + 62} 186 V208 Z`} fill="#ff7a1a" className="torch" />
      {/* gingerbread man on a tray */}
      <rect x={x + 30} y="196" width="30" height="3" fill="#cfd6e0" />
      <g fill="#b5713a">
        <circle cx={x + 45} cy="186" r="4" />
        <rect x={x + 41} y="189" width="8" height="7" rx="2" />
        <rect x={x + 37} y="190" width="16" height="3" rx="1.5" />
      </g>
      {[0, 1, 2].map((k) => (
        <path
          key={k}
          d={`M${x + 34 + k * 11} 160 q -4 -7 0 -14 q 4 -7 0 -14`}
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          className="steam"
          style={{ animationDelay: `${k * 0.7}s` }}
        />
      ))}
    </g>
  )
}

function Toys({ x }: { x: number }) {
  return (
    <g>
      <path d={gear(x + 34, 178, 22, 10)} fill="#8a4f24" className="spin" />
      <circle cx={x + 34} cy="178" r="6" fill="#ffd98a" />
      <path d={gear(x + 66, 158, 14, 8)} fill="#6e3a1a" className="spin-rev" />
      <circle cx={x + 66} cy="158" r="4" fill="#ffd98a" />
      {/* little toy soldier */}
      <g transform={`translate(${x + 68} 182)`}>
        <rect x="-5" y="-4" width="10" height="14" rx="2" fill="#d93a3d" />
        <circle cx="0" cy="-9" r="5" fill="#ffd7b5" />
        <rect x="-5" y="-20" width="10" height="9" rx="2" fill="#1b1b2a" />
        <rect x="-5" y="10" width="4" height="10" fill="#1b1b2a" />
        <rect x="1" y="10" width="4" height="10" fill="#1b1b2a" />
      </g>
    </g>
  )
}

function Glitter({ x }: { x: number }) {
  const sparkles = [
    [18, 156], [36, 172], [58, 150], [72, 176], [28, 194], [50, 188], [80, 196], [12, 176],
  ]
  return (
    <g>
      {[160, 186].map((y) => (
        <rect key={y} x={x} y={y + 14} width="90" height="3" fill="#8a4f24" />
      ))}
      {[10, 34, 58].map((dx, k) => (
        <g key={k}>
          <rect x={x + dx} y="160" width="16" height="14" rx="3" fill={['#e8b4ff', '#9fe3ff', '#ffe08a'][k]} opacity="0.85" />
          <rect x={x + dx + 6} y="186" width="16" height="14" rx="3" fill={['#ffe08a', '#e8b4ff', '#9fe3ff'][k]} opacity="0.85" />
        </g>
      ))}
      {sparkles.map(([sx, sy], k) => (
        <path
          key={k}
          d={`M${x + sx} ${sy - 5} L${x + sx + 1.4} ${sy - 1.4} L${x + sx + 5} ${sy} L${x + sx + 1.4} ${sy + 1.4} L${x + sx} ${sy + 5} L${x + sx - 1.4} ${sy + 1.4} L${x + sx - 5} ${sy} L${x + sx - 1.4} ${sy - 1.4} Z`}
          fill="#fff"
          className="animate-twinkle"
          style={{ animationDelay: `${k * 0.35}s`, animationDuration: '1.8s', transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      ))}
    </g>
  )
}

function Post({ x }: { x: number }) {
  return (
    <g>
      {/* pigeonholes */}
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={x + 6 + c * 21} y={146 + r * 18} width="18" height="15" fill="#c98a52" opacity="0.55" />),
      )}
      {[0, 1, 2].map((k) => (
        <g key={k} className="letter-fly" style={{ animationDelay: `${k * 1.1}s` }}>
          <rect x={x - 20} y={160 + k * 14} width="20" height="13" rx="1.5" fill="#fff" />
          <path d={`M${x - 20} ${160 + k * 14} l10 7 l10 -7`} stroke="#d93a3d" strokeWidth="1.5" fill="none" />
        </g>
      ))}
    </g>
  )
}

/** Tomtens destilleri – copper kettles bubbling over the fire. */
export function Destilleri({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  const kettles = [
    { x: 130, label: 'I' },
    { x: 320, label: 'II' },
    { x: 510, label: 'III' },
  ]
  return (
    <svg viewBox="0 0 640 290" className={className} role="img" aria-label="Tomtens destilleri – tre kopparpannor över elden">
      <defs>
        <radialGradient id={`${id}-copper`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffd2a1" />
          <stop offset="0.25" stopColor="#e9925a" />
          <stop offset="0.7" stopColor="#b5562a" />
          <stop offset="1" stopColor="#6e2f17" />
        </radialGradient>
        <radialGradient id={`${id}-amber`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-pipe`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2a56b" />
          <stop offset="1" stopColor="#8a3d1d" />
        </linearGradient>
      </defs>

      {/* back wall: timber */}
      <rect width="640" height="290" fill="#1f120d" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x="0" y={i * 34} width="640" height="32" fill={i % 2 ? '#26160f' : '#2b1911'} />
      ))}
      <rect width="640" height="290" fill={`url(#${id}-amber)`} />

      {/* shelf with bottles and spices */}
      <rect x="40" y="70" width="560" height="8" rx="2" fill="#5a3420" />
      {[
        { x: 70, h: 40, c: '#7a1f2b' },
        { x: 96, h: 30, c: '#2f6b4f' },
        { x: 120, h: 46, c: '#d9925a' },
        { x: 470, h: 36, c: '#4a5fa8' },
        { x: 496, h: 44, c: '#7a1f2b' },
        { x: 524, h: 28, c: '#c9a24a' },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={70 - b.h} width="18" height={b.h} rx="4" fill={b.c} opacity="0.9" />
          <rect x={b.x + 6} y={70 - b.h - 10} width="6" height="12" fill={b.c} opacity="0.9" />
          <rect x={b.x + 3} y={70 - b.h + 8} width="5" height={b.h - 14} rx="2" fill="#fff" opacity="0.18" />
        </g>
      ))}
      {/* cinnamon jar + star anise */}
      <rect x="560" y="40" width="26" height="30" rx="4" fill="#cfe3f0" opacity="0.35" />
      {[0, 1, 2].map((k) => (
        <rect key={k} x={564 + k * 7} y="32" width="4" height="36" rx="2" fill="#8a4a24" transform={`rotate(${(k - 1) * 8} 575 68)`} />
      ))}
      <path d="M160 62 l3 -8 l3 8 l8 -3 l-5 7 l5 7 l-8 -3 l-3 8 l-3 -8 l-8 3 l5 -7 l-5 -7 z" fill="#6b3a1f" />

      {/* hanging lamp */}
      <line x1="320" y1="0" x2="320" y2="26" stroke="#5a3420" strokeWidth="2" />
      <path d="M306 26 h28 l-6 18 h-16 z" fill="#3a2418" />
      <circle cx="320" cy="48" r="26" fill="#ffcf6b" opacity="0.25" className="torch" />
      <circle cx="320" cy="46" r="6" fill="#ffd98a" />

      {/* shared copper pipe along the top */}
      <path d="M60 110 H580" stroke={`url(#${id}-pipe)`} strokeWidth="8" strokeLinecap="round" />

      {kettles.map((k, i) => (
        <g key={i}>
          {/* firebox */}
          <rect x={k.x - 46} y="232" width="92" height="30" rx="4" fill="#3a2418" />
          <path d={`M${k.x - 26} 260 q 8 -26 14 -6 q 6 -24 12 0 q 6 -22 12 -2 q 6 -20 12 8 z`} fill="#ff7a1a" className="torch" style={{ animationDelay: `${i * 0.3}s` }} />
          <path d={`M${k.x - 14} 260 q 6 -14 10 -2 q 6 -14 10 2 z`} fill="#ffd27a" className="torch" style={{ animationDelay: `${i * 0.3 + 0.2}s` }} />
          {/* kettle body */}
          <path
            d={`M${k.x - 54} 222 Q${k.x - 66} 170 ${k.x - 30} 152 Q${k.x - 14} 144 ${k.x - 12} 132 L${k.x + 12} 132 Q${k.x + 14} 144 ${k.x + 30} 152 Q${k.x + 66} 170 ${k.x + 54} 222 Z`}
            fill={`url(#${id}-copper)`}
          />
          <rect x={k.x - 58} y="218" width="116" height="10" rx="4" fill="#7a3a1c" />
          {/* rivets */}
          {[-40, -20, 0, 20, 40].map((dx) => (
            <circle key={dx} cx={k.x + dx} cy="210" r="2" fill="#ffd2a1" opacity="0.8" />
          ))}
          {/* brass plate */}
          <rect x={k.x - 13} y="182" width="26" height="16" rx="3" fill="#e9c46a" />
          <text x={k.x} y="194" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="11" fontWeight="700" fill="#5a3420">
            {k.label}
          </text>
          {/* neck up to the shared pipe */}
          <rect x={k.x - 6} y="110" width="12" height="24" fill={`url(#${id}-pipe)`} />
          <circle cx={k.x} cy="110" r="8" fill="#e9925a" />
          {/* bubbles out of a little vent */}
          {[0, 1, 2, 3].map((b) => (
            <circle
              key={b}
              cx={k.x + 34 + (b % 2) * 6}
              cy="150"
              r={2.5 + (b % 2)}
              fill="#ffe7c2"
              className="bubble"
              style={{ animationDelay: `${i * 0.4 + b * 0.5}s` }}
            />
          ))}
          {/* steam */}
          {[0, 1].map((s) => (
            <path
              key={s}
              d={`M${k.x - 8 + s * 16} 100 q -5 -8 0 -16 q 5 -8 0 -16`}
              stroke="#fff"
              strokeOpacity="0.55"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              className="steam"
              style={{ animationDelay: `${i * 0.5 + s * 0.8}s` }}
            />
          ))}
        </g>
      ))}

      {/* the finished brew: a glass catching drips from the end of the pipe */}
      <path d="M580 110 q 16 0 16 18 v14" stroke={`url(#${id}-pipe)`} strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="596" cy="150" r="3.5" fill="#ff9a3c" className="drip" />
      <path d="M582 196 l4 40 h20 l4 -40 z" fill="#cfe3f0" opacity="0.35" />
      <path d="M584 214 l2 22 h20 l2 -22 z" fill="#d9472b" opacity="0.85" />
      <rect x="578" y="236" width="36" height="5" rx="2" fill="#5a3420" />

      {/* floor */}
      <rect x="0" y="262" width="640" height="28" fill="#140b07" />
    </svg>
  )
}
