import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GAMES } from '../games/registry'
import { getScores, type ScoreEntry } from '../lib/api'
import { Stars } from '../components/Scenery'
import { Reindeer } from '../components/Reindeer'

export default function Games() {
  const [tops, setTops] = useState<Record<string, ScoreEntry | undefined>>({})

  useEffect(() => {
    GAMES.forEach((g) =>
      getScores(g.id)
        .then((l) => setTops((t) => ({ ...t, [g.id]: l[0] })))
        .catch(() => {}),
    )
  }, [])

  return (
    <div className="sky relative min-h-dvh overflow-hidden px-4 pb-24 pt-28">
      <Stars count={60} />
      <div className="relative mx-auto max-w-5xl">
        <header className="text-center">
          <h1 className="animate-rise text-4xl font-medium sm:text-5xl">
            Julspel
          </h1>
          <p className="animate-rise mx-auto mt-3 max-w-xl text-lg text-snow/80" style={{ animationDelay: '0.1s' }}>
            Tre spel, tre topplistor. Den som leder på julbordet får äran att skåla först 🥂
          </p>
        </header>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {GAMES.map((g, i) => (
            <Link
              key={g.id}
              to={`/spel/${g.id}`}
              className={`animate-rise group relative flex flex-col overflow-hidden rounded-[2rem] bg-gradient-to-br p-7 shadow-2xl transition-transform hover:-translate-y-2 hover:rotate-[0.6deg] ${g.color}`}
              style={{ animationDelay: `${0.15 + i * 0.1}s` }}
            >
              <span className="absolute -right-4 -top-4 text-[8rem] opacity-25 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                {g.emoji}
              </span>
              <h2 className="relative text-3xl font-semibold">{g.name}</h2>
              <p className="relative mt-1 text-white/85">{g.tagline}</p>
              <div className="relative mt-8 rounded-2xl bg-black/20 p-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-white/70">Rekord</p>
                <p className="font-display text-lg font-semibold">
                  {tops[g.id] ? (
                    <>
                      👑 {tops[g.id]!.name} · {tops[g.id]!.score}
                    </>
                  ) : (
                    'Ledigt – ta det!'
                  )}
                </p>
              </div>
              <span className="btn btn-ghost relative mt-5 justify-center !bg-white/20">▶ Spela</span>
            </Link>
          ))}
        </div>

        <div className="pointer-events-none mt-16 flex justify-center gap-2 opacity-90">
          <Reindeer size={90} mode="gallop" scarf="#2fa36b" />
          <Reindeer size={90} mode="gallop" scarf="#4f7dff" />
          <Reindeer size={90} mode="gallop" rudolf scarf="#f6c453" />
        </div>
      </div>
    </div>
  )
}
