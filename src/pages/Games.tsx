import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GAMES } from '../games/registry'
import { getScores, type ScoreEntry } from '../lib/api'
import { Aurora, Lappland, Stars } from '../components/Scenery'
import { Awning, Chalkboard, GamePreview, StringLights, WOOD } from '../components/Market'

const AWNINGS = [
  { a: '#d93a3d', b: '#fbf7ef' },
  { a: '#23885a', b: '#fbf7ef' },
  { a: '#2f5fb8', b: '#fbf7ef' },
]

/** Spelstugan – the games as stalls on Tomtens julmarknad. */
export default function Games() {
  const [tops, setTops] = useState<Record<string, ScoreEntry | null | undefined>>({})

  useEffect(() => {
    GAMES.forEach((g) =>
      getScores(g.id)
        .then((l) => setTops((t) => ({ ...t, [g.id]: l[0] ?? null })))
        .catch(() => setTops((t) => ({ ...t, [g.id]: null }))),
    )
  }, [])

  return (
    <div className="sky relative min-h-[100svh] overflow-hidden pb-10 pt-28">
      <Stars count={110} />
      <Aurora />
      <div className="absolute inset-x-0 bottom-0 h-[34%] min-h-[220px]">
        <Lappland village={false} className="h-full" />
      </div>

      <header className="relative z-10 mx-auto max-w-2xl px-6 text-center">
        <p className="animate-rise text-xs font-semibold uppercase tracking-[0.3em] text-jul-gold/90">Tomtens by · Julmarknaden</p>
        <h1 className="animate-rise mt-3 text-5xl font-normal sm:text-6xl" style={{ animationDelay: '0.1s' }}>
          Spelstugan
        </h1>
        <p className="animate-rise mx-auto mt-4 max-w-md text-snow/70" style={{ animationDelay: '0.2s' }}>
          Tre stånd, tre topplistor. Den som leder när julbordet dukas får äran att skåla först.
        </p>
      </header>

      <StringLights count={22} className="relative z-10 mx-auto mt-10 max-w-6xl" />

      <div className="relative z-10 mx-auto mt-6 grid max-w-6xl gap-12 px-6 md:grid-cols-3 md:gap-8">
        {GAMES.map((g, i) => (
          <Link key={g.id} to={`/spel/${g.id}`} className="stall animate-rise group relative block" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
            {/* warm glow behind the stall */}
            <span className="stall-glow pointer-events-none absolute -inset-6 rounded-[3rem] bg-amber-300/10 opacity-0 blur-2xl transition-opacity duration-500" aria-hidden />

            {/* posts */}
            <span className="absolute bottom-6 left-1 top-4 w-3 rounded-sm" style={{ background: WOOD }} aria-hidden />
            <span className="absolute bottom-6 right-1 top-4 w-3 rounded-sm" style={{ background: WOOD }} aria-hidden />

            {/* roof + awning */}
            <div className="relative">
              <div className="mx-0 h-4 rounded-t-md bg-[#f4f8ff] shadow-[0_-2px_0_#dfe8f7_inset]" />
              <Awning a={AWNINGS[i % 3].a} b={AWNINGS[i % 3].b} className="h-12" />
              <StringLights count={7} className="-mt-1 mx-3" />
            </div>

            {/* stall interior */}
            <div className="relative mx-4 -mt-1 rounded-b-md px-4 pb-4 pt-3" style={{ background: 'linear-gradient(180deg, #2b1911, #3a2418)' }}>
              <div className="mx-auto mb-3 w-fit rounded px-4 py-1.5 text-center shadow-md" style={{ background: WOOD }}>
                <h2 className="text-xl font-normal text-jul-cream">{g.name}</h2>
              </div>
              <GamePreview id={g.id} />
              <Chalkboard className="mt-3 !p-3 text-center">
                <p className="text-sm leading-none text-[#f2efe6]/70">Rekord</p>
                <p className="mt-1 text-2xl leading-tight">
                  {tops[g.id] === undefined ? '…' : tops[g.id] ? `${tops[g.id]!.name} · ${tops[g.id]!.score}` : 'Ledigt – ta det!'}
                </p>
              </Chalkboard>
            </div>

            {/* counter with snow on top */}
            <div className="relative mx-1 rounded-md px-5 pb-4 pt-5 shadow-2xl shadow-black/50" style={{ background: WOOD }}>
              <span className="absolute -top-2 inset-x-1 h-4 rounded-full bg-[#f4f8ff]" aria-hidden />
              <p className="text-sm text-jul-cream/80">{g.tagline}</p>
              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-jul-cream px-4 py-2 text-sm font-semibold text-[#2a160d] transition group-hover:bg-white">
                Spela <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
