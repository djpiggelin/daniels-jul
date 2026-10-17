import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EVENTS, type JulEvent } from '../data'
import { Countdown } from '../components/Countdown'
import { Reindeer } from '../components/Reindeer'
import { SantaSleigh, SleighTeam } from '../components/Santa'
import { Hills, Moon, Stars } from '../components/Scenery'
import { burst, burstFrom, jingle } from '../lib/fx'
import { countdown, eventStatus, useNow } from '../lib/time'

const SCARFS = ['#2fa36b', '#e5383b', '#4f7dff', '#f6c453']

export default function Home() {
  const now = useNow(30_000)
  const next = EVENTS.find((e) => eventStatus(e, now) !== 'passed') ?? EVENTS[EVENTS.length - 1]
  const live = eventStatus(next, now) === 'live'

  return (
    <>
      <section className="sky relative flex min-h-[100svh] flex-col overflow-hidden">
        <div className="aurora" />
        <Stars />
        <Moon className="absolute right-[7%] top-20 h-16 w-16 sm:h-24 sm:w-24" />

        {/* a sleigh far away in the sky */}
        <div className="sleigh-flight pointer-events-none absolute left-0 top-[11%] z-0 opacity-60">
          <div className="sleigh-bob">
            <SleighTeam scale={0.34} />
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pt-28 text-center sm:pt-32">
          <h1 className="animate-rise text-4xl font-medium sm:text-5xl">Daniels Jul</h1>
          <div className="animate-rise mt-6" style={{ animationDelay: '0.15s' }}>
            <p className="mb-3 text-sm text-snow/60">
              {live ? (
                <>
                  <span className="text-jul-gold">{next.name}</span> pågår just nu
                </>
              ) : (
                <>
                  Nästa: <span className="text-jul-gold">{next.name}</span>
                </>
              )}
            </p>
            {!live && <Countdown target={next.start} />}
          </div>
        </div>

        <div className="relative z-10 mt-auto pt-8">
          <SleighScene now={now} />
          <Hills className="-mt-6 sm:-mt-12" />
        </div>
      </section>

      <section className="relative z-10 bg-[#f7f9ff] px-4 pb-20 pt-6 text-night-900">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          <Link to="/knytis" className="rounded-2xl border border-night-900/10 bg-white p-6 transition hover:border-jul-red/40 hover:shadow-lg">
            <h3 className="text-xl font-medium">Knytis-listan</h3>
            <p className="mt-1 text-sm text-night-800/70">Vad tar du med till julbordet? Paxa en rätt innan någon annan gör det.</p>
            <span className="mt-4 inline-block text-sm font-semibold text-jul-red">Öppna listan →</span>
          </Link>
          <Link to="/spel" className="rounded-2xl border border-night-900/10 bg-white p-6 transition hover:border-jul-green/40 hover:shadow-lg">
            <h3 className="text-xl font-medium">Julspel</h3>
            <p className="mt-1 text-sm text-night-800/70">Klappfångst, Rudolfs flygtur och memory med gästerna – med topplistor.</p>
            <span className="mt-4 inline-block text-sm font-semibold text-jul-green">Spela →</span>
          </Link>
        </div>
      </section>
    </>
  )
}

/**
 * Santa's sleigh with every event as a reindeer floating around it.
 * Desktop: reindeer in an arc on both sides. Mobile: a column flying up from the sleigh.
 * Click a reindeer → event. Click Santa → his event. Swipe the sleigh → it takes off.
 */
function SleighScene({ now }: { now: number }) {
  const navigate = useNavigate()
  const herd = EVENTS.filter((e) => !e.santa)
  const santaEvent = EVENTS.find((e) => e.santa)
  const [away, setAway] = useState(false)
  const [hoho, setHoho] = useState(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  // desktop arc positions (in % of the scene), split left/right of the sleigh
  const spots = useMemo(() => {
    const left = Math.ceil(herd.length / 2)
    const right = herd.length - left
    const side = (count: number, fromX: number, toX: number) =>
      Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0.5 : i / (count - 1)
        // outermost reindeer fly highest, like an arc
        const outer = fromX < 50 ? 1 - t : t
        return { x: fromX + (toX - fromX) * t, y: 20 - outer * 14 }
      })
    return [...side(left, 10, 32), ...side(right, 68, 90)]
  }, [herd.length])

  const launch = () => {
    if (away) return
    jingle()
    burst(0.5, 0.75)
    setHoho(true)
    setTimeout(() => setHoho(false), 1200)
    setTimeout(() => setAway(true), 250)
    setTimeout(() => setAway(false), 4200)
  }

  const sleigh = (size: number) => (
    <button
      className="relative block touch-pan-y"
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerMove={(e) => {
        if (!swipe.current) return
        const dx = e.clientX - swipe.current.x
        const dy = Math.abs(e.clientY - swipe.current.y)
        if (Math.abs(dx) > 40 && Math.abs(dx) > dy * 2) {
          swipe.current = null
          launch()
        }
      }}
      onPointerUp={() => {
        if (swipe.current && santaEvent) navigate(`/event/${santaEvent.id}`)
        swipe.current = null
      }}
      onPointerLeave={() => (swipe.current = null)}
      aria-label={santaEvent ? `${santaEvent.name} – tomten leder släden` : 'Tomtens släde'}
    >
      <span className="absolute inset-x-[10%] bottom-[5%] top-[30%] rounded-full bg-jul-red/40 blur-2xl" aria-hidden />
      <span className="relative block animate-float" style={{ animationDuration: '4s' }}>
        <SantaSleigh size={size} />
      </span>
      {santaEvent && (
        <>
          <span className="absolute right-[12%] top-[8%]">
            <DaysBadge event={santaEvent} now={now} />
          </span>
          <span className="absolute inset-x-0 -bottom-3 flex justify-center">
            <NamePill>{santaEvent.name}</NamePill>
          </span>
        </>
      )}
      {hoho && (
        <span className="animate-pop-in absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1 text-sm font-semibold text-jul-red shadow-lg">
          Ho ho ho!
        </span>
      )}
    </button>
  )

  return (
    <div className={`relative mx-auto max-w-5xl px-4 ${away ? 'sleigh-zoom' : 'animate-rise'}`} style={{ animationDelay: '0.3s' }}>
      <FloatingGifts />

      {/* desktop */}
      <div className="relative hidden h-[420px] md:block">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {spots.map((s, i) => (
            <path
              key={i}
              d={`M50 66 Q ${(50 + s.x) / 2} ${s.y + 40} ${s.x} ${s.y + 22}`}
              fill="none"
              stroke="#f6c453"
              strokeOpacity="0.55"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {herd.map((e, i) => (
          <div key={e.id} className="absolute -translate-x-1/2" style={{ left: `${spots[i].x}%`, top: `${spots[i].y}%` }}>
            <FlyingReindeer event={e} now={now} index={i} size={130} />
          </div>
        ))}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">{sleigh(260)}</div>
      </div>

      {/* mobile */}
      <div className="relative flex flex-col items-center gap-4 pb-4 md:hidden">
        <span className="pointer-events-none absolute bottom-24 top-10 left-1/2 w-px bg-jul-gold/50" aria-hidden />
        {herd.map((e, i) => (
          <div key={e.id} style={{ transform: `translateX(${i % 2 ? 22 : -22}px)` }}>
            <FlyingReindeer event={e} now={now} index={i} size={104} />
          </div>
        ))}
        <div className="mt-2">{sleigh(190)}</div>
      </div>

      <p className="mt-4 text-center text-xs text-snow/40">Tryck på en ren · svep på släden</p>
    </div>
  )
}

function FlyingReindeer({ event: e, now, index, size }: { event: JulEvent; now: number; index: number; size: number }) {
  const passed = eventStatus(e, now) === 'passed'
  return (
    <Link to={`/event/${e.id}`} className={`team-member group relative flex flex-col items-center ${passed ? 'opacity-50' : ''}`} aria-label={e.name}>
      <span className="block animate-float" style={{ animationDelay: `${index * 0.8}s`, animationDuration: `${5 + index * 0.6}s` }}>
        <span className="relative block transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-105">
          <span className="absolute inset-[15%] rounded-full bg-white/5 blur-xl transition group-hover:bg-jul-gold/20" aria-hidden />
          <Reindeer size={size} rudolf={e.reindeer === 'Rudolf'} scarf={SCARFS[index % SCARFS.length]} />
          <span className="absolute -right-1 top-0">
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
    <span className="mt-1 rounded-full bg-jul-red-dark px-3.5 py-1 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-colors group-hover:bg-jul-red">
      {children}
    </span>
  )
}

function DaysBadge({ event, now }: { event: JulEvent; now: number }) {
  const status = eventStatus(event, now)
  const value = status === 'live' ? 'Nu' : status === 'passed' ? '✓' : String(countdown(event.start, now).days)
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-full bg-jul-gold text-sm font-semibold tabular-nums text-night-950 shadow-lg shadow-black/30"
      title={status === 'upcoming' ? `${value} dagar kvar` : undefined}
    >
      {value}
    </span>
  )
}

const GIFTS = [
  { left: 4, top: 30, size: 1.6, delay: 0 },
  { left: 40, top: 8, size: 1.2, delay: 1.2 },
  { left: 60, top: 18, size: 1.4, delay: 2.1 },
  { left: 94, top: 40, size: 1.5, delay: 0.6 },
  { left: 28, top: 70, size: 1.1, delay: 1.7 },
  { left: 76, top: 72, size: 1.3, delay: 2.6 },
]

function FloatingGifts() {
  const [opened, setOpened] = useState<number[]>([])
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {GIFTS.map((g, i) =>
        opened.includes(i) ? null : (
          <button
            key={i}
            tabIndex={-1}
            className="pointer-events-auto absolute animate-float"
            style={{ left: `${g.left}%`, top: `${g.top}%`, fontSize: `${g.size}rem`, animationDelay: `${g.delay}s`, animationDuration: `${5 + g.delay}s` }}
            onClick={(e) => {
              burstFrom(e.currentTarget)
              setOpened((o) => [...o, i])
            }}
          >
            🎁
          </button>
        ),
      )}
    </div>
  )
}
