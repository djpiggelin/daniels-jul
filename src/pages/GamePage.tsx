import { Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GAMES } from '../games/registry'
import { getScores, postScore, rememberedName, type ScoreEntry } from '../lib/api'
import { burst } from '../lib/fx'
import { useMusic } from '../lib/music'
import { Leaderboard } from '../components/Leaderboard'
import { Aurora, Lappland, Stars } from '../components/Scenery'
import { Awning, Chalkboard, GamePreview, StringLights } from '../components/Market'
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

  const awning = game.id === 'renflyg' ? '#23885a' : game.id === 'tomtememory' ? '#2f5fb8' : '#d93a3d'

  return (
    <div className="sky relative min-h-dvh overflow-hidden px-4 pb-16 pt-24">
      <Stars count={70} />
      <Aurora />
      <div className="absolute inset-x-0 bottom-0 h-[30%] min-h-[200px]">
        <Lappland village={false} className="h-full" />
      </div>

      <div className="relative mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <Link to="/spel" className="text-snow/70 underline-offset-4 hover:text-white hover:underline">
              ← Julmarknaden
            </Link>
            <button onClick={music.toggle} className="text-snow/70 hover:text-white" aria-label="Musik av/på">
              {music.enabled ? '♪ Musik på' : '♪ Musik av'}
            </button>
          </div>

          {/* the stall the game lives in */}
          <div className="mx-auto w-full max-w-[min(500px,calc((100svh-12rem)*2/3+20px))]">
            <div className="h-3 rounded-t-md bg-[#f4f8ff]" />
            <Awning a={awning} className="h-10" />
            <StringLights count={9} className="-mt-1 mx-3" />
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md border-[10px] border-[#6b4423] shadow-2xl shadow-black/60">
              {phase === 'playing' ? (
                <Suspense fallback={<div className="flex h-full items-center justify-center">Laddar …</div>}>
                  <Game key={round} onScore={onScore} onOver={onOver} />
                </Suspense>
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-[#061229] via-[#0b2342] to-[#133a5c] p-7 text-center">
                  {phase === 'intro' ? (
                    <>
                      <div className="w-full max-w-[280px]">
                        <GamePreview id={game.id} />
                      </div>
                      <h1 className="mt-6 text-4xl font-normal">{game.name}</h1>
                      <ul className="mt-4 space-y-1.5 text-sm text-snow/75">
                        {game.howTo.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                      <button onClick={start} className="btn mt-7 bg-jul-cream px-7 text-base text-[#2a160d] hover:bg-white">
                        Starta
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-jul-gold/90">Slut på spelet</p>
                      <p className="animate-pop-in mt-2 font-serif text-7xl text-jul-gold">{final}</p>
                      {isRecord && <p className="mt-2 font-chalk text-2xl text-jul-cream">Nytt rekord!</p>}
                      {saved ? (
                        <p className="mt-6 text-snow/80">Sparat på griffeltavlan ✓</p>
                      ) : final > 0 ? (
                        <form onSubmit={save} className="mt-6 flex w-full max-w-xs flex-col gap-2">
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ditt namn"
                            maxLength={24}
                            className="rounded-full bg-white/95 px-4 py-2.5 text-center text-night-900 outline-none ring-jul-gold focus:ring-4"
                          />
                          <button disabled={saving || !name.trim()} className="btn btn-red justify-center disabled:opacity-60">
                            {saving ? 'Sparar …' : `Skriv upp mig (${final})`}
                          </button>
                          {err && <p className="text-sm">{err}</p>}
                        </form>
                      ) : null}
                      <button onClick={start} className="btn btn-ghost mt-4">
                        Spela igen
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="relative -mt-1 h-5 rounded-b-md" style={{ background: 'linear-gradient(180deg, #7a4c2a, #4a2c1c)' }}>
              <span className="absolute -top-1.5 inset-x-0 h-3 rounded-full bg-[#f4f8ff]" aria-hidden />
            </div>
          </div>
          {phase === 'playing' && <p className="mt-2 text-center text-sm text-snow/50">Poäng: {score}</p>}
        </div>

        <Chalkboard className="lg:mt-24">
          <p role="heading" aria-level={2} className="text-center text-4xl font-bold">Topplista</p>
          <p className="text-center text-xl text-[#f2efe6]/60">{game.name}</p>
          <div className="mt-3">
            <Leaderboard entries={scores} highlight={saved} chalk />
          </div>
        </Chalkboard>
      </div>
    </div>
  )
}
