type Props = {
  size?: number
  rudolf?: boolean
  mode?: 'gallop' | 'idle'
  scarf?: string
  className?: string
  flip?: boolean
}

/** Hand-drawn, animated reindeer. Facing right; `flip` mirrors it. */
export function Reindeer({ size = 140, rudolf = false, mode = 'idle', scarf = '#e5383b', className = '', flip }: Props) {
  const fur = '#a0612f'
  const furDark = '#7a4520'
  const cream = '#f1cf9b'
  const hoof = '#3b2416'
  const antler = '#6b4423'
  return (
    <svg
      viewBox="0 -14 150 128"
      width={size}
      height={(size * 128) / 150}
      className={`${mode === 'gallop' ? 'rd-gallop' : 'rd-idle'} ${className}`}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      <g className="rd-bob">
        {/* far legs */}
        <g className="rd-leg rd-leg-b">
          <rect x="34" y="60" width="8" height="36" rx="4" fill={furDark} />
          <rect x="33" y="92" width="10" height="7" rx="3" fill={hoof} />
        </g>
        <g className="rd-leg rd-leg-a">
          <rect x="88" y="60" width="8" height="36" rx="4" fill={furDark} />
          <rect x="87" y="92" width="10" height="7" rx="3" fill={hoof} />
        </g>

        {/* tail */}
        <ellipse className="rd-tail" cx="24" cy="48" rx="8" ry="6" fill="#fbf1e2" />

        {/* body */}
        <ellipse cx="64" cy="56" rx="42" ry="22" fill={fur} />
        <ellipse cx="66" cy="66" rx="28" ry="10" fill={cream} opacity="0.9" />
        <circle cx="46" cy="48" r="2.4" fill={cream} opacity="0.7" />
        <circle cx="56" cy="44" r="1.8" fill={cream} opacity="0.7" />
        <circle cx="40" cy="56" r="1.6" fill={cream} opacity="0.7" />

        {/* near legs */}
        <g className="rd-leg rd-leg-a">
          <rect x="44" y="62" width="9" height="36" rx="4.5" fill={fur} />
          <rect x="43" y="94" width="11" height="7" rx="3" fill={hoof} />
        </g>
        <g className="rd-leg rd-leg-b">
          <rect x="80" y="62" width="9" height="36" rx="4.5" fill={fur} />
          <rect x="79" y="94" width="11" height="7" rx="3" fill={hoof} />
        </g>

        {/* neck + scarf */}
        <path d="M84 50 Q94 30 104 22 L118 30 Q106 44 102 62 Z" fill={fur} />
        <path d="M88 44 Q100 50 112 38 L115 44 Q101 58 86 51 Z" fill={scarf} />
        <path d="M95 50 L92 66 L99 66 L100 51 Z" fill={scarf} />
        <circle cx="96" cy="50" r="3" fill="#f6c453" />

        {/* head */}
        <g className="rd-head">
          {/* antlers */}
          <g stroke={antler} strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M108 14 Q104 2 98 -6" />
            <path d="M104 4 L96 2" />
            <path d="M101 -1 L104 -9" />
            <path d="M116 13 Q120 0 128 -6" />
            <path d="M121 3 L129 4" />
            <path d="M124 -2 L122 -10" />
          </g>
          <ellipse cx="103" cy="18" rx="7" ry="3.5" fill={furDark} transform="rotate(-25 103 18)" />
          <ellipse cx="115" cy="24" rx="15" ry="12" fill={fur} />
          <ellipse cx="128" cy="30" rx="10" ry="7.5" fill={cream} />
          {/* eye */}
          <circle cx="117" cy="21" r="3.2" fill="#1d130c" />
          <circle cx="118.2" cy="19.8" r="1.1" fill="white" />
          {/* blush */}
          <ellipse cx="121" cy="29" rx="3.5" ry="2" fill="#ff8a8a" opacity="0.55" />
          {/* smile */}
          <path d="M126 35 Q130 37 134 34" stroke={furDark} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {/* nose */}
          {rudolf && <circle className="rd-nose-glow" cx="137" cy="28" r="9" fill="#ff3b3b" opacity="0.6" style={{ filter: 'blur(3px)' }} />}
          <circle cx="137" cy="28" r={rudolf ? 5.5 : 4.5} fill={rudolf ? '#ff2d2d' : '#3b2416'} />
          <circle cx="135.5" cy="26.5" r="1.4" fill="white" opacity="0.7" />
        </g>
      </g>
    </svg>
  )
}

/**
 * A slender reindeer mid-leap – legs stretched fore and aft, big golden antlers,
 * white collar and a red saddle blanket. Facing right. Used for the team in the sky.
 */
export function LeapingReindeer({ size = 140, rudolf = false, className = '' }: { size?: number; rudolf?: boolean; className?: string }) {
  const fur = '#b47b47'
  const furDark = '#94602f'
  const cream = '#d9b388'
  const antler = '#ecd39b'
  const hoof = '#3b2416'
  return (
    <svg viewBox="0 -14 170 134" width={size} height={(size * 134) / 170} className={`leap ${className}`} aria-hidden>
      <g className="leap-bob">
        {/* far legs */}
        <g className="leap-front" stroke={furDark} strokeWidth="4.2" strokeLinecap="round" fill="none">
          <path d="M96 76 Q104 88 113 93 L119 94" />
        </g>
        <g className="leap-back" stroke={furDark} strokeWidth="4.6" strokeLinecap="round" fill="none">
          <path d="M60 76 Q50 89 41 95 L34 97" />
        </g>
        <circle cx="119.5" cy="94" r="2.4" fill={hoof} className="leap-front" />
        <circle cx="33.5" cy="97" r="2.4" fill={hoof} className="leap-back" />

        {/* tail */}
        <path d="M42 64 Q30 58 32 52 Q40 56 46 60 Z" fill="#f3ece0" />
        {/* body */}
        <path d="M44 66 Q48 54 70 54 Q92 52 104 60 Q112 68 104 76 Q90 84 66 82 Q46 80 44 66 Z" fill={fur} />
        <path d="M56 78 Q74 84 98 76 Q86 82 66 82 Q58 81 56 78 Z" fill={cream} />
        {/* saddle blanket */}
        <path d="M64 54 Q80 50 94 56 L92 72 Q78 76 66 72 Z" fill="#c1272d" />
        <path d="M64 54 Q80 50 94 56 L92 72 Q78 76 66 72 Z" fill="none" stroke="#f6c453" strokeWidth="1.6" />
        <path d="M66 71 Q79 75 92 71" stroke="#fbf7ef" strokeWidth="1.4" fill="none" />
        {/* neck + white collar */}
        <path d="M96 62 Q104 44 118 32 L130 40 Q118 54 110 70 Z" fill={fur} />
        <path d="M100 58 Q110 62 112 74 Q104 72 98 64 Z" fill="#f3ece0" />
        <path d="M101 52 Q112 56 116 50" stroke="#c1272d" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="109" cy="55" r="2.2" fill="#f6c453" />

        {/* near legs */}
        <g className="leap-front" stroke={fur} strokeWidth="4.8" strokeLinecap="round" fill="none">
          <path d="M100 72 Q112 82 122 85 L129 83" />
        </g>
        <g className="leap-back" stroke={fur} strokeWidth="5.2" strokeLinecap="round" fill="none">
          <path d="M54 72 Q42 82 32 86 L25 84" />
        </g>
        <circle cx="129.5" cy="83" r="2.6" fill={hoof} className="leap-front" />
        <circle cx="24.5" cy="84" r="2.6" fill={hoof} className="leap-back" />

        {/* head */}
        <g>
          <g stroke={antler} strokeWidth="2.6" strokeLinecap="round" fill="none">
            <path d="M124 26 Q118 10 106 2" />
            <path d="M120 16 L126 6" />
            <path d="M114 8 L117 -2" />
            <path d="M110 5 L104 -4" />
            <path d="M129 25 Q132 8 125 -4" />
            <path d="M131 14 L139 8" />
            <path d="M130 5 L136 -4" />
          </g>
          <ellipse cx="121" cy="29" rx="5" ry="2.4" fill={furDark} transform="rotate(-30 121 29)" />
          <ellipse cx="131" cy="33" rx="11" ry="7.5" fill={fur} transform="rotate(18 131 33)" />
          <ellipse cx="141" cy="39" rx="6.5" ry="5" fill={cream} transform="rotate(18 141 39)" />
          <circle cx="133" cy="30" r="1.8" fill="#1d130c" />
          <circle cx="133.6" cy="29.4" r="0.6" fill="#fff" />
          {rudolf && <circle className="rd-nose-glow" cx="146" cy="41" r="8" fill="#ff3b3b" opacity="0.6" style={{ filter: 'blur(3px)' }} />}
          <circle cx="146" cy="41" r={rudolf ? 3.6 : 2.6} fill={rudolf ? '#ff2d2d' : hoof} />
        </g>
      </g>
    </svg>
  )
}
