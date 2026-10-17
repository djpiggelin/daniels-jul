import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EVENTS, type Competition } from '../data'
import { Countdown } from '../components/Countdown'
import { Reindeer } from '../components/Reindeer'
import { Stars } from '../components/Scenery'
import { burstFrom } from '../lib/fx'
import { downloadIcs, eventStatus, formatDate, formatTime, useNow } from '../lib/time'
import NotFound from './NotFound'

export default function EventPage() {
  const { id } = useParams()
  const now = useNow()
  const e = EVENTS.find((x) => x.id === id)
  if (!e) return <NotFound />
  const status = eventStatus(e, now)

  return (
    <div className="sky relative min-h-dvh pb-24">
      <Stars count={50} />
      {/* photo hero */}
      <div className="relative h-[62svh] min-h-[420px] overflow-hidden">
        <img src={e.image} alt={e.name} className="h-full w-full scale-105 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/40 to-night-950/30" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-4 pb-10">
          <Link to="/" className="mb-4 inline-block rounded-full bg-black/30 px-3 py-1 text-sm backdrop-blur hover:bg-black/50">
            ← Tillbaka
          </Link>
          <h1 className="animate-rise text-5xl font-medium sm:text-6xl">
            {e.name}
          </h1>
          <p className="animate-rise mt-2 text-xl text-snow/85" style={{ animationDelay: '0.1s' }}>
            {e.tagline}
          </p>
        </div>
        <div className="absolute bottom-6 right-4 hidden sm:block">
          <Reindeer size={150} rudolf={e.reindeer === 'Rudolf'} flip />
        </div>
      </div>

      <div className="relative mx-auto -mt-4 grid max-w-5xl gap-6 px-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="glass animate-rise rounded-3xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">Om kvällen</h2>
            <p className="mt-3 text-lg leading-relaxed text-snow/85">{e.description}</p>
            {e.potluck && (
              <Link to="/knytis" className="btn btn-red mt-6">
                🍽️ Se Knytis-listan & paxa din rätt
              </Link>
            )}
          </section>

          {e.theme && (
            <section className="candy-border animate-rise relative overflow-hidden rounded-3xl p-6 text-center sm:p-8" style={{ animationDelay: '0.1s' }}>
              <p className="font-display text-sm uppercase tracking-[0.3em] text-jul-gold">Årets tema</p>
              <p className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{e.theme}</p>
            </section>
          )}

          {e.competitions?.map((c, i) => <CompetitionCard key={c.name} c={c} delay={0.15 + i * 0.1} />)}
        </div>

        <aside className="space-y-6">
          <section className="glass animate-rise sticky top-24 rounded-3xl p-6" style={{ animationDelay: '0.05s' }}>
            <dl className="space-y-3">
              <Info icon="📅" label="Datum" value={formatDate(e.start)} />
              <Info icon="🕖" label="Tid" value={formatTime(e.start)} />
              <Info icon="📍" label="Plats" value={e.location} />
              <Info icon="🦌" label="Kvällens ren" value={e.reindeer} />
            </dl>
            <div className="my-6 h-px bg-white/10" />
            {status === 'upcoming' ? (
              <>
                <p className="mb-3 text-center font-display text-snow/80">Det är bara …</p>
                <Countdown target={e.start} size="sm" />
              </>
            ) : (
              <p className="text-center font-display text-lg">{status === 'live' ? '🎉 Pågår just nu!' : '🎄 Den här har redan varit – tack för i år!'}</p>
            )}
            <button
              onClick={(ev) => {
                downloadIcs(e)
                burstFrom(ev.currentTarget)
              }}
              className="btn btn-gold mt-6 w-full justify-center"
            >
              📆 Lägg till i kalendern
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Info({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <dt className="text-xs uppercase tracking-wider text-snow/60">{label}</dt>
        <dd className="font-display text-lg font-semibold">{value}</dd>
      </div>
    </div>
  )
}

function CompetitionCard({ c, delay }: { c: Competition; delay: number }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="glass animate-rise overflow-hidden rounded-3xl" style={{ animationDelay: `${delay}s` }}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-6 text-left sm:px-8" aria-expanded={open}>
        <h2 className="text-2xl font-semibold">
          <span className="mr-2 inline-block animate-wiggle">{c.emoji}</span>
          {c.name}
        </h2>
        <span className={`text-2xl transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open && (
        <div className="grid gap-6 px-6 pb-8 sm:px-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="mb-3 font-display text-sm uppercase tracking-widest text-jul-gold">📜 Regler</h3>
            <ul className="space-y-2.5">
              {c.rules.map((r) => (
                <li key={r} className="flex gap-3 text-snow/85">
                  <span className="mt-1 text-jul-red">❄</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          {c.criteria && (
            <div>
              <h3 className="mb-3 font-display text-sm uppercase tracking-widest text-jul-gold">⭐ Bedömning</h3>
              <ul className="space-y-2">
                {c.criteria.map((k) => (
                  <li key={k} className="rounded-2xl bg-white/5 px-4 py-2.5 font-display">
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
