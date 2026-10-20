import { useEffect, useRef, useState } from 'react'
import type { CustomPiece } from '../../lib/gingerbread'
import { bounds, edgeMid, HOLE_PRESETS, moveShape, OUTLINE_PRESETS, shapeArea, splitEdge, toPolyline, type Shape } from '../../lib/shapes'

/** -1 is the outline, 0… are the holes. */
type Sel = { shape: number; kind: 'v' | 'e'; i: number } | { shape: number; kind: 'hole' } | null
type Drag =
  | { kind: 'v'; shape: number; i: number }
  | { kind: 'bulge'; shape: number; i: number }
  | { kind: 'move'; shape: number; x: number; y: number; start: Shape }

const sv = (n: number, d = 1) => n.toLocaleString('sv-SE', { maximumFractionDigits: d })
const pathOf = (s: Shape) => `M${toPolyline(s).map((p) => p.join(' ')).join('L')}Z`

/**
 * A small CAD board for one free-form piece: draw the outline (or an opening)
 * point by point on the grid, or start from a preset; drag corners, pull the
 * diamond in the middle of an edge to bend it into an arc, double-click an edge
 * for a new corner, and punch openings from the presets.
 */
export function PieceCad({ piece, onChange }: { piece: CustomPiece; onChange: (p: CustomPiece) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [pendingShape, setPendingShape] = useState<string | null>(null)
  const [sel, setSel] = useState<Sel>(null)
  const [snap, setSnap] = useState(true)
  const drag = useRef<Drag | null>(null)
  const frozen = useRef<string | null>(null)
  // drawing a new outline or opening by clicking corners on the grid
  const [drawing, setDrawing] = useState<{ target: 'outline' | 'hole'; pts: { x: number; y: number }[] } | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const drawView = useRef('-2 -2 36 27')

  const shapeAt = (k: number) => (k < 0 ? piece.outline : piece.holes[k])
  const setShape = (k: number, s: Shape) =>
    onChange(k < 0 ? { ...piece, outline: s } : { ...piece, holes: piece.holes.map((h, j) => (j === k ? s : h)) })

  // keep the view still while dragging so nothing runs away under the finger
  const poly = toPolyline(piece.outline)
  const b = bounds(poly)
  const pad = 3
  let vx = b.x0 - pad,
    vy = b.y0 - pad,
    vw = b.x1 - b.x0 + pad * 2,
    vh = b.y1 - b.y0 + pad * 2
  if (vw < 20) [vx, vw] = [vx - (20 - vw) / 2, 20]
  if (vh < 14) [vy, vh] = [vy - (14 - vh) / 2, 14]
  const live = `${vx} ${vy} ${vw} ${vh}`
  const viewBox = drawing ? drawView.current : frozen.current ?? live
  const scale = parseFloat(viewBox.split(' ')[2]) / 26 // handle size follows the zoom
  const hr = 0.32 * scale

  const toCm = (e: React.PointerEvent) => {
    const m = svg.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
    return { x: p.x, y: p.y }
  }
  const snapV = (v: number) => (snap ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100)

  const begin = (e: React.PointerEvent, d: Drag, s: Sel) => {
    e.stopPropagation()
    try {
      svg.current!.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic or already released pointer */
    }
    frozen.current = live
    drag.current = d
    setSel(s)
  }

  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const { x, y } = toCm(e)
    const s = shapeAt(d.shape)
    if (d.kind === 'v') {
      setShape(
        d.shape,
        s.map((v, j) => (j === d.i ? { ...v, x: snapV(x), y: snapV(y) } : v)),
      )
    } else if (d.kind === 'bulge') {
      const a = s[d.i]
      const c = s[(d.i + 1) % s.length]
      const m = edgeMid(s.map((v, j) => (j === d.i ? { ...v, b: 0 } : v)), d.i)
      const sag = (x - (a.x + c.x) / 2) * m.nx + (y - (a.y + c.y) / 2) * m.ny
      let bulge = (2 * sag) / m.len
      if (Math.abs(sag) < 0.25) bulge = 0
      bulge = Math.max(-2.4, Math.min(2.4, Math.round(bulge * 100) / 100))
      setShape(
        d.shape,
        s.map((v, j) => (j === d.i ? { ...v, b: bulge || undefined } : v)),
      )
    } else {
      setShape(d.shape, moveShape(d.start, snapV(x - d.x), snapV(y - d.y)))
    }
  }
  const end = () => {
    drag.current = null
    frozen.current = null
    // re-render so the view can settle around the new shape
    setSel((s) => (s ? { ...s } : s))
  }

  const selected = sel ? shapeAt(sel.shape) : null
  const vertex = sel && sel.kind === 'v' && selected ? selected[sel.i] : null

  const startDrawing = (target: 'outline' | 'hole') => {
    // an empty sheet to draw a new outline on; openings are drawn on the piece as it is
    drawView.current = target === 'outline' ? '-2 -2 36 27' : live
    setDrawing({ target, pts: [] })
    setHover(null)
    setSel(null)
    setPendingShape(null)
  }
  const stopDrawing = () => {
    setDrawing(null)
    setHover(null)
  }
  const finishDrawing = () => {
    if (!drawing) return
    // drop repeated points (a double-click lands twice) and a closing point on top of the first
    const pts = drawing.pts.filter((q, i, a) => i === 0 || q.x !== a[i - 1].x || q.y !== a[i - 1].y)
    if (pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) pts.pop()
    if (pts.length < 3) return
    const shape: Shape = pts.map((q) => ({ x: q.x, y: q.y }))
    if (drawing.target === 'outline') {
      // keep the piece's coordinates starting at 0,0 like the presets
      const dx = -Math.min(...pts.map((q) => q.x))
      const dy = -Math.min(...pts.map((q) => q.y))
      onChange({ ...piece, outline: moveShape(shape, dx, dy), holes: piece.holes.map((h) => moveShape(h, dx, dy)) })
    } else {
      onChange({ ...piece, holes: [...piece.holes, shape] })
      setSel({ shape: piece.holes.length, kind: 'hole' })
    }
    stopDrawing()
  }
  const addPoint = (e: React.PointerEvent) => {
    if (!drawing) return
    const p = toCm(e)
    const q = { x: snapV(p.x), y: snapV(p.y) }
    const first = drawing.pts[0]
    // clicking the first corner again closes the shape
    if (first && drawing.pts.length >= 3 && Math.hypot(q.x - first.x, q.y - first.y) < hr * 2.5) return finishDrawing()
    setDrawing({ ...drawing, pts: [...drawing.pts, q] })
  }

  useEffect(() => {
    if (!drawing) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
      if (e.key === 'Escape') stopDrawing()
      else if (e.key === 'Enter') finishDrawing()
      else if (e.key === 'Backspace') {
        e.preventDefault()
        setDrawing((d) => d && { ...d, pts: d.pts.slice(0, -1) })
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const deleteSelected = () => {
    if (!sel) return
    if (sel.kind === 'hole') onChange({ ...piece, holes: piece.holes.filter((_, j) => j !== sel.shape) })
    else if (sel.kind === 'v' && shapeAt(sel.shape).length > 3) setShape(sel.shape, shapeAt(sel.shape).filter((_, j) => j !== sel.i))
    setSel(null)
  }

  const btn = 'rounded-full border border-[#3a2410]/25 px-3 py-1.5 text-sm transition-colors hover:border-[#3a2410]/60 disabled:opacity-40'
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2

  const handles = (k: number) => {
    const s = shapeAt(k)
    return (
      <g key={`h${k}`}>
        {s.map((v, i) => {
          const c = s[(i + 1) % s.length]
          const m = edgeMid(s, i)
          const on = sel && sel.shape === k && sel.kind !== 'hole' && sel.i === i
          return (
            <g key={i}>
              {/* the edge: double-click (or the button) adds a corner */}
              <line
                x1={v.x}
                y1={v.y}
                x2={c.x}
                y2={c.y}
                stroke="transparent"
                strokeWidth={hr * 2.5}
                onPointerDown={(e) => begin(e, { kind: 'bulge', shape: k, i }, { shape: k, kind: 'e', i })}
                className="cursor-pointer"
              />
              <rect
                x={m.x - hr * 0.8}
                y={m.y - hr * 0.8}
                width={hr * 1.6}
                height={hr * 1.6}
                transform={`rotate(45 ${m.x} ${m.y})`}
                fill={on && sel?.kind === 'e' ? '#d93a3d' : '#fbf3e4'}
                stroke="#3a2410"
                strokeWidth={hr * 0.25}
                className="cursor-move"
                onPointerDown={(e) => begin(e, { kind: 'bulge', shape: k, i }, { shape: k, kind: 'e', i })}
              />
            </g>
          )
        })}
        {s.map((v, i) => {
          const on = sel && sel.shape === k && sel.kind === 'v' && sel.i === i
          return (
            <g key={`v${i}`} onPointerDown={(e) => begin(e, { kind: 'v', shape: k, i }, { shape: k, kind: 'v', i })} className="cursor-grab">
              <circle cx={v.x} cy={v.y} r={hr * 2.2} fill="transparent" />
              <circle cx={v.x} cy={v.y} r={hr} fill={on ? '#d93a3d' : '#fff'} stroke="#3a2410" strokeWidth={hr * 0.3} />
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="flex flex-col gap-5 text-sm">
        <fieldset>
          <legend className="text-[11px] uppercase tracking-widest text-[#3a2410]/60">Börja från</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              className={`${btn} border-[#b5713a] bg-[#b5713a]/15 ${drawing?.target === 'outline' ? '!border-[#d93a3d] !text-[#d93a3d]' : ''}`}
              onClick={() => (drawing?.target === 'outline' ? stopDrawing() : startDrawing('outline'))}
            >
              ✎ Rita själv
            </button>
            {OUTLINE_PRESETS.map((p) => (
              <button
                key={p.name}
                className={`${btn} ${pendingShape === p.name ? '!border-[#d93a3d] !text-[#d93a3d]' : ''}`}
                onClick={() => {
                  // switching shape drops the cut-outs: ask with a second click instead of confirm()
                  if (piece.holes.length && pendingShape !== p.name) return setPendingShape(p.name)
                  onChange({ ...piece, outline: p.shape(), holes: [] })
                  setPendingShape(null)
                  setSel(null)
                }}
              >
                {pendingShape === p.name ? 'Urtagen försvinner – klicka igen' : p.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[11px] uppercase tracking-widest text-[#3a2410]/60">Ta ur</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              className={`${btn} ${drawing?.target === 'hole' ? '!border-[#d93a3d] !text-[#d93a3d]' : ''}`}
              onClick={() => (drawing?.target === 'hole' ? stopDrawing() : startDrawing('hole'))}
            >
              ✎ Rita urtag
            </button>
            {HOLE_PRESETS.map((p) => (
              <button
                key={p.name}
                className={btn}
                onClick={() => {
                  onChange({ ...piece, holes: [...piece.holes, p.shape(Math.round(cx * 2) / 2, Math.round(cy * 2) / 2)] })
                  setSel({ shape: piece.holes.length, kind: 'hole' })
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="border-t border-[#3a2410]/15 pt-4">
          {drawing && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-[#d93a3d]">{drawing.target === 'outline' ? 'Ritar ny form' : 'Ritar urtag'}</p>
              <p className="text-[13px] leading-relaxed text-[#3a2410]/75">
                Klicka i rutnätet för att sätta ut hörnen. Klicka på första punkten igen, dubbelklicka eller tryck Enter för att stänga formen. Bågar gör du sedan med ruterna mitt på kanterna.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button className={`${btn} border-[#3a2410] bg-[#3a2410] text-[#fbf3e4]`} disabled={drawing.pts.length < 3} onClick={finishDrawing}>
                  Klar
                </button>
                <button className={btn} disabled={!drawing.pts.length} onClick={() => setDrawing({ ...drawing, pts: drawing.pts.slice(0, -1) })}>
                  Ångra punkt
                </button>
                <button className={btn} onClick={stopDrawing}>
                  Avbryt
                </button>
              </div>
            </div>
          )}
          {!drawing && !sel && <p className="text-[13px] leading-relaxed text-[#3a2410]/65">Dra i hörnen. Dra i ruterna mitt på kanterna för att böja dem till bågar. Dubbelklicka på en kant för ett nytt hörn. Dra i ett urtag för att flytta det.</p>}
          {sel?.kind === 'v' && vertex && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-[#3a2410]/60">Hörn</p>
              <div className="flex gap-3">
                {(['x', 'y'] as const).map((ax) => (
                  <label key={ax} className="flex items-center gap-1.5">
                    {ax}
                    <input
                      type="number"
                      step={0.5}
                      value={vertex[ax]}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!Number.isNaN(v)) setShape(sel.shape, selected!.map((p, j) => (j === sel.i ? { ...p, [ax]: v } : p)))
                      }}
                      className="w-16 rounded border border-[#3a2410]/20 bg-white/60 px-1.5 py-0.5 text-right"
                    />
                    cm
                  </label>
                ))}
              </div>
              <button className={btn} onClick={deleteSelected} disabled={selected!.length <= 3}>
                Ta bort hörnet
              </button>
            </div>
          )}
          {sel?.kind === 'e' && selected && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-[#3a2410]/60">Kant</p>
              <label className="block">
                Böj
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.05}
                  value={selected[sel.i].b ?? 0}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setShape(sel.shape, selected.map((p, j) => (j === sel.i ? { ...p, b: Math.abs(v) < 0.03 ? undefined : v } : p)))
                  }}
                  className="dough-range mt-1 w-full"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button className={btn} onClick={() => setShape(sel.shape, splitEdge(selected, sel.i))}>
                  Nytt hörn
                </button>
                <button className={btn} onClick={() => setShape(sel.shape, selected.map((p, j) => (j === sel.i ? { ...p, b: undefined } : p)))}>
                  Gör rak
                </button>
              </div>
            </div>
          )}
          {sel?.kind === 'hole' && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-[#3a2410]/60">Urtag</p>
              <button className={btn} onClick={deleteSelected}>
                Ta bort urtaget
              </button>
            </div>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="h-4 w-4 accent-[#d93a3d]" />
          Fäst mot rutnätet (½ cm)
        </label>
      </div>

      <div className="min-w-0">
        <div className="overflow-hidden rounded-2xl bg-white/50 ring-1 ring-[#3a2410]/10">
          <svg
            ref={svg}
            viewBox={viewBox}
            className={`block aspect-[4/3] w-full touch-none select-none ${drawing ? 'cursor-crosshair' : ''}`}
            onPointerMove={(e) => {
              if (!drawing) return move(e)
              const p = toCm(e)
              setHover({ x: snapV(p.x), y: snapV(p.y) })
            }}
            onPointerLeave={() => drawing && setHover(null)}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerDown={(e) => (drawing ? addPoint(e) : setSel(null))}
            onDoubleClick={() => {
              if (drawing) return finishDrawing()
              if (sel?.kind === 'e') setShape(sel.shape, splitEdge(shapeAt(sel.shape), sel.i))
            }}
            role="img"
            aria-label={`Ritbord för ${piece.name}`}
          >
            <defs>
              <pattern id="cad-grid" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M1 0V5M2 0V5M3 0V5M4 0V5M0 1H5M0 2H5M0 3H5M0 4H5" stroke="#3a2410" strokeOpacity="0.08" strokeWidth="0.03" />
                <path d="M0 0V5M0 0H5" stroke="#3a2410" strokeOpacity="0.2" strokeWidth="0.05" />
              </pattern>
            </defs>
            <rect x={-200} y={-200} width={400} height={400} fill="url(#cad-grid)" />
            <path
              d={pathOf(piece.outline)}
              fill="#b5713a"
              fillOpacity={drawing?.target === 'outline' ? 0.15 : 0.85}
              stroke="#3a2410"
              strokeOpacity={drawing?.target === 'outline' ? 0.3 : 1}
              strokeWidth={0.06 * scale}
              strokeLinejoin="round"
            />
            {piece.holes.map((h, k) => (
              <path
                key={k}
                d={pathOf(h)}
                fill={sel && sel.shape === k ? '#ffe2a8' : '#fbf3e4'}
                stroke="#3a2410"
                strokeWidth={0.05 * scale}
                strokeDasharray={`${0.25 * scale} ${0.15 * scale}`}
                className="cursor-move"
                onPointerDown={(e) => {
                  const p = toCm(e)
                  begin(e, { kind: 'move', shape: k, x: p.x, y: p.y, start: h }, { shape: k, kind: 'hole' })
                }}
              />
            ))}
            {!drawing && handles(-1)}
            {!drawing && sel && sel.shape >= 0 && piece.holes[sel.shape] && handles(sel.shape)}

            {/* the shape being drawn, with a rubber band to the pointer */}
            {drawing && (
              <g pointerEvents="none">
                {drawing.pts.length > 0 && (
                  <polyline
                    points={[...drawing.pts, ...(hover ? [hover] : [])].map((q) => `${q.x},${q.y}`).join(' ')}
                    fill={drawing.target === 'outline' ? '#b5713a' : '#fbf3e4'}
                    fillOpacity={drawing.pts.length >= 2 ? 0.35 : 0}
                    stroke="#3a2410"
                    strokeWidth={0.07 * scale}
                    strokeDasharray={drawing.target === 'hole' ? `${0.25 * scale} ${0.15 * scale}` : undefined}
                    strokeLinejoin="round"
                  />
                )}
                {drawing.pts.map((q, i) => (
                  <circle
                    key={i}
                    cx={q.x}
                    cy={q.y}
                    r={i === 0 && drawing.pts.length >= 3 ? hr * 1.6 : hr}
                    fill={i === 0 && drawing.pts.length >= 3 ? '#d93a3d' : '#fff'}
                    stroke="#3a2410"
                    strokeWidth={hr * 0.3}
                  />
                ))}
                {hover && <circle cx={hover.x} cy={hover.y} r={hr * 0.7} fill="#d93a3d" fillOpacity="0.6" />}
              </g>
            )}
          </svg>
        </div>
        <p className="mt-2 text-center text-xs text-[#3a2410]/55">
          {drawing
            ? hover
              ? `${sv(hover.x)}, ${sv(hover.y)} cm · ${drawing.pts.length} hörn · rutor om 1 cm`
              : `${drawing.pts.length} hörn · rutor om 1 cm`
            : `${sv(b.x1 - b.x0)} × ${sv(b.y1 - b.y0)} cm · ${sv(shapeArea(piece.outline), 0)} cm² · rutor om 1 cm`}
        </p>
      </div>
    </div>
  )
}
