import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Piece } from '../../lib/gingerbread'
import { compact, drawStamp, MARGIN, NOZZLES, renderPiece, STAMPS, type Op, type StampType } from '../../lib/icing'

type Tool = 'pensel' | 'stampel' | 'sudd'

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'lag'

function StampIcon({ type }: { type: StampType }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const dpr = window.devicePixelRatio || 1
    c.width = 36 * dpr
    c.height = 36 * dpr
    const ctx = c.getContext('2d')!
    // show about 2.4 cm of gingerbread so the candy fills the button
    const s = (36 * dpr) / 2.4
    ctx.setTransform(s, 0, 0, s, 18 * dpr, 18 * dpr)
    drawStamp(ctx, { k: 't', t: type, x: 0, y: 0, r: type === 'kanel' ? -0.6 : 0, s: 3 })
  }, [type])
  return <canvas ref={ref} className="h-9 w-9" aria-hidden />
}

export function FacadeEditor({
  pieces,
  sketches,
  onChange,
  team,
}: {
  pieces: Piece[]
  sketches: Record<string, Op[]>
  onChange: (pieceId: string, ops: Op[]) => void
  team: string
}) {
  const [sure, setSure] = useState(false)
  const [pieceId, setPieceId] = useState(pieces[0]?.id ?? '')
  const [tool, setTool] = useState<Tool>('pensel')
  const [nozzle, setNozzle] = useState(NOZZLES[1].w)
  const [stamp, setStamp] = useState<StampType>('polkagris')
  const [box, setBox] = useState({ w: 0, maxH: 0 })
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const current = useRef<Op | null>(null)
  const raf = useRef(0)
  // a candy being dragged from the buttons (screen coordinates), and one being moved on the piece
  const [carry, setCarry] = useState<{ type: StampType; x: number; y: number } | null>(null)
  const moving = useRef<{ i: number; dx: number; dy: number; x: number; y: number } | null>(null)
  const latest = useRef<{ press: (t: StampType, x: number, y: number) => void; center: (t: StampType) => void; cw: number; ch: number } | null>(null)
  // the candy you last placed or picked up – the one ⟲ ⟳ turn (index into the piece's ops)
  const [sel, setSel] = useState<number | null>(null)
  const wheel = useRef<((e: WheelEvent) => void) | null>(null)

  const piece = pieces.find((p) => p.id === pieceId) ?? pieces[0]
  const ops = (piece && sketches[piece.id]) || []

  useEffect(() => {
    if (piece && piece.id !== pieceId) setPieceId(piece.id)
  }, [piece, pieceId])
  useEffect(() => setSel(null), [pieceId, tool])
  // the scroll wheel over a candy turns it (a native listener: React's wheel events can't preventDefault)
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const onWheel = (e: WheelEvent) => wheel.current?.(e)
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }, [piece?.id])

  useLayoutEffect(() => {
    const el = wrap.current!
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, maxH: Math.max(260, window.innerHeight * 0.62) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // fit the piece in the available box, keeping its proportions
  const cw = piece ? piece.w + MARGIN * 2 : 1
  const ch = piece ? piece.h + MARGIN * 2 : 1
  const cssW = Math.max(0, Math.min(box.w, (box.maxH * cw) / ch))
  const cssH = (cssW * ch) / cw
  const ppc = (cssW * (window.devicePixelRatio || 1)) / cw

  const redraw = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      if (!canvas.current || !piece || !ppc) return
      const m = moving.current
      const shown = m ? ops.map((o, j) => (j === m.i && o.k === 't' ? { ...o, x: m.x, y: m.y } : o)) : ops
      renderPiece(canvas.current, piece, current.current ? [...shown, current.current] : shown, ppc)
      const o = sel !== null ? shown[sel] : undefined
      if (o && o.k === 't' && tool === 'stampel') {
        const ctx = canvas.current.getContext('2d')!
        ctx.save()
        ctx.setLineDash([ppc * 0.25, ppc * 0.18])
        ctx.lineWidth = Math.max(2, ppc * 0.08)
        ctx.strokeStyle = '#d4a64a'
        ctx.beginPath()
        ctx.arc((o.x + MARGIN) * ppc, (o.y + MARGIN) * ppc, ppc * 1.05, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    })
  }
  useEffect(redraw)

  if (!piece) return null

  const toCm = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * cw - MARGIN, ((e.clientY - r.top) / r.height) * ch - MARGIN] as const
  }

  const press = (type: StampType, x: number, y: number) => {
    const s = Math.floor(Math.random() * 1000)
    const r = type === 'kanel' || type === 'mandel' ? Math.random() * Math.PI : (Math.random() - 0.5) * 0.5
    onChange(piece.id, [...ops, { k: 't', t: type, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, r: Math.round(r * 100) / 100, s }])
    setSel(ops.length)
  }

  /** Turn a candy (the selected one unless another is given) by `delta` radians. */
  const rotate = (delta: number, j = sel) => {
    const o = j !== null ? ops[j] : undefined
    if (!o || o.k !== 't') return
    onChange(piece.id, ops.map((p, k) => (k === j && p.k === 't' ? { ...p, r: Math.round((p.r + delta) * 100) / 100 } : p)))
  }
  const removeSelected = () => {
    if (sel === null || ops[sel]?.k !== 't') return
    onChange(piece.id, ops.filter((_, k) => k !== sel))
    setSel(null)
  }

  /** A plain tap on a candy button drops one in the middle of the piece, so something always happens. */
  const center = (type: StampType) => {
    const jitter = () => (Math.random() - 0.5) * Math.min(piece.w, piece.h) * 0.3
    press(type, piece.w / 2 + jitter(), piece.h / 2 + jitter())
  }
  latest.current = { press, center, cw, ch }

  /** Drag a candy from the buttons and drop it on the gingerbread (a tap puts it in the middle). */
  const startCarry = (type: StampType, e: React.PointerEvent) => {
    e.preventDefault()
    setStamp(type)
    setTool('stampel')
    const sx = e.clientX
    const sy = e.clientY
    let dragged = false
    const onMove = (ev: PointerEvent) => {
      if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) dragged = true
      if (dragged) setCarry({ type, x: ev.clientX, y: ev.clientY })
    }
    const onUp = (ev: PointerEvent) => {
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onUp)
      setCarry(null)
      const l = latest.current
      if (!l) return
      if (!dragged) return l.center(type)
      const r = canvas.current?.getBoundingClientRect()
      if (!r || ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return
      l.press(type, ((ev.clientX - r.left) / r.width) * l.cw - MARGIN, ((ev.clientY - r.top) / r.height) * l.ch - MARGIN)
    }
    addEventListener('pointermove', onMove)
    addEventListener('pointerup', onUp)
    addEventListener('pointercancel', onUp)
  }

  /** The candy under a point, topmost first (-1 if none). */
  const candyAt = (x: number, y: number) => {
    for (let j = ops.length - 1; j >= 0; j--) {
      const o = ops[j]
      if (o.k === 't' && Math.hypot(x - o.x, y - o.y) < 0.9) return j
    }
    return -1
  }

  wheel.current = (e: WheelEvent) => {
    if (tool !== 'stampel' || !canvas.current) return
    const r = canvas.current.getBoundingClientRect()
    const j = candyAt(((e.clientX - r.left) / r.width) * cw - MARGIN, ((e.clientY - r.top) / r.height) * ch - MARGIN)
    if (j < 0) return
    e.preventDefault()
    setSel(j)
    rotate(Math.sign(e.deltaY) * (Math.PI / 12), j)
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const [x, y] = toCm(e)
    if (tool === 'stampel') {
      // grab a candy that's already there and move it – otherwise press a new one
      const j = candyAt(x, y)
      if (j >= 0) {
        const o = ops[j] as Extract<Op, { k: 't' }>
        e.currentTarget.setPointerCapture(e.pointerId)
        moving.current = { i: j, dx: x - o.x, dy: y - o.y, x: o.x, y: o.y }
        setSel(j)
        e.currentTarget.style.cursor = 'grabbing'
        return
      }
      press(stamp, x, y)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    current.current = tool === 'sudd' ? { k: 's', w: 1.2, p: [x, y], e: 1 } : { k: 's', w: nozzle, p: [x, y] }
    redraw()
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [mx, my] = toCm(e)
    const m = moving.current
    if (m) {
      m.x = Math.round((mx - m.dx) * 100) / 100
      m.y = Math.round((my - m.dy) * 100) / 100
      redraw()
      return
    }
    // show a hand over candy you can pick up
    if (tool === 'stampel') e.currentTarget.style.cursor = candyAt(mx, my) >= 0 ? 'grab' : ''
    const c = current.current
    if (!c || c.k !== 's') return
    const [x, y] = [mx, my]
    c.p.push(x, y)
    redraw()
  }
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const m = moving.current
    if (m) {
      moving.current = null
      e.currentTarget.style.cursor = ''
      // dragged off the gingerbread → gone; otherwise it stays where it was dropped
      const off = m.x < -0.5 || m.y < -0.5 || m.x > piece.w + 0.5 || m.y > piece.h + 0.5
      onChange(piece.id, off ? ops.filter((_, j) => j !== m.i) : ops.map((o, j) => (j === m.i && o.k === 't' ? { ...o, x: m.x, y: m.y } : o)))
      if (off) setSel(null)
      return
    }
    const c = current.current
    current.current = null
    if (c && c.k === 's') onChange(piece.id, [...ops, { ...c, p: compact(c.p) }])
  }

  const exportPng = () => {
    const c = document.createElement('canvas')
    renderPiece(c, piece, ops, 40)
    c.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `pepparkakshus-${slug(team)}-${slug(piece.name)}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    }, 'image/png')
  }

  const btn = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm transition-colors ${active ? 'border-[#3a2410] bg-[#3a2410] text-[#fbf3e4]' : 'border-[#3a2410]/25 hover:border-[#3a2410]/60'}`

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Välj bit">
        {pieces.map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === piece.id} className={btn(p.id === piece.id)} onClick={() => setPieceId(p.id)}>
            {p.name}
            {sketches[p.id]?.length ? <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-jul-red align-middle" aria-label="har skiss" /> : null}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* tools */}
        <div className="flex flex-col gap-5 text-sm">
          <fieldset>
            <legend className="text-[11px] uppercase tracking-widest text-[#3a2410]/60">Verktyg</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btn(tool === 'pensel')} onClick={() => setTool('pensel')}>
                Spritspåse
              </button>
              <button className={btn(tool === 'stampel')} onClick={() => setTool('stampel')}>
                Godis
              </button>
              <button className={btn(tool === 'sudd')} onClick={() => setTool('sudd')}>
                Sudd
              </button>
            </div>
          </fieldset>

          {tool === 'pensel' && (
            <fieldset>
              <legend className="text-[11px] uppercase tracking-widest text-[#3a2410]/60">Tyll</legend>
              <div className="mt-2 flex gap-2">
                {NOZZLES.map((n) => (
                  <button key={n.w} className={`${btn(nozzle === n.w)} flex items-center gap-2`} onClick={() => setNozzle(n.w)}>
                    <span className="inline-block rounded-full bg-current" style={{ width: 4 + n.w * 18, height: 4 + n.w * 18 }} aria-hidden />
                    {n.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {tool === 'stampel' && (
            <fieldset>
              <legend className="text-[11px] uppercase tracking-widest text-[#3a2410]/60">Godis att trycka fast</legend>
              <div className="mt-2 grid grid-cols-5 gap-1.5 lg:grid-cols-3">
                {STAMPS.map((s) => (
                  <button
                    key={s.type}
                    title={s.name}
                    aria-label={s.name}
                    aria-pressed={stamp === s.type}
                    onPointerDown={(e) => startCarry(s.type, e)}
                    className={`flex touch-none cursor-grab flex-col items-center gap-1 rounded-xl border p-1.5 text-[11px] leading-tight ${stamp === s.type ? 'border-[#3a2410] bg-[#b5713a]/25' : 'border-transparent hover:border-[#3a2410]/30'}`}
                  >
                    <span className="rounded-lg bg-[#b5713a] p-0.5">
                      <StampIcon type={s.type} />
                    </span>
                    <span className="hidden sm:block">{s.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-live="polite">
                <span className="mr-1 text-[11px] uppercase tracking-widest text-[#3a2410]/60">{sel !== null ? 'Valt godis' : 'Vrid godis'}</span>
                <button className={btn(false)} disabled={sel === null} onClick={() => rotate(-Math.PI / 12)} title="Vrid moturs" aria-label="Vrid moturs">
                  ⟲
                </button>
                <button className={btn(false)} disabled={sel === null} onClick={() => rotate(Math.PI / 12)} title="Vrid medurs" aria-label="Vrid medurs">
                  ⟳
                </button>
                <button className={btn(false)} disabled={sel === null} onClick={removeSelected} title="Ta bort godiset" aria-label="Ta bort godiset">
                  🗑
                </button>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[#3a2410]/70">
                Dra ett godis till pepparkakan och släpp det där du vill ha det – eller tryck så hamnar det i mitten. Dra i godis som redan sitter för att flytta dem, och dra ut dem från kakan för att ta bort dem. Vrid det valda godiset med ⟲ ⟳ – eller scrolla med musen över ett godis.
              </p>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-2 border-t border-[#3a2410]/15 pt-4">
            <button className={btn(false)} disabled={!ops.length} onClick={() => onChange(piece.id, ops.slice(0, -1))}>
              Ångra
            </button>
            <button
              className={btn(sure)}
              disabled={!ops.length}
              onClick={() => {
                // two clicks instead of a confirm() dialog, which some browsers block
                if (!sure) return setSure(true)
                onChange(piece.id, [])
                setSure(false)
              }}
              onBlur={() => setSure(false)}
            >
              {sure ? 'Säker? Klicka igen' : 'Börja om'}
            </button>
            <button className={btn(false)} onClick={exportPng}>
              Spara som bild
            </button>
          </div>
          <p className="text-[13px] leading-relaxed text-[#3a2410]/65">
            Skissen hamnar direkt på huset i förhandsvisningen. Bitar som skärs i flera exemplar delar skiss.
          </p>
        </div>

        {carry && (
          <div className="pointer-events-none fixed z-[70] drop-shadow-lg" style={{ left: carry.x, top: carry.y, transform: 'translate(-50%, -50%) scale(1.6)' }} aria-hidden>
            <StampIcon type={carry.type} />
          </div>
        )}

        {/* the gingerbread itself */}
        <div className="min-w-0">
          <div className="rounded-2xl bg-[#3a2410]/[0.06] p-3 sm:p-5">
            <div ref={wrap}>
            <canvas
              ref={canvas}
              style={{ width: cssW, height: cssH }}
              className={`mx-auto block touch-none ${tool === 'stampel' ? 'cursor-copy' : 'cursor-crosshair'}`}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              aria-label={`Skissyta för ${piece.name.toLowerCase()}`}
            />
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-[#3a2410]/55">
            {piece.name} · {String(piece.w).replace('.', ',')} × {String(piece.h).replace('.', ',')} cm
          </p>
        </div>
      </div>
    </div>
  )
}
