import { useEffect, useMemo, useState } from 'react'
import { DISHES, PARTICIPANTS, POTLUCK_IMAGE, type Dish } from '../data'
import { getClaims, rememberedName, setClaim, type Claims } from '../lib/api'
import { burst } from '../lib/fx'
import { Stars } from '../components/Scenery'
import { Reindeer } from '../components/Reindeer'

const pictureFor = (name: string) => PARTICIPANTS.find((p) => p.name.toLowerCase() === name.toLowerCase())?.image ?? null
const isGuest = (name: string) => PARTICIPANTS.some((p) => p.name.toLowerCase() === name.toLowerCase())

export default function Knytis() {
  const [claims, setClaims] = useState<Claims>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [me, setMe] = useState(rememberedName.get())
  const [view, setView] = useState<'karta' | 'lista'>('karta')
  const [selected, setSelected] = useState<Dish | null>(null)

  useEffect(() => {
    getClaims()
      .then(setClaims)
      .catch(() => setError('Kunde inte hämta listan just nu. Försök igen om en stund.'))
      .finally(() => setLoading(false))
  }, [])

  const chooseMe = (n: string) => {
    setMe(n)
    rememberedName.set(n)
  }

  const claimedCount = DISHES.filter((d) => claims[d.id]?.length).length
  const mine = DISHES.filter((d) => claims[d.id]?.some((c) => c.name.toLowerCase() === me.toLowerCase()))

  return (
    <div className="sky relative min-h-dvh px-4 pb-24 pt-28">
      <Stars count={50} />
      <div className="relative mx-auto max-w-6xl">
        <header className="text-center">
          <h1 className="animate-rise text-4xl font-medium sm:text-5xl">
            Knytis-listan
          </h1>
          <p className="animate-rise mx-auto mt-3 max-w-xl text-lg text-snow/80" style={{ animationDelay: '0.1s' }}>
            Julbordet byggs tillsammans! Välj vem du är och klicka på det du tar med.
          </p>
          <div className="animate-rise mx-auto mt-6 max-w-md" style={{ animationDelay: '0.2s' }}>
            <div className="flex justify-between font-display text-sm text-snow/70">
              <span>Paxade rätter</span>
              <span>
                {claimedCount} / {DISHES.length}
              </span>
            </div>
            <div className="mt-1 h-4 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${(claimedCount / DISHES.length) * 100}%`, background: 'repeating-linear-gradient(45deg,#e5383b 0 10px,#ff6b6e 10px 20px)' }}
              />
            </div>
          </div>
        </header>

        <WhoAmI me={me} onChange={chooseMe} />

        {me && mine.length > 0 && (
          <p className="mt-4 text-center font-display text-lg">
            Du tar med: {mine.map((d) => `${d.emoji} ${d.name}`).join(', ')} 🙌
          </p>
        )}

        {error && <p className="mt-6 rounded-2xl bg-jul-red/20 p-4 text-center">{error}</p>}

        <div className="mt-8 flex justify-center">
          <div className="glass inline-flex rounded-full p-1">
            {(['karta', 'lista'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-5 py-2 font-display font-semibold capitalize transition ${view === v ? 'bg-jul-green text-white' : 'text-snow/70'}`}
              >
                {v === 'karta' ? '🗺️ Bordet' : '📋 Lista'}
              </button>
            ))}
          </div>
        </div>

        <div className={`mt-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {view === 'karta' ? <TableMap claims={claims} onPick={setSelected} /> : <DishList claims={claims} onPick={setSelected} />}
        </div>
      </div>

      {selected && (
        <DishModal
          dish={selected}
          claims={claims[selected.id] ?? []}
          me={me}
          onClose={() => setSelected(null)}
          onSave={async (action) => {
            const next = await setClaim(selected.id, me, pictureFor(me), action)
            setClaims(next)
            if (action === 'claim') burst()
            setSelected(null)
          }}
          needName={() => document.getElementById('whoami')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />
      )}
    </div>
  )
}

function WhoAmI({ me, onChange }: { me: string; onChange: (n: string) => void }) {
  const [custom, setCustom] = useState('')
  const notListed = me && !isGuest(me)
  return (
    <section id="whoami" className="glass animate-rise mx-auto mt-10 max-w-4xl rounded-3xl p-5 sm:p-6" style={{ animationDelay: '0.25s' }}>
      <h2 className="text-center text-xl font-semibold">{me ? `Hej ${me}! 👋` : 'Vem är du?'}</h2>
      <div className="mt-4 flex flex-wrap justify-center gap-2 sm:gap-3">
        {PARTICIPANTS.map((p) => {
          const active = p.name === me
          return (
            <button key={p.name} onClick={() => onChange(p.name)} className="group flex w-16 flex-col items-center gap-1 sm:w-20">
              <span
                className={`block h-14 w-14 overflow-hidden rounded-full bg-white/90 ring-4 transition sm:h-16 sm:w-16 ${
                  active ? 'scale-110 ring-jul-gold' : 'ring-transparent group-hover:ring-white/40'
                }`}
              >
                {p.image ? (
                  <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-jul-gold text-2xl font-semibold text-night-950">{p.name[0]}</span>
                )}
              </span>
              <span className={`text-xs font-semibold ${active ? 'text-jul-gold' : 'text-snow/80'}`}>{p.name}</span>
            </button>
          )
        })}
      </div>
      <form
        className="mx-auto mt-4 flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (custom.trim()) onChange(custom.trim().slice(0, 24))
          setCustom('')
        }}
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={notListed ? `Inte ${me}? Skriv ditt namn` : 'Inte med? Skriv ditt namn'}
          className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 outline-none ring-jul-gold placeholder:text-snow/50 focus:ring-2"
          maxLength={24}
        />
        <button className="btn btn-ghost !py-2">OK</button>
      </form>
    </section>
  )
}

function Avatar({ name, picture, size = 28 }: { name: string; picture?: string | null; size?: number }) {
  return picture ? (
    <img src={picture} alt={name} title={name} className="rounded-full bg-white object-cover ring-2 ring-white" style={{ width: size, height: size }} />
  ) : (
    <span
      title={name}
      className="flex items-center justify-center rounded-full bg-jul-gold font-display font-semibold text-night-950 ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name[0]?.toUpperCase()}
    </span>
  )
}

function TableMap({ claims, onPick }: { claims: Claims; onPick: (d: Dish) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="relative overflow-hidden rounded-[2rem] shadow-2xl ring-4 ring-white/10">
        <img src={POTLUCK_IMAGE} alt="Julbordet" className="block w-full" />
        {DISHES.map((d) => {
          const c = claims[d.id] ?? []
          const taken = c.length > 0
          return (
            <button
              key={d.id}
              onClick={() => onPick(d)}
              onMouseEnter={() => setHover(d.id)}
              onMouseLeave={() => setHover(null)}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${d.x}%`, top: `${Math.max(d.y, 3)}%`, zIndex: hover === d.id ? 20 : 10 }}
              aria-label={`${d.name}${taken ? `, paxad av ${c.map((x) => x.name).join(', ')}` : ', ledig'}`}
            >
              {taken ? (
                <span className="flex -space-x-2">
                  {c.slice(0, 3).map((p) => (
                    <Avatar key={p.name} name={p.name} picture={p.picture} size={30} />
                  ))}
                </span>
              ) : (
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-jul-gold/70" />
                  <span className="relative h-4 w-4 rounded-full border-2 border-white bg-jul-gold" />
                </span>
              )}
              {hover === d.id && (
                <span className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1 font-display text-sm font-semibold text-night-900 shadow-lg">
                  {d.emoji} {d.name}
                  {!taken && ' – ledig!'}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-center text-sm text-snow/60">
        <span className="mr-1 inline-block h-3 w-3 rounded-full bg-jul-gold align-middle" /> = ledig rätt · Klicka för att paxa
      </p>
    </div>
  )
}

function DishList({ claims, onPick }: { claims: Claims; onPick: (d: Dish) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, Dish[]>()
    for (const d of DISHES) m.set(d.category, [...(m.get(d.category) ?? []), d])
    return [...m]
  }, [])
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {groups.map(([cat, dishes]) => (
        <section key={cat} className="glass rounded-3xl p-5">
          <h2 className="mb-3 text-xl font-semibold">{cat}</h2>
          <ul className="space-y-2">
            {dishes.map((d) => {
              const c = claims[d.id] ?? []
              return (
                <li key={d.id}>
                  <button onClick={() => onPick(d)} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left transition hover:bg-white/10">
                    <span className="text-2xl">{d.emoji}</span>
                    <span className="flex-1 font-display font-semibold">{d.name}</span>
                    {c.length ? (
                      <span className="flex items-center gap-2">
                        <span className="hidden text-sm text-snow/70 sm:inline">{c.map((x) => x.name).join(', ')}</span>
                        <span className="flex -space-x-2">
                          {c.slice(0, 3).map((p) => (
                            <Avatar key={p.name} name={p.name} picture={p.picture} />
                          ))}
                        </span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-jul-gold px-2.5 py-0.5 text-xs font-semibold text-night-950">Ledig</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function DishModal({
  dish,
  claims,
  me,
  onClose,
  onSave,
  needName,
}: {
  dish: Dish
  claims: { name: string; picture?: string | null }[]
  me: string
  onClose: () => void
  onSave: (action: 'claim' | 'unclaim') => Promise<void>
  needName: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const mineAlready = claims.some((c) => c.name.toLowerCase() === me.toLowerCase())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  const save = async (action: 'claim' | 'unclaim') => {
    setBusy(true)
    setErr('')
    try {
      await onSave(action)
    } catch {
      setErr('Det gick inte att spara. Försök igen!')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-night-950/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="animate-pop-in relative w-full max-w-md rounded-[2rem] bg-snow p-7 text-night-900 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="absolute -top-14 left-1/2 -translate-x-1/2">
          <Reindeer size={110} rudolf={!claims.length} />
        </div>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full px-2 text-2xl text-night-900/50 hover:text-night-900" aria-label="Stäng">
          ×
        </button>
        <p className="mt-6 text-center text-5xl">{dish.emoji}</p>
        <h2 className="mt-2 text-center text-3xl font-semibold">{dish.name}</h2>
        <p className="mt-1 text-center text-night-800/60">{dish.category}</p>

        <div className="mt-5 rounded-2xl bg-night-900/5 p-4">
          {claims.length ? (
            <>
              <p className="text-sm font-semibold text-night-800/70">Redan paxad av:</p>
              <ul className="mt-2 flex flex-wrap gap-3">
                {claims.map((c) => (
                  <li key={c.name} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow">
                    <Avatar name={c.name} picture={c.picture} />
                    <span className="font-display font-semibold">{c.name}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-night-800/60">Det går bra att vara flera på samma rätt.</p>
            </>
          ) : (
            <p className="text-center font-display text-lg">🎁 Ingen har tagit denna än!</p>
          )}
        </div>

        {err && <p className="mt-3 text-center text-sm text-jul-red">{err}</p>}

        <div className="mt-6 flex flex-col gap-2">
          {!me ? (
            <button
              onClick={() => {
                onClose()
                needName()
              }}
              className="btn btn-gold justify-center"
            >
              Välj vem du är först ↑
            </button>
          ) : mineAlready ? (
            <button disabled={busy} onClick={() => save('unclaim')} className="btn btn-ghost justify-center !bg-night-900/10 !text-night-900">
              {busy ? 'Sparar …' : 'Ta bort min paxning'}
            </button>
          ) : (
            <button disabled={busy} onClick={() => save('claim')} className="btn btn-red justify-center">
              {busy ? 'Sparar …' : `Paxa som ${me}!`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
