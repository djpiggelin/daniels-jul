import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EVENTS, type JulEvent } from '../data'
import { Gift } from '../components/Gift'
import { SkyTeam } from '../components/Santa'
import { Aurora, DOOR_PLATES, Lappland, Moon, Stars, type Building } from '../components/Scenery'
import { jingle } from '../lib/fx'
import { eventStatus, useNow } from '../lib/time'

// gifts float around the edges, clear of the sleigh
const GIFTS = [
  { left: '6%', top: '30%', size: 44, mobile: true },
  { left: '92%', top: '40%', size: 40, mobile: true },
  { left: '24%', top: '12%', size: 34, mobile: false },
  { left: '76%', top: '14%', size: 38, mobile: false },
  { left: '12%', top: '52%', size: 36, mobile: false },
  { left: '86%', top: '56%', size: 42, mobile: false },
]

// which event each building in Tomtens by belongs to
const JULBAK = EVENTS.find((e) => e.competitions?.some((c) => c.art))
const JULBORD = EVENTS.find((e) => e.potluck)
const JULAFTON = EVENTS.find((e) => e.santa)
const EVENT_FOR: Partial<Record<Building, JulEvent | undefined>> = { verkstad: JULBAK, destilleri: JULBAK, julbord: JULBORD, julafton: JULAFTON }

const linkFor = (b: Building) => {
  if (b === 'spel') return '/spel'
  if (b === 'verkstad' || b === 'destilleri') return `/event/${JULBAK?.id}#${b}`
  return `/event/${EVENT_FOR[b]?.id ?? ''}`
}

export default function Home() {
  const now = useNow(30_000)
  const navigate = useNavigate()
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
        <Stars count={110} />
        <Aurora />
        <Moon className="absolute left-[8%] top-20 h-10 w-10 opacity-80 sm:h-14 sm:w-14" />

        {GIFTS.map((g, i) => (
          <div key={i} className={`absolute z-20 -translate-x-1/2 ${g.mobile ? '' : 'hidden md:block'}`} style={{ left: g.left, top: g.top }}>
            <Gift variant={i} size={g.size} delay={i * 0.7} />
          </div>
        ))}

        <FlyingSanta />

        <Village onEnter={enter} now={now} />

        <p className="absolute inset-x-0 bottom-3 z-10 text-center text-xs text-night-800/50">Svep på släden för en tur · kliv in i husen</p>
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
/* Tomtens by, with a house-number plate by each event's front door    */
/* ------------------------------------------------------------------ */

// everyone knows it's December – the house number is just the day
const plateDate = (iso: string) => String(new Date(iso).getDate())

function Village({ onEnter, now }: { onEnter: (b: Building, e: React.MouseEvent) => void; now: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // the landscape SVG is 1440×460 drawn with xMidYMax slice – map its units to pixels
  const scale = Math.max(size.w / 1440, size.h / 460)
  const toPx = (x: number, y: number) => ({ left: size.w / 2 + (x - 720) * scale, top: size.h - (460 - y) * scale })

  return (
    <div ref={box} className="absolute inset-x-0 bottom-0 h-[36%] min-h-[210px]">
      <Lappland className="h-full" onEnter={onEnter} />
      {size.w > 0 &&
        DOOR_PLATES.map((d) => {
          const ev = EVENT_FOR[d.building]
          if (!ev) return null
          const { left, top } = toPx(d.x, d.y)
          if (left < 0 || left > size.w) return null
          const passed = eventStatus(ev, now) === 'passed'
          return (
            <button
              key={d.building}
              onClick={(e) => onEnter(d.building, e)}
              className={`absolute z-10 flex h-[15px] min-w-[15px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2px] bg-[#1d3e8a] px-[3px] text-[10px] font-bold leading-none text-white shadow-[inset_0_0_0_1.5px_#1d3e8a,inset_0_0_0_2.5px_#fff,0_1px_2px_rgba(0,0,0,0.5)] transition-transform hover:scale-150 sm:h-[17px] sm:min-w-[17px] sm:text-[11px] ${passed ? 'opacity-60' : ''}`}
              style={{ left, top }}
              aria-label={`${ev.name}, ${plateDate(ev.start)} december – kliv in`}
              title={ev.name}
            >
              {plateDate(ev.start)}
            </button>
          )
        })}
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
                <SkyTeam scale={0.6} />
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
