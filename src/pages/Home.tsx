import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EVENTS, type JulEvent } from '../data'
import { Gift } from '../components/Gift'
import { Reindeer } from '../components/Reindeer'
import { SantaSleigh, SleighTeam } from '../components/Santa'
import { Aurora, Lappland, Moon, Stars, type Building } from '../components/Scenery'
import { jingle } from '../lib/fx'
import { countdown, eventStatus, useNow } from '../lib/time'

const SCARFS = ['#2fa36b', '#e5383b', '#4f7dff', '#f6c453']

// gifts float around the edges so they never cover the reindeer
const GIFTS = [
  { left: '5%', top: '22%', size: 44, mobile: true },
  { left: '91%', top: '46%', size: 40, mobile: true },
  { left: '30%', top: '14%', size: 34, mobile: false },
  { left: '68%', top: '18%', size: 38, mobile: false },
  { left: '14%', top: '55%', size: 36, mobile: true },
  { left: '84%', top: '58%', size: 42, mobile: false },
]

// which event chapter each building on the front page opens
const BUILDING_EVENT = EVENTS.find((e) => e.competitions?.some((c) => c.art))?.id ?? 'julbak'
const POTLUCK_EVENT = EVENTS.find((e) => e.potluck)?.id ?? 'julbord'

export default function Home() {
  const now = useNow(30_000)
  const navigate = useNavigate()
  const [entering, setEntering] = useState<{ x: number; y: number } | null>(null)

  // zoom the whole scene into the clicked door, glow warm, then step inside
  const enter = (b: Building, ev: React.MouseEvent) => {
    if (entering) return
    setEntering({ x: ev.clientX, y: ev.clientY })
    const to = b === 'spel' ? '/spel' : b === 'julbord' ? `/event/${POTLUCK_EVENT}` : `/event/${BUILDING_EVENT}#${b}`
    setTimeout(() => navigate(to), 1000)
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

      {/* a sleigh far away in the sky */}
      <div className="sleigh-flight pointer-events-none absolute left-0 top-[9%] opacity-50">
        <div className="sleigh-bob">
          <SleighTeam scale={0.3} />
        </div>
      </div>

      {GIFTS.map((g, i) => (
        <div key={i} className={`absolute z-20 -translate-x-1/2 ${g.mobile ? '' : 'hidden md:block'}`} style={{ left: g.left, top: g.top }}>
          <Gift variant={i} size={g.size} delay={i * 0.7} />
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-0 h-[36%] min-h-[210px]">
        <Lappland className="h-full" onEnter={enter} />
      </div>

      <div className="absolute inset-x-0 bottom-[24%] top-[13%] z-10 flex items-end justify-center px-4">
        <SleighScene now={now} />
      </div>

      <p className="absolute inset-x-0 bottom-3 z-10 text-center text-xs text-night-800/50">Tryck på en ren · svep på släden · kliv in i verkstaden</p>
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

/**
 * Santa's sleigh with every event as a reindeer floating around it in an arc.
 * Click a reindeer → its event. Tap Santa → his event. Swipe the sleigh → it flies a lap.
 */
function SleighScene({ now }: { now: number }) {
  const navigate = useNavigate()
  const herd = EVENTS.filter((e) => !e.santa)
  const santaEvent = EVENTS.find((e) => e.santa)
  const [lapping, setLapping] = useState(false)
  const [hoho, setHoho] = useState(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const sleighRef = useRef<HTMLSpanElement>(null)

  // arc positions (% of the scene), half the herd on each side of the sleigh; outermost fly highest
  const spots = useMemo(() => {
    const left = Math.ceil(herd.length / 2)
    const side = (count: number, fromX: number, toX: number) =>
      Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0.5 : i / (count - 1)
        const outer = fromX < 50 ? 1 - t : t
        return { x: fromX + (toX - fromX) * t, y: 22 - outer * 16 }
      })
    return [...side(left, 12, 34), ...side(herd.length - left, 66, 88)]
  }, [herd.length])

  // gold stardust behind the sleigh while it flies its lap
  useEffect(() => {
    if (!lapping) return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      const el = sleighRef.current
      if (el && t - last > 45) {
        last = t
        const r = el.getBoundingClientRect()
        const s = document.createElement('span')
        s.className = 'trail-spark'
        s.style.left = `${r.left + r.width * 0.15 + (Math.random() - 0.5) * 20}px`
        s.style.top = `${r.top + r.height * 0.75 + (Math.random() - 0.5) * 16}px`
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
    <div className={`relative h-full max-h-[440px] w-full max-w-4xl ${lapping ? 'sleigh-lap' : 'animate-rise'}`}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {spots.map((s, i) => (
          <path
            key={i}
            d={`M50 70 Q ${(50 + s.x) / 2} ${s.y + 42} ${s.x} ${s.y + 20}`}
            fill="none"
            stroke="#f6c453"
            strokeOpacity="0.5"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {herd.map((e, i) => (
        <div key={e.id} className="absolute -translate-x-1/2" style={{ left: `${spots[i].x}%`, top: `${spots[i].y}%` }}>
          <div className="origin-top scale-[0.7] sm:scale-85 md:scale-100">
            <FlyingReindeer event={e} now={now} index={i} />
          </div>
        </div>
      ))}

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <div className="origin-bottom scale-[0.78] sm:scale-90 md:scale-100">
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
              if (swipe.current && santaEvent && !lapping) navigate(`/event/${santaEvent.id}`)
              swipe.current = null
            }}
            onPointerLeave={() => (swipe.current = null)}
            aria-label={santaEvent ? `${santaEvent.name} – tomten leder släden` : 'Tomtens släde'}
          >
            <span className="absolute inset-x-[10%] bottom-[8%] top-[30%] rounded-full bg-jul-red/35 blur-2xl" aria-hidden />
            <span ref={sleighRef} className="relative block animate-float" style={{ animationDuration: '4s' }}>
              <SantaSleigh size={250} />
            </span>
            {santaEvent && (
              <>
                <span className="absolute left-[4%] top-[4%]">
                  <DaysBadge event={santaEvent} now={now} />
                </span>
                <span className="absolute inset-x-0 -bottom-2 flex justify-center">
                  <NamePill>{santaEvent.name}</NamePill>
                </span>
              </>
            )}
            {hoho && (
              <span className="animate-pop-in absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1 text-sm font-semibold text-jul-red shadow-lg">
                Ho ho ho!
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function FlyingReindeer({ event: e, now, index }: { event: JulEvent; now: number; index: number }) {
  const passed = eventStatus(e, now) === 'passed'
  return (
    <Link to={`/event/${e.id}`} className={`team-member group relative flex flex-col items-center ${passed ? 'opacity-50' : ''}`} aria-label={e.name}>
      <span className="block animate-float" style={{ animationDelay: `${index * 0.8}s`, animationDuration: `${5 + index * 0.6}s` }}>
        <span className="relative block transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-105">
          <span className="absolute inset-[15%] rounded-full bg-white/5 blur-xl transition group-hover:bg-jul-gold/25" aria-hidden />
          <Reindeer size={140} rudolf={e.reindeer === 'Rudolf'} scarf={SCARFS[index % SCARFS.length]} />
          {/* badge over the back, away from the face */}
          <span className="absolute -left-2 top-4">
            <DaysBadge event={e} now={now} />
          </span>
        </span>
      </span>
      <NamePill>{e.name}</NamePill>
    </Link>
  )
}

function NamePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 whitespace-nowrap rounded-full bg-jul-red-dark px-4 py-1 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-colors group-hover:bg-jul-red">
      {children}
    </span>
  )
}

function DaysBadge({ event, now }: { event: JulEvent; now: number }) {
  const status = eventStatus(event, now)
  const value = status === 'live' ? 'Nu' : status === 'passed' ? '✓' : String(countdown(event.start, now).days)
  return (
    <span
      className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-jul-gold text-night-950 shadow-lg shadow-black/30 ring-2 ring-white/70"
      title={status === 'upcoming' ? `${value} dagar kvar` : undefined}
    >
      <span className="text-sm font-semibold leading-none tabular-nums">{value}</span>
      {status === 'upcoming' && <span className="text-[7px] uppercase leading-tight tracking-wide">dagar</span>}
    </span>
  )
}
