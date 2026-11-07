import { useEffect, useRef, useState } from 'react'
import { addPoster, getPosters, POSTER_MAX_BYTES, POSTER_TYPES, rememberedName, type Poster } from '../lib/api'
import { burst } from '../lib/fx'
import { Stars } from '../components/Scenery'

// Affischtavlan: everyone can pin up a poster (PNG, JPG or PDF – shown just as it is) or write a note on the board.

const PIN_COLORS = ['#e5383b', '#f6c453', '#2fa36b', '#4a7fd6', '#f2efe6']
const NOTE_COLORS = ['#fff6c9', '#ffe1e1', '#e3f5e6', '#e2ecff']
/** A little tilt per poster, the same every time (from its id). */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)

const when = (iso: string) =>
  new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Affischtavla() {
  const [posters, setPosters] = useState<Poster[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPosters()
      .then(setPosters)
      .catch(() => {
        setPosters([])
        setError('Kunde inte hämta affischtavlan just nu. Försök igen om en stund.')
      })
  }, [])

  return (
    <div className="sky relative min-h-dvh px-4 pb-24 pt-28">
      <Stars count={50} />
      <div className="relative mx-auto max-w-6xl">
        <header className="text-center">
          <h1 className="animate-rise text-4xl font-medium sm:text-5xl">Affischtavlan</h1>
          <p className="animate-rise mx-auto mt-3 max-w-xl text-lg text-snow/80" style={{ animationDelay: '0.1s' }}>
            Sätt upp en affisch – en bild eller en PDF – eller skriv en rad till alla andra.
          </p>
        </header>

        <PinForm onPinned={setPosters} />

        {error && <p className="mt-6 rounded-2xl bg-jul-red/20 p-4 text-center">{error}</p>}

        <section
          aria-label="Affischer och lappar"
          className="mt-10 rounded-[28px] border-[10px] border-[#6b4426] p-4 shadow-2xl sm:p-6"
          style={{
            backgroundColor: '#b98a58',
            backgroundImage:
              'radial-gradient(rgba(80,48,20,0.35) 1px, transparent 1.5px), radial-gradient(rgba(255,235,200,0.25) 1px, transparent 1.5px)',
            backgroundSize: '9px 9px, 13px 13px',
            backgroundPosition: '0 0, 4px 6px',
          }}
        >
          {posters === null ? (
            <p className="py-16 text-center font-display text-lg text-night-950/70">Hämtar affischerna …</p>
          ) : posters.length === 0 ? (
            <p className="py-16 text-center font-display text-lg text-night-950/70">Tavlan är tom – bli först att sätta upp något! 📌</p>
          ) : (
            <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
              {posters.map((p) => (
                <PosterCard key={p.id} poster={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function PinForm({ onPinned }: { onPinned: (list: Poster[]) => void }) {
  const [name, setName] = useState(rememberedName.get())
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const pick = (f: File | null) => {
    setError('')
    if (f && !POSTER_TYPES.includes(f.type)) {
      setError('Bara PNG, JPG och PDF går att sätta upp.')
      f = null
    } else if (f && f.size > POSTER_MAX_BYTES) {
      setError('Filen är för stor – max 4,5 MB.')
      f = null
    }
    setFile(f)
    if (!f && fileInput.current) fileInput.current.value = ''
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!name.trim()) return setError('Skriv ditt namn först.')
    if (!text.trim() && !file) return setError('Välj en fil eller skriv något.')
    setBusy(true)
    setError('')
    try {
      rememberedName.set(name.trim())
      onPinned(await addPoster(name.trim(), text.trim(), file))
      setText('')
      pick(null)
      burst()
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Kunde inte sätta upp affischen – försök igen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass animate-rise mx-auto mt-10 max-w-2xl space-y-4 rounded-3xl p-5 sm:p-6" style={{ animationDelay: '0.2s' }}>
      <h2 className="text-center text-xl font-semibold">Sätt upp något 📌</h2>
      <label className="block">
        <span className="font-display text-sm text-snow/70">Ditt namn</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          className="mt-1 w-full rounded-xl bg-white/90 px-4 py-2.5 text-night-950 outline-none ring-jul-gold focus:ring-2"
          placeholder="Vem är du?"
        />
      </label>
      <label className="block">
        <span className="font-display text-sm text-snow/70">Skriv något (valfritt med en fil)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-1 w-full resize-y rounded-xl bg-white/90 px-4 py-2.5 text-night-950 outline-none ring-jul-gold focus:ring-2"
          placeholder="Hälsning, inbjudan, efterlysning …"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-full bg-white/15 px-4 py-2 font-display font-semibold transition hover:bg-white/25">
          {file ? 'Byt fil' : '🖼️ Välj affisch'}
          <input
            ref={fileInput}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>
        {file ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-snow/80">
            <span className="truncate">{file.name}</span>
            <button type="button" onClick={() => pick(null)} className="text-snow/60 hover:text-white" aria-label="Ta bort filen">
              ✕
            </button>
          </span>
        ) : (
          <span className="text-sm text-snow/60">PNG, JPG eller PDF, max 4,5 MB</span>
        )}
        <button
          type="submit"
          disabled={busy}
          className="ml-auto rounded-full bg-jul-green px-6 py-2.5 font-display font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Sätter upp …' : 'Sätt upp'}
        </button>
      </div>
      {error && <p className="rounded-xl bg-jul-red/25 px-4 py-2 text-sm">{error}</p>}
    </form>
  )
}

function PosterCard({ poster }: { poster: Poster }) {
  const h = Math.abs(hash(poster.id))
  const tilt = ((h % 7) - 3) * 0.5
  const pin = PIN_COLORS[h % PIN_COLORS.length]
  const { file } = poster
  const note = !file
  return (
    <figure
      className="relative mb-5 break-inside-avoid rounded-sm p-3 pt-5 text-night-950 shadow-[0_8px_20px_rgba(40,20,0,0.35)]"
      style={{ transform: `rotate(${tilt}deg)`, background: note ? NOTE_COLORS[h % NOTE_COLORS.length] : '#fdfbf6' }}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-1.5 h-4 w-4 -translate-x-1/2 rounded-full shadow-[0_2px_3px_rgba(0,0,0,0.4)]"
        style={{ background: `radial-gradient(circle at 35% 35%, #fff8 0 20%, ${pin} 45%)` }}
      />
      {file?.type === 'application/pdf' ? (
        <div>
          <object data={file.url} type="application/pdf" className="block aspect-[1/1.414] w-full bg-white" aria-label={file.name}>
            <a href={file.url} target="_blank" rel="noreferrer" className="flex aspect-[1/1.414] w-full flex-col items-center justify-center gap-2 bg-white text-center">
              <span className="text-5xl">📄</span>
              <span className="px-3 font-display font-semibold">{file.name}</span>
              <span className="text-sm underline">Öppna PDF:en</span>
            </a>
          </object>
          <a href={file.url} target="_blank" rel="noreferrer" className="mt-1 block text-right text-xs underline opacity-70">
            Öppna i helskärm ↗
          </a>
        </div>
      ) : file ? (
        <a href={file.url} target="_blank" rel="noreferrer">
          <img src={file.url} alt={poster.text || file.name} loading="lazy" className="block h-auto w-full" />
        </a>
      ) : null}
      {poster.text && (
        <p className={`whitespace-pre-wrap break-words ${note ? 'font-serif text-lg leading-snug' : 'mt-2 text-sm'}`}>{poster.text}</p>
      )}
      <figcaption className="mt-2 flex justify-between gap-2 text-xs opacity-60">
        <span className="truncate">— {poster.by}</span>
        <span className="shrink-0">{when(poster.at)}</span>
      </figcaption>
    </figure>
  )
}
