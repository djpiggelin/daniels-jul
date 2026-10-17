import { Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GAMES } from '../games/registry'
import { getScores, postScore, rememberedName, type ScoreEntry } from '../lib/api'
import { burst } from '../lib/fx'
import { useMusic } from '../lib/music'
import { Leaderboard } from '../components/Leaderboard'
import { Stars } from '../components/Scenery'
import NotFound from './NotFound'

type Phase = 'intro' | 'playing' | 'over'

export default function GamePage() {
  const { game: id } = useParams()
  const game = GAMES.find((g) => g.id === id)
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [final, setFinal] = useState(0)
  const [scores, setScores] = useState<ScoreEntry[] | null>(null)
  const [name, setName] = useState(rememberedName.get())
  const [saved, setSaved] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const music = useMusic(phase === 'playing')

  useEffect(() => {
    if (!game) return
    getScores(game.id).then(setScores).catch(() => setScores([]))
  }, [game])

  const onScore = useCallback((s: number) => setScore(s), [])
  const onOver = useCallback((s: number) => {
    setFinal(s)
    setPhase('over')
    setSaved(undefined)
  }, [])

  if (!game) return <NotFound />
  const Game = game.Component
  const isRecord = final > 0 && (scores?.length ? final > scores[0].score : true)

  const start = () => {
    setScore(0)
    setRound((r) => r + 1)
    setPhase('playing')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setErr('')
    try {
      rememberedName.set(name.trim())
      const list = await postScore(game.id, name.trim(), final)
      setScores(list)
      const mine = list.find((x) => x.name === name.trim().slice(0, 24) && x.score === final)
      setSaved(mine?.at ?? 'saved')
      if (mine && list.indexOf(mine) < 3) burst()
    } catch {
      setErr('Kunde inte spara poängen – försök igen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sky relative min-h-dvh px-4 pb-16 pt-24">
      <Stars count={40} />
      <div className="relative mx-auto grid max-w-5xl gap-6 lg:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link to="/spel" className="rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
              ← Alla spel
            </Link>
            <h1 className="font-display text-2xl font-semibold">
              {game.emoji} {game.name}
            </h1>
            <button onClick={music.toggle} className="rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20" aria-label="Musik av/på">
              {music.enabled ? '🔊' : '🔇'}
            </button>
          </div>

          <div className="relative mx-auto aspect-[2/3] w-full max-w-[min(480px,calc((100svh-9rem)*2/3))] overflow-hidden rounded-[1.75rem] shadow-2xl ring-4 ring-white/15">
            {phase === 'playing' ? (
              <Suspense fallback={<div className="flex h-full items-center justify-center">Laddar …</div>}>
                <Game key={round} onScore={onScore} onOver={onOver} />
              </Suspense>
            ) : (
              <div className={`flex h-full flex-col items-center justify-center bg-gradient-to-br p-8 text-center ${game.color}`}>
                {phase === 'intro' ? (
                  <>
                    <span className="animate-float text-8xl">{game.emoji}</span>
                    <h2 className="mt-4 text-4xl font-semibold">{game.name}</h2>
                    <ul className="mt-5 space-y-2 text-white/90">
                      {game.howTo.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                    <button onClick={start} className="btn btn-gold mt-8 text-xl">
                      ▶ Starta
                    </button>
                  </>
                ) : (
                  <>
                    <p className="font-display text-xl text-white/80">Game over! 🎄</p>
                    <p className="animate-pop-in mt-1 font-display text-7xl font-semibold text-jul-gold drop-shadow-lg">{final}</p>
                    {isRecord && <p className="mt-2 animate-wiggle font-display text-lg">👑 Nytt rekord!</p>}
                    {saved ? (
                      <p className="mt-6 font-display text-lg">✅ Sparat på topplistan!</p>
                    ) : final > 0 ? (
                      <form onSubmit={save} className="mt-6 flex w-full max-w-xs flex-col gap-2">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ditt namn"
                          maxLength={24}
                          className="rounded-full bg-white/90 px-4 py-2.5 text-center font-display text-lg text-night-900 outline-none ring-jul-gold focus:ring-4"
                        />
                        <button disabled={saving || !name.trim()} className="btn btn-red justify-center disabled:opacity-60">
                          {saving ? 'Sparar …' : `Spara min poäng (${final})`}
                        </button>
                        {err && <p className="text-sm">{err}</p>}
                      </form>
                    ) : null}
                    <button onClick={start} className="btn btn-ghost mt-4 !bg-white/20">
                      🔁 Spela igen
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {phase === 'playing' && <p className="mt-2 text-center text-sm text-snow/50">Poäng: {score}</p>}
        </div>

        <aside className="glass h-fit rounded-3xl p-5">
          <h2 className="mb-3 text-xl font-semibold">🏆 Topplista</h2>
          <Leaderboard entries={scores} highlight={saved} />
        </aside>
      </div>
    </div>
  )
}
