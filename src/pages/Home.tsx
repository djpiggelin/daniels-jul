import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EVENTS, type JulEvent } from '../data'
import { Countdown } from '../components/Countdown'
import { Reindeer } from '../components/Reindeer'
import { SantaSleigh, SleighTeam } from '../components/Santa'
import { Hills, Moon, Stars } from '../components/Scenery'
import { burst, jingle } from '../lib/fx'
import { countdown, eventStatus, formatDate, formatTime, useNow } from '../lib/time'

const SCARF = { red: '#2fa36b', green: '#e5383b', gold: '#e5383b' }

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')

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
        <div className="sleigh-flight pointer-events-none absolute left-0 top-[11%] z-0 opacity-70">
          <div className="sleigh-bob">
            <SleighTeam scale={0.38} />
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pt-28 text-center sm:pt-32">
          <h1 className="animate-rise text-4xl font-medium sm:text-5xl">Daniels Jul</h1>
          <p className="animate-rise mx-auto mt-3 max-w-md text-snow/70" style={{ animationDelay: '0.1s' }}>
            Julbak, julbord och allt däremellan. Klicka på en ren för att läsa mer.
          </p>
          <div className="animate-rise mt-8" style={{ animationDelay: '0.2s' }}>
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

        <div className="relative z-10 mt-auto pt-10">
          <Team now={now} />
          <Hills className="-mt-10 sm:-mt-16" />
        </div>
      </section>

      <section className="relative z-10 bg-[#f7f9ff] px-4 pb-20 pt-4 text-night-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-medium">Kalender</h2>
          <ul className="mt-4 divide-y divide-night-900/10 border-y border-night-900/10">
            {EVENTS.map((e) => (
              <li key={e.id}>
                <Link to={`/event/${e.id}`} className="group flex items-center gap-4 py-4">
                  <span className="w-24 shrink-0 text-sm text-night-800/60">{shortDate(e.start)}</span>
                  <span className="flex-1">
                    <span className="font-serif text-lg">{e.name}</span>
                    <span className="block text-sm text-night-800/60">
                      {formatTime(e.start)} · {e.location}
                    </span>
                  </span>
                  <span className="text-night-800/40 transition-transform group-hover:translate-x-1 group-hover:text-jul-red">→</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
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
        </div>
      </section>
    </>
  )
}

/** Santa's sleigh pulled by one reindeer per event. */
function Team({ now }: { now: number }) {
  const [away, setAway] = useState(false)
  const [hoho, setHoho] = useState(false)

  const launch = (ev: React.MouseEvent) => {
    if (away) return
    burst(ev.clientX / innerWidth, ev.clientY / innerHeight)
    jingle()
    setHoho(true)
    setTimeout(() => setHoho(false), 1200)
    setTimeout(() => setAway(true), 300)
    setTimeout(() => setAway(false), 4200)
  }

  return (
    <div className="mx-auto max-w-5xl px-4">
      {/* desktop: one long team */}
      <div className={`relative hidden items-end justify-center md:flex ${away ? 'sleigh-zoom' : 'animate-rise'}`} style={{ animationDelay: '0.3s' }}>
        <button onClick={launch} className="relative z-10 -mr-4 mb-6 shrink-0 cursor-pointer" aria-label="Tryck på tomten" title="Ta en tur med släden!">
          <SantaSleigh size={240} />
          {hoho && <Bubble className="-top-6 left-16">Ho ho ho!</Bubble>}
        </button>
        <div className="relative flex items-end gap-1">
          <span className="absolute left-0 right-16 top-[42%] h-px bg-jul-gold/70" aria-hidden />
          {EVENTS.map((e) => (
            <TeamMember key={e.id} event={e} now={now} />
          ))}
        </div>
      </div>

      {/* mobile: santa on top, reindeer as a list */}
      <div className={`md:hidden ${away ? 'sleigh-zoom' : ''}`}>
        <button onClick={launch} className="relative mx-auto block" aria-label="Tryck på tomten">
          <SantaSleigh size={150} />
          {hoho && <Bubble className="-top-6 left-10">Ho ho ho!</Bubble>}
        </button>
        <div className="mt-2 space-y-2 pb-6">
          {EVENTS.map((e) => (
            <TeamMember key={e.id} event={e} now={now} compact />
          ))}
        </div>
      </div>
    </div>
  )
}

function TeamMember({ event: e, now, compact }: { event: JulEvent; now: number; compact?: boolean }) {
  const status = eventStatus(e, now)
  const days = countdown(e.start, now).days
  const badge = status === 'live' ? 'Nu!' : status === 'passed' ? '✓' : String(days)

  if (compact) {
    return (
      <Link
        to={`/event/${e.id}`}
        className={`team-member flex items-center gap-3 rounded-2xl border border-white/10 bg-night-950/50 py-1 pl-1 pr-4 backdrop-blur ${status === 'passed' ? 'opacity-50' : ''}`}
      >
        <Reindeer size={84} rudolf={e.reindeer === 'Rudolf'} scarf={SCARF[e.accent]} />
        <span className="flex-1">
          <span className="block font-serif text-lg leading-tight">{e.name}</span>
          <span className="text-sm text-snow/60">
            {shortDate(e.start)} · {formatTime(e.start)}
          </span>
        </span>
        <DaysBadge value={badge} unit={status === 'upcoming'} />
      </Link>
    )
  }

  return (
    <Link
      to={`/event/${e.id}`}
      className={`team-member group relative flex w-[175px] flex-col items-center ${status === 'passed' ? 'opacity-50' : ''}`}
      aria-label={`${e.name}, ${formatDate(e.start)}`}
    >
      <span className="absolute left-3 top-3 z-10">
        <DaysBadge value={badge} unit={status === 'upcoming'} />
      </span>
      <span className="block transition-transform duration-300 group-hover:-translate-y-3">
        <Reindeer size={175} rudolf={e.reindeer === 'Rudolf'} scarf={SCARF[e.accent]} />
      </span>
      <span className="mt-1 rounded-full bg-night-950/70 px-4 py-1.5 text-center backdrop-blur transition-colors group-hover:bg-jul-red">
        <span className="block font-serif text-base leading-tight">{e.name}</span>
        <span className="block text-xs text-snow/70">{shortDate(e.start)}</span>
      </span>
    </Link>
  )
}

function DaysBadge({ value, unit }: { value: string; unit: boolean }) {
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full bg-jul-gold text-night-950 shadow-lg shadow-black/30">
      <span className="text-sm font-semibold leading-none tabular-nums">{value}</span>
      {unit && <span className="text-[8px] uppercase leading-none tracking-wide">dagar</span>}
    </span>
  )
}

function Bubble({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`animate-pop-in absolute whitespace-nowrap rounded-xl bg-white px-3 py-1 text-sm font-semibold text-jul-red shadow-lg ${className}`}>
      {children}
    </span>
  )
}
