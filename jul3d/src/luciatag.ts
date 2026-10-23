// The Lucia concert: on Lucia morning the whole village walks in procession – the choir and some sixty
// villagers in white gowns, each with a candle – in from the south of the square, round the big tree
// and up the path to Leksaksfabriken, where they stand in rising rows before the arch, like a church
// choir: Lucia in front, tärnor with red sashes round her, star boys with their tall cones at the
// sides and at the back.
//
// It follows the music, as a real one does: they walk in to one song, and as the concert begins Lucia
// herself comes in, alone, up through the yard with her crown alight. They end with Sankta Lucia: in
// its last verse they blow out their candles column by column and fall silent, Lucia last. In the dark they file in through the arch; the village's lights come back, and a few minutes
// later a new procession sets off. The program runs on the clock, so everyone sees the same moment.
//
// The villagers are instanced (a dozen draw calls for all of them); the choir's toons walk along too.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Toon } from './toons'

/* ---------- the program ---------- */

/** The songs, in order, with their lengths (s) – the first is the one they walk in to. */
export const PROGRAM = [
  { song: 'o-come-all-ye-faithful', length: 192.5 },
  { song: 'stilla-natt', length: 192.8 },
  { song: 'o-little-town-of-bethlehem', length: 70.4 },
  { song: 'hark-the-herald-angels-sing', length: 114.6 },
  { song: 'sankta-lucia', length: 202.5 },
]
/** A breath between songs, the walk out in the dark, and the wait before the next procession (s). */
const GAP = 1.5
const EXIT = 80
// (counted from when the last of them is in place – the choir at the table sits down a minute before)
const PAUSE = 200
/** After the fika they walk back out (lights still on) and line up for the next procession (s). */
const WALK_BACK = 300
const starts: number[] = []
let clock = 0
for (const p of PROGRAM) {
  starts.push(clock)
  clock += p.length + GAP
}
const SONGS_END = clock - GAP
const LAST = PROGRAM.length - 1
/** The whole go round (s). */
const FIKA_END = SONGS_END + EXIT + PAUSE
export const CYCLE = FIKA_END + WALK_BACK

/** What is playing `t` seconds into the cycle, and how far into it. */
export function programAt(t: number) {
  for (let i = 0; i < PROGRAM.length; i++) if (t >= starts[i] && t < starts[i] + PROGRAM[i].length) return { song: PROGRAM[i].song, offset: t - starts[i] }
  return null
}

/** How dark the village should be: from the procession setting off until the last note. */
export function darknessAt(t: number) {
  // (the lights come back on as soon as the singing is over)
  return t < SONGS_END + 3 ? 1 : 0
}

/* ---------- the way in, and where they stand ---------- */

const SPACING = 0.9

/** The way in: from the south of the square, round the west side of the big tree, up the path to the yard. */
const MAIN: THREE.Vector3[] = [new THREE.Vector3(0, 0, 24), new THREE.Vector3(0, 0, 9.6)]
for (let i = 1; i <= 24; i++) {
  const a = Math.PI + (i / 24) * Math.PI
  MAIN.push(new THREE.Vector3(Math.sin(a) * 9.6, 0, -Math.cos(a) * 9.6))
}
MAIN.push(new THREE.Vector3(0, 0, -50))
/** Where they wait their turn before it: along the east of the square, behind the shops, to the start. */
const QUEUE: THREE.Vector3[] = []
for (let a = 60; a <= 165; a += 7.5) QUEUE.push(new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(a)) * 30.5, 0, -Math.cos(THREE.MathUtils.degToRad(a)) * 30.5))
QUEUE.push(MAIN[0].clone())
function pathOf(pts: THREE.Vector3[]) {
  const path = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]))
  return path
}
const QUEUE_LENGTH = pathOf(QUEUE).getLength()

/** Rising rows facing the yard (+z), before the arch at z = −68. */
const ROWS = [
  { z: -59.7, y: 0, n: 8 },
  { z: -60.9, y: 0.22, n: 12 },
  { z: -62.1, y: 0.44, n: 14 },
  { z: -63.3, y: 0.66, n: 16 },
  { z: -64.5, y: 0.88, n: 18 },
]
const LUCIA_AT = new THREE.Vector3(0, 0, -58.5)
/** Lucia comes in on her own, up the path through the yard, as the concert begins (with its second song). */
const LUCIA_SONG = 1
const LUCIA_FROM = new THREE.Vector3(0, 0, -44)
const LUCIA_WALK = 22
const ARCH = new THREE.Vector3(0, 0, -67)
/** The way back after the fika: out of the arch, down the path, round the tree and into the queue. */
const WAY_BACK = pathOf([ARCH, ...[...MAIN].reverse(), ...QUEUE.slice(0, -1).reverse()])
const WAY_BACK_LENGTH = WAY_BACK.getLength()
const BACK_TO_START = WAY_BACK_LENGTH - QUEUE_LENGTH

export type Walker = {
  girl: boolean
  /** Placed by hand (Lucia, the chipmunks, Pluto), otherwise given a spot in the rows. */
  spot?: THREE.Vector3
  tall?: boolean
  toon?: Toon
  /** Puts the toon's candle (and crown) out, or lights them again. */
  light?: (on: boolean) => void
  /** Index into the villagers' instances. */
  extra?: number
  /** When, into the cycle, this one blows out the candle. */
  out: number
  pos: THREE.Vector3
  yaw: number
  walking: boolean
  /** Having fika: a bun in the hands instead of a candle. */
  eating: boolean
  shown: boolean
  lit: boolean
  phase: number
}

const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

/** A lussebulle: a saffron-yellow S, curled up at both ends, a raisin in each curl. */
let bunGeo: THREE.BufferGeometry | null = null
let raisinGeo: THREE.BufferGeometry | null = null
export function lussebulle() {
  if (!bunGeo) {
    const curl = (x: number, flip: number) => {
      const g = new THREE.TorusGeometry(0.026, 0.017, 8, 14, Math.PI * 1.5)
      g.rotateX(Math.PI / 2)
      g.rotateY(flip)
      g.translate(x, 0.014, 0)
      return g
    }
    bunGeo = mergeGeometries([curl(-0.024, 0), curl(0.024, Math.PI)])!
    const r = (x: number) => new THREE.SphereGeometry(0.009, 6, 4).translate(x, 0.03, 0)
    raisinGeo = mergeGeometries([r(-0.024), r(0.024)])!
  }
  return { bun: bunGeo, raisins: raisinGeo! }
}
const bunMat = std(0xe8a12a, 0.6)
const raisinMat = std(0x2a1410, 0.5)
const cookieMat = std(0x9a5a2c, 0.75)
const plateMat = std(0xfbf8f2, 0.3)
let heartGeo: THREE.ExtrudeGeometry | null = null
function pepparkaka() {
  if (!heartGeo) {
    const h = new THREE.Shape()
    h.moveTo(0, -0.04)
    h.bezierCurveTo(-0.05, -0.005, -0.04, 0.035, 0, 0.018)
    h.bezierCurveTo(0.04, 0.035, 0.05, -0.005, 0, -0.04)
    heartGeo = new THREE.ExtrudeGeometry(h, { depth: 0.006, bevelEnabled: false, curveSegments: 6 })
    heartGeo.rotateX(-Math.PI / 2)
  }
  return new THREE.Mesh(heartGeo, cookieMat)
}

/** A plate heaped with lussebullar (and, if `cookies`, a few pepparkakshjärtan beside them). */
export function luciaTray(cookies = true) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.025, 20), plateMat).translateY(0.012))
  const { bun, raisins } = lussebulle()
  const spots = [[0, 0, 0], [0.11, 0, 0.06], [-0.11, 0, 0.05], [0.04, 0, -0.11], [-0.07, 0, -0.1], [0.12, 0, -0.07], [0.02, 0.035, 0.0], [-0.05, 0.035, -0.04]]
  spots.forEach(([x, y, z], i) => {
    const b = new THREE.Group()
    b.add(new THREE.Mesh(bun, bunMat), new THREE.Mesh(raisins, raisinMat))
    b.position.set(x, 0.025 + y, z)
    b.rotation.y = i * 1.3
    g.add(b)
  })
  if (cookies)
    for (let i = 0; i < 4; i++) {
      const c = pepparkaka()
      c.position.set(0.34 + (i % 2) * 0.09, 0.01 + Math.floor(i / 2) * 0.007, -0.05 + i * 0.04)
      c.rotation.y = i * 0.9
      g.add(c)
    }
  return g
}

export type LuciaToon = { toon: Toon; girl: boolean; lucia?: boolean; tall?: boolean; spot?: THREE.Vector3; light: (on: boolean) => void }

export function buildLuciaConcert(scene: THREE.Scene, toons: LuciaToon[], glowTex: THREE.Texture) {
  // the procession walks the queue and then the way in, all in one
  const path = pathOf([...QUEUE, ...MAIN.slice(1)])
  const length = path.getLength()
  const end = path.getPoint(1)
  const group = new THREE.Group()
  scene.add(group)

  /* ---------- the villagers, instanced ---------- */
  const GIRLS = 34
  const BOYS = 22
  const N = GIRLS + BOYS
  const parts = {
    gown: new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.2, 0.82, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.85, side: THREE.DoubleSide }), N),
    shoulders: new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 8), std(0xfbf8f2, 0.85), N),
    head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 14, 10), std(0xf1c7a5, 0.6), N),
    hair: new THREE.InstancedMesh(new THREE.SphereGeometry(0.108, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), std(0xffffff, 0.8), N),
    hands: new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), std(0xf1c7a5, 0.6), N * 2),
    candle: new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.016, 0.13, 8), std(0xfbf8f2, 0.5), N),
    flame: new THREE.InstancedMesh(new THREE.ConeGeometry(0.018, 0.065, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }), N),
    crown: new THREE.InstancedMesh(new THREE.TorusGeometry(0.1, 0.012, 6, 18), std(0xdfe3ea, 0.25, 0.8), GIRLS),
    sash: new THREE.InstancedMesh(new THREE.TorusGeometry(0.15, 0.022, 6, 18), std(0xc8102e, 0.5), GIRLS),
    strut: new THREE.InstancedMesh(new THREE.ConeGeometry(0.085, 0.36, 14), std(0xfbf8f2, 0.6), BOYS),
    bun: new THREE.InstancedMesh(lussebulle().bun, bunMat, N),
    eyes: new THREE.InstancedMesh(new THREE.SphereGeometry(0.013, 8, 6), std(0x1a1210, 0.3), N * 2),
    cheeks: new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 8, 6), std(0xe8908a, 0.7), N * 2),
    nose: new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), std(0xe8b090, 0.6), N),
    mouth: new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 10, 6), std(0x5a1a1c, 0.6), N),
    stars: new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.022), new THREE.MeshStandardMaterial({ color: 0xf6c453, roughness: 0.3, metalness: 0.7, emissive: 0x6a4a10, emissiveIntensity: 0.6 }), BOYS * 3),
  }
  const hairCols = [0xe8c77a, 0xd9b25e, 0x8a5a32, 0x5a3a22, 0xc9783a, 0x2a1d16, 0xf0d9a0].map((c) => new THREE.Color(c))
  for (let i = 0; i < N; i++) parts.hair.setColorAt(i, hairCols[(i * 5) % hairCols.length])
  for (const m of Object.values(parts)) {
    m.frustumCulled = false
    m.castShadow = false
    group.add(m)
  }
  // a glow round every lit candle: one cloud of sprites
  const glowPos = new Float32Array(N * 3)
  const glowGeo = new THREE.BufferGeometry()
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3))
  const glows = new THREE.Points(glowGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.95, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: 0xffc070 }))
  glows.frustumCulled = false
  group.add(glows)

  /* ---------- who walks where ---------- */
  // the order of the procession: Lucia, the tärnor, then the star boys (the small ones last)
  const lucia = toons.find((t) => t.lucia)!
  const walkers: Walker[] = []
  const add = (w: Pick<Walker, 'girl' | 'spot' | 'tall' | 'toon' | 'light' | 'extra'>) =>
    walkers.push({ ...w, out: 0, pos: new THREE.Vector3(), yaw: 0, walking: false, eating: false, shown: false, lit: true, phase: Math.random() * 10 })
  add({ girl: true, toon: lucia.toon, light: lucia.light, spot: LUCIA_AT.clone() })
  const toonGirls = toons.filter((t) => t.girl && !t.lucia)
  let g = 0
  for (let i = 0; i < GIRLS; i++) {
    add({ girl: true, extra: i })
    if (i % 12 === 5 && g < toonGirls.length) add({ girl: true, toon: toonGirls[g].toon, light: toonGirls[g++].light })
  }
  for (const t of toonGirls.slice(g)) add({ girl: true, toon: t.toon, light: t.light })
  const toonBoys = toons.filter((t) => !t.girl && !t.spot)
  let b = 0
  for (let i = 0; i < BOYS; i++) {
    add({ girl: false, extra: GIRLS + i })
    if (i % 3 === 1 && b < toonBoys.length) {
      const t = toonBoys[b++]
      add({ girl: false, toon: t.toon, tall: t.tall, light: t.light })
    }
  }
  for (const t of toonBoys.slice(b)) add({ girl: false, toon: t.toon, tall: t.tall, light: t.light })
  for (const t of toons.filter((t) => t.spot && !t.lucia)) add({ girl: false, toon: t.toon, light: t.light, spot: t.spot!.clone() })

  // spots in the rows: the boys at the ends of the rows and at the back, the girls in the middle;
  // the tall one in the back row; the choir's own girls in the front row
  const slots: { p: THREE.Vector3; side: number }[] = []
  ROWS.forEach((r, ri) => {
    for (let k = 0; k < r.n; k++) {
      const x = (k - (r.n - 1) / 2) * 0.82
      slots.push({ p: new THREE.Vector3(x, r.y, r.z), side: Math.abs(x) / ((r.n * 0.82) / 2) + ri * 0.12 })
    }
  })
  const free = walkers.filter((w) => !w.spot)
  const taken = new Set<(typeof slots)[number]>()
  const backRow = slots.filter((s) => s.p.z === ROWS[ROWS.length - 1].z).sort((a, b) => Math.abs(a.p.x) - Math.abs(b.p.x))
  for (const w of free.filter((w) => !w.girl && w.tall)) {
    const s = backRow.find((s) => !taken.has(s))!
    taken.add(s)
    w.spot = s.p.clone()
  }
  const bySide = [...slots].sort((a, b) => b.side - a.side)
  for (const w of free.filter((w) => !w.girl && !w.tall)) {
    const s = bySide.find((s) => !taken.has(s))!
    taken.add(s)
    w.spot = s.p.clone()
  }
  const middle = slots.filter((s) => !taken.has(s)).sort((a, b) => b.p.z - a.p.z || Math.abs(a.p.x) - Math.abs(b.p.x))
  const girls = free.filter((w) => w.girl)
  ;[...girls.filter((w) => w.toon), ...girls.filter((w) => !w.toon)].forEach((w, i) => (w.spot = (middle[i] ?? middle[middle.length - 1]).p.clone()))

  // in the last verse of Sankta Lucia they put their candles out column by column, from the two ends
  // of the rows in towards the middle (each column front to back) – and Lucia last of all
  const lastEnd = starts[LAST] + PROGRAM[LAST].length
  const blowFrom = lastEnd - 48
  const blowTo = lastEnd - 10
  const column = (w: Walker) => Math.round(Math.abs(w.spot!.x) / 0.41)
  const columns = [...new Set(walkers.slice(1).map(column))].sort((a, b) => b - a)
  for (const w of walkers.slice(1)) {
    const c = columns.indexOf(column(w))
    w.out = blowFrom + ((blowTo - blowFrom) * c) / Math.max(1, columns.length - 1) + (w.spot!.z + 58.5) * -0.12
  }
  // (Lucia keeps hers – and her crown – alight)
  walkers[0].out = Infinity

  /** Fast enough that the last one is in place a few seconds before the first song ends. */
  // (Lucia isn't in the line: she comes in later on her own)
  const speed = (length - QUEUE_LENGTH + (walkers.length - 2) * SPACING + 10) / (PROGRAM[0].length - 6)
  /** Back to the queue, the whole line arriving together just before the next procession. */


  /* ---------- the riser they stand on ---------- */
  const riser = new THREE.Group()
  ROWS.slice(1).forEach((r, i) => {
    const w = r.n * 0.82 + 0.8
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, r.y, 1.25), std(0x3a2418, 0.85))
    step.position.set(0, r.y / 2, r.z - (i === ROWS.length - 2 ? 0.3 : 0))
    step.receiveShadow = true
    riser.add(step)
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.04, 0.06), std(0xd4a64a, 0.4, 0.6))
    edge.position.set(0, r.y, r.z + 0.6)
    riser.add(edge)
  })
  group.add(riser)

  /* ---------- the fika afterwards, inside the hall ---------- */
  // The choir round a long table of lussebullar and pepparkakor; the villagers up on the galleries,
  // each with a bun. (The hall's middle is at z = −86; its galleries are 5.5 m up at x = ±14.4…17.4.)
  const HALL = -86
  const TABLE = new THREE.Vector3(0, 0, HALL + 6.2)
  const GALLERY = 5.67
  const fika = new Map<Walker, { p: THREE.Vector3; yaw: number }>()
  {
    const seats: { p: THREE.Vector3; yaw: number }[] = []
    for (const side of [-1, 1]) for (let k = 0; k < 6; k++) seats.push({ p: new THREE.Vector3(-2.5 + k, 0, TABLE.z + side * 0.85), yaw: side < 0 ? 0 : Math.PI })
    seats.push({ p: new THREE.Vector3(3.7, 0, TABLE.z), yaw: -Math.PI / 2 })
    walkers.filter((w) => w.toon).forEach((w, i) => fika.set(w, seats[i % seats.length]))
    const rails: { p: THREE.Vector3; yaw: number }[] = []
    for (const side of [-1, 1]) for (let k = 0; k < 23; k++) rails.push({ p: new THREE.Vector3(side * 14.9, GALLERY, HALL - 8 + k * 0.77), yaw: (-side * Math.PI) / 2 })
    for (let k = 0; k < 12; k++) rails.push({ p: new THREE.Vector3(-4.4 + k * 0.8, GALLERY, HALL - 9.1), yaw: 0 })
    walkers.filter((w) => !w.toon).forEach((w, i) => fika.set(w, rails[i % rails.length]))
  }
  // the way from the arch to each one's place at the fika: the choir round the end of the table to
  // their seats, the villagers up the stairs by the door and along the galleries
  const into = new Map<Walker, THREE.CurvePath<THREE.Vector3>>()
  const inside = new THREE.Vector3(0, 0, HALL + 10)
  for (const [w, f] of fika) {
    const p = f.p
    const side = p.x < 0 ? -1 : 1
    let pts: THREE.Vector3[]
    if (p.y === 0) {
      pts = [ARCH, inside]
      // the far side of the table: round its end
      if (p.z < TABLE.z) pts.push(new THREE.Vector3(side * 3.8, 0, TABLE.z + 1.3), new THREE.Vector3(side * 3.8, 0, TABLE.z - 0.9))
      pts.push(p)
    } else {
      const foot = new THREE.Vector3(side * 6.2, 0, HALL + 10.75)
      const top = new THREE.Vector3(side * 14.4, GALLERY, HALL + 10.75)
      const landing = new THREE.Vector3(side * 14.9, GALLERY, HALL + 10.3)
      pts = [ARCH, inside, foot, top, landing]
      if (Math.abs(p.x) < 10) pts.push(new THREE.Vector3(side * 14.9, GALLERY, p.z))
      pts.push(p)
    }
    into.set(w, pathOf(pts))
  }
  const outOf = new Map<Walker, { path: THREE.CurvePath<THREE.Vector3>; hall: number }>()
  for (const [w, p] of into) {
    const pts = p.curves.map((c) => (c as THREE.LineCurve3).v1)
    pts.push((p.curves[p.curves.length - 1] as THREE.LineCurve3).v2)
    outOf.set(w, { path: pathOf([...pts.reverse(), ...WAY_BACK.curves.map((c) => (c as THREE.LineCurve3).v2)]), hall: p.getLength() })
  }

  /** Who strolls back when, how fast and how far to the side: little groups of three to five, setting off
   *  over a minute and a half – each still in the queue in time for the next procession. */
  const stroll: { leave: number; speed: number; side: number }[] = []
  {
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    let left = 0
    let size = 0
    let leave = 0
    let pace = 1
    let middle = 0
    for (let j = 0; j < walkers.length - 1; j++) {
      if (left === 0) {
        size = left = 3 + Math.floor(rnd() * 3)
        leave = rnd() * 90
        pace = 0.85 + rnd() * 0.3
        middle = (rnd() - 0.5) * 1.2
      }
      const dist = outOf.get(walkers[j + 1])!.hall + BACK_TO_START + j * SPACING
      stroll.push({ leave, speed: Math.max(pace * (0.95 + rnd() * 0.1), dist / (WALK_BACK - 8 - leave)), side: middle + (left - (size + 1) / 2) * 0.5 })
      left--
    }
  }

  const table = new THREE.Group()
  table.position.copy(TABLE)
  table.add(new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.07, 1.1), std(0x6b4226, 0.7)).translateY(0.78))
  table.add(new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.02, 1.16), std(0xfbf8f2, 0.9)).translateY(0.825))
  table.add(new THREE.Mesh(new THREE.BoxGeometry(6.52, 0.022, 0.36), std(0xc8102e, 0.8)).translateY(0.83))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) table.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), std(0x4a2c1c, 0.7)).translateX(sx * 3).translateY(0.39).translateZ(sz * 0.45))
  for (let k = 0; k < 4; k++) table.add(luciaTray(k % 2 === 0).translateX(-2.25 + k * 1.5).translateY(0.84))
  // and a few candles burning down the middle
  for (const x of [-1.5, 0, 1.5]) {
    table.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), std(0xfbf8f2, 0.5)).translateX(x).translateY(0.94).translateZ(0.25))
    table.add(new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })).translateX(x).translateY(1.06).translateZ(0.25))
  }
  group.add(table)

  /* ---------- where everyone is, t seconds into the cycle ---------- */
  const tmp = new THREE.Vector3()
  const centre = new THREE.Vector3(0, 0, -62)
  const middleOfLine = new THREE.Vector3()
  /** The share of the candles still burning, for the music (it fades as they go out). */
  let litShare = 1
  let fikaNow = false
  function place(t: number) {
    const outStart = SONGS_END + 2
    fikaNow = t >= SONGS_END + EXIT
    let lit = 0
    let shown = 0
    const back = t >= FIKA_END
    walkers.forEach((w, i) => {
      // (in the queue before setting off: the first at its front, the last at its far end)
      const s = QUEUE_LENGTH + t * speed - (i - 1) * SPACING
      w.lit = t < w.out
      w.eating = false
      const lucia = i === 0
      if (back && !lucia) {
        // after the fika they wander back in little groups, each at its own pace and spread across the
        // path and the square – only falling into line as they reach the queue for the next procession
        const j = i - 1
        const way = outOf.get(w)!
        const plan = stroll[j]
        const stop = way.hall + BACK_TO_START + j * SPACING
        const u = (t - FIKA_END - plan.leave) * plan.speed
        if (u < 0) {
          const f = fika.get(w)!
          w.pos.copy(f.p)
          w.yaw = f.yaw
          w.walking = false
          w.eating = true
        } else {
          const len = way.path.getLength()
          const d = Math.min(u, stop)
          way.path.getPointAt(d / len, w.pos)
          way.path.getTangentAt(d / len, tmp)
          w.yaw = Math.atan2(tmp.x, tmp.z)
          // out of the hall in single file, then spread out side by side, and in line again near the queue
          const spread = THREE.MathUtils.smoothstep(d, way.hall + 2, way.hall + 10) * (1 - THREE.MathUtils.smoothstep(d, way.hall + BACK_TO_START - 14, way.hall + BACK_TO_START - 2))
          w.pos.x += tmp.z * plan.side * spread
          w.pos.z -= tmp.x * plan.side * spread
          w.walking = u < stop
        }
        w.shown = true
        w.lit = false
      } else if (lucia && !fikaNow && t < outStart) {
        // waiting for her song; then, crown alight, up through the yard to the front of the choir
        const k = (t - starts[LUCIA_SONG]) / LUCIA_WALK
        w.shown = k >= 0
        w.walking = k >= 0 && k < 1
        w.pos.lerpVectors(LUCIA_FROM, LUCIA_AT, THREE.MathUtils.clamp(k, 0, 1))
        w.yaw = k < 1 ? Math.PI : 0
      } else if (fikaNow) {
        const f = fika.get(w)!
        w.pos.copy(f.p)
        w.yaw = f.yaw
        w.walking = false
        w.shown = true
        w.lit = false
        w.eating = true
      } else if (t >= outStart) {
        // in through the arch, the back rows (nearest it) first and Lucia last, and on to their places
        const lag = (w.spot!.z + 64.5) * 2.5 + (lucia ? 4 : 0)
        const first = w.spot!.distanceTo(ARCH)
        const hall = into.get(w)!
        const d = Math.max(0, (t - outStart - lag) * 1.05)
        if (d < first) {
          w.pos.lerpVectors(w.spot!, ARCH, d / first)
          w.yaw = Math.atan2(ARCH.x - w.spot!.x, ARCH.z - w.spot!.z)
        } else {
          const k = Math.min(1, (d - first) / hall.getLength())
          hall.getPointAt(k, w.pos)
          hall.getTangentAt(k, tmp)
          w.yaw = k < 1 ? Math.atan2(tmp.x, tmp.z) : fika.get(w)!.yaw
        }
        w.walking = d > 0 && d < first + hall.getLength()
        w.shown = true
      } else if (s < 0) {
        w.shown = false
      } else if (s < length) {
        path.getPointAt(s / length, w.pos)
        path.getTangentAt(s / length, tmp)
        w.yaw = Math.atan2(tmp.x, tmp.z)
        w.walking = t > 0
        w.shown = true
      } else {
        const d = s - length
        const to = w.spot!
        const run = Math.hypot(to.x - end.x, to.z - end.z)
        if (d < run) {
          w.pos.lerpVectors(end, to, d / run)
          w.pos.y = to.y * (d / run)
          w.yaw = Math.atan2(to.x - end.x, to.z - end.z)
          w.walking = true
        } else {
          w.pos.copy(to)
          w.yaw = 0
          w.walking = false
        }
        w.shown = true
      }
      if (i === Math.floor(walkers.length / 2)) middleOfLine.copy(w.pos)
      if (w.shown) {
        shown++
        if (w.lit) lit++
      }
    })
    litShare = t < starts[LAST] ? 1 : shown ? lit / shown : 0
    return t >= PROGRAM[0].length ? centre : middleOfLine
  }

  /* ---------- drawing them ---------- */
  const m4 = new THREE.Matrix4()
  const base = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const size = new THREE.Vector3()
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  const flameAt = new THREE.Vector3()
  const at4 = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z).premultiply(base)
  /** `voice`: how loud the singing is, 0 … 1 – the villagers' mouths follow it. */
  function update(t: number, time: number, voice = 0) {
    const at = place(t)
    let girlIx = 0
    let boyIx = 0
    for (const w of walkers) {
      const bob = w.walking ? Math.abs(Math.sin(time * 5.5 + w.phase)) * 0.03 : Math.sin(time * 1.3 + w.phase) * 0.006
      if (w.toon) {
        const tg = w.toon.group
        tg.visible = w.shown
        tg.position.set(w.pos.x, w.pos.y + bob, w.pos.z)
        w.toon.setYaw(w.yaw)
        w.toon.walkPose(time * 5.5 + w.phase, w.walking ? 0.6 : 0)
        w.light?.(w.lit)
        continue
      }
      const i = w.extra!
      const s = 0.95 + ((i * 7) % 5) * 0.06
      const sway = w.walking ? Math.sin(time * 2.75 + w.phase) * 0.05 : Math.sin(time * 0.9 + w.phase) * 0.02
      e.set(0, w.yaw, sway, 'YXZ')
      q.setFromEuler(e)
      base.compose(tmp.set(w.pos.x, w.pos.y + bob, w.pos.z), q, size.set(s, s, s))
      if (!w.shown) {
        for (const k of ['gown', 'shoulders', 'head', 'hair', 'candle', 'flame', 'bun', 'nose', 'mouth'] as const) parts[k].setMatrixAt(i, hidden)
        for (const k of ['eyes', 'cheeks'] as const) for (const e of [0, 1]) parts[k].setMatrixAt(i * 2 + e, hidden)
        parts.hands.setMatrixAt(i * 2, hidden)
        parts.hands.setMatrixAt(i * 2 + 1, hidden)
        glowPos.set([0, -50, 0], i * 3)
      } else {
        parts.gown.setMatrixAt(i, at4(0, 0.41, 0))
        parts.shoulders.setMatrixAt(i, at4(0, 0.8, 0).multiply(m4.makeScale(1, 0.55, 0.85)))
        parts.head.setMatrixAt(i, at4(0, 0.97, 0))
        parts.hair.setMatrixAt(i, at4(0, 0.985, -0.012))
        // a face: eyes, rosy cheeks, a nose, and a mouth that sings with the music (or munches)
        for (const sx of [-1, 1]) {
          parts.eyes.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), at4(sx * 0.033, 0.99, 0.087).multiply(m4.makeScale(1, 1.25, 0.6)))
          parts.cheeks.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), at4(sx * 0.054, 0.955, 0.076).multiply(m4.makeScale(1, 0.8, 0.4)))
        }
        parts.nose.setMatrixAt(i, at4(0, 0.968, 0.099))
        const open = w.eating
          ? 0.25 + Math.max(0, Math.sin(time * 7 + w.phase)) * 0.6
          : w.lit && !w.walking
            ? 0.2 + voice * (0.75 + 0.25 * Math.sin(time * 9 + w.phase))
            : w.lit
              ? 0.2 + voice * 0.6
              : 0.15
        parts.mouth.setMatrixAt(i, at4(0, 0.932, 0.09).multiply(m4.makeScale(1.6, 0.25 + open * 1.1, 0.55)))
        if (w.eating) {
          // a bun in the hands, and every now and then a bite
          const k = (time * 0.13 + w.phase) % 1
          const bite = k < 0.12 ? Math.sin((k / 0.12) * Math.PI) : 0
          const hy = 0.6 + bite * 0.3
          const hz = 0.15 - bite * 0.03
          parts.hands.setMatrixAt(i * 2, at4(-0.035, hy - 0.03, hz))
          parts.hands.setMatrixAt(i * 2 + 1, at4(0.035, hy - 0.03, hz))
          parts.bun.setMatrixAt(i, at4(0, hy, hz + 0.02).multiply(m4.makeRotationX(-1.1)))
          parts.candle.setMatrixAt(i, hidden)
        } else {
          parts.hands.setMatrixAt(i * 2, at4(-0.035, 0.56, 0.15))
          parts.hands.setMatrixAt(i * 2 + 1, at4(0.035, 0.56, 0.15))
          parts.candle.setMatrixAt(i, at4(0, 0.62, 0.16))
          parts.bun.setMatrixAt(i, hidden)
        }
        if (w.lit) {
          const flicker = 0.85 + Math.sin(time * 17 + w.phase * 3) * 0.15
          parts.flame.setMatrixAt(i, at4(0, 0.715, 0.16).multiply(m4.makeScale(1, flicker, 1)))
          flameAt.set(0, 0.725, 0.16).applyMatrix4(base)
          glowPos.set([flameAt.x, flameAt.y, flameAt.z], i * 3)
        } else {
          parts.flame.setMatrixAt(i, hidden)
          glowPos.set([0, -50, 0], i * 3)
        }
      }
      if (w.girl) {
        const j = girlIx++
        parts.crown.setMatrixAt(j, w.shown ? at4(0, 1.04, 0).multiply(m4.makeRotationX(Math.PI / 2 - 0.15)) : hidden)
        parts.sash.setMatrixAt(j, w.shown ? at4(0, 0.5, 0).multiply(m4.makeRotationX(Math.PI / 2)) : hidden)
      } else {
        const j = boyIx++
        parts.strut.setMatrixAt(j, w.shown ? at4(0, 1.2, -0.01) : hidden)
        for (let k = 0; k < 3; k++) parts.stars.setMatrixAt(j * 3 + k, w.shown ? at4(0, 1.08 + k * 0.08, 0.075 - k * 0.018).multiply(m4.makeScale(1, 1, 0.35)) : hidden)
      }
    }
    for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true
    glowGeo.attributes.position.needsUpdate = true
    return at
  }

  /** Is this toon singing (in the procession, candle alight)? Lucia never does: she walks in silence. */
  const singing = (toon: Toon) => {
    const w = walkers.find((w) => w.toon === toon)
    return !!w && w !== walkers[0] && w.shown && w.lit
  }
  /** …or having fika afterwards? */
  const eating = (toon: Toon) => walkers.some((w) => w.toon === toon && w.eating)

  function show(on: boolean) {
    group.visible = on
    if (!on)
      for (const w of walkers)
        if (w.toon) {
          w.toon.group.visible = true
          w.light?.(true)
        }
  }
  show(false)

  return {
    group,
    update,
    show,
    singing,
    eating,
    /** How far `p` is from the nearest of them (the music is as loud as the nearest singer). */
    distanceTo(p: THREE.Vector3) {
      let best = Infinity
      for (const w of walkers) if (w.shown) best = Math.min(best, Math.hypot(p.x - w.pos.x, p.z - w.pos.z))
      return best
    },
    lucia: walkers[0],
    /** The share of candles still alight (1 until the last song): the music fades with them. */
    get litShare() {
      return litShare
    },
  }
}
