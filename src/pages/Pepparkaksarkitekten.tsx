import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buildDesign, DEFAULT_PARAMS, DOUGH_DENSITY, DOUGH_WASTE, HOUSE_TYPES, totalArea, type HouseParams, type HouseType } from '../lib/gingerbread'
import { renderPiece, type Op, type Sketches } from '../lib/icing'
import { getHouse, shareHouse, type SavedHouse } from '../lib/api'
import { JULBAK } from '../lib/village'
import { Preview3D } from '../components/arkitekt/Preview3D'
import { FacadeEditor } from '../components/arkitekt/FacadeEditor'
import { layoutPages, TemplatePage } from '../components/arkitekt/Templates'

const STORAGE = 'pepparkaksarkitekten'

/** Sensible starting measurements when switching house type. */
const PRESETS: Record<HouseType, Partial<HouseParams>> = {
  sadel: { width: 18, depth: 12, height: 10, pitch: 45 },
  platt: { width: 18, depth: 13, height: 9, pitch: 40 },
  torn: { width: 9, depth: 9, height: 18, pitch: 62 },
}

type Draft = { team: string; params: HouseParams; sketches: Sketches; thickness: number; pack: number; id?: string }

const fresh = (): Draft => ({ team: '', params: DEFAULT_PARAMS, sketches: {}, thickness: 0.5, pack: 500 })

function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (raw) return { ...fresh(), ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return fresh()
}

const fromSaved = (h: SavedHouse): Draft => ({
  ...fresh(),
  team: h.team,
  params: { ...DEFAULT_PARAMS, ...h.params },
  sketches: h.sketches ?? {},
  thickness: h.thickness ?? 0.5,
  pack: h.pack ?? 500,
  id: h.id,
})

const sv = (n: number, d = 0) => n.toLocaleString('sv-SE', { maximumFractionDigits: d, minimumFractionDigits: d })

export default function Pepparkaksarkitekten() {
  const [search, setSearch] = useSearchParams()
  const [draft, setDraft] = useState<Draft>(readDraft)
  const [notice, setNotice] = useState('')
  const [sharing, setSharing] = useState(false)
  const [textures, setTextures] = useState<Record<string, string>>({})
  const { params, sketches, team } = draft

  const design = useMemo(() => buildDesign(params), [params])
  const pages = useMemo(() => layoutPages(design.pieces), [design])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setParam = <K extends keyof HouseParams>(k: K, v: HouseParams[K]) => setDraft((d) => ({ ...d, params: { ...d.params, [k]: v } }))
  const setSketch = (id: string, ops: Op[]) => setDraft((d) => ({ ...d, sketches: { ...d.sketches, [id]: ops } }))

  // a shared link opens that team's plan
  const sharedId = search.get('hus')
  useEffect(() => {
    if (!sharedId || sharedId === draft.id) return
    getHouse(sharedId)
      .then((h) => {
        setDraft(fromSaved(h))
        setNotice(`Du har öppnat ${/[sxz]$/i.test(h.team) ? h.team : `${h.team}s`} ritning. Ändringar sparas hos dig – dela igen för att uppdatera lagets länk.`)
      })
      .catch((e: Error) => setNotice(e.message || 'Kunde inte öppna ritningen.'))
  }, [sharedId])

  // remember everything on this device
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(draft))
    } catch {
      /* full or blocked – the plan still works for this visit */
    }
  }, [draft])

  // icing textures for the 3D preview
  useEffect(() => {
    const t = setTimeout(() => {
      const next: Record<string, string> = {}
      for (const p of design.pieces) {
        const ops = sketches[p.id]
        if (!ops?.length) continue
        const c = document.createElement('canvas')
        renderPiece(c, p, ops, 16, false)
        next[p.id] = c.toDataURL()
      }
      setTextures(next)
    }, 120)
    return () => clearTimeout(t)
  }, [design, sketches])

  const area = totalArea(design.pieces)
  const grams = area * draft.thickness * DOUGH_DENSITY * DOUGH_WASTE
  const packs = grams / Math.max(1, draft.pack)

  const share = async () => {
    if (!team.trim()) {
      setNotice('Skriv in ert lagnamn först, så vet alla vems ritning det är.')
      document.getElementById('lagnamn')?.focus()
      return
    }
    setSharing(true)
    try {
      const saved = await shareHouse({ id: draft.id, team, params, sketches, thickness: draft.thickness, pack: draft.pack })
      update({ id: saved.id })
      setSearch({ hus: saved.id! }, { replace: true })
      const link = `${location.origin}/pepparkaksarkitekten?hus=${saved.id}`
      try {
        await navigator.clipboard.writeText(link)
        setNotice('Ritningen är sparad och länken kopierad – skicka den till resten av laget.')
      } catch {
        setNotice(`Ritningen är sparad. Länk: ${link}`)
      }
    } catch (e) {
      setNotice((e as Error).message || 'Kunde inte spara just nu. Ritningen finns kvar på den här enheten.')
    } finally {
      setSharing(false)
    }
  }

  const startOver = () => {
    if (!confirm('Börja om med ett nytt hus? Den nuvarande ritningen försvinner från den här enheten.')) return
    setDraft({ ...fresh(), team })
    setSearch({}, { replace: true })
    setNotice('')
  }

  const typeName = HOUSE_TYPES.find((t) => t.type === params.type)!.name
  const title = `${team.trim() || 'Ert lag'} · ${typeName}, ${sv(params.width, 1)} × ${sv(params.depth, 1)} cm, väggar ${sv(params.height, 1)} cm`

  return (
    <div className="relative bg-[#170b06] text-jul-cream print:bg-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] print:hidden" style={{ backgroundImage: 'radial-gradient(#f0b878 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32 print:hidden">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f0b878]">
            <Link to={`/event/${JULBAK?.id ?? 'julbak'}#verkstad`} className="hover:text-jul-cream">
              Julbak · Tomtens verkstad
            </Link>
          </p>
          <h1 className="mt-3 text-4xl font-normal sm:text-6xl">Pepparkaksarkitekten</h1>
          <p className="mt-5 text-lg leading-relaxed text-jul-cream/80">
            Rita huset innan ni står med degen. Ange måtten, skissa glasyren och skriv ut mallarna i skala 1:1. Planera hur mycket ni vill – men bygget och pyntet sker först på plats.
          </p>
        </header>

        {/* team & saving */}
        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-jul-cream/15 p-4 sm:flex-row sm:items-end sm:p-5">
          <label className="flex-1">
            <span className="text-[11px] uppercase tracking-widest text-jul-cream/55">Lagnamn</span>
            <input
              id="lagnamn"
              value={team}
              maxLength={24}
              onChange={(e) => update({ team: e.target.value })}
              placeholder="t.ex. Nissarna på tredje"
              className="mt-1 block w-full border-b border-jul-cream/30 bg-transparent py-2 font-serif text-xl outline-none placeholder:text-jul-cream/30 focus:border-[#f0b878]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button onClick={share} disabled={sharing} className="rounded-full bg-[#d93a3d] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#b3202a] disabled:opacity-60">
              {sharing ? 'Sparar …' : draft.id ? 'Uppdatera lagets länk' : 'Dela med laget'}
            </button>
            <button onClick={startOver} className="rounded-full border border-jul-cream/25 px-5 py-2.5 text-sm text-jul-cream/80 transition-colors hover:border-jul-cream/60">
              Nytt hus
            </button>
          </div>
        </div>
        <p className="mt-2 min-h-5 text-sm text-jul-cream/60" aria-live="polite">
          {notice || 'Allt sparas automatiskt på den här enheten.'}
        </p>

        {/* 1 · måtten */}
        <section className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <Paper>
            <Eyebrow n={1}>Måtten</Eyebrow>
            <fieldset className="mt-5">
              <legend className="sr-only">Hustyp</legend>
              <div className="grid grid-cols-3 gap-2">
                {HOUSE_TYPES.map((t) => (
                  <button
                    key={t.type}
                    aria-pressed={params.type === t.type}
                    onClick={() => params.type !== t.type && update({ params: { ...params, ...PRESETS[t.type], type: t.type } })}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-1 py-3 text-center text-[13px] leading-tight transition-colors ${
                      params.type === t.type ? 'border-[#3a2410] bg-[#b5713a]/20' : 'border-[#3a2410]/20 hover:border-[#3a2410]/50'
                    }`}
                  >
                    <TypeIcon type={t.type} />
                    {t.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-[#3a2410]/65">{HOUSE_TYPES.find((t) => t.type === params.type)!.text}</p>
            </fieldset>

            <div className="mt-6 space-y-4">
              <Measure label={params.type === 'torn' ? 'Bredd fram' : 'Bredd (långvägg)'} value={params.width} min={6} max={40} onChange={(v) => setParam('width', v)} />
              <Measure label={params.type === 'torn' ? 'Djup (sida)' : 'Djup (gavel)'} value={params.depth} min={6} max={30} onChange={(v) => setParam('depth', v)} />
              <Measure label="Vägghöjd" value={params.height} min={4} max={30} onChange={(v) => setParam('height', v)} />
              <Measure label={params.type === 'platt' ? 'Taklutning på kupan' : 'Taklutning'} value={params.pitch} min={20} max={70} step={1} unit="°" onChange={(v) => setParam('pitch', v)} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#3a2410]/15 pt-5 text-sm">
              <Check label="Dörr" checked={params.door} onChange={(v) => setParam('door', v)} />
              {params.type !== 'torn' && <Check label="Skorsten" checked={params.chimney} onChange={(v) => setParam('chimney', v)} />}
              <Check label={params.type === 'sadel' ? 'Fönster i gavlarna' : 'Fönster på sidorna'} checked={params.gableWindow} onChange={(v) => setParam('gableWindow', v)} />
              <label className="col-span-2 flex items-center justify-between gap-3">
                <span>Fönster per {params.type === 'torn' ? 'vägg' : 'långvägg'}</span>
                <span className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].slice(0, params.type === 'torn' ? 3 : 5).map((n) => (
                    <button
                      key={n}
                      aria-pressed={params.windows === n}
                      onClick={() => setParam('windows', n)}
                      className={`h-8 w-8 rounded-full border text-sm ${params.windows === n ? 'border-[#3a2410] bg-[#3a2410] text-[#fbf3e4]' : 'border-[#3a2410]/25'}`}
                    >
                      {n}
                    </button>
                  ))}
                </span>
              </label>
            </div>
          </Paper>

          <Paper className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>Förhandsvisning</Eyebrow>
              <span className="text-xs text-[#3a2410]/50">dra för att vrida</span>
            </div>
            <div className="mt-3 flex flex-1 items-center rounded-xl" style={{ backgroundImage: 'linear-gradient(#3a241012 1px, transparent 1px), linear-gradient(90deg, #3a241012 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
              <Preview3D design={design} textures={textures} className="block aspect-[5/4] w-full" />
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[#3a2410]/80 sm:grid-cols-3">
              {design.pieces.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 border-b border-dotted border-[#3a2410]/20 py-1">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-[#3a2410]/55">× {p.count}</span>
                </li>
              ))}
            </ul>
          </Paper>
        </section>

        {/* 2 · fasaden */}
        <section className="mt-6">
          <Paper>
            <Eyebrow n={2}>Fasaden</Eyebrow>
            <p className="mt-2 max-w-2xl text-[#3a2410]/75">
              Välj en bit och spritsa. Tänk på juryn: estetik, kreativitet och att det ska kännas igen som en del av Tomtens verkstad.
            </p>
            <div className="mt-6">
              <FacadeEditor pieces={design.pieces} sketches={sketches} onChange={setSketch} team={team} />
            </div>
          </Paper>
        </section>

        {/* 3 · degen */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <Paper>
            <Eyebrow n={3}>Degen</Eyebrow>
            <p className="mt-4 font-serif text-4xl">
              ≈ {sv(Math.round(grams / 10) * 10)} g
            </p>
            <p className="mt-1 text-sm text-[#3a2410]/65">
              {sv(area)} cm² utkavlad deg × {sv(draft.thickness * 10)} mm, plus en fjärdedel för spill och provbitar.
            </p>
            <div className="mt-6 space-y-4">
              <Measure label="Degens tjocklek" value={draft.thickness * 10} min={3} max={8} step={0.5} unit="mm" onChange={(v) => update({ thickness: v / 10 })} />
              <Measure label="Ett paket deg väger" value={draft.pack} min={250} max={2000} step={50} unit="g" onChange={(v) => update({ pack: v })} />
            </div>
          </Paper>

          <Paper className="flex flex-col justify-between">
            <div>
              <Eyebrow>Räcker degen?</Eyebrow>
              <div className="relative mt-6 h-4 rounded-full bg-[#3a2410]/10">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, packs * 100)}%`, background: packs > 0.5 ? '#d93a3d' : '#b5713a' }} />
                <span className="absolute -top-1.5 left-1/2 h-7 w-px bg-[#3a2410]" aria-hidden />
                <span className="absolute left-1/2 top-6 -translate-x-1/2 text-xs text-[#3a2410]/60">½ paket</span>
              </div>
              <p className="mt-10 text-lg leading-relaxed">
                {packs > 0.5 ? (
                  <>
                    Huset kräver ungefär <strong className="font-semibold">{sv(packs, 1)} paket</strong>. Det är mer än ett halvt – ta med egen extra deg till Tomtens verkstad.
                  </>
                ) : (
                  <>
                    Huset kräver ungefär <strong className="font-semibold">{sv(packs, 2)} paket</strong> och ryms inom ett halvt. Inget extra behövs.
                  </>
                )}
              </p>
            </div>
            <p className="mt-6 border-t border-[#3a2410]/15 pt-4 font-serif italic text-[#5a3420]">
              Påminnelse: behöver laget mer än ett halvt paket deg tar ni med egen extra deg.
            </p>
          </Paper>
        </section>

        {/* 4 · mallarna */}
        <section className="mt-6">
          <Paper>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow n={4}>Mallarna</Eyebrow>
                <p className="mt-2 max-w-2xl text-[#3a2410]/75">
                  {pages.length} A4-{pages.length === 1 ? 'sida' : 'sidor'} i skala 1:1. Skriv ut i faktisk storlek och mät 5 cm-linjen längst ner. Streckade linjer är dörrar och fönster.
                </p>
              </div>
              <button onClick={() => window.print()} className="shrink-0 self-start rounded-full bg-[#3a2410] px-5 py-2.5 text-sm font-medium text-[#fbf3e4] transition-colors hover:bg-[#5a3420] sm:self-auto">
                Skriv ut mallarna
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {pages.map((pg, i) => (
                <div key={i} className="overflow-hidden rounded-sm shadow-[0_6px_24px_-8px_rgba(58,36,16,0.45)] ring-1 ring-[#3a2410]/10">
                  <TemplatePage page={pg} index={i} total={pages.length} title={title} />
                </div>
              ))}
            </div>
            <ul className="mt-8 grid gap-3 text-sm leading-relaxed text-[#3a2410]/75 sm:grid-cols-3">
              <li>Klipp ut mallarna, lägg dem på den utkavlade degen och skär runt med en vass kniv.</li>
              <li>Degen flyter lite i ugnen – lägg tillbaka mallen och putsa kanterna direkt när plåten kommer ut.</li>
              <li>Prefabdelar får bakas från kl. 00.00 den 6 december. Fota eller filma med tidsstämpel.</li>
            </ul>
          </Paper>
        </section>
      </div>

      {/* what the printer sees */}
      <div className="hidden print:block">
        {pages.map((pg, i) => (
          <div key={i} className="tpl-print">
            <TemplatePage page={pg} index={i} total={pages.length} title={title} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Paper({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-sm bg-[#fbf3e4] p-5 text-[#3a2410] shadow-2xl shadow-black/50 sm:p-8 ${className}`}>{children}</div>
}

function Eyebrow({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-3 text-2xl font-normal sm:text-3xl">
      {n && <span className="font-serif text-xl text-[#d93a3d]">{n}.</span>}
      {children}
    </h2>
  )
}

function Measure({
  label,
  value,
  min,
  max,
  step = 0.5,
  unit = 'cm',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="flex items-baseline gap-1">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value.replace(',', '.'))
              if (!Number.isNaN(v)) onChange(clamp(v))
            }}
            className="w-16 rounded border border-[#3a2410]/20 bg-white/60 px-1.5 py-0.5 text-right tabular-nums outline-none focus:border-[#b5713a]"
          />
          <span className="w-6 text-[#3a2410]/60">{unit}</span>
        </span>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(parseFloat(e.target.value))} className="dough-range mt-2 w-full" />
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#d93a3d]" />
      {label}
    </label>
  )
}

function TypeIcon({ type }: { type: HouseType }) {
  const common = { fill: '#b5713a', stroke: '#fff8ee', strokeWidth: 1.6, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 48 40" className="h-9 w-11" aria-hidden>
      {type === 'sadel' && (
        <>
          <path d="M8 18 L24 6 L40 18 V36 H8Z" {...common} />
          <path d="M5 20 L24 5 L43 20" fill="none" stroke="#fff8ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="20" y="25" width="8" height="11" rx="4" fill="#3a1f0e" />
        </>
      )}
      {type === 'platt' && (
        <>
          <path d="M18 16 L24 9 L30 16 V20 H18Z" {...common} />
          <rect x="6" y="20" width="36" height="16" {...common} />
          <path d="M4 20 H44" stroke="#fff8ee" strokeWidth="3" strokeLinecap="round" />
          <rect x="21" y="26" width="6" height="10" rx="3" fill="#3a1f0e" />
        </>
      )}
      {type === 'torn' && (
        <>
          <rect x="16" y="16" width="16" height="20" {...common} />
          <path d="M14 17 L24 2 L34 17Z" {...common} />
          <rect x="21" y="26" width="6" height="10" rx="3" fill="#3a1f0e" />
        </>
      )}
    </svg>
  )
}

