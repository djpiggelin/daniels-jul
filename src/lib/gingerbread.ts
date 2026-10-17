// Geometry for Pepparkaksarkitekten: turns a few measurements into flat
// template pieces (cm, y pointing down) and places each piece in 3D so the
// same shapes drive both the printable templates and the live preview.

import { bounds, toPolyline, type Shape } from './shapes'

export type HouseType = 'sadel' | 'platt' | 'torn' | 'rund'

export type HouseParams = {
  type: HouseType
  /** cm, along the long walls */
  width: number
  /** cm, along the gables */
  depth: number
  /** cm, wall height up to the eaves */
  height: number
  /** degrees */
  pitch: number
  chimney: boolean
  door: boolean
  /** windows per long wall */
  windows: number
  gableWindow: boolean
  /** facets of the round tower */
  sides?: number
}

export const DEFAULT_PARAMS: HouseParams = {
  type: 'sadel',
  width: 18,
  depth: 12,
  height: 10,
  pitch: 45,
  chimney: true,
  door: true,
  windows: 2,
  gableWindow: false,
  sides: 8,
}

export const HOUSE_TYPES: { type: HouseType; name: string; text: string }[] = [
  { type: 'sadel', name: 'Sadeltak', text: 'Det klassiska huset med två takfall.' },
  { type: 'platt', name: 'Platt tak med takkupa', text: 'Ett platt hus med en liten kupa på taket.' },
  { type: 'torn', name: 'Torn', text: 'Högt och smalt med spetsigt tältak.' },
  { type: 'rund', name: 'Runt torn', text: 'Ett runt torn av smala väggbitar med kontak – rundare ju fler sidor.' },
]

export type Pt = [number, number]
export type V3 = [number, number, number]

export type Piece = {
  id: string
  name: string
  count: number
  w: number
  h: number
  outline: Pt[]
  cutouts: { kind: 'door' | 'window'; pts: Pt[] }[]
  note?: string
  roof?: boolean
}

/** A piece standing in the house: piece point (p, q) lands at origin + p·u + q·v. */
export type Face = {
  piece: string
  origin: V3
  u: V3
  v: V3
  /** The piece is seen from behind here (a mirrored copy of the template). */
  mirror?: boolean
  /** Drawn after the main body – chimneys and dormers sit on top of the roof. */
  attached?: boolean
  /** Visible from both sides (free-standing pieces). */
  double?: boolean
  /** Faces of one building are depth-sorted together. */
  group?: string
}

export type Design = { pieces: Piece[]; faces: Face[] }

const rad = (d: number) => (d * Math.PI) / 180
const r1 = (n: number) => Math.round(n * 10) / 10
const rect = (w: number, h: number): Pt[] => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
]
const gableShape = (span: number, rise: number, h: number): Pt[] => [
  [0, rise],
  [span / 2, 0],
  [span, rise],
  [span, rise + h],
  [0, rise + h],
]

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/* ---------- openings ---------- */

function windowAt(cx: number, cy: number, s: number): Pt[] {
  // small arched window
  const pts: Pt[] = [
    [cx - s / 2, cy + s / 2],
    [cx + s / 2, cy + s / 2],
    [cx + s / 2, cy - s / 4],
  ]
  for (let i = 1; i < 8; i++) {
    const a = (i / 8) * Math.PI
    pts.push([cx + Math.cos(a) * (s / 2), cy - s / 4 - Math.sin(a) * (s / 2) * 0.7])
  }
  pts.push([cx - s / 2, cy - s / 4])
  return pts.map(([x, y]) => [r1(x), r1(y)])
}

function doorAt(cx: number, bottom: number, w: number, h: number): Pt[] {
  const top = bottom - h + w / 2
  const pts: Pt[] = [
    [cx - w / 2, bottom],
    [cx + w / 2, bottom],
    [cx + w / 2, top],
  ]
  for (let i = 1; i < 10; i++) {
    const a = (i / 10) * Math.PI
    pts.push([cx + Math.cos(a) * (w / 2), top - Math.sin(a) * (w / 2)])
  }
  pts.push([cx - w / 2, top])
  return pts.map(([x, y]) => [r1(x), r1(y)])
}

/** Door and windows spread along a wall of width w and height h (top at y0). */
function wallOpenings(w: number, h: number, windows: number, door: boolean, y0 = 0): Piece['cutouts'] {
  const out: Piece['cutouts'] = []
  const slots = windows + (door ? 1 : 0)
  if (!slots) return out
  const slot = w / slots
  const doorSlot = door ? Math.floor(slots / 2) : -1
  const win = Math.min(slot * 0.5, h * 0.32, 4.5)
  for (let i = 0; i < slots; i++) {
    const cx = slot * (i + 0.5)
    if (i === doorSlot) {
      const dw = Math.min(Math.max(w * 0.18, 2.5), slot * 0.7, 5)
      const dh = Math.min(h * 0.6, h - 1.5, dw * 2.2)
      if (dw >= 1.5 && dh >= 2.5) out.push({ kind: 'door', pts: doorAt(cx, y0 + h, dw, dh) })
    } else if (win >= 1.2) {
      out.push({ kind: 'window', pts: windowAt(cx, y0 + h * 0.42, win) })
    }
  }
  return out
}

/* ---------- local frame helpers ---------- */

/** Rotate a block built with its ridge along x so the ridge runs along z instead (front gable faces the viewer). */
function ridgeAlongZ(faces: Face[], x0: number, z0: number, len: number): Face[] {
  const lin = (p: V3): V3 => [p[2], p[1], -p[0]]
  return faces.map((f) => ({ ...f, origin: add([x0, 0, z0 + len], lin([f.origin[0], f.origin[1], f.origin[2]])), u: lin(f.u), v: lin(f.v) }))
}

/** Faces of a gabled block in its own frame: x ∈ [0, len] along the ridge, z ∈ [0, span], walls from y0 to y0 + h. */
function gabledFaces(ids: { front: string; back: string; gable: string; roof: string }, len: number, span: number, h: number, pitch: number, over: number, y0: number, attached = false): Face[] {
  const a = rad(pitch)
  const rise = (span / 2) * Math.tan(a)
  const top = y0 + h + rise
  return [
    { piece: ids.front, origin: [0, y0 + h, span], u: [1, 0, 0], v: [0, -1, 0], attached },
    { piece: ids.back, origin: [len, y0 + h, 0], u: [-1, 0, 0], v: [0, -1, 0], attached },
    { piece: ids.gable, origin: [len, top, span], u: [0, 0, -1], v: [0, -1, 0], attached },
    { piece: ids.gable, origin: [0, top, 0], u: [0, 0, 1], v: [0, -1, 0], attached },
    { piece: ids.roof, origin: [-over, top, span / 2], u: [1, 0, 0], v: [0, -Math.sin(a), Math.cos(a)], attached },
    { piece: ids.roof, origin: [len + over, top, span / 2], u: [-1, 0, 0], v: [0, -Math.sin(a), -Math.cos(a)], attached },
  ]
}

/** Four walls of a hollow box chimney, each `hTop` above the roof line ending at y = top. */
function chimneyPieces(prefix: string, cw: number, cd: number, hFront: number, hBack: number): Piece[] {
  if (Math.abs(hFront - hBack) < 0.05) {
    return [
      { id: `${prefix}-a`, name: 'Skorsten, fram/bak', count: 2, w: cw, h: r1(hFront), outline: rect(cw, r1(hFront)), cutouts: [] },
      { id: `${prefix}-b`, name: 'Skorsten, sida', count: 2, w: cd, h: r1(hFront), outline: rect(cd, r1(hFront)), cutouts: [] },
    ]
  }
  return [
    { id: `${prefix}-fram`, name: 'Skorsten, fram', count: 1, w: cw, h: r1(hFront), outline: rect(cw, r1(hFront)), cutouts: [] },
    { id: `${prefix}-bak`, name: 'Skorsten, bak', count: 1, w: cw, h: r1(hBack), outline: rect(cw, r1(hBack)), cutouts: [] },
    {
      id: `${prefix}-sida`,
      name: 'Skorsten, sida',
      count: 2,
      w: cd,
      h: r1(Math.max(hFront, hBack)),
      outline: [
        [0, 0],
        [cd, 0],
        [cd, r1(hBack)],
        [0, r1(hFront)],
      ],
      cutouts: [],
      note: 'vänd mallen för den andra',
    },
  ]
}

/* ---------- the three house types ---------- */

export function buildDesign(p: HouseParams): Design {
  if (p.type === 'rund') return roundTower(p)
  if (p.type === 'torn') return tower(p)
  if (p.type === 'platt') return flat(p)
  return saddle(p)
}

function saddle(p: HouseParams): Design {
  const { width: W, depth: D, height: H, pitch } = p
  const a = rad(pitch)
  const over = 1
  const rise = r1((D / 2) * Math.tan(a))
  const slope = (D / 2) / Math.cos(a)
  const frontCut = wallOpenings(W, H, p.windows, p.door)
  const backCut = wallOpenings(W, H, p.windows, false)
  const sameWalls = !p.door
  const gableCut: Piece['cutouts'] = p.gableWindow && rise > 3 ? [{ kind: 'window', pts: windowAt(D / 2, rise * 0.62, Math.min(rise * 0.4, D * 0.25, 3.5)) }] : []

  const pieces: Piece[] = [
    { id: 'gavel', name: 'Gavel', count: 2, w: D, h: r1(rise + H), outline: gableShape(D, rise, H), cutouts: gableCut, note: `taklutning ${pitch}°` },
    sameWalls
      ? { id: 'langvagg', name: 'Långvägg', count: 2, w: W, h: H, outline: rect(W, H), cutouts: frontCut }
      : { id: 'langvagg-fram', name: 'Långvägg, fram', count: 1, w: W, h: H, outline: rect(W, H), cutouts: frontCut },
    ...(sameWalls ? [] : [{ id: 'langvagg-bak', name: 'Långvägg, bak', count: 1, w: W, h: H, outline: rect(W, H), cutouts: backCut } as Piece]),
    { id: 'tak', name: 'Takhalva', count: 2, w: r1(W + 2 * over), h: r1(slope + over), outline: rect(r1(W + 2 * over), r1(slope + over)), cutouts: [], roof: true },
  ]
  const faces = gabledFaces({ front: sameWalls ? 'langvagg' : 'langvagg-fram', back: sameWalls ? 'langvagg' : 'langvagg-bak', gable: 'gavel', roof: 'tak' }, W, D, H, pitch, over, 0)

  if (p.chimney) {
    const cw = 3,
      cd = 3
    const xc = W * 0.7 - cw / 2
    const zBack = D / 2 + (D / 2) * 0.25
    const zFront = zBack + cd
    const roofY = (z: number) => H + rise - (z - D / 2) * Math.tan(a)
    const top = Math.max(H + rise + 1.5, roofY(zBack) + 2.5)
    const hBack = top - roofY(zBack)
    const hFront = top - roofY(zFront)
    const cp = chimneyPieces('skorsten', cw, cd, hFront, hBack)
    pieces.push(...cp)
    const [fr, bk, sd] = cp.length === 2 ? [cp[0].id, cp[0].id, cp[1].id] : [cp[0].id, cp[1].id, cp[2].id]
    faces.push(
      { piece: fr, origin: [xc, top, zFront], u: [1, 0, 0], v: [0, -1, 0], attached: true },
      { piece: bk, origin: [xc + cw, top, zBack], u: [-1, 0, 0], v: [0, -1, 0], attached: true },
      { piece: sd, origin: [xc + cw, top, zFront], u: [0, 0, -1], v: [0, -1, 0], attached: true },
      { piece: sd, origin: [xc, top, zFront], u: [0, 0, -1], v: [0, -1, 0], attached: true, mirror: true },
    )
  }
  return { pieces, faces }
}

function flat(p: HouseParams): Design {
  const { width: W, depth: D, height: H, pitch } = p
  const over = 1
  const frontCut = wallOpenings(W, H, p.windows, p.door)
  const backCut = wallOpenings(W, H, p.windows, false)
  const sameWalls = !p.door
  const gableCut: Piece['cutouts'] = p.gableWindow ? wallOpenings(D, H, 1, false) : []

  const pieces: Piece[] = [
    sameWalls
      ? { id: 'langvagg', name: 'Långvägg', count: 2, w: W, h: H, outline: rect(W, H), cutouts: frontCut }
      : { id: 'langvagg-fram', name: 'Långvägg, fram', count: 1, w: W, h: H, outline: rect(W, H), cutouts: frontCut },
    ...(sameWalls ? [] : [{ id: 'langvagg-bak', name: 'Långvägg, bak', count: 1, w: W, h: H, outline: rect(W, H), cutouts: backCut } as Piece]),
    { id: 'kortvagg', name: 'Kortvägg', count: 2, w: D, h: H, outline: rect(D, H), cutouts: gableCut },
    { id: 'tak', name: 'Tak', count: 1, w: W + 2 * over, h: D + 2 * over, outline: rect(W + 2 * over, D + 2 * over), cutouts: [], roof: true },
  ]
  const front = sameWalls ? 'langvagg' : 'langvagg-fram'
  const back = sameWalls ? 'langvagg' : 'langvagg-bak'
  const faces: Face[] = [
    { piece: front, origin: [0, H, D], u: [1, 0, 0], v: [0, -1, 0] },
    { piece: back, origin: [W, H, 0], u: [-1, 0, 0], v: [0, -1, 0] },
    { piece: 'kortvagg', origin: [W, H, D], u: [0, 0, -1], v: [0, -1, 0] },
    { piece: 'kortvagg', origin: [0, H, 0], u: [0, 0, 1], v: [0, -1, 0] },
    { piece: 'tak', origin: [-over, H, -over], u: [1, 0, 0], v: [0, 0, 1] },
  ]

  // the takkupa: a little gabled house on the roof, its gable facing front
  const dw = r1(Math.max(4, Math.min(W * 0.4, 10)))
  const dd = r1(Math.max(3, Math.min(D * 0.45, 8)))
  const dh = r1(Math.max(2, Math.min(H * 0.4, 5)))
  const da = rad(pitch)
  const drise = r1((dw / 2) * Math.tan(da))
  const dslope = (dw / 2) / Math.cos(da)
  const dover = 0.5
  const kupaCut: Piece['cutouts'] = dh >= 2.5 ? [{ kind: 'window', pts: windowAt(dw / 2, drise + dh * 0.5, Math.min(dw * 0.4, dh * 0.6, 3)) }] : []
  pieces.push(
    { id: 'kupa-gavel', name: 'Takkupa, gavel', count: 2, w: dw, h: r1(drise + dh), outline: gableShape(dw, drise, dh), cutouts: kupaCut, note: `taklutning ${pitch}°` },
    { id: 'kupa-sida', name: 'Takkupa, sida', count: 2, w: dd, h: dh, outline: rect(dd, dh), cutouts: [] },
    { id: 'kupa-tak', name: 'Takkupa, takhalva', count: 2, w: r1(dd + 2 * dover), h: r1(dslope + dover), outline: rect(r1(dd + 2 * dover), r1(dslope + dover)), cutouts: [], roof: true },
  )
  const x0 = (W - dw) / 2
  const z0 = D * 0.25
  faces.push(...ridgeAlongZ(gabledFaces({ front: 'kupa-sida', back: 'kupa-sida', gable: 'kupa-gavel', roof: 'kupa-tak' }, dd, dw, dh, pitch, dover, H, true), x0, z0, dd))

  if (p.chimney) {
    const c = 3
    const hc = 4
    pieces.push({ id: 'skorsten', name: 'Skorsten', count: 4, w: c, h: hc, outline: rect(c, hc), cutouts: [] })
    const xc = W * 0.8 - c / 2,
      zc = D * 0.3,
      top = H + hc
    faces.push(
      { piece: 'skorsten', origin: [xc, top, zc + c], u: [1, 0, 0], v: [0, -1, 0], attached: true },
      { piece: 'skorsten', origin: [xc + c, top, zc], u: [-1, 0, 0], v: [0, -1, 0], attached: true },
      { piece: 'skorsten', origin: [xc + c, top, zc + c], u: [0, 0, -1], v: [0, -1, 0], attached: true },
      { piece: 'skorsten', origin: [xc, top, zc], u: [0, 0, 1], v: [0, -1, 0], attached: true },
    )
  }
  return { pieces, faces }
}

function tower(p: HouseParams): Design {
  const { width: W, depth: D, height: H, pitch } = p
  const rise = (Math.min(W, D) / 2) * Math.tan(rad(pitch))
  const slantW = r1(Math.hypot(rise, D / 2)) // height of the triangles over the W sides
  const slantD = r1(Math.hypot(rise, W / 2))
  const square = Math.abs(W - D) < 0.05
  const frontCut = wallOpenings(W, H, Math.min(p.windows, 2), p.door)
  const sideCut = p.gableWindow ? wallOpenings(D, H, 1, false) : []
  const backCut = wallOpenings(W, H, Math.min(p.windows, 2), false)
  const tri = (b: number, s: number): Pt[] => [
    [0, s],
    [b / 2, 0],
    [b, s],
  ]
  const pieces: Piece[] = [
    { id: 'torn-fram', name: 'Tornvägg, fram', count: 1, w: W, h: H, outline: rect(W, H), cutouts: frontCut },
    { id: 'torn-bak', name: 'Tornvägg, bak', count: 1, w: W, h: H, outline: rect(W, H), cutouts: backCut },
    { id: 'torn-sida', name: 'Tornvägg, sida', count: 2, w: D, h: H, outline: rect(D, H), cutouts: sideCut },
    square
      ? { id: 'spira', name: 'Tornspira', count: 4, w: W, h: slantW, outline: tri(W, slantW), cutouts: [], roof: true }
      : { id: 'spira', name: 'Tornspira, bred', count: 2, w: W, h: slantW, outline: tri(W, slantW), cutouts: [], roof: true },
    ...(square ? [] : [{ id: 'spira-smal', name: 'Tornspira, smal', count: 2, w: D, h: slantD, outline: tri(D, slantD), cutouts: [], roof: true } as Piece]),
  ]
  const apex: V3 = [W / 2, H + rise, D / 2]
  const unit = (v: V3): V3 => scale(v, 1 / Math.hypot(...v))
  const narrow = square ? 'spira' : 'spira-smal'
  const faces: Face[] = [
    { piece: 'torn-fram', origin: [0, H, D], u: [1, 0, 0], v: [0, -1, 0] },
    { piece: 'torn-bak', origin: [W, H, 0], u: [-1, 0, 0], v: [0, -1, 0] },
    { piece: 'torn-sida', origin: [W, H, D], u: [0, 0, -1], v: [0, -1, 0] },
    { piece: 'torn-sida', origin: [0, H, 0], u: [0, 0, 1], v: [0, -1, 0] },
    { piece: 'spira', origin: add(apex, [-W / 2, 0, 0]), u: [1, 0, 0], v: unit([0, -rise, D / 2]) },
    { piece: 'spira', origin: add(apex, [W / 2, 0, 0]), u: [-1, 0, 0], v: unit([0, -rise, -D / 2]) },
    { piece: narrow, origin: add(apex, [0, 0, D / 2]), u: [0, 0, -1], v: unit([W / 2, -rise, 0]) },
    { piece: narrow, origin: add(apex, [0, 0, -D / 2]), u: [0, 0, 1], v: unit([-W / 2, -rise, 0]) },
  ]
  return { pieces, faces }
}

function roundTower(p: HouseParams): Design {
  const n = Math.max(5, Math.min(16, Math.round(p.sides ?? 8)))
  const R = p.width / 2
  const H = p.height
  const fw = r1(2 * R * Math.sin(Math.PI / n))
  const apo = R * Math.cos(Math.PI / n)
  const rise = apo * Math.tan(rad(p.pitch))
  const slant = r1(Math.hypot(rise, apo))
  const k = Math.min(p.windows, n - (p.door ? 1 : 0))
  const winAt = new Set(Array.from({ length: k }, (_, j) => Math.round((n * (j + 1)) / (k + 1)) % n))
  if (p.door) winAt.delete(0)
  const plain = n - winAt.size - (p.door ? 1 : 0)
  const pieces: Piece[] = []
  if (p.door) pieces.push({ id: 'rund-dorr', name: 'Tornvägg med dörr', count: 1, w: fw, h: H, outline: rect(fw, H), cutouts: wallOpenings(fw, H, 0, true) })
  if (winAt.size) pieces.push({ id: 'rund-fonster', name: 'Tornvägg med fönster', count: winAt.size, w: fw, h: H, outline: rect(fw, H), cutouts: wallOpenings(fw, H, 1, false) })
  if (plain) pieces.push({ id: 'rund-vagg', name: 'Tornvägg', count: plain, w: fw, h: H, outline: rect(fw, H), cutouts: [] })
  pieces.push({
    id: 'rund-tak',
    name: 'Kontak, bit',
    count: n,
    w: fw,
    h: slant,
    outline: [
      [0, slant],
      [fw / 2, 0],
      [fw, slant],
    ],
    cutouts: [],
    roof: true,
    note: `${n} sidor`,
  })
  const apex: V3 = [R, H + rise, R]
  const faces: Face[] = []
  for (let i = 0; i < n; i++) {
    const phi = (i * 2 * Math.PI) / n
    const dir: V3 = [Math.sin(phi), 0, Math.cos(phi)]
    const u: V3 = [Math.cos(phi), 0, -Math.sin(phi)]
    const mid: V3 = [R + dir[0] * apo, H, R + dir[2] * apo]
    const id = p.door && i === 0 ? 'rund-dorr' : winAt.has(i) ? 'rund-fonster' : 'rund-vagg'
    faces.push({ piece: id, origin: add(mid, scale(u, -fw / 2)), u, v: [0, -1, 0] })
    const down: V3 = [mid[0] - apex[0], mid[1] - apex[1], mid[2] - apex[2]]
    faces.push({ piece: 'rund-tak', origin: add(apex, scale(u, -fw / 2)), u, v: scale(down, 1 / Math.hypot(...down)) })
  }
  return { pieces, faces }
}

/* ---------- the whole cake board ---------- */

export type Building = { id: string; name: string; params: HouseParams; x: number; z: number; rot: number }

export type CustomPiece = {
  id: string
  name: string
  count: number
  outline: Shape
  holes: Shape[]
  /** Where it stands on the board in the preview; null keeps it off the board. */
  place: { x: number; z: number; y: number; yaw: number; flat: boolean } | null
}

/** Footprint centre of a building in its own coordinates. */
const footprint = (p: HouseParams) => [p.width / 2, p.type === 'rund' ? p.width / 2 : p.depth / 2]

/** A custom piece as a template piece: arcs sampled, moved so its corner sits at 0, 0. */
export function customToPiece(c: CustomPiece): Piece {
  const outline = toPolyline(c.outline)
  const b = bounds(outline)
  const shift = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [Math.round((x - b.x0) * 100) / 100, Math.round((y - b.y0) * 100) / 100])
  return {
    id: c.id,
    name: c.name || 'Egen bit',
    count: c.count,
    w: r1(b.x1 - b.x0),
    h: r1(b.y1 - b.y0),
    outline: shift(outline),
    cutouts: c.holes.map((h) => ({ kind: 'window' as const, pts: shift(toPolyline(h)) })),
  }
}

/** Every building and free piece on the board, with ids prefixed per building. */
export function buildBoard(buildings: Building[], custom: CustomPiece[]): Design & { owner: Record<string, string> } {
  const pieces: Piece[] = []
  const faces: Face[] = []
  const owner: Record<string, string> = {}
  const many = buildings.length > 1
  for (const b of buildings) {
    const d = buildDesign(b.params)
    const [cx, cz] = footprint(b.params)
    const a = rad(b.rot)
    const R = (v: V3): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
    for (const pc of d.pieces) {
      const id = `${b.id}/${pc.id}`
      pieces.push({ ...pc, id, name: many ? `${b.name} · ${pc.name}` : pc.name })
      owner[id] = b.id
    }
    for (const f of d.faces) {
      faces.push({ ...f, piece: `${b.id}/${f.piece}`, origin: add(R([f.origin[0] - cx, f.origin[1], f.origin[2] - cz]), [b.x, 0, b.z]), u: R(f.u), v: R(f.v), group: b.id })
    }
  }
  for (const c of custom) {
    const pc = customToPiece(c)
    pieces.push(pc)
    owner[pc.id] = c.id
    if (!c.place || pc.w <= 0 || pc.h <= 0) continue
    const a = rad(c.place.yaw)
    const u: V3 = [Math.cos(a), 0, -Math.sin(a)]
    const { x, y, z } = c.place
    if (c.place.flat) {
      const v: V3 = [Math.sin(a), 0, Math.cos(a)]
      faces.push({ piece: pc.id, origin: add(add([x, y + 0.01, z], scale(u, -pc.w / 2)), scale(v, -pc.h / 2)), u, v, group: c.id })
    } else {
      faces.push({ piece: pc.id, origin: add([x, y + pc.h, z], scale(u, -pc.w / 2)), u, v: [0, -1, 0], double: true, group: c.id })
    }
  }
  return { pieces, faces, owner }
}

/* ---------- areas & dough ---------- */

export function polygonArea(pts: Pt[]) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

/** Net dough area in cm² – openings are cut out (and can be rolled again). */
export const pieceArea = (pc: Piece) => polygonArea(pc.outline) - pc.cutouts.reduce((s, c) => s + polygonArea(c.pts), 0)
export const totalArea = (pieces: Piece[]) => pieces.reduce((s, pc) => s + pieceArea(pc) * pc.count, 0)

/** Raw pepparkaksdeg weighs roughly 1.25 g per cm³. */
export const DOUGH_DENSITY = 1.25
/** Leftover strips, test bites and the odd broken wall. */
export const DOUGH_WASTE = 1.25
