// Free-form pieces for Pepparkaksarkitekten's drawing board. A shape is a
// closed list of vertices; each edge may bulge into a circular arc
// (b = tan(¼ of the arc's angle), positive = outwards, 1 = a half circle),
// so straight walls, arches, round windows and hearts share one format.

import type { Pt } from './gingerbread'

export type Vertex = { x: number; y: number; b?: number }
export type Shape = Vertex[]

const shoelace = (pts: { x: number; y: number }[]) => {
  let s = 0
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    s += p.x * q.y - q.x * p.y
  })
  return s / 2
}

/** Which way is "out" for this shape's edges. */
export const winding = (shape: Shape) => (shoelace(shape) < 0 ? -1 : 1)

/** The point halfway along an edge – on the arc when the edge bulges. */
export function edgeMid(shape: Shape, i: number) {
  const a = shape[i]
  const c = shape[(i + 1) % shape.length]
  const len = Math.hypot(c.x - a.x, c.y - a.y) || 1e-6
  const s = winding(shape)
  const nx = (s * (c.y - a.y)) / len
  const ny = (s * -(c.x - a.x)) / len
  const sag = ((a.b ?? 0) * len) / 2
  return { x: (a.x + c.x) / 2 + nx * sag, y: (a.y + c.y) / 2 + ny * sag, nx, ny, len }
}

/** Sample every arc into short straight segments. */
export function toPolyline(shape: Shape): Pt[] {
  const out: Pt[] = []
  const n = shape.length
  for (let i = 0; i < n; i++) {
    const a = shape[i]
    const c = shape[(i + 1) % n]
    out.push([a.x, a.y])
    const b = a.b ?? 0
    if (Math.abs(b) < 0.01) continue
    const { x: sx, y: sy, nx, ny, len } = edgeMid(shape, i)
    const sag = (b * len) / 2
    const r = (len * len) / 4 / (2 * sag) + sag / 2 // signed radius
    const cx = (a.x + c.x) / 2 + nx * (sag - r)
    const cy = (a.y + c.y) / 2 + ny * (sag - r)
    const a1 = Math.atan2(a.y - cy, a.x - cx)
    const a2 = Math.atan2(c.y - cy, c.x - cx)
    const aS = Math.atan2(sy - cy, sx - cx)
    let d = a2 - a1
    while (d <= 0) d += Math.PI * 2
    if (Math.cos(a1 + d / 2 - aS) < 0) d -= Math.PI * 2
    const R = Math.abs(r)
    const steps = Math.max(2, Math.ceil(Math.abs(d) / (Math.PI / 24)))
    for (let k = 1; k < steps; k++) {
      const t = a1 + (d * k) / steps
      out.push([cx + Math.cos(t) * R, cy + Math.sin(t) * R])
    }
  }
  return out.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])
}

/** Split an edge at its middle without changing the outline. */
export function splitEdge(shape: Shape, i: number): Shape {
  const m = edgeMid(shape, i)
  const half = Math.tan(Math.atan(shape[i].b ?? 0) / 2)
  const b = Math.abs(half) < 0.005 ? undefined : Math.round(half * 1000) / 1000
  const next = shape.slice()
  next[i] = { ...shape[i], b }
  next.splice(i + 1, 0, { x: Math.round(m.x * 100) / 100, y: Math.round(m.y * 100) / 100, b })
  return next
}

export const shapeArea = (shape: Shape) => Math.abs(shoelace(toPolyline(shape).map(([x, y]) => ({ x, y }))))

export function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

export const moveShape = (shape: Shape, dx: number, dy: number): Shape =>
  shape.map((v) => ({ ...v, x: Math.round((v.x + dx) * 100) / 100, y: Math.round((v.y + dy) * 100) / 100 }))

/* ---------- presets ---------- */

const Q = Math.tan(Math.PI / 8) // quarter circle bulge

const circle = (cx: number, cy: number, r: number): Shape => [
  { x: cx, y: cy - r, b: Q },
  { x: cx + r, y: cy, b: Q },
  { x: cx, y: cy + r, b: Q },
  { x: cx - r, y: cy, b: Q },
]

const star = (cx: number, cy: number, r: number, inner: number, n = 5): Shape =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const rr = i % 2 ? inner : r
    return { x: Math.round((cx + Math.cos(a) * rr) * 100) / 100, y: Math.round((cy + Math.sin(a) * rr) * 100) / 100 }
  })

export const OUTLINE_PRESETS: { name: string; shape: () => Shape }[] = [
  {
    name: 'Rektangel',
    shape: () => [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 8 },
      { x: 0, y: 8 },
    ],
  },
  {
    name: 'Gavel',
    shape: () => [
      { x: 0, y: 5 },
      { x: 6, y: 0 },
      { x: 12, y: 5 },
      { x: 12, y: 13 },
      { x: 0, y: 13 },
    ],
  },
  {
    name: 'Valv',
    shape: () => [
      { x: 0, y: 5, b: 1 },
      { x: 10, y: 5 },
      { x: 10, y: 14 },
      { x: 0, y: 14 },
    ],
  },
  { name: 'Cirkel', shape: () => circle(5, 5, 5) },
  {
    name: 'Hjärta',
    shape: () => [
      { x: 5, y: 9 },
      { x: 0.4, y: 3.6, b: 0.9 },
      { x: 5, y: 2.4, b: 0.9 },
      { x: 9.6, y: 3.6 },
    ],
  },
  { name: 'Stjärna', shape: () => star(5, 5, 5, 2.2) },
  {
    name: 'Gran',
    shape: () => [
      { x: 5, y: 0 },
      { x: 7.5, y: 4 },
      { x: 6.5, y: 4 },
      { x: 9, y: 8 },
      { x: 7.5, y: 8 },
      { x: 10, y: 12 },
      { x: 6, y: 12 },
      { x: 6, y: 14 },
      { x: 4, y: 14 },
      { x: 4, y: 12 },
      { x: 0, y: 12 },
      { x: 2.5, y: 8 },
      { x: 1, y: 8 },
      { x: 3.5, y: 4 },
      { x: 2.5, y: 4 },
    ],
  },
]

/** Openings, centred on (cx, cy). */
export const HOLE_PRESETS: { name: string; shape: (cx: number, cy: number) => Shape }[] = [
  {
    name: 'Fönster',
    shape: (cx, cy) => [
      { x: cx - 1.25, y: cy - 1.25 },
      { x: cx + 1.25, y: cy - 1.25 },
      { x: cx + 1.25, y: cy + 1.25 },
      { x: cx - 1.25, y: cy + 1.25 },
    ],
  },
  { name: 'Runt fönster', shape: (cx, cy) => circle(cx, cy, 1.2) },
  {
    name: 'Valvdörr',
    shape: (cx, cy) => [
      { x: cx - 1.5, y: cy - 1, b: 1 },
      { x: cx + 1.5, y: cy - 1 },
      { x: cx + 1.5, y: cy + 2.5 },
      { x: cx - 1.5, y: cy + 2.5 },
    ],
  },
  {
    name: 'Hjärta',
    shape: (cx, cy) =>
      [
        { x: 5, y: 9 },
        { x: 0.4, y: 3.6, b: 0.9 },
        { x: 5, y: 2.4, b: 0.9 },
        { x: 9.6, y: 3.6 },
      ].map((v) => ({ ...v, x: Math.round((cx + (v.x - 5) * 0.3) * 100) / 100, y: Math.round((cy + (v.y - 5.5) * 0.3) * 100) / 100 })),
  },
]
