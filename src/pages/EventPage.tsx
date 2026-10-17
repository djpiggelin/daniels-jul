import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { EVENTS, POTLUCK_IMAGE, type Competition, type JulEvent } from '../data'
import { Reindeer } from '../components/Reindeer'
import { SleighTeam } from '../components/Santa'
import { Aurora, Lappland, Stars } from '../components/Scenery'
import { Destilleri, ROOMS, Verkstad, WindowScene } from '../components/ThemeArt'
import { burstFrom } from '../lib/fx'
import { countdown, downloadIcs, eventStatus, formatDate, formatTime, useNow } from '../lib/time'
import NotFound from './NotFound'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 0 → 1 as the (tall) element scrolls past the top of the viewport. */
function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const total = r.height - window.innerHeight
        setP(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0)
      })
    }
    update()
    addEventListener('scroll', update, { passive: true })
    addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('scroll', update)
      removeEventListener('resize', update)
    }
  }, [ref])
  return p
}

/** Fades `.reveal` elements in as they enter the viewport. */
function useReveal(root: React.RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const els = root.current?.querySelectorAll('.reveal') ?? []
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible')
            io.unobserve(en.target)
          }
        }),
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [root, key])
}

export default function EventPage() {
  const { id } = useParams()
  const { hash } = useLocation()
  const root = useRef<HTMLDivElement>(null)
  const e = EVENTS.find((x) => x.id === id)
  useReveal(root, id ?? '')

  // arriving from the front page buildings: jump straight to that room
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => {
      const el = document.getElementById(hash.slice(1))
      if (!el) return
      el.querySelectorAll('.reveal').forEach((r) => r.classList.add('is-visible'))
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'instant' as ScrollBehavior })
    }, 30)
    return () => clearTimeout(t)
  }, [hash, id])

  if (!e) return <NotFound />
  const verkstad = e.competitions?.find((c) => c.art === 'verkstad')
  const destilleri = e.competitions?.find((c) => c.art === 'destilleri')
  const others = e.competitions?.filter((c) => !c.art) ?? []

  return (
    <div ref={root} className="bg-night-950">
      {verkstad ? <ZoomOpening event={e} /> : <Opening event={e} />}
      <Evening event={e} />
      {verkstad && <VerkstadChapter c={verkstad} />}
      {destilleri && <DestilleriChapter c={destilleri} />}
      {others.map((c) => (
        <PlainChapter key={c.name} c={c} />
      ))}
      {e.potluck && <KnytisChapter />}
      <Closing event={e} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Openings                                                            */
/* ------------------------------------------------------------------ */

function Title({ event: e, style }: { event: JulEvent; style?: React.CSSProperties }) {
  return (
    <div className="absolute inset-x-0 top-[16%] z-20 px-6 text-center" style={style}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-jul-gold/90">
        {formatDate(e.start)} · {formatTime(e.start)}
      </p>
      <h1 className="mt-3 text-5xl font-normal sm:text-7xl">{e.name}</h1>
      <p className="mx-auto mt-3 max-w-md text-snow/70">{e.tagline}</p>
    </div>
  )
}

function ScrollCue({ label, style, className = 'bottom-5 text-night-800/70' }: { label: string; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`absolute inset-x-0 z-20 flex flex-col items-center gap-2 text-xs ${className}`} style={style}>
      <span>{label}</span>
      <span className="block h-6 w-px animate-pulse bg-current opacity-60" />
    </div>
  )
}

/** Julbak: scroll to walk up to Tomtens verkstad and in through the door. */
function ZoomOpening({ event: e }: { event: JulEvent }) {
  const ref = useRef<HTMLElement>(null)
  const p = useScrollProgress(ref)
  const still = reducedMotion()
  const zoom = still ? 1 : 1 + p ** 2.2 * 9
  const warm = still ? 0 : Math.max(0, (p - 0.55) / 0.4)

  return (
    <section ref={ref} className={still ? 'relative h-[100svh]' : 'relative h-[230svh]'}>
      <div className="sky sticky top-0 h-[100svh] overflow-hidden">
        <Stars count={90} />
        <Aurora />
        <div className="absolute inset-x-0 bottom-0 h-[42%]" style={{ transform: `scale(${1 + p * 0.25})`, transformOrigin: '50% 100%' }}>
          <Lappland village={false} className="h-full" />
        </div>
        <div className="absolute inset-x-0 bottom-[4%] flex justify-center" style={{ transform: `scale(${zoom})`, transformOrigin: '50% 82%' }}>
          <Verkstad className="w-[min(94vw,760px)]" />
        </div>
        <Title event={e} style={{ opacity: 1 - p * 2.5, transform: `translateY(${-p * 60}px)` }} />
        <div className="pointer-events-none absolute inset-0 z-30" style={{ opacity: warm, background: 'radial-gradient(circle at 50% 70%, #ffcf6b, #c8742c 45%, #2a160d 100%)' }} />
        {!still && <ScrollCue label="Scrolla för att kliva in" className="top-[44%] text-snow/60 sm:top-[40%]" style={{ opacity: 1 - p * 5 }} />}
      </div>
    </section>
  )
}

function Opening({ event: e }: { event: JulEvent }) {
  return (
    <section className="sky relative h-[100svh] min-h-[560px] overflow-hidden">
      <Stars count={90} />
      <Aurora />
      <div className="absolute inset-x-0 bottom-0 h-[42%]">
        <Lappland className="h-full" />
      </div>
      <div className="absolute bottom-[14%] left-[8%] z-10 hidden sm:block">
        <Reindeer size={130} rudolf={e.reindeer === 'Rudolf'} />
      </div>
      <Title event={e} />
      <ScrollCue label="Scrolla" />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Kvällen – the practical bits, told rather than boxed                */
/* ------------------------------------------------------------------ */

function Evening({ event: e }: { event: JulEvent }) {
  const now = useNow(60_000)
  const status = eventStatus(e, now)
  const days = countdown(e.start, now).days
  const warmBg = 'radial-gradient(1200px 700px at 30% 0%, rgba(200,116,44,0.35) 0%, transparent 60%), linear-gradient(180deg, #7a3f1a 0%, #2a160d 28%, #170b06 100%)'

  return (
    <section id="kvallen" className="relative overflow-hidden px-6 py-24 text-jul-cream sm:py-32" style={{ background: warmBg }}>
      <div className="mx-auto grid max-w-5xl items-center gap-14 md:grid-cols-[1.2fr_1fr]">
        <div className="reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-jul-gold/80">Kvällen</p>
          <p className="mt-5 font-serif text-2xl leading-snug sm:text-3xl">{e.description}</p>

          <dl className="mt-10 grid grid-cols-3 border-y border-jul-cream/15 text-sm">
            {[
              ['När', formatDate(e.start)],
              ['Tid', formatTime(e.start)],
              ['Var', e.location],
            ].map(([k, v]) => (
              <div key={k} className="border-l border-jul-cream/15 py-4 pl-4 first:border-l-0 first:pl-0">
                <dt className="text-[11px] uppercase tracking-widest text-jul-cream/50">{k}</dt>
                <dd className="mt-1 font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              onClick={(ev) => {
                downloadIcs(e)
                burstFrom(ev.currentTarget)
              }}
              className="btn bg-jul-cream text-[#2a160d] hover:bg-white"
            >
              Lägg till i kalendern
            </button>
            <span className="text-sm text-jul-cream/60">
              {status === 'upcoming' ? `Om ${days} ${days === 1 ? 'dag' : 'dagar'}` : status === 'live' ? 'Pågår just nu' : 'Har redan varit – tack för i år!'}
            </span>
          </div>
        </div>

        {/* a polaroid from an earlier year */}
        <figure className="reveal mx-auto w-64 rotate-3 bg-[#fbf7ef] p-3 pb-10 shadow-2xl shadow-black/50 transition-transform duration-500 hover:rotate-0 sm:w-72">
          <img src={e.image} alt={`${e.name} tidigare år`} className="aspect-square w-full object-cover" loading="lazy" />
          <figcaption className="mt-3 text-center font-serif text-sm italic text-[#5a3420]">{e.name}, tidigare år</figcaption>
        </figure>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Tomtens verkstad                                                    */
/* ------------------------------------------------------------------ */

const COOKIE_TILT = ['-rotate-6', 'rotate-3', '-rotate-2', 'rotate-6']

function VerkstadChapter({ c }: { c: Competition }) {
  return (
    <section id="verkstad" className="relative overflow-hidden bg-[#170b06] px-6 py-24 text-jul-cream sm:py-32">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#f0b878 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      <div className="relative mx-auto max-w-5xl">
        <header className="reveal max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f0b878]">Kapitel I · {c.name}</p>
          <h2 className="mt-3 text-4xl font-normal sm:text-6xl">{c.theme?.title}</h2>
          {c.theme?.intro.map((p) => (
            <p key={p} className="mt-5 text-lg leading-relaxed text-jul-cream/80">
              {p}
            </p>
          ))}
        </header>

        {/* the four frosty windows */}
        <div className="mt-16 grid grid-cols-2 gap-5 sm:gap-8 lg:grid-cols-4">
          {ROOMS.map((r, i) => (
            <figure key={r.kind} className="reveal" style={{ transitionDelay: `${i * 0.12}s` }}>
              <div className="overflow-hidden rounded-t-[999px] rounded-b-xl border-[6px] border-[#fbf7ef] shadow-[0_0_60px_-10px_rgba(255,170,80,0.6)]">
                <WindowScene kind={r.kind} className="block aspect-[9/8] w-full" />
              </div>
              <figcaption className="mt-3">
                <span className="font-serif text-lg">{r.name}</span>
                <span className="mt-1 block text-sm text-jul-cream/60">{r.text}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-24 grid items-start gap-14 md:grid-cols-[1.3fr_1fr]">
          {/* Verkstadsordning – pinned to the wall */}
          <div className="reveal relative -rotate-1 bg-[#fbf3e4] p-8 pt-10 text-[#3a2410] shadow-2xl shadow-black/60 sm:p-10">
            <span className="absolute left-1/2 top-3 h-4 w-4 -translate-x-1/2 rounded-full bg-jul-red shadow-md ring-2 ring-white/60" aria-hidden />
            {c.notice && (
              <span className="absolute -right-3 -top-4 rotate-[8deg] rounded border-[3px] border-jul-red bg-[#fbf3e4] px-3 py-1 text-xs font-bold uppercase tracking-widest text-jul-red shadow">
                Nytt i år
              </span>
            )}
            <h3 className="text-3xl font-normal">Verkstadsordning</h3>
            {c.notice && <p className="mt-3 font-serif italic leading-relaxed text-[#5a3420]">{c.notice}</p>}
            <ol className="mt-6 space-y-4">
              {c.rules.map((r, i) => (
                <li key={r} className="flex gap-4">
                  <span className="font-serif text-2xl leading-none text-jul-red">{i + 1}.</span>
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* jury criteria as iced gingerbread cookies */}
          {c.criteria && (
            <div className="reveal">
              <h3 className="text-2xl font-normal">Juryn bedömer</h3>
              <div className="mt-6 flex flex-wrap gap-5">
                {c.criteria.map((k, i) => (
                  <span
                    key={k}
                    className={`flex h-32 w-32 items-center justify-center rounded-full border-[3px] border-dashed border-white/90 bg-[#b5713a] p-4 text-center font-serif text-[15px] leading-tight text-white shadow-[inset_0_-6px_0_rgba(0,0,0,0.15),0_10px_30px_-10px_rgba(0,0,0,0.6)] outline outline-8 outline-[#b5713a] transition-transform hover:scale-105 ${COOKIE_TILT[i % COOKIE_TILT.length]}`}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Tomtens destilleri                                                  */
/* ------------------------------------------------------------------ */

const TAG_TILT = ['-rotate-3', 'rotate-2', '-rotate-1', 'rotate-3']

function DestilleriChapter({ c }: { c: Competition }) {
  return (
    <section
      id="destilleri"
      className="relative overflow-hidden text-jul-cream"
      style={{ background: 'radial-gradient(1000px 600px at 50% 20%, #4a2614 0%, #1f120d 55%, #0f0805 100%)' }}
    >
      <div className="mx-auto max-w-6xl px-6 pt-24 text-center sm:pt-32">
        <p className="reveal text-xs font-semibold uppercase tracking-[0.3em] text-[#f2a56b]">Kapitel II · {c.name}</p>
        <h2 className="reveal mt-3 text-4xl font-normal sm:text-6xl">{c.theme?.title}</h2>
      </div>

      <div className="reveal mx-auto mt-12 max-w-6xl sm:px-6">
        <Destilleri className="block h-auto w-full sm:rounded-2xl" />
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pb-32">
        <div className="reveal mx-auto max-w-2xl text-center">
          {c.theme?.intro.map((p) => (
            <p key={p} className="mt-5 text-lg leading-relaxed text-jul-cream/80 first:mt-0">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-20 grid items-start gap-14 md:grid-cols-[1.3fr_1fr]">
          {/* brass plaque */}
          {c.rules.length > 0 && (
            <div
              className="reveal relative rounded-lg p-8 text-[#3a2410] sm:p-10"
              style={{
                background: 'linear-gradient(135deg, #f2d98a 0%, #c9973a 30%, #f5e2a6 55%, #b07f2c 80%, #e3bd63 100%)',
                boxShadow: 'inset 0 0 0 3px rgba(90,52,32,0.35), inset 0 2px 0 rgba(255,255,255,0.5), 0 25px 50px -12px rgba(0,0,0,0.7)',
              }}
            >
              {['left-3 top-3', 'right-3 top-3', 'left-3 bottom-3', 'right-3 bottom-3'].map((pos) => (
                <span key={pos} className={`absolute h-3 w-3 rounded-full bg-[#8a5d1f] shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] ${pos}`} aria-hidden />
              ))}
              <h3 className="text-center text-2xl font-normal tracking-wide [text-shadow:0_1px_0_rgba(255,255,255,0.45)]">Destilleriets regler</h3>
              <ol className="mt-6 space-y-3">
                {c.rules.map((r, i) => (
                  <li key={r} className="flex gap-4 [text-shadow:0_1px_0_rgba(255,255,255,0.35)]">
                    <span className="w-7 shrink-0 font-serif text-xl leading-none">{['I', 'II', 'III', 'IV', 'V', 'VI'][i]}</span>
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* criteria as bottle tags */}
          {c.criteria && (
            <div className="reveal">
              <h3 className="text-2xl font-normal">Juryn smakar på</h3>
              <ul className="mt-6 flex flex-wrap gap-4">
                {c.criteria.map((k, i) => (
                  <li
                    key={k}
                    className={`relative bg-[#f3e6c8] py-3 pl-9 pr-5 font-serif text-[#3a2410] shadow-lg shadow-black/40 ${TAG_TILT[i % TAG_TILT.length]}`}
                    style={{ clipPath: 'polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 50%)' }}
                  >
                    <span className="absolute left-3.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#1f120d]" aria-hidden />
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

/* ------------------------------------------------------------------ */
/* Other chapters                                                      */
/* ------------------------------------------------------------------ */

function PlainChapter({ c }: { c: Competition }) {
  return (
    <section className="bg-[#170b06] px-6 py-24 text-jul-cream">
      <div className="reveal mx-auto max-w-3xl">
        <h2 className="text-4xl font-normal">{c.theme?.title ?? c.name}</h2>
        <ol className="mt-6 list-decimal space-y-2 pl-5 text-jul-cream/85">
          {c.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function KnytisChapter() {
  return (
    <section className="relative overflow-hidden bg-[#170b06] px-6 py-24 text-jul-cream sm:py-32">
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
        <div className="reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-jul-gold/80">Knytis</p>
          <h2 className="mt-3 text-4xl font-normal sm:text-5xl">Bordet dukas tillsammans</h2>
          <p className="mt-5 text-lg leading-relaxed text-jul-cream/80">
            Sill, lax, skinka, köttbullar, Jansson och snaps – alla tar med något. Klicka på en rätt på bordet och paxa den innan någon annan gör det.
          </p>
          <Link to="/knytis" className="btn mt-8 bg-jul-cream text-[#2a160d] hover:bg-white">
            Öppna Knytis-listan
          </Link>
        </div>
        <Link to="/knytis" className="reveal group block overflow-hidden rounded-2xl shadow-2xl shadow-black/60">
          <img src={POTLUCK_IMAGE} alt="Julbordet" className="w-full transition-transform duration-700 group-hover:scale-105" loading="lazy" />
        </Link>
      </div>
    </section>
  )
}

function Closing({ event: e }: { event: JulEvent }) {
  return (
    <section className="sky relative h-[80svh] min-h-[480px] overflow-hidden">
      <Stars count={70} />
      <Aurora />
      <div className="sleigh-flight pointer-events-none absolute left-0 top-[18%] opacity-70">
        <div className="sleigh-bob">
          <SleighTeam scale={0.4} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[40%]">
        <Lappland village={false} className="h-full" />
      </div>
      <div className="reveal absolute inset-x-0 top-[34%] z-10 px-6 text-center">
        <h2 className="text-4xl font-normal sm:text-5xl">Vi ses {e.location === 'Där hjärtat är' ? 'där hjärtat är' : `på ${e.location}`}</h2>
        <p className="mt-3 text-snow/70">
          {formatDate(e.start)} · {formatTime(e.start)}
        </p>
        <Link to="/" className="mt-8 inline-block text-sm text-snow/70 underline-offset-4 hover:text-white hover:underline">
          ← Tillbaka till släden
        </Link>
      </div>
    </section>
  )
}
