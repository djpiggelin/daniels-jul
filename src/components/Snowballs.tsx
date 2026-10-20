import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { blip } from '../lib/fx'

/*
 * Snowball fight on the front page: click a snow pile to pick up snowballs,
 * then click anywhere to throw. Nissar (and the snowman) that get hit react –
 * run off, fall over, pull a face or throw one back at the screen.
 */

export type NisseEffect = 'flee' | 'fall' | 'hop' | 'wobble'

const SnowCtx = createContext<Record<string, NisseEffect | undefined> | null>(null)

/** The current reaction of a nisse (or the snowman) that was hit, if any. */
export const useNisseEffect = (id?: string) => {
  const effects = useContext(SnowCtx)
  return id && effects ? effects[id] : undefined
}

type SnowApi = {
  /** A snowball thrown from inside the scene is at this point on screen – hit whoever's there. */
  hitAt: (clientX: number, clientY: number) => boolean
}
const SnowApiCtx = createContext<SnowApi | null>(null)
/** Lets snowballs thrown from inside the scene (the villager's) join the fight. */
export const useSnowballs = () => useContext(SnowApiCtx)

type Flight = { id: number; x0: number; y0: number; x1: number; y1: number; back?: boolean }
type Pop = { id: number; x: number; y: number; text: string }
type Splat = { id: number; x: number; y: number; big?: boolean }

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const MAX_AMMO = 5

export function SnowballArena({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const seq = useRef(0)
  const [ammo, setAmmo] = useState(0)
  const [hits, setHits] = useState(0)
  const [effects, setEffects] = useState<Record<string, NisseEffect | undefined>>({})
  const [flights, setFlights] = useState<Flight[]>([])
  const [pops, setPops] = useState<Pop[]>([])
  const [splats, setSplats] = useState<Splat[]>([])

  const local = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect()
    return { x: cx - r.left, y: cy - r.top }
  }
  const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms)

  const pop = (x: number, y: number, text: string) => {
    const id = ++seq.current
    setPops((p) => [...p, { id, x, y, text }])
    later(1800, () => setPops((p) => p.filter((q) => q.id !== id)))
  }
  const splat = (x: number, y: number, big = false) => {
    const id = ++seq.current
    setSplats((s) => [...s, { id, x, y, big }])
    later(big ? 2600 : 900, () => setSplats((s) => s.filter((q) => q.id !== id)))
  }
  const react = (id: string, fx: NisseEffect, ms: number) => {
    setEffects((e) => ({ ...e, [id]: fx }))
    later(ms, () => setEffects((e) => ({ ...e, [id]: undefined })))
  }

  /** The visible nisse (or snowman) closest to a point on screen, within a small margin. */
  const targetAt = (cx: number, cy: number, pad = 10) => {
    let best: { id: string; el: Element; d: number } | null = null
    document.querySelectorAll('[data-nisse]').forEach((el) => {
      if (parseFloat(getComputedStyle(el).opacity) < 0.3) return
      const r = el.getBoundingClientRect()
      if (!r.width) return
      if (cx < r.left - pad || cx > r.right + pad || cy < r.top - pad || cy > r.bottom + pad) return
      const d = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2))
      if (!best || d < best.d) best = { id: el.getAttribute('data-nisse')!, el, d }
    })
    return best as { id: string; el: Element; d: number } | null
  }

  const throwBack = (x0: number, y0: number) => {
    const r = box.current!.getBoundingClientRect()
    const id = ++seq.current
    setFlights((f) => [...f, { id, x0, y0, x1: r.width * (0.3 + Math.random() * 0.4), y1: r.height * (0.28 + Math.random() * 0.3), back: true }])
  }

  const land = (fl: Flight) => {
    setFlights((f) => f.filter((q) => q.id !== fl.id))
    if (fl.back) {
      splat(fl.x1, fl.y1, true)
      blip(160, 0.25, 'sawtooth', 0.05)
      return
    }
    const r = box.current!.getBoundingClientRect()
    const hit = targetAt(fl.x1 + r.left, fl.y1 + r.top)
    splat(fl.x1, fl.y1)
    if (!hit) {
      blip(240, 0.08, 'triangle', 0.04)
      return
    }
    strike(hit)
  }

  /** Someone got a snowball on them: count it and let them react. */
  const strike = (hit: { id: string; el: Element }) => {
    setHits((h) => h + 1)
    blip(700, 0.09, 'triangle', 0.06)
    const b = hit.el.getBoundingClientRect()
    const head = local(b.left + b.width / 2, b.top)

    if (hit.id === 'snowman') {
      react('snowman', 'wobble', 1200)
      pop(head.x, head.y, pick(['😳', 'Hallå!', 'Inte hatten!', 'Brr!']))
      return
    }
    const roll = Math.random()
    if (roll < 0.28) {
      react(hit.id, 'flee', 6000)
      pop(head.x, head.y, pick(['Aj!', 'Hjälp!', '💨', 'Fusk!']))
    } else if (roll < 0.5) {
      react(hit.id, 'fall', 2800)
      pop(head.x, head.y, pick(['😵', '💫', 'Oj oj']))
    } else if (roll < 0.76) {
      react(hit.id, 'hop', 1200)
      pop(head.x, head.y, pick(['😂', '😤', '🥶', '😱', '🤣', '😆']))
    } else {
      react(hit.id, 'hop', 1200)
      pop(head.x, head.y, pick(['Nu jäklar!', 'Hörru!', 'Ha!', 'Vänta du!']))
      later(650, () => throwBack(head.x, head.y))
    }
  }

  const latest = useRef<SnowApi>(null!)
  latest.current = {
    hitAt: (cx, cy) => {
      const hit = targetAt(cx, cy, 3)
      if (!hit) return false
      const p = local(cx, cy)
      splat(p.x, p.y)
      strike(hit)
      return true
    },
  }
  const api = useMemo<SnowApi>(() => ({ hitAt: (cx, cy) => latest.current.hitAt(cx, cy) }), [])

  const onClickCapture = (e: React.MouseEvent) => {
    const t = e.target as Element
    if (t.closest?.('[data-snow-ui]')) return
    if (t.closest?.('[data-pile]')) {
      e.stopPropagation()
      e.preventDefault()
      setAmmo((a) => Math.min(MAX_AMMO, a + 3))
      blip(420, 0.12, 'triangle', 0.05)
      const p = local(e.clientX, e.clientY)
      pop(p.x, p.y - 12, '+3 ❄')
      return
    }
    if (ammo <= 0) return
    // holding snowballs: every click is a throw (also on houses and Santa)
    e.stopPropagation()
    e.preventDefault()
    setAmmo((a) => a - 1)
    const r = box.current!.getBoundingClientRect()
    const p = local(e.clientX, e.clientY)
    const id = ++seq.current
    setFlights((f) => [...f, { id, x0: r.width / 2 + (Math.random() - 0.5) * 80, y0: r.height + 24, x1: p.x, y1: p.y }])
    blip(300, 0.06, 'triangle', 0.03)
  }

  return (
    <SnowCtx.Provider value={effects}>
      <SnowApiCtx.Provider value={api}>
      <div ref={box} className={`absolute inset-0 ${ammo > 0 ? 'aiming' : ''}`} onClickCapture={onClickCapture}>
        {children}

        <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden>
          {flights.map((fl) => (
            <SnowballFlight key={fl.id} flight={fl} onLand={land} />
          ))}
          {splats.map((s) => (
            <span key={s.id} className={s.big ? 'splat-big' : 'splat'} style={{ left: s.x, top: s.y }}>
              {!s.big && Array.from({ length: 7 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 51}deg` }} />)}
            </span>
          ))}
          {pops.map((p) => (
            <span key={p.id} className="snow-pop" style={{ left: p.x, top: p.y }}>
              {p.text}
            </span>
          ))}
        </div>

        <div data-snow-ui className="absolute bottom-10 left-4 z-30 flex items-center gap-3 rounded-full bg-night-950/55 px-3 py-1.5 text-xs text-snow/85 backdrop-blur">
            {/* until you've picked up any snow: tell people the piles are there */}
            {ammo === 0 && hits === 0 && (
              <span>
                <span className="snowball-icon mr-1.5 align-[-1px]" /> Klicka på en snöhög för att börja kasta
              </span>
            )}
            {ammo > 0 && (
              <>
                <span className="flex gap-1" aria-label={`${ammo} snöbollar`}>
                  {Array.from({ length: ammo }, (_, i) => (
                    <span key={i} className="snowball-icon" />
                  ))}
                </span>
                <button onClick={() => setAmmo(0)} className="text-snow/60 underline-offset-2 hover:text-white hover:underline">
                  släpp
                </button>
              </>
            )}
            {hits > 0 && <span>Träffar: {hits}</span>}
        </div>
      </div>
      </SnowApiCtx.Provider>
    </SnowCtx.Provider>
  )
}

/** One snowball in flight: arcs into the scene, or (thrown back) grows towards the screen. */
function SnowballFlight({ flight: fl, onLand }: { flight: Flight; onLand: (f: Flight) => void }) {
  const el = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const dur = fl.back ? 650 : 540
    const cx = (fl.x0 + fl.x1) / 2
    const cy = Math.min(fl.y0, fl.y1) - (fl.back ? 70 : 170)
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const x = (1 - k) ** 2 * fl.x0 + 2 * (1 - k) * k * cx + k * k * fl.x1
      const y = (1 - k) ** 2 * fl.y0 + 2 * (1 - k) * k * cy + k * k * fl.y1
      const s = fl.back ? 0.35 + k * k * 7 : 1.7 - 1.2 * k
      if (el.current) el.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`
      if (k < 1) raf = requestAnimationFrame(tick)
      else onLand(fl)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <span ref={el} className="snowball absolute left-0 top-0" />
}
