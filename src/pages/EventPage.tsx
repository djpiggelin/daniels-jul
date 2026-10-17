import { Link, useParams } from 'react-router-dom'
import { EVENTS, type Competition } from '../data'
import { Countdown } from '../components/Countdown'
import { Destilleri, Verkstad } from '../components/ThemeArt'
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

const ART = {
  verkstad: { Art: Verkstad, bg: 'linear-gradient(180deg,#061229,#0e2a4a)', accent: '#f0b878', chip: 'bg-[#b5713a]/25 ring-[#f0b878]/40' },
  destilleri: { Art: Destilleri, bg: '#1f120d', accent: '#f2a56b', chip: 'bg-[#b5562a]/25 ring-[#f2a56b]/40' },
}

function CompetitionCard({ c, delay }: { c: Competition; delay: number }) {
  const look = c.art ? ART[c.art] : null
  const accent = look?.accent ?? '#f6c453'
  return (
    <section className="glass animate-rise overflow-hidden rounded-3xl" style={{ animationDelay: `${delay}s` }}>
      {look && (
        <div style={{ background: look.bg }}>
          <look.Art className="block h-auto w-full" />
        </div>
      )}
      <div className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
          {c.name}
        </p>
        <h2 className="mt-1 text-3xl font-medium">{c.theme?.title ?? c.name}</h2>
        {c.theme?.intro.map((p) => (
          <p key={p} className="mt-3 leading-relaxed text-snow/80">
            {p}
          </p>
        ))}

        {c.notice && (
          <p className="mt-6 rounded-2xl border-l-4 bg-white/5 px-4 py-3 text-sm text-snow/90" style={{ borderColor: accent }}>
            <span className="font-semibold" style={{ color: accent }}>
              Nytt i år:{' '}
            </span>
            {c.notice}
          </p>
        )}

        <div className={`mt-8 grid gap-8 ${c.rules.length ? 'md:grid-cols-[1.4fr_1fr]' : ''}`}>
          {c.rules.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-medium">Regler</h3>
              <ol className="space-y-3">
                {c.rules.map((r, i) => (
                  <li key={r} className="flex gap-3 text-snow/85">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-night-950"
                      style={{ background: accent }}
                    >
                      {i + 1}
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {c.criteria && (
            <div>
              <h3 className="mb-3 text-lg font-medium">Juryn bedömer</h3>
              <ul className={`flex flex-wrap gap-2 ${c.rules.length ? 'md:flex-col' : ''}`}>
                {c.criteria.map((k) => (
                  <li key={k} className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${look?.chip ?? 'bg-white/5 ring-white/10'}`}>
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
