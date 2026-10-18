import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift } from '../components/Gift'
import { SnowballArena } from '../components/Snowballs'
import { SkyTeam } from '../components/Santa'
import { Aurora, Lappland, Moon, Stars, Sun, type Building } from '../components/Scenery'
import { useDaypart } from '../lib/daypart'
import { jingle } from '../lib/fx'
import { HOUSE_NUMBERS, linkFor } from '../lib/village'

// gifts float around the edges, clear of the sleigh
const GIFTS = [
  { left: '7%', top: '50%', size: 44, mobile: true },
  { left: '92%', top: '40%', size: 40, mobile: true },
  { left: '24%', top: '12%', size: 34, mobile: false },
  { left: '76%', top: '14%', size: 38, mobile: false },
  { left: '12%', top: '52%', size: 36, mobile: false },
  { left: '86%', top: '56%', size: 42, mobile: false },
]

export default function Home() {
  const navigate = useNavigate()
  const daypart = useDaypart()
  const [entering, setEntering] = useState<{ x: number; y: number } | null>(null)

  // coming back via the browser's back button may restore the zoomed-in page – reset it
  useEffect(() => {
    const reset = () => setEntering(null)
    addEventListener('pageshow', reset)
    return () => removeEventListener('pageshow', reset)
  }, [])

  // zoom the whole scene into the clicked door, glow warm, then step inside
  const enter = (b: Building, ev: React.MouseEvent) => {
    if (entering) return
    setEntering({ x: ev.clientX, y: ev.clientY })
    setTimeout(() => navigate(linkFor(b)), 1000)
  }

  return (
    <section className="sky relative h-[100svh] min-h-[620px] overflow-hidden">
      <div
        className="enter-zoom absolute inset-0"
        style={entering ? { transform: 'scale(7)', transformOrigin: `${entering.x}px ${entering.y}px` } : undefined}
      >
        <SnowballArena>
        <Stars count={110} />
        <Aurora />
        <Moon className="absolute left-[8%] top-20 h-10 w-10 opacity-80 sm:h-14 sm:w-14" />
        <Sun daypart={daypart} />

        {GIFTS.map((g, i) => (
          <div key={i} className={`absolute z-20 -translate-x-1/2 ${g.mobile ? '' : 'hidden md:block'}`} style={{ left: g.left, top: g.top }}>
            <Gift variant={i} size={g.size} delay={i * 0.7} />
          </div>
        ))}

        <FlyingSanta />

        <Village onEnter={enter} />

        <p className="pointer-events-none absolute inset-x-0 bottom-3 z-10 text-center text-xs text-night-800/50">
          Svep på släden · kliv in i husen · kasta snöbollar från högarna
        </p>
        </SnowballArena>
      </div>
      <div
        className="enter-warm pointer-events-none absolute inset-0 z-50"
        style={{
          opacity: entering ? 1 : 0,
          background: `radial-gradient(circle at ${entering?.x ?? 0}px ${entering?.y ?? 0}px, #ffcf6b, #c8742c 40%, #2a160d 100%)`,
        }}
      />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Tomtens by – each event's house has the day in December as its number */
/* ------------------------------------------------------------------ */

function Village({ onEnter }: { onEnter: (b: Building, e: React.MouseEvent) => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[36%] min-h-[210px]">
      <Lappland className="h-full" onEnter={onEnter} numbers={HOUSE_NUMBERS} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Santa and the reindeer, flying free in the sky                      */
/* ------------------------------------------------------------------ */

function FlyingSanta() {
  const [lapping, setLapping] = useState(false)
  const [hoho, setHoho] = useState(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const teamRef = useRef<HTMLSpanElement>(null)

  // gold stardust behind the sleigh while it flies its lap
  useEffect(() => {
    if (!lapping) return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      const el = teamRef.current
      if (el && t - last > 45) {
        last = t
        const r = el.getBoundingClientRect()
        const s = document.createElement('span')
        s.className = 'trail-spark'
        s.style.left = `${r.left + r.width * 0.12 + (Math.random() - 0.5) * 20}px`
        s.style.top = `${r.top + r.height * 0.8 + (Math.random() - 0.5) * 16}px`
        document.body.appendChild(s)
        setTimeout(() => s.remove(), 1100)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lapping])

  const fly = () => {
    if (lapping) return
    jingle()
    setHoho(true)
    setLapping(true)
    setTimeout(() => setHoho(false), 1300)
    setTimeout(() => setLapping(false), 5200)
  }

  return (
    <div className="absolute inset-x-0 top-[24%] z-10 flex justify-center sm:top-[16%]">
      <div className="sky-drift">
        <div className={lapping ? 'sleigh-lap' : 'animate-rise'} style={{ animationDelay: lapping ? '0s' : '0.2s' }}>
          <button
            className="relative block touch-pan-y select-none"
            onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
            onPointerMove={(e) => {
              if (!swipe.current) return
              const dx = e.clientX - swipe.current.x
              const dy = Math.abs(e.clientY - swipe.current.y)
              if (Math.abs(dx) > 40 && Math.abs(dx) > dy * 2) {
                swipe.current = null
                fly()
              }
            }}
            onPointerUp={() => {
              if (swipe.current) fly()
              swipe.current = null
            }}
            onPointerLeave={() => (swipe.current = null)}
            aria-label="Tomten och renarna – tryck för en tur"
            title="Ta en tur med släden!"
          >
            <span className="absolute inset-x-[5%] bottom-[5%] top-[30%] rounded-full bg-jul-red/20 blur-3xl" aria-hidden />
            <span ref={teamRef} className="sleigh-bob relative block">
              <span className="block md:hidden">
                <SkyTeam scale={0.55} />
              </span>
              <span className="hidden md:block">
                <SkyTeam />
              </span>
            </span>
            {hoho && (
              <span className="animate-pop-in absolute -top-8 left-[18%] whitespace-nowrap rounded-xl bg-white px-3 py-1 text-sm font-semibold text-jul-red shadow-lg">
                Ho ho ho!
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
