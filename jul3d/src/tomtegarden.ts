// Tomtegården: the clearing east of the path between the village and Leksaksfabriken, where Tomten and
// Tomtemor live. Three buildings round a snowy courtyard:
//
//   Tomtens stuga – a big red two-storey house with a turret, a porch and candles in every window.
//     Inside, by the fire, they sit in their wing chairs with hot chocolate, watching old Christmas
//     films: two stockings on the mantel, the tree in the corner, the cat asleep on the rug, and now and
//     then a nisse dropping in. He lives here until the 23rd (and is back from the 25th).
//   Stallet – the reindeer in their stalls, eating polkagrisar (their favourite) from the troughs.
//   Slädverkstaden – the sleigh, being polished and mended by nissar with screwdrivers and cloths
//     (and taken out from here, doors flying open, if you hop up into it).
//
// On the 23rd and julafton the sleigh, the team and Tomten are out at Leksaksfabriken (see
// julaftonsrunda.ts) – the stalls stand empty and Tomtemor sits by the fire on her own.
// World space throughout, except inside each building (its Lot), which faces +z in its own space.
import * as THREE from 'three'
import { keepApart, mergeRigid } from './batch'
import { wallClock } from './korsang'
import { Nisse } from './npc'
import { noise } from './sfx'
import type { Box, Floor } from './shop'
import { Reindeer, std } from './sleigh'
import { drawArrowSign, glowTexture, makeCanvas, planksTexture, toTexture } from './tex'
import { Claus, wingChair } from './tomtefolk'
import { LOG_R, doorFir, garland, julkarve, lantern, logCourses, logGable, logMaterials } from './timmer'
import { html, type Talk } from './ui'
import type { Circle, Roof } from './world'

/** A building of its own: boxes and floors to bump into and stand on, in its own space (like a shop's). */
export class Lot {
  readonly group = new THREE.Group()
  readonly boxes: Box[] = []
  readonly floors: Floor[] = []
  constructor(x: number, z: number, yaw: number) {
    this.group.position.set(x, 0, z)
    this.group.rotation.y = yaw
  }
  block(x: number, z: number, hw: number, hd: number, y0?: number, y1?: number) {
    const b: Box = { x, z, hw, hd, y0, y1 }
    this.boxes.push(b)
    return b
  }
  /** Where snow stops falling: its footprint, up to `h`. */
  roof(hw: number, hd: number, h: number): Roof {
    const p = this.group.position
    return { x: p.x, z: p.z, cos: Math.cos(this.group.rotation.y), sin: Math.sin(this.group.rotation.y), hw, hd, h }
  }
  toWorld(x: number, y: number, z: number) {
    this.group.updateMatrixWorld()
    return this.group.localToWorld(new THREE.Vector3(x, y, z))
  }
}

const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  parent.add(m)
  return m
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const repeat = (t: THREE.Texture, x: number, y: number) => {
  const c = t.clone()
  c.repeat.set(x, y)
  c.wrapS = c.wrapT = THREE.RepeatWrapping
  c.needsUpdate = true
  return c
}

/* ---------- shared materials ---------- */
const WHITE = std(0xf4f1ea, 0.7)
const SNOW = std(0xf4f8ff, 0.9)
const DARK = std(0x2a1a10, 0.7)
const WOOD = std(0x8a5a32, 0.75)
const IRON = std(0x16161c, 0.5, 0.5)
const GOLD = new THREE.MeshStandardMaterial({ color: 0xe0b24a, roughness: 0.3, metalness: 0.85 })
const WARM_GLASS = new THREE.MeshStandardMaterial({ color: 0x3a2410, emissive: 0xffc070, emissiveIntensity: 1.3, roughness: 0.3 })
const BULB_COLORS = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff, 0xff8de1].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }))
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
const CANDLE = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })

/** Board text on a plank sign. */
function signTexture(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; accent?: string } = {}) {
  const [c, ctx] = makeCanvas(opts.w ?? 512, opts.h ?? 160)
  ctx.fillStyle = opts.bg ?? '#6b4226'
  ctx.beginPath()
  ctx.roundRect(4, 4, c.width - 8, c.height - 8, 18)
  ctx.fill()
  ctx.strokeStyle = opts.accent ?? '#f6c453'
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.fillStyle = opts.fg ?? '#fff3dc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => {
    ctx.font = i === 0 ? `600 ${Math.round(c.height * 0.34)}px Fraunces, Georgia, serif` : `600 ${Math.round(c.height * 0.2)}px 'DM Sans', sans-serif`
    ctx.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : i === 0 ? 0.38 : 0.74))
  })
  return toTexture(c)
}
const sign = (lines: string[], w: number, h: number, opts?: Parameters<typeof signTexture>[1]) =>
  new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTexture(lines, opts), roughness: 0.7, emissive: 0xffffff, emissiveMap: signTexture(lines, opts), emissiveIntensity: 0.15 }))

/**
 * Four walls round w × d (centred on the lot's origin), h high and t thick, with doorways in them:
 * `{ wall, at, width, height }` (at: along the wall, from its middle). Their boxes go into the lot.
 * With `logs`, the outside is round logs (timmer.ts), their ends crossing at the corners.
 */
function walls(lot: Lot, w: number, d: number, h: number, t: number, outside: THREE.Material, inside: THREE.Material | null, gaps: { wall: 'front' | 'back' | 'left' | 'right'; at: number; width: number; height: number }[], logs?: THREE.Material[]) {
  const g = lot.group
  const sides = [
    { wall: 'front' as const, len: w, x: 0, z: d / 2, rot: 0 },
    { wall: 'back' as const, len: w, x: 0, z: -d / 2, rot: Math.PI },
    { wall: 'left' as const, len: d, x: -w / 2, z: 0, rot: -Math.PI / 2 },
    { wall: 'right' as const, len: d, x: w / 2, z: 0, rot: Math.PI / 2 },
  ]
  for (const s of sides) {
    // the wall in pieces along its length, around its doorways
    const holes = gaps.filter((gp) => gp.wall === s.wall).sort((a, b) => a.at - b.at)
    let from = -s.len / 2
    const pieces: [number, number, number, number][] = [] // u0, u1, y0, y1
    for (const hole of holes) {
      pieces.push([from, hole.at - hole.width / 2, 0, h])
      pieces.push([hole.at - hole.width / 2, hole.at + hole.width / 2, hole.height, h])
      from = hole.at + hole.width / 2
    }
    pieces.push([from, s.len / 2, 0, h])
    const wall = new THREE.Group()
    wall.position.set(s.x, 0, s.z)
    wall.rotation.y = s.rot
    for (const [u0, u1, y0, y1] of pieces) {
      if (u1 - u0 < 0.01 || y1 - y0 < 0.01) continue
      const len = u1 - u0
      const mid = (u0 + u1) / 2
      const m = add(wall, box(len, y1 - y0, t), outside, mid, (y0 + y1) / 2, 0)
      m.castShadow = m.receiveShadow = true
      if (inside) add(wall, new THREE.PlaneGeometry(len, y1 - y0), inside, mid, (y0 + y1) / 2, -t / 2 - 0.005).rotation.y = Math.PI
      // (outside is the group's +z on every side; the ends of the wall stick out past the corners)
      if (logs) {
        const across = s.wall === 'left' || s.wall === 'right'
        logCourses(wall, logs, u0, u1, y0, y1, t / 2 + LOG_R * 0.85, { over0: u0 <= -s.len / 2 + 0.01 ? 0.4 : 0, over1: u1 >= s.len / 2 - 0.01 ? 0.4 : 0, phase: across ? 1 : 0 })
      }
      // only the low ones are in the way
      if (y0 < 2) {
        const c = Math.cos(s.rot)
        const sn = Math.sin(s.rot)
        const lx = s.x + mid * c
        const lz = s.z - mid * sn
        const across = s.wall === 'left' || s.wall === 'right'
        lot.block(lx, lz, across ? t / 2 + 0.05 : len / 2, across ? len / 2 : t / 2 + 0.05, -Infinity, Infinity)
      }
    }
    g.add(wall)
  }
}

/** A gable roof over w × d (the ridge along x), its eaves at `eave`, `rise` up to the ridge, snow on top (log gables with `logs`). */
function gableRoof(parent: THREE.Object3D, w: number, d: number, eave: number, rise: number, mat: THREE.Material, gableMat: THREE.Material, over = 0.6, logs?: THREE.Material[]) {
  const half = d / 2 + over
  const slope = Math.atan2(rise, d / 2)
  const len = Math.hypot(half, rise * (half / (d / 2)))
  for (const s of [-1, 1]) {
    const panel = add(parent, box(w + over * 2, 0.2, len), mat, 0, eave + rise / 2 - (over / (d / 2)) * rise * 0.5, (s * len) / 2 * Math.cos(slope))
    panel.rotation.x = s * slope
    panel.castShadow = true
    const snow = add(parent, box(w + over * 2 - 0.1, 0.12, len - 0.15), SNOW, 0, 0, 0)
    snow.position.copy(panel.position).add(new THREE.Vector3(0, 0.13 * Math.cos(slope), s * 0.13 * Math.sin(slope)))
    snow.rotation.x = s * slope
  }
  // the gable ends
  const tri = new THREE.Shape()
  tri.moveTo(-d / 2, 0)
  tri.lineTo(d / 2, 0)
  tri.lineTo(0, rise)
  tri.closePath()
  for (const s of [-1, 1]) {
    const gable = add(parent, new THREE.ShapeGeometry(tri), gableMat, s * (w / 2), eave, 0)
    gable.rotation.y = s * (Math.PI / 2)
    ;(gable.material as THREE.Material).side = THREE.DoubleSide
    if (logs) {
      const lg = new THREE.Group()
      lg.position.x = s * (w / 2 + LOG_R * 0.9)
      lg.rotation.y = Math.PI / 2
      logGable(lg, logs, d + 0.8, eave, rise, 0)
      parent.add(lg)
    }
  }
}

/** A window: white frame, glazing bars, warm light behind – and a candle arch on the sill (both faces). */
function windowOn(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, yaw: number, candles = true) {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  g.rotation.y = yaw
  add(g, box(w + 0.2, h + 0.2, 0.1), WHITE, 0, 0, 0.02)
  for (const side of [1, -1]) {
    const glass = add(g, new THREE.PlaneGeometry(w, h), WARM_GLASS, 0, 0, side * 0.08)
    if (side < 0) glass.rotation.y = Math.PI
  }
  add(g, box(0.05, h, 0.16), WHITE, 0, 0, 0)
  add(g, box(w, 0.05, 0.16), WHITE, 0, h * 0.12, 0)
  add(g, box(w + 0.3, 0.06, 0.24), WHITE, 0, -h / 2 - 0.12, 0.05)
  if (candles) {
    // an advent candle arch on the inside sill, seen from both sides
    const arch = new THREE.Group()
    arch.position.set(0, -h / 2 + 0.02, -0.12)
    add(arch, new THREE.TorusGeometry(0.3, 0.02, 6, 16, Math.PI), DARK, 0, 0.02, 0)
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI
      add(arch, new THREE.SphereGeometry(0.025, 6, 5), CANDLE, Math.cos(a) * 0.3, 0.06 + Math.sin(a) * 0.3, 0)
    }
    g.add(arch)
  }
  parent.add(g)
  return g
}

/** A little fire: logs, flames that flicker (call the returned function every frame), a warm light. */
function fire(parent: THREE.Object3D, x: number, y: number, z: number, size: number, lightPower: number) {
  const g = keepApart(new THREE.Group())
  g.position.set(x, y, z)
  for (let i = 0; i < 3; i++) {
    const log = add(g, new THREE.CylinderGeometry(0.06 * size, 0.07 * size, 0.7 * size, 7), std(0x4a3020, 0.9), 0, 0.08 * size, 0)
    log.rotation.set(Math.PI / 2, (i / 3) * Math.PI, 0.15)
  }
  add(g, new THREE.SphereGeometry(0.14 * size, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a1a, toneMapped: false }), 0, 0.02, 0)
  const tongues = Array.from({ length: 5 }, (_, i) => add(g, new THREE.ConeGeometry((0.14 - i * 0.015) * size, 0.5 * size, 8), FLAME, Math.cos(i * 2.4) * 0.09 * size, 0.25 * size, Math.sin(i * 2.4) * 0.09 * size))
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,170,70,0.9)', 'rgba(255,110,30,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.position.y = 0.4 * size
  glow.scale.setScalar(1.8 * size)
  g.add(glow)
  const light = new THREE.PointLight(0xff9040, lightPower, 9, 1.6)
  light.position.y = 0.6 * size
  g.add(light)
  parent.add(g)
  return (t: number) => {
    tongues.forEach((f, i) => {
      const k = 0.75 + Math.sin(t * (9 + i) + i * 1.7) * 0.18 + Math.sin(t * 23 + i) * 0.07
      f.scale.set(1, k, 1)
      f.position.y = 0.25 * size * k
    })
    light.intensity = lightPower * (0.9 + Math.sin(t * 13) * 0.08 + Math.sin(t * 29) * 0.05)
  }
}

/** Polkagrisar: red-and-white striped sticks (one material for all of them). */
const candyMat = (() => {
  const [c, ctx] = makeCanvas(64, 64)
  ctx.fillStyle = '#fff6ee'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#d6203a'
  for (let y = -64; y < 128; y += 16) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(64, y + 32)
    ctx.lineTo(64, y + 40)
    ctx.lineTo(0, y + 8)
    ctx.fill()
  }
  return new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.35 })
})()
function candyHeap(parent: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, n: number, seed: number) {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const sticks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8), candyMat, n)
  const m = new THREE.Matrix4()
  for (let i = 0; i < n; i++) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + (r() - 0.5) * 0.6, r() * Math.PI, (r() - 0.5) * 0.5))
    m.compose(new THREE.Vector3(x + (r() - 0.5) * w, y + r() * 0.06, z + (r() - 0.5) * d), q, new THREE.Vector3(1, 1, 1))
    sticks.setMatrixAt(i, m)
  }
  parent.add(sticks)
  return sticks
}

/** What's on: an old Christmas film, flickering in black and white – snow over a cottage, a sleigh across the moon, title cards. */
function filmScreen() {
  const [c, ctx] = makeCanvas(256, 192)
  const tex = toTexture(c, { live: true })
  const cards = ['GOD JUL', 'En vinternatt i Lappland', 'SLUT – och god fortsättning!']
  let last = -1
  const draw = (t: number) => {
    const frame = Math.floor(t * 12)
    if (frame === last) return
    last = frame
    const scene = Math.floor(t / 14) % 4
    const k = (t % 14) / 14
    const flick = 0.85 + Math.random() * 0.15
    ctx.fillStyle = `rgb(${18 * flick},${18 * flick},${20 * flick})`
    ctx.fillRect(0, 0, 256, 192)
    if (scene === 0 || scene === 2) {
      // a title card
      ctx.strokeStyle = `rgba(230,230,220,${0.8 * flick})`
      ctx.lineWidth = 3
      ctx.strokeRect(22, 22, 212, 148)
      ctx.fillStyle = `rgba(235,235,225,${0.95 * flick})`
      ctx.textAlign = 'center'
      ctx.font = scene === 0 ? '700 34px Georgia, serif' : 'italic 18px Georgia, serif'
      ctx.fillText(cards[scene === 0 ? 0 : Math.floor(t / 56) % 2 ? 2 : 1], 128, 104)
    } else {
      // a snowy night: the moon, a cottage with a lit window, a sleigh crossing the sky
      ctx.fillStyle = `rgba(200,200,190,${flick})`
      ctx.beginPath()
      ctx.arc(190, 52, 24, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(150,150,145,${flick})`
      ctx.fillRect(0, 150, 256, 42)
      ctx.fillStyle = `rgba(70,70,70,${flick})`
      ctx.fillRect(40, 112, 60, 40)
      ctx.beginPath()
      ctx.moveTo(32, 114)
      ctx.lineTo(70, 86)
      ctx.lineTo(108, 114)
      ctx.fill()
      ctx.fillStyle = `rgba(230,220,180,${flick})`
      ctx.fillRect(60, 124, 12, 12)
      const sx = -40 + k * 340
      const sy = 70 + Math.sin(k * 6) * 10
      ctx.fillStyle = `rgba(20,20,20,${flick})`
      ctx.fillRect(sx, sy, 22, 7)
      for (let i = 0; i < 4; i++) ctx.fillRect(sx + 26 + i * 12, sy - 3 + (i % 2) * 2, 9, 5)
      ctx.fillStyle = `rgba(240,240,240,${0.8 * flick})`
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 67 + t * 12) % 256, (i * 41 + t * 30) % 192, 2, 2)
    }
    // scratches and grain
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    for (let i = 0; i < 3; i++) ctx.fillRect(Math.random() * 256, 0, 1, 192)
    tex.needsUpdate = true
  }
  return { tex, draw }
}

/** A grandfather clock telling the village's time (hands from the village clock, like the tower's). */
function grandfatherClock(parent: THREE.Object3D, x: number, z: number, yaw: number) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = yaw
  const case_ = std(0x5a3418, 0.45)
  add(g, box(0.55, 2.1, 0.35), case_, 0, 1.05, 0)
  add(g, box(0.65, 0.12, 0.42), case_, 0, 2.16, 0)
  const [c, ctx] = makeCanvas(128, 128)
  ctx.fillStyle = '#fbf3e4'
  ctx.beginPath()
  ctx.arc(64, 64, 60, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3a2410'
  ctx.font = '700 16px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    ctx.fillText(String(i), 64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46)
  }
  add(g, new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.6 }), 0, 1.75, 0.18)
  const hand = (len: number, w: number) => {
    const h = keepApart(new THREE.Group())
    add(h, box(w, len, 0.01), DARK, 0, len / 2, 0)
    h.position.set(0, 1.75, 0.19)
    g.add(h)
    return h
  }
  const hour = hand(0.1, 0.018)
  const minute = hand(0.16, 0.012)
  // the pendulum swinging behind its little window
  add(g, new THREE.PlaneGeometry(0.3, 0.8), std(0x1a1008, 0.4), 0, 0.95, 0.176)
  const pend = keepApart(new THREE.Group())
  pend.position.set(0, 1.35, 0.18)
  add(pend, box(0.02, 0.6, 0.01), GOLD, 0, -0.3, 0)
  add(pend, new THREE.CylinderGeometry(0.07, 0.07, 0.015, 16), GOLD, 0, -0.62, 0).rotation.x = Math.PI / 2
  g.add(pend)
  parent.add(g)
  return (t: number) => {
    const d = new Date(wallClock())
    const min = d.getUTCMinutes() + d.getUTCSeconds() / 60
    minute.rotation.z = -(min / 60) * Math.PI * 2
    hour.rotation.z = -(((d.getUTCHours() % 12) + min / 60) / 12) * Math.PI * 2
    pend.rotation.z = Math.sin(t * Math.PI) * 0.12
  }
}

export type GardenDay = {
  /** Tomten at home (not out at the sleigh on the 23rd or julafton). */
  tomteHome: boolean
  /** The reindeer in their stalls (likewise). */
  deerHome: boolean
  /** Leksaksfabriken open (from the 1st of December until it all comes down after tjugondag Knut) – Tomten talks about it. */
  open: boolean
  /** The sleigh in its place in the slädverkstad (not at the factory, not off flying). */
  sleighHome: boolean
  /** Flying out of the slädverkstad right now: the doors open for it, whatever the date. */
  flyingOut: boolean
}

export function buildTomtegarden(scene: THREE.Scene, opts: { onNewYork: () => void }) {
  const lots: Lot[] = []
  const roofs: Roof[] = []
  const colliders: Circle[] = []
  const solids: THREE.Object3D[] = []
  /** Things that move: kept out of the baking. */
  const moving: THREE.Object3D[] = []
  const updaters: ((t: number, dt: number, player: THREE.Vector3) => void)[] = []
  let day: GardenDay = { tomteHome: true, deerHome: true, open: true, sleighHome: true, flyingOut: false }

  const pine = planksTexture('#b07a4a', { boards: 6, seed: 12 })
  const floorPlanks = planksTexture('#7a4a28', { boards: 8, vertical: false, seed: 13 })
  const roofMat = std(0x2c3a35, 0.8)
  // the stable and the slädverkstad are log cabins (timmer.ts), their doors of dark planks
  const timber = logMaterials(0xe8d8c8)
  const doorPlanks = planksTexture('#5a3a22', { boards: 5, seed: 17 })
  const plankDoor = (w: number, h: number) => new THREE.MeshStandardMaterial({ map: repeat(doorPlanks, w / 1.4, h / 2.4), roughness: 0.85 })
  // grey fieldstone (the manor's ground floor and towers) and cream plaster between dark timbers (its upper floor)
  const fieldstone = (() => {
    const [c, ctx] = makeCanvas(256, 256)
    ctx.fillStyle = '#5a564f'
    ctx.fillRect(0, 0, 256, 256)
    let seed = 3
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let y = 0; y < 256; y += 28)
      for (let x = -r() * 30; x < 256; x += 34 + r() * 22) {
        const sh = 120 + Math.floor(r() * 60)
        ctx.fillStyle = `rgb(${sh},${sh - 4},${sh - 10})`
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 2, 30 + r() * 20, 24, 9)
        ctx.fill()
      }
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })()
  const halfTimber = (() => {
    const [c, ctx] = makeCanvas(256, 256)
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = '#4a2c1c'
    ctx.fillRect(0, 0, 256, 14)
    ctx.fillRect(0, 242, 256, 14)
    ctx.fillRect(0, 121, 256, 12)
    for (const x of [0, 128]) ctx.fillRect(x, 0, 14, 256)
    ctx.strokeStyle = '#4a2c1c'
    ctx.lineWidth = 12
    ctx.beginPath()
    ctx.moveTo(14, 14)
    ctx.lineTo(128, 121)
    ctx.moveTo(242, 14)
    ctx.lineTo(142, 121)
    ctx.moveTo(14, 242)
    ctx.lineTo(128, 133)
    ctx.moveTo(242, 242)
    ctx.lineTo(142, 133)
    ctx.stroke()
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })()

  /* ====================================================================== Tomtens stuga */
  const house = new Lot(50, -36, -Math.PI / 2)
  lots.push(house)
  {
    const W = 16
    const D = 13
    const H1 = 3.6
    const H = 6.8
    const g = house.group
    const inner = new THREE.MeshStandardMaterial({ map: repeat(pine, 3, 1), roughness: 0.8, side: THREE.DoubleSide })
    // a fairy-tale manor: grey fieldstone below, cream plaster and dark timbers above, slate roofs,
    // two round towers with verdigris copper caps and gold stars, a stone portal, a balcony with a
    // garland, a rose window in the gable over the door, smoking chimneys, lights and icicles
    const stoneWall = (w: number, h: number) => new THREE.MeshStandardMaterial({ map: repeat(fieldstone, w / 3, h / 3), roughness: 0.95 })
    const timber = (w: number, h: number) => new THREE.MeshStandardMaterial({ map: repeat(halfTimber, w / 3.2, h / 3.2), roughness: 0.85 })
    const SAND = std(0xd8ccb4, 0.85)
    const SLATE = std(0x3a4048, 0.8)
    const COPPER = std(0x5fa38e, 0.55, 0.3)
    walls(house, W, D, H1, 0.4, stoneWall(W, H1), inner, [{ wall: 'front', at: 0, width: 2.2, height: 2.9 }])
    // the upper floor (outside only)
    const upper = new THREE.Group()
    upper.position.y = H1
    for (const [w, d, x, z] of [[W, 0.3, 0, D / 2], [W, 0.3, 0, -D / 2], [0.3, D, -W / 2, 0], [0.3, D, W / 2, 0]] as const) add(upper, box(w, H - H1, d), timber(Math.max(w, d), H - H1), x, (H - H1) / 2, z).castShadow = true
    g.add(upper)
    // sandstone quoins at the corners, a cornice between the floors and under the eaves
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]])
      for (let i = 0; i < 6; i++) add(g, box(i % 2 ? 0.55 : 0.75, 0.55, i % 2 ? 0.75 : 0.55), SAND, x, 0.3 + i * 0.58, z)
    for (const [w, d, x, z] of [[W + 0.5, 0.5, 0, D / 2], [W + 0.5, 0.5, 0, -D / 2], [0.5, D + 0.5, -W / 2, 0], [0.5, D + 0.5, W / 2, 0]] as const) {
      add(g, box(w, 0.28, d), SAND, x, H1, z)
      add(g, box(w, 0.3, d), SAND, x, H - 0.1, z)
    }
    // the roof (ridge along the front), the side gables in timber
    gableRoof(g, W, D, H, 4.8, SLATE, timber(D, 4.8))
    // a tall gable over the entrance, the rose window in it
    const cross = new THREE.Group()
    cross.position.set(0, H, D / 2)
    const tri = new THREE.Shape()
    tri.moveTo(-2.8, 0)
    tri.lineTo(2.8, 0)
    tri.lineTo(0, 3.6)
    tri.closePath()
    const front = add(cross, new THREE.ExtrudeGeometry(tri, { depth: 2.4, bevelEnabled: false }), timber(5.6, 3.6), 0, 0, -2.3)
    front.castShadow = true
    const slope = Math.atan2(3.6, 2.8)
    for (const s of [-1, 1]) {
      const r = add(cross, box(Math.hypot(2.8, 3.6) + 0.4, 0.2, 2.9), SLATE, s * 1.4, 1.85, -1.1)
      r.rotation.z = -s * slope
      const sn = add(cross, box(Math.hypot(2.8, 3.6) + 0.2, 0.1, 2.8), SNOW, s * 1.42, 2.0, -1.1)
      sn.rotation.z = -s * slope
    }
    const [roseC, roseCtx] = makeCanvas(256, 256)
    roseCtx.fillStyle = '#2a1a10'
    roseCtx.fillRect(0, 0, 256, 256)
    const glassCols = ['#c8102e', '#1d7a4a', '#f6c453', '#2b5fa8', '#e86a2a', '#7a2a8a']
    for (let i = 0; i < 12; i++) {
      roseCtx.fillStyle = glassCols[i % glassCols.length]
      roseCtx.beginPath()
      roseCtx.moveTo(128, 128)
      roseCtx.arc(128, 128, 116, (i / 12) * Math.PI * 2 + 0.03, ((i + 1) / 12) * Math.PI * 2 - 0.03)
      roseCtx.fill()
    }
    roseCtx.fillStyle = '#f6c453'
    roseCtx.beginPath()
    roseCtx.arc(128, 128, 34, 0, Math.PI * 2)
    roseCtx.fill()
    roseCtx.fillStyle = '#c8102e'
    roseCtx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const rr = i % 2 ? 12 : 28
      roseCtx.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr)
    }
    roseCtx.fill()
    const rose = add(cross, new THREE.CircleGeometry(0.85, 32), new THREE.MeshStandardMaterial({ map: toTexture(roseC), emissive: 0xffffff, emissiveMap: toTexture(roseC), emissiveIntensity: 0.9, roughness: 0.3 }), 0, 1.45, 0.12)
    void rose
    add(cross, new THREE.TorusGeometry(0.9, 0.09, 8, 32), SAND, 0, 1.45, 0.12)
    g.add(cross)
    // three dormers on the front slope
    for (const x of [-5.2, 5.2]) {
      const dm = new THREE.Group()
      dm.position.set(x, H + 1.5, D / 2 - 1.6)
      add(dm, box(1.8, 1.9, 1.6), timber(1.8, 1.9), 0, 0, 0)
      windowOn(dm, 0, 0.05, 0.82, 0.9, 1.1, 0)
      add(dm, box(2.2, 0.15, 1.9), SLATE, 0, 1.05, 0)
      add(dm, box(2.2, 0.12, 1.9), SNOW, 0, 1.17, 0)
      g.add(dm)
    }
    // the towers on the front corners: round fieldstone, copper caps gone green, gold stars on top
    for (const s of [-1, 1]) {
      const tur = new THREE.Group()
      tur.position.set(s * (W / 2 + 0.3), 0, D / 2 + 0.3)
      add(tur, new THREE.CylinderGeometry(2.1, 2.25, 10.4, 28), stoneWall(13, 10.4), 0, 5.2, 0).castShadow = true
      for (const y of [H1, H, 10.4]) add(tur, new THREE.CylinderGeometry(2.24, 2.24, 0.26, 28), SAND, 0, y, 0)
      // a crenellated ring under the cap
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        add(tur, box(0.5, 0.45, 0.35), SAND, Math.sin(a) * 2.2, 10.75, Math.cos(a) * 2.2).rotation.y = a
      }
      const cone = add(tur, new THREE.ConeGeometry(2.45, 6.2, 28), COPPER, 0, 10.5 + 3.1, 0)
      cone.castShadow = true
      add(tur, new THREE.ConeGeometry(1.5, 2.6, 28), SNOW, 0, 10.5 + 4.6, 0)
      add(tur, new THREE.SphereGeometry(0.16, 10, 8), GOLD, 0, 17.0, 0)
      const star = add(tur, new THREE.OctahedronGeometry(0.42), GOLD, 0, 17.6, 0)
      star.scale.set(1, 1.3, 0.35)
      for (const [y, a] of [[1.9, 0.7 * s], [5.2, 0.4 * s], [8.6, 0.9 * s], [5.2, 1.4 * s]] as const) windowOn(tur, Math.sin(a) * 2.13, y, Math.cos(a) * 2.13, 0.75, 1.4, a)
      // lights spiralling up it
      for (let i = 0; i < 36; i++) {
        const k = i / 36
        const a = k * Math.PI * 2 * 2.5
        add(tur, new THREE.SphereGeometry(0.07, 6, 5), BULB_COLORS[i % 5], Math.sin(a) * 2.28, 0.8 + k * 9.4, Math.cos(a) * 2.28)
      }
      g.add(tur)
      house.block(s * (W / 2 + 0.3), D / 2 + 0.3, 2.1, 2.1)
    }
    // three chimneys smoking: the fireplace at the back, one at each end of the ridge
    const chimneys: [number, number][] = [[0, -D / 2 + 1.2], [-W / 2 + 1.6, 0], [W / 2 - 1.6, 0]]
    for (const [x, z] of chimneys) {
      add(g, box(1.4, 4.6, 1.1), stoneWall(1.4, 4.6), x, H + 3.6, z)
      add(g, box(1.6, 0.25, 1.3), SAND, x, H + 6.0, z)
    }
    const smoke = chimneys.flatMap(([cx, cz], c) =>
      Array.from({ length: 5 }, (_, i) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(220,222,230,0.7)', 'rgba(220,222,230,0)'), transparent: true, depthWrite: false }))
        s.userData = { k: i / 5 + c * 0.07, cx, cz }
        g.add(s)
        return s
      }),
    )
    updaters.push((t, dt) => {
      for (const s of smoke) {
        s.userData.k = (s.userData.k + dt * 0.08) % 1
        const k = s.userData.k as number
        s.position.set(s.userData.cx + Math.sin(k * 4 + t * 0.2) * 0.6 * k, H + 6.3 + k * 7, s.userData.cz + k * 1.5)
        s.scale.setScalar(1 + k * 3)
        s.material.opacity = 0.55 * (1 - k)
      }
    })
    // windows, with sandstone lintels over them
    const lintel = (x: number, y: number, z: number, yaw: number, w: number) => {
      const l = add(g, box(w + 0.5, 0.22, 0.3), SAND, x, y, z)
      l.rotation.y = yaw
    }
    for (const x of [-5.4, -3.2, 3.2, 5.4]) {
      windowOn(g, x, 1.75, D / 2 + 0.08, 1.0, 1.7, 0)
      lintel(x, 2.78, D / 2 + 0.1, 0, 1.0)
      windowOn(g, x, H1 + 1.55, D / 2 + 0.06, 0.9, 1.3, 0)
    }
    for (const z of [-3.5, 0, 3.5])
      for (const s of [-1, 1]) {
        windowOn(g, s * (W / 2 + 0.08), 1.75, z, 1.0, 1.7, (s * Math.PI) / 2)
        lintel(s * (W / 2 + 0.1), 2.78, z, (s * Math.PI) / 2, 1.0)
        windowOn(g, s * (W / 2 + 0.06), H1 + 1.55, z, 0.9, 1.3, (s * Math.PI) / 2)
      }
    for (const x of [-4.5, 4.5]) windowOn(g, x, 1.75, -D / 2 - 0.08, 1.0, 1.7, Math.PI)
    // the entrance: a stone portal with an arch, steps up to a landing, lanterns on pillars,
    // a big wreath, and over it a balcony with a garland and a glass door
    const porch = new THREE.Group()
    porch.position.set(0, 0, D / 2)
    for (const s of [-1, 1]) add(porch, box(0.6, 3.3, 0.7), SAND, s * 1.5, 1.65, 0.25)
    add(porch, new THREE.TorusGeometry(1.5, 0.3, 10, 24, Math.PI), SAND, 0, 3.0, 0.25)
    add(porch, box(0.5, 0.6, 0.75), SAND, 0, 4.45, 0.25)
    add(porch, box(4.6, 0.15, 2.0), std(0x9a948c, 0.9), 0, 0.075, 1.0)
    add(porch, box(3.4, 0.08, 0.5), std(0x9a948c, 0.9), 0, 0.04, 2.25)
    house.floors.push({ x: 0, z: D / 2 + 1.0, hw: 2.3, hd: 1.0, top: 0.15, solid: false })
    for (const s of [-1, 1]) {
      house.block(s * 1.5, D / 2 + 0.25, 0.32, 0.36)
      // the lantern pillars either side of the steps
      add(porch, box(0.6, 1.1, 0.6), SAND, s * 2.7, 0.55, 1.6)
      add(porch, box(0.4, 0.5, 0.4), WARM_GLASS, s * 2.7, 1.4, 1.6)
      add(porch, new THREE.ConeGeometry(0.36, 0.3, 4), IRON, s * 2.7, 1.8, 1.6).rotation.y = Math.PI / 4
      add(porch, new THREE.ConeGeometry(0.28, 0.14, 4), SNOW, s * 2.7, 1.95, 1.6).rotation.y = Math.PI / 4
      house.block(s * 2.7, D / 2 + 1.6, 0.32, 0.32)
    }
    // the double doors, open inwards
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group()
      leaf.position.set(s * 1.1, 0, -0.15)
      leaf.rotation.y = s * -1.7
      add(leaf, box(1.1, 2.85, 0.1), std(0x1d4a32, 0.6), -s * 0.55, 1.43, 0)
      add(leaf, new THREE.TorusGeometry(0.06, 0.012, 6, 12), GOLD, -s * 0.9, 1.3, 0.07)
      porch.add(leaf)
    }
    // a big wreath on the stone over the door
    const wreath = new THREE.Group()
    wreath.position.set(0, 3.55, 0.65)
    add(wreath, new THREE.TorusGeometry(0.55, 0.17, 10, 28), std(0x1d5e3a, 0.85), 0, 0, 0)
    for (let i = 0; i < 12; i++) add(wreath, new THREE.SphereGeometry(0.06, 8, 6), std(i % 3 ? 0xc8102e : 0xf6c453, 0.35), Math.cos(i * 0.52) * 0.55, Math.sin(i * 0.52) * 0.55, 0.15)
    add(wreath, box(0.35, 0.22, 0.08), std(0xc8102e, 0.4), 0, -0.6, 0.12)
    porch.add(wreath)
    // the balcony above, on the first floor
    const balc = new THREE.Group()
    balc.position.set(0, H1, 0)
    add(balc, box(4.6, 0.25, 1.5), SAND, 0, 0, 0.75)
    for (let i = 0; i < 13; i++) add(balc, new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), SAND, -2.15 + i * 0.36, 0.5, 1.4)
    add(balc, box(4.6, 0.12, 0.2), SAND, 0, 0.95, 1.4)
    for (const s of [-1, 1]) {
      add(balc, box(0.2, 0.12, 1.5), SAND, s * 2.2, 0.95, 0.75)
      for (let i = 0; i < 3; i++) add(balc, new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), SAND, s * 2.2, 0.5, 0.3 + i * 0.4)
    }
    // the garland along it, swagged, with red bows and lights
    for (let i = 0; i < 24; i++) {
      const u = i / 23
      const x = -2.2 + u * 4.4
      const y = 0.95 - Math.sin(((u * 4) % 1) * Math.PI) * 0.28
      add(balc, new THREE.SphereGeometry(0.13, 8, 6), std(0x1d5e3a, 0.85), x, y, 1.52)
      if (i % 2) add(balc, new THREE.SphereGeometry(0.05, 6, 5), BULB_COLORS[i % 5], x, y - 0.08, 1.64)
    }
    for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) add(balc, box(0.22, 0.16, 0.08), std(0xc8102e, 0.4), x, 1.0, 1.62)
    // the glass door out onto it
    add(balc, new THREE.PlaneGeometry(1.4, 2.2), WARM_GLASS, 0, 1.2, 0.17)
    add(balc, box(1.6, 2.4, 0.08), SAND, 0, 1.2, 0.12)
    porch.add(balc)
    const nameBoard = sign(['Tomtens stuga', 'Tomten & Tomtemor'], 2.6, 0.8, { bg: '#d8ccb4', fg: '#5a2a1a', accent: '#8a6a3a' })
    nameBoard.position.set(0, 4.95, 0.64)
    porch.add(nameBoard)
    g.add(porch)
    // string lights along the eaves of the front, icicles under them
    const bulbs = new THREE.Group()
    for (let i = 0; i < 44; i++) add(bulbs, new THREE.SphereGeometry(0.06, 6, 5), BULB_COLORS[i % 5], -W / 2 + (i / 43) * W, H - 0.3 - Math.sin((((i % 8) / 8) * Math.PI)) * 0.18, D / 2 + 0.36)
    const ice = new THREE.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.1, transparent: true, opacity: 0.8 })
    for (let i = 0; i < 46; i++) {
      const len = 0.18 + ((i * 37) % 11) / 20
      const ic = add(bulbs, new THREE.ConeGeometry(0.04, len, 5), ice, -W / 2 + 0.2 + (i / 45) * (W - 0.4), H - 0.25 - len / 2, D / 2 + 0.3)
      ic.rotation.x = Math.PI
    }
    g.add(bulbs)
    roofs.push(house.roof(W / 2 + 0.6, D / 2 + 0.6, H + 5))
    roofs.push({ ...house.roof(2.4, 1.0, H1), ...(() => { const p = house.toWorld(0, 0, D / 2 + 0.75); return { x: p.x, z: p.z } })() })

    /* ---------- inside: the living room ---------- */
    add(g, new THREE.PlaneGeometry(W - 0.6, D - 0.6), new THREE.MeshStandardMaterial({ map: repeat(floorPlanks, 3, 3), roughness: 0.75 }), 0, 0.015, 0).rotation.x = -Math.PI / 2
    const ceiling = add(g, new THREE.PlaneGeometry(W - 0.6, D - 0.6), std(0xe8dcc8, 0.9), 0, H1 - 0.02, 0)
    ceiling.rotation.x = Math.PI / 2
    for (let i = -3; i <= 3; i++) add(g, box(0.25, 0.25, D - 0.6), std(0x5a3418, 0.7), i * 2.2, H1 - 0.15, 0)
    // a big oval rug
    const [rc, rctx] = makeCanvas(256, 256)
    rctx.fillStyle = '#7a1d24'
    rctx.beginPath()
    rctx.ellipse(128, 128, 126, 126, 0, 0, Math.PI * 2)
    rctx.fill()
    for (const [r, col] of [[110, '#1d5e3a'], [100, '#7a1d24'], [70, '#c8962a'], [62, '#7a1d24']] as const) {
      rctx.strokeStyle = col
      rctx.lineWidth = 8
      rctx.beginPath()
      rctx.ellipse(128, 128, r, r, 0, 0, Math.PI * 2)
      rctx.stroke()
    }
    const rug = add(g, new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ map: toTexture(rc), roughness: 1, transparent: true }), 0, 0.02, -2.9)
    rug.rotation.x = -Math.PI / 2
    rug.scale.set(3.2, 2.4, 1)

    // the fireplace on the back wall: a stone chimney breast, the fire, the mantel with garland, candles and stockings
    const [sc, sctx] = makeCanvas(256, 256)
    sctx.fillStyle = '#6a625a'
    sctx.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 256; y += 32)
      for (let x = (y / 32) % 2 ? -24 : 0; x < 256; x += 48) {
        const sh = 90 + Math.floor(Math.random() * 50)
        sctx.fillStyle = `rgb(${sh},${sh - 6},${sh - 12})`
        sctx.beginPath()
        sctx.roundRect(x + 2, y + 2, 44, 28, 8)
        sctx.fill()
      }
    const stone = new THREE.MeshStandardMaterial({ map: toTexture(sc), roughness: 0.95 })
    const fz = -D / 2 + 0.15
    for (const [w, h, x, y] of [[0.75, H1, -1.15, H1 / 2], [0.75, H1, 1.15, H1 / 2], [1.55, H1 - 1.2, 0, 1.2 + (H1 - 1.2) / 2]] as const) add(g, box(w, h, 0.75), stone, x, y, fz + 0.37)
    add(g, box(1.55, 1.2, 0.2), std(0x120c08, 0.9), 0, 0.6, fz + 0.1)
    add(g, box(3.2, 0.12, 1.3), std(0x5a524a, 0.9), 0, 0.06, fz + 0.65)
    house.block(0, fz + 0.5, 1.6, 0.6)
    const fireFlicker = fire(g, 0, 0.12, fz + 0.45, 1.3, 9)
    updaters.push((t) => fireFlicker(t))
    add(g, box(3.0, 0.14, 0.42), std(0x4a2a16, 0.5), 0, 1.4, fz + 0.86)
    // garland with red berries along the mantel, candles at its ends
    for (let i = 0; i < 14; i++) {
      add(g, new THREE.SphereGeometry(0.1, 8, 6), std(0x1d5e3a, 0.85), -1.35 + i * 0.208, 1.5 + Math.abs(Math.sin(i * 1.3)) * 0.03, fz + 0.95)
      if (i % 2) add(g, new THREE.SphereGeometry(0.035, 6, 5), std(0xc8102e, 0.4), -1.35 + i * 0.208, 1.55, fz + 1.05)
    }
    for (const x of [-1.3, 1.3]) {
      add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.28, 10), std(0xfbf3e0, 0.6), x, 1.61, fz + 0.86)
      add(g, new THREE.ConeGeometry(0.02, 0.06, 6), CANDLE, x, 1.78, fz + 0.86)
    }
    // the stockings: one for him, one for her, with their names on the cuffs
    const VELV = new THREE.MeshPhysicalMaterial({ color: 0xb3121f, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color(0xff7a7a) })
    for (const [x, name] of [[-0.55, 'Tomten'], [0.55, 'Tomtemor']] as const) {
      const st = new THREE.Group()
      st.position.set(x, 1.35, fz + 1.06)
      add(st, box(0.26, 0.5, 0.1), VELV, 0, -0.33, 0)
      const foot = add(st, new THREE.CapsuleGeometry(0.1, 0.16, 4, 8), VELV, 0.08, -0.6, 0)
      foot.rotation.z = Math.PI / 2
      add(st, box(0.32, 0.14, 0.14), std(0xf7f4ee, 1), 0, -0.07, 0)
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ map: signTexture([name], { w: 256, h: 80, bg: '#f7f4ee', fg: '#8a1a1e', accent: '#f7f4ee' }), roughness: 0.8 }))
      label.position.set(0, -0.07, 0.072)
      st.add(label)
      g.add(st)
    }

    // the two wing chairs facing the fire, the little table between them (cocoa pot, a plate of pepparkakor)
    const tomten = new Claus('tomten')
    const tomtemor = new Claus('tomtemor')
    tomten.partner = tomtemor
    tomtemor.partner = tomten
    const chairs = [
      { who: tomten, x: -0.75, yaw: Math.PI - 0.28, color: 0x7a1d24 },
      { who: tomtemor, x: 0.75, yaw: Math.PI + 0.28, color: 0x1d4a3a },
    ]
    for (const c of chairs) {
      const chair = wingChair(c.color)
      chair.position.set(c.x, 0, -2.2)
      chair.rotation.y = c.yaw
      g.add(chair)
      const fig = c.who.group
      fig.position.copy(chair.position)
      fig.rotation.y = c.yaw
      g.add(keepApart(fig))
      house.block(c.x, -2.25, 0.45, 0.45)
      solids.push(fig)
    }
    const table = new THREE.Group()
    table.position.set(0, 0, -2.3)
    add(table, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), std(0x4a2a16, 0.45), 0, 0.64, 0)
    add(table, new THREE.CylinderGeometry(0.04, 0.06, 0.6, 10), std(0x4a2a16, 0.45), 0, 0.32, 0)
    add(table, new THREE.CylinderGeometry(0.2, 0.22, 0.03, 16), std(0x4a2a16, 0.45), 0, 0.015, 0)
    add(table, new THREE.CylinderGeometry(0.13, 0.13, 0.015, 18), std(0xf7f4ee, 0.4), -0.08, 0.67, 0.08)
    for (let i = 0; i < 5; i++) add(table, new THREE.CylinderGeometry(0.035, 0.035, 0.01, 6), std(0x9a5a2a, 0.8), -0.08 + Math.cos(i * 1.3) * 0.06, 0.685 + i * 0.006, 0.08 + Math.sin(i * 1.3) * 0.06)
    add(table, new THREE.CylinderGeometry(0.07, 0.09, 0.2, 14), std(0xc8102e, 0.35), 0.1, 0.76, -0.1)
    add(table, new THREE.SphereGeometry(0.05, 10, 8), std(0xc8102e, 0.35), 0.1, 0.88, -0.1)
    g.add(table)
    house.block(0, -2.3, 0.3, 0.3)

    // the films: a wooden console television on legs, to the right of the fire
    const film = filmScreen()
    const tv = new THREE.Group()
    tv.position.set(3.0, 0, -5.0)
    tv.rotation.y = -0.6
    add(tv, box(1.1, 0.85, 0.6), std(0x6b3e1e, 0.45), 0, 0.85, 0)
    for (const [x, z] of [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]]) add(tv, new THREE.CylinderGeometry(0.025, 0.02, 0.42, 6), DARK, x, 0.21, z)
    const screen = add(tv, new THREE.PlaneGeometry(0.62, 0.47), new THREE.MeshBasicMaterial({ map: film.tex, toneMapped: false }), -0.12, 0.88, 0.302)
    keepApart(screen)
    for (let i = 0; i < 2; i++) add(tv, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), GOLD, 0.38, 1.0 - i * 0.16, 0.31).rotation.x = Math.PI / 2
    add(tv, box(0.02, 0.4, 0.02), IRON, -0.1, 1.45, 0)
    add(tv, box(0.02, 0.4, 0.02), IRON, 0.1, 1.45, 0).rotation.z = 0.5
    g.add(tv)
    house.block(3.0, -5.0, 0.6, 0.45)
    updaters.push((t) => film.draw(t))

    // the Christmas tree in the corner, presents under it
    const tree = new THREE.Group()
    tree.position.set(-6.0, 0, -4.6)
    add(tree, new THREE.CylinderGeometry(0.1, 0.12, 0.5, 8), DARK, 0, 0.25, 0)
    const needles = std(0x1d5236, 0.9)
    for (const [r, h, y] of [[1.2, 1.6, 1.1], [0.95, 1.4, 1.9], [0.65, 1.2, 2.6], [0.38, 0.9, 3.1]] as const) add(tree, new THREE.ConeGeometry(r, h, 14), needles, 0, y, 0)
    for (let i = 0; i < 40; i++) {
      const k = i / 40
      const y = 0.7 + k * 2.6
      const rr = THREE.MathUtils.lerp(1.15, 0.2, k) + 0.04
      const a = k * Math.PI * 2 * 6
      add(tree, new THREE.SphereGeometry(0.05, 6, 5), BULB_COLORS[i % 5], Math.cos(a) * rr, y, Math.sin(a) * rr)
    }
    add(tree, new THREE.OctahedronGeometry(0.16), GOLD, 0, 3.6, 0)
    for (let i = 0; i < 6; i++) {
      const s = 0.25 + (i % 3) * 0.08
      add(tree, box(s, s * 0.8, s), std([0xc8102e, 0x2fa36b, 0xf6c453, 0x2b5fa8][i % 4], 0.6), Math.cos(i) * 1.0, s * 0.4, Math.sin(i) * 1.0).rotation.y = i
    }
    g.add(tree)
    house.block(-6.0, -4.6, 1.2, 1.2)

    // a bookshelf, a grandfather clock telling the time, a chandelier with candles
    const shelf = new THREE.Group()
    shelf.position.set(-W / 2 + 0.55, 0, 0.8)
    shelf.rotation.y = Math.PI / 2
    add(shelf, box(2.4, 2.4, 0.4), std(0x4a2a16, 0.6), 0, 1.2, 0)
    for (let r = 0; r < 4; r++)
      for (let i = 0; i < 12; i++) {
        const h = 0.3 + ((i * 7 + r) % 5) * 0.03
        add(shelf, box(0.14, h, 0.3), std([0x7a1d24, 0x1d4a3a, 0xc8962a, 0x2b3a5a, 0x5a3418][(i + r) % 5], 0.7), -1.05 + i * 0.18, 0.25 + r * 0.55 + h / 2, 0.06)
      }
    g.add(shelf)
    house.block(-W / 2 + 0.55, 0.8, 0.25, 1.25)
    const clock = grandfatherClock(g, W / 2 - 0.5, 3.6, -Math.PI / 2)
    updaters.push((t) => clock(t))
    house.block(W / 2 - 0.5, 3.6, 0.25, 0.35)
    const chand = new THREE.Group()
    chand.position.set(0, H1 - 0.9, -1.5)
    add(chand, new THREE.TorusGeometry(0.5, 0.03, 6, 24), GOLD, 0, 0, 0).rotation.x = Math.PI / 2
    add(chand, new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), GOLD, 0, 0.45, 0)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      add(chand, new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), std(0xfbf3e0, 0.6), Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5)
      add(chand, new THREE.ConeGeometry(0.015, 0.04, 6), CANDLE, Math.cos(a) * 0.5, 0.18, Math.sin(a) * 0.5)
    }
    const roomLight = new THREE.PointLight(0xffc98a, 14, 14, 1.4)
    roomLight.position.y = 0.1
    chand.add(roomLight)
    g.add(chand)

    // the cat, asleep on the rug in front of the fire
    const cat = keepApart(new THREE.Group())
    cat.position.set(-0.9, 0, -4.5)
    const ginger = std(0xd8843a, 0.9)
    const catBody = add(cat, new THREE.SphereGeometry(0.2, 14, 10), ginger, 0, 0.12, 0)
    catBody.scale.set(1.3, 0.6, 1)
    const catHead = add(cat, new THREE.SphereGeometry(0.1, 12, 10), ginger, 0.2, 0.12, 0.1)
    for (const s of [-1, 1]) add(cat, new THREE.ConeGeometry(0.035, 0.07, 4), ginger, 0.2 + s * 0.05, 0.22, 0.1).rotation.z = -s * 0.3
    const tail = add(cat, new THREE.TorusGeometry(0.2, 0.03, 6, 16, Math.PI * 1.2), ginger, 0, 0.06, 0)
    tail.rotation.x = Math.PI / 2
    g.add(cat)
    updaters.push((t) => {
      catBody.scale.y = 0.6 + Math.sin(t * 1.4) * 0.02
      tail.rotation.z = Math.sin(t * 0.7) * 0.15
      catHead.rotation.z = Math.sin(t * 0.3) * 0.05
    })
    moving.push(cat)

    /* ---------- the people ---------- */
    // a nisse dropping by every few minutes, with news from the slädverkstad or the stable
    const visitor = new Nisse({ coat: 0x2fa36b, hat: 0xc8102e, apron: 0x8a5a32, scale: 0.85, beard: false, ears: true })
    visitor.group.visible = false
    // (it moves: kept out of the house's baking, or a ghost of it would stay behind in the room)
    g.add(keepApart(visitor.group))
    moving.push(visitor.group)
    const VISIT = 150
    const NEWS = [
      ['🧝 "Tomten! Vi har putsat medarna så att man kan se sig själv i dem!"', '🎅 "Ho ho ho! Det är ett mästerverk, mina vänner."'],
      ['🧝 "Tomtemor, finns det fler pepparkakor? Det frågar … hela verkstaden."', '🤶 "Det finns en plåt i ugnen. Ta med er några till stallet också."'],
      ['🧝 "Renarna har ätit upp alla polkagrisar igen. Igen!"', '🎅 "Då får vi beställa fler. Ho ho! Rudolf blir ju så glad."'],
      ['🧝 "Vi hittade en vante i stallet – är den din, Tomten?"', '🎅 "Där var den ju! Tack, lilla vän."'],
      ['🧝 "Bara en fråga: hur många paket ryms det egentligen i säcken?"', '🎅 "Alla, min vän. Alla som behövs. Ho ho ho!"'],
    ]
    let lastVisit = -1
    let spoke = -1
    updaters.push((t, dt, player) => {
      const sec = wallClock() / 1000
      const k = ((sec % VISIT) + VISIT) % VISIT
      const n = Math.floor(sec / VISIT)
      // in through the door, round the chairs to the fire, a word with them, and out again
      const route = [new THREE.Vector3(0, 0, D / 2 + 1.2), new THREE.Vector3(2.2, 0, 0), new THREE.Vector3(1.7, 0, -3.6)]
      const g2 = visitor.group
      // in for half a minute, the rest of the time out at work
      g2.visible = k < 40
      if (!g2.visible) return
      const walk = (u: number) => {
        // along the route at u 0…1 (by its two legs), facing the way it goes
        const a = u < 0.5 ? route[0] : route[1]
        const b = u < 0.5 ? route[1] : route[2]
        const was = g2.position.clone()
        g2.position.lerpVectors(a, b, u < 0.5 ? u * 2 : u * 2 - 1)
        if (g2.position.distanceToSquared(was) > 1e-8) g2.rotation.y = Math.atan2(g2.position.x - was.x, g2.position.z - was.z)
        visitor.walkPose(t * 9, 1)
      }
      if (k < 8) walk(k / 8)
      else if (k < 32) {
        g2.position.copy(route[2])
        // facing the two of them in their chairs
        g2.rotation.y = Math.atan2(0 - route[2].x, -2.2 - route[2].z)
        visitor.walkPose(0, 0)
        visitor.armR.rotation.z = Math.sin(t * 3) * 0.3 + 0.3
      } else walk(1 - (k - 32) / 8)
      // what they say, if you're in the room to hear it
      const local = house.group.worldToLocal(player.clone())
      const here = Math.abs(local.x) < W / 2 && Math.abs(local.z) < D / 2
      if (n !== lastVisit) {
        lastVisit = n
        spoke = -1
      }
      const line = NEWS[n % NEWS.length]
      const step = k > 8 && k < 9 ? 0 : k > 13 && k < 14 ? 1 : -1
      if (here && step >= 0 && step !== spoke && (step === 0 || day.tomteHome || line[1].startsWith('🤶'))) {
        spoke = step
        say(line[step])
        if (step === 1) (line[1].startsWith('🎅') ? tomten : tomtemor).laugh()
      }
      void dt
    })

    // they look at you if you come close; otherwise at the films, the fire, each other
    updaters.push((t, dt, player) => {
      tomten.group.visible = day.tomteHome
      const eyes = new THREE.Vector3(player.x, 1.6, player.z)
      for (const c of [tomten, tomtemor]) {
        const near = c.eyes().distanceTo(eyes) < 3.2
        c.update(t, dt, near ? eyes : null)
      }
    })

    talkers.push(
      { who: tomten, talk: tomtenTalk(() => day, () => opts.onNewYork()), present: () => day.tomteHome },
      { who: tomtemor, talk: tomtemorTalk(() => day), present: () => true },
    )
  }

  /* ====================================================================== Stallet */
  const stable = new Lot(49, -54, -Math.PI / 2)
  lots.push(stable)
  const deer: Reindeer[] = []
  let awaySign: THREE.Mesh
  {
    const W = 12
    const D = 9
    const H = 3.8
    const g = stable.group
    walls(stable, W, D, H, 0.3, DARK, new THREE.MeshStandardMaterial({ map: repeat(pine, 2.5, 1), roughness: 0.85, side: THREE.DoubleSide }), [{ wall: 'front', at: 0, width: 10.4, height: 3.2 }], timber)
    gableRoof(g, W, D, H, 3.2, roofMat, DARK, 0.6, timber)
    // Christmas on the stable: a garland over the doorway, lanterns, a julkärve for the birds
    garland(g, -5, 5, 3.0, D / 2 + 0.45, 4)
    for (const s of [-1, 1]) lantern(g, s * 5.4, 2.9, D / 2 + 0.3, 0.35)
    julkarve(g, W / 2 + 1.2, D / 2 + 0.8)
    stable.block(W / 2 + 1.2, D / 2 + 0.8, 0.12, 0.12)
    roofs.push(stable.roof(W / 2 + 0.6, D / 2 + 0.6, H + 3))
    // a pine ceiling (the roof is dark from below), the big stable doors swung wide open
    add(g, new THREE.PlaneGeometry(W - 0.6, D - 0.6), new THREE.MeshStandardMaterial({ map: repeat(pine, 3, 2), roughness: 0.85, side: THREE.DoubleSide }), 0, H - 0.05, 0).rotation.x = Math.PI / 2
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group()
      leaf.position.set(s * 5.2, 0, D / 2 + 0.1)
      leaf.rotation.y = s * 1.9
      add(leaf, box(2.6, 3.0, 0.1), plankDoor(2.6, 3.0), -s * 1.3, 1.5, 0)
      for (const y of [0.6, 2.4]) add(leaf, box(2.6, 0.14, 0.14), WHITE, -s * 1.3, y, 0.06)
      const brace = add(leaf, box(0.12, 3.1, 0.14), WHITE, -s * 1.3, 1.5, 0.06)
      brace.rotation.z = s * 0.6
      g.add(leaf)
    }
    // hay on the floor, hay bales in the corner, a lantern from the beam
    add(g, new THREE.PlaneGeometry(W - 0.6, D - 0.6), std(0xc8a456, 1), 0, 0.02, 0).rotation.x = -Math.PI / 2
    for (const [x, z, y] of [[4.8, 3.2, 0.3], [4.8, 2.1, 0.3], [4.8, 2.65, 0.9]] as const) {
      add(g, box(1.1, 0.6, 1.0), std(0xd8b866, 1), x, y, z)
      stable.block(x, z, 0.6, 0.55)
    }
    const stableLight = new THREE.PointLight(0xffc070, 7, 10, 1.5)
    stableLight.position.set(0, 2.6, 0.5)
    g.add(stableLight)
    add(g, box(0.25, 0.35, 0.25), WARM_GLASS, 0, 2.75, 0.5)
    // five stalls along the back, a trough of polkagrisar in front of each, a name over each
    const names = ['Komet', 'Dunder', 'Rudolf', 'Blixten', 'Cupido']
    names.forEach((name, i) => {
      const x = (i - 2) * 2.15
      if (i < 4) add(g, box(0.1, 1.3, 2.9), WOOD, x + 1.075, 0.65, -D / 2 + 1.6)
      // the trough (a wooden box on legs) heaped with polkagrisar
      add(g, box(1.4, 0.32, 0.5), WOOD, x, 0.5, -D / 2 + 3.1)
      add(g, box(1.3, 0.05, 0.4), DARK, x, 0.64, -D / 2 + 3.1)
      candyHeap(g, x, 0.69, -D / 2 + 3.1, 1.15, 0.3, 26, 31 + i * 7)
      for (const s of [-1, 1]) add(g, box(0.08, 0.34, 0.08), WOOD, x + s * 0.6, 0.17, -D / 2 + 3.1)
      const plate = sign([name], 1.2, 0.36, { w: 384, h: 112 })
      plate.position.set(x, 2.45, -D / 2 + 0.2)
      g.add(plate)
      const d = new Reindeer(name === 'Rudolf')
      d.group.position.set(x, 0, -D / 2 + 1.75)
      // (built facing -z: turned round to face the trough and the door)
      d.group.rotation.y = Math.PI
      g.add(keepApart(d.group))
      deer.push(d)
    })
    // you can come up to the troughs, but not into the stalls
    stable.block(0, -D / 2 + 1.9, W / 2 - 0.2, 1.65)
    stable.block(0, -D / 2 + 3.1, W / 2 - 0.4, 0.28)
    const stableSign = sign(['Stallet'], 2.2, 0.66)
    stableSign.position.set(0, H + 0.6, D / 2 + 0.2)
    g.add(stableSign)
    awaySign = keepApart(sign(['Ute och jobbar! 🛷', 'Tillbaka efter julafton'], 2.6, 0.82))
    awaySign.position.set(0, 1.6, -D / 2 + 3.5)
    g.add(awaySign)
    updaters.push((t) => {
      for (const d of deer) {
        d.group.visible = day.deerHome
        if (d.group.visible) d.update(t, 0)
      }
      awaySign.visible = !day.deerHome
    })
  }

  /* ====================================================================== Slädverkstaden */
  const shop = new Lot(32, -61.5, 0)
  lots.push(shop)
  const doors: { leaf: THREE.Group; s: number; box: Box }[] = []
  const workers: { n: Nisse; tool: 'cloth' | 'screwdriver' | 'ladder' }[] = []
  let doorOpen = 1
  {
    const W = 12
    const D = 10
    const H = 5.2
    const g = shop.group
    walls(shop, W, D, H, 0.3, DARK, new THREE.MeshStandardMaterial({ map: repeat(pine, 3, 1.5), roughness: 0.85, side: THREE.DoubleSide }), [
      { wall: 'front', at: 0, width: 7.2, height: 4.8 },
      { wall: 'right', at: -2.5, width: 1.3, height: 2.3 },
    ], timber)
    gableRoof(g, W, D, H, 3.6, roofMat, DARK, 0.6, timber)
    // Christmas: a garland over the great doors, lanterns, firs either side
    garland(g, -3.6, 3.6, 5.0, D / 2 + 0.45, 4)
    for (const s of [-1, 1]) {
      lantern(g, s * 4.2, 3.6, D / 2 + 0.3, 0.35)
      doorFir(g, s * 4.9, D / 2 + 1.0, 1.5)
      shop.block(s * 4.9, D / 2 + 1.0, 0.35, 0.35)
    }
    roofs.push(shop.roof(W / 2 + 0.6, D / 2 + 0.6, H + 3.4))
    add(g, new THREE.PlaneGeometry(W - 0.6, D - 0.6), std(0x8a8478, 0.95), 0, 0.02, 0).rotation.x = -Math.PI / 2
    add(g, new THREE.PlaneGeometry(W - 0.6, D - 0.6), new THREE.MeshStandardMaterial({ map: repeat(pine, 3, 2.5), roughness: 0.85, side: THREE.DoubleSide }), 0, H - 0.05, 0).rotation.x = Math.PI / 2
    const nameSign = sign(['Slädverkstaden'], 3.6, 1.0)
    nameSign.position.set(0, H + 0.9, D / 2 + 0.2)
    g.add(nameSign)
    // the two great doors, hinged at the sides of the opening
    for (const s of [-1, 1]) {
      const leaf = keepApart(new THREE.Group())
      leaf.position.set(s * 3.6, 0, D / 2 + 0.15)
      add(leaf, box(3.6, 4.7, 0.14), plankDoor(3.6, 4.7), -s * 1.8, 2.35, 0)
      for (const y of [0.5, 2.35, 4.2]) add(leaf, box(3.6, 0.16, 0.16), WHITE, -s * 1.8, y, 0.08)
      const brace = add(leaf, box(0.14, 4.6, 0.16), WHITE, -s * 1.8, 2.35, 0.08)
      brace.rotation.z = s * 0.65
      add(leaf, new THREE.TorusGeometry(0.12, 0.025, 6, 14), IRON, -s * 0.3, 2.3, 0.12)
      g.add(leaf)
      doors.push({ leaf, s, box: shop.block(-s * 1.8 + s * 3.6, D / 2 + 0.15, 1.8, 0.12, -Infinity, Infinity) })
    }
    // the side door, ajar – for anyone who simply must take the sleigh out early
    const side = new THREE.Group()
    // (the doorway is at z = 2.5: on the right-hand wall, `at` runs the other way)
    side.position.set(W / 2 + 0.15, 0, 2.5 + 0.65)
    side.rotation.y = 1.3
    add(side, box(0.08, 2.25, 1.3), plankDoor(1.3, 2.25), 0, 1.12, -0.65)
    g.add(side)
    // the workbench, tools on the wall, paint pots, a spare runner, lamps
    add(g, box(0.9, 0.9, 3.4), WOOD, -W / 2 + 0.75, 0.45, -1.2)
    shop.block(-W / 2 + 0.75, -1.2, 0.5, 1.75)
    add(g, box(0.05, 1.4, 3.2), std(0xc8a87a, 0.9), -W / 2 + 0.2, 1.8, -1.2)
    for (let i = 0; i < 6; i++) {
      const z = -2.5 + i * 0.5
      add(g, box(0.06, 0.4, 0.06), std(0x8a5a32, 0.6), -W / 2 + 0.28, 1.95, z)
      add(g, box(0.07, 0.1, 0.22), IRON, -W / 2 + 0.28, 2.18, z + (i % 2 ? 0.06 : -0.06))
    }
    for (let i = 0; i < 4; i++) add(g, new THREE.CylinderGeometry(0.12, 0.12, 0.2, 14), std([0xc8102e, 0xf6c453, 0x2fa36b, 0xfbf8f2][i], 0.4), -W / 2 + 0.6 + (i % 2) * 0.3, 1.0, 0.2 + i * 0.3)
    add(g, box(0.1, 0.1, 3.4), GOLD, W / 2 - 0.8, 0.05, -3.4).rotation.y = 0.2
    // (lamps cost every lit surface in the village a little: one real light for the two shades)
    for (const z of [-2, 2]) {
      add(g, new THREE.ConeGeometry(0.35, 0.25, 12, 1, true), std(0x2a5a3a, 0.5), 0, H - 1.0, z)
      add(g, new THREE.SphereGeometry(0.1, 8, 6), CANDLE, 0, H - 1.1, z)
    }
    const lamp = new THREE.PointLight(0xffd8a0, 16, 13, 1.3)
    lamp.position.set(0, H - 1.2, 0)
    g.add(lamp)
    const inSign = sign(['Tomtens slädverkstad', 'Puts · Smörjning · Medar'], 3.4, 1.06)
    inSign.position.set(0, 3.6, -D / 2 + 0.2)
    g.add(inSign)
    // the nissar at work on the sleigh (which stands in the middle, facing the doors – see WORKSHOP)
    const cloth = new THREE.MeshStandardMaterial({ color: 0xf6c453, roughness: 1, side: THREE.DoubleSide })
    const crew: [number, number, number, number, 'cloth' | 'screwdriver' | 'ladder', number][] = [
      [1.45, 0, 0.6, -Math.PI / 2, 'cloth', 0x2b5fa8],
      [-1.25, 0, -0.9, Math.PI / 2, 'screwdriver', 0xc8102e],
      [0.2, 0.62, -2.6, 0, 'ladder', 0x2fa36b],
    ]
    for (const [x, y, z, yaw, tool, coat] of crew) {
      const n = new Nisse({ coat, hat: tool === 'screwdriver' ? 0x2fa36b : 0xc8102e, apron: 0x8a5a32, scale: 0.9, beard: tool !== 'ladder', ears: tool === 'ladder' })
      n.group.position.set(x, y, z)
      n.setYaw(yaw)
      if (tool === 'screwdriver') {
        // kneeling down by the runner
        n.sit(true)
        n.group.position.y = -0.18
        const sd = new THREE.Group()
        add(sd, new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), std(0xf6c453, 0.4), 0, -0.47, 0.02)
        add(sd, new THREE.CylinderGeometry(0.007, 0.007, 0.16, 6), IRON, 0, -0.6, 0.02)
        n.armR.add(sd)
      } else {
        const c = add(n.armR, new THREE.PlaneGeometry(0.18, 0.16), cloth, 0, -0.47, 0.06)
        c.rotation.x = 0.3
      }
      if (tool === 'ladder') {
        const ladder = new THREE.Group()
        ladder.position.set(x, 0, z - 0.1)
        for (const s of [-1, 1]) add(ladder, box(0.05, 0.75, 0.05), WOOD, s * 0.25, 0.37, 0).rotation.x = s * 0.15
        for (const yy of [0.2, 0.4, 0.6]) add(ladder, box(0.55, 0.04, 0.2), WOOD, 0, yy, 0)
        g.add(ladder)
      }
      mergeRigid(n.group)
      g.add(keepApart(n.group))
      workers.push({ n, tool })
    }
    updaters.push((t, dt) => {
      // the doors stand open while the sleigh's in for its polish (and when it's going out)
      const want = day.sleighHome || day.flyingOut ? 1 : 0
      doorOpen += (want - doorOpen) * Math.min(1, dt * (day.flyingOut ? 5 : 1.5))
      for (const d of doors) {
        d.leaf.rotation.y = d.s * doorOpen * 1.75
        d.box.y0 = doorOpen > 0.2 ? 99 : -Infinity
      }
      // the nissar polish and tinker while the sleigh is in
      const working = day.sleighHome
      for (const w of workers) {
        w.n.group.visible = working
        if (!working) continue
        const p = t * (w.tool === 'cloth' ? 4 : 3) + w.n.group.position.x
        if (w.tool === 'screwdriver') {
          w.n.armR.rotation.set(-1.25, Math.sin(t * 7) * 0.5, -0.2)
          w.n.armL.rotation.set(-0.9, 0, 0.2)
        } else {
          // round and round with the cloth
          w.n.armR.rotation.set(-1.2 + Math.sin(p) * 0.25, 0, -0.25 + Math.cos(p) * 0.3)
          w.n.armL.rotation.set(-0.5, 0, 0.18)
        }
        w.n.head.rotation.x = 0.25
      }
    })
  }

  /* ====================================================================== the courtyard */
  {
    // a sign at the path, pointing the way
    const post = new THREE.Group()
    post.position.set(5.2, 0, -41.6)
    add(post, new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), DARK, 0, 1.3, 0)
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.4), new THREE.MeshStandardMaterial({ map: toTexture(drawArrowSign('Tomtegården', false)), roughness: 0.7, side: THREE.DoubleSide }))
    arrow.position.y = 2.2
    arrow.rotation.y = Math.PI / 2
    post.add(arrow)
    scene.add(post)
    colliders.push({ x: 5.2, z: -41.6, r: 0.2 })
    // trampled paths from the main path to the doors, lamp posts along them
    const trodden = std(0xd6dde9, 1)
    for (const [x0, z0, x1, z1] of [[3.5, -41, 41, -36], [24, -40, 32, -55.5], [30, -40, 43.5, -54]] as const) {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const strip = add(scene, new THREE.PlaneGeometry(2.4, len), trodden, (x0 + x1) / 2, 0.012, (z0 + z1) / 2)
      strip.rotation.set(-Math.PI / 2, 0, Math.atan2(x1 - x0, z1 - z0))
      strip.receiveShadow = true
    }
    const lampG = new THREE.Group()
    for (const [x, z] of [[12, -38.8], [22, -37.4], [32, -36.2], [27, -47.5], [37, -47]]) {
      add(lampG, new THREE.CylinderGeometry(0.07, 0.11, 3.2, 8), IRON, x, 1.6, z)
      add(lampG, box(0.3, 0.4, 0.3), WARM_GLASS, x, 3.4, z)
      add(lampG, new THREE.ConeGeometry(0.28, 0.25, 4), IRON, x, 3.75, z).rotation.y = Math.PI / 4
      add(lampG, new THREE.ConeGeometry(0.22, 0.12, 4), SNOW, x, 3.88, z).rotation.y = Math.PI / 4
      colliders.push({ x, z, r: 0.18 })
    }
    scene.add(lampG)
    // the mailbox: "Tomten & Tomtemor, Nordpolen"
    const mail = new THREE.Group()
    mail.position.set(40.2, 0, -32)
    add(mail, new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), DARK, 0, 0.55, 0)
    add(mail, box(0.36, 0.3, 0.55), std(0xc8102e, 0.4), 0, 1.25, 0)
    add(mail, new THREE.CylinderGeometry(0.18, 0.18, 0.55, 12, 1, false, 0, Math.PI), std(0xc8102e, 0.4), 0, 1.4, 0).rotation.x = Math.PI / 2
    const mailSign = sign(['Tomten & Tomtemor', 'Nordpolen'], 0.6, 0.2, { w: 384, h: 128 })
    mailSign.position.set(0.19, 1.25, 0)
    mailSign.rotation.y = Math.PI / 2
    mail.add(mailSign)
    scene.add(mail)
    colliders.push({ x: 40.2, z: -32, r: 0.3 })
    // a woodpile by the house
    const pile = new THREE.Group()
    pile.position.set(44.6, 0, -45.6)
    for (let r = 0; r < 4; r++)
      for (let i = 0; i < 9 - r; i++) {
        const log = add(pile, new THREE.CylinderGeometry(0.13, 0.13, 1.1, 8), std(0x7a5232, 0.9), (i - (8 - r) / 2) * 0.27, 0.13 + r * 0.24, 0)
        log.rotation.x = Math.PI / 2
      }
    add(pile, box(2.6, 0.08, 1.3), SNOW, 0, 1.08, 0)
    scene.add(pile)
    colliders.push({ x: 44.6, z: -45.6, r: 1.2 })
  }

  for (const l of lots) scene.add(l.group)
  for (const l of lots) solids.push(l.group)

  // what the visitors say goes to a toast (main.ts sets it)
  let say: (text: string) => void = () => {}

  function update(t: number, dt: number, player: THREE.Vector3) {
    for (const u of updaters) u(t, dt, player)
  }
  function setDay(d: GardenDay) {
    day = d
  }
  return {
    lots,
    roofs,
    colliders,
    solids,
    moving,
    talkers,
    update,
    setDay,
    set say(fn: (text: string) => void) {
      say = fn
    },
    /** Where to stand when you come back here from elsewhere: on the porch steps, facing the door. */
    porch: () => ({ at: house.toWorld(0, 0, 13 / 2 + 3.6), yaw: -Math.PI / 2 }),
  }
}

/* ====================================================================== what they say */
const talkers: { who: Claus; talk: Talk; present: () => boolean }[] = []

function tomtenTalk(day: () => GardenDay, newYork: () => void): Talk {
  const now = () => new Date(wallClock())
  return {
    name: 'Tomten',
    avatar: '🎅',
    greeting: () => {
      const d = now()
      const after = d.getUTCMonth() === 11 && d.getUTCDate() > 24
      return after
        ? [html.p('Ho ho ho! Välkommen in, välkommen in! Nu vilar vi, Tomtemor och jag. Julafton gick som på räls – eller som på medar, kanske.'), html.p('Sätt dig gärna en stund vid brasan.')]
        : [html.p('Ho ho ho! Kom in i värmen! Tomtemor har precis gjort varm choklad.'), html.p('Vi sitter här och tittar på de gamla julfilmerna. Samma varje år – och lika bra varje gång.')]
    },
    topics: [
      {
        label: '🛷 Hur går det med släden?',
        pages: () =>
          day().open
            ? [html.p('Nissarna putsar och skruvar för fullt borta i slädverkstaden. Medarna ska blänka och varenda bjällra ska klinga rent.'), html.p('Den 23:e kör vi ut den till Leksaksfabriken och lastar. Ho ho!')]
            : [html.p('Leksaksfabriken har stängt till den 1 december – där har nissarna semester. Det står till och med på porten.'), html.p('Men släden kan de inte låta bli: den putsar de i slädverkstaden här borta ändå. Ho ho ho!')],
      },
      {
        label: '🦌 Hur mår renarna?',
        pages: () => [html.p('Utmärkt! De står i stallet här bredvid och äter polkagrisar. Det är det de tycker allra bäst om.'), html.p('Rudolf äter mest. Han säger att det är för nosens skull.')],
      },
      {
        label: '📺 Vad tittar ni på?',
        pages: () => [html.p('Gamla svartvita julfilmer! Snö, slädar och tomtar – precis som vi har det här, fast i svartvitt.'), html.p('Tomtemor gråter alltid i slutet. Säg inte att jag sa det.')],
      },
      {
        label: '🗽 Kan vi åka till New York igen?',
        pages: () => [html.p('Ho ho ho! Den resan var något alldeles extra. Hela Central Park sjöng!'), html.p('Vill du åka igen? Säg bara till.')],
        go: () => {
          const d = now()
          // (after Christmas: off again on the spot; before it, the trip is on the 23rd)
          if ((d.getUTCMonth() === 11 && d.getUTCDate() > 24) || d.getUTCMonth() === 0) newYork()
          else say0('🎅 Ho ho! Den resan gör vi den 23 december, när släden är färdig. Kom till släden vid fabriken då!')
        },
      },
    ],
    bye: 'Ho ho ho! Kom snart tillbaka!',
  }
}

function tomtemorTalk(day: () => GardenDay): Talk {
  return {
    name: 'Tomtemor',
    avatar: '🤶',
    greeting: () =>
      day().tomteHome
        ? [html.p('Nämen hej! Kom in och värm dig. Vill du ha lite varm choklad? Det finns mer i kannan.'), html.p('Tomten har redan druckit tre koppar. Det är bra för magen, säger han.')]
        : [html.p('Hej, kära du! Tomten är ute med släden och renarna – det är full fart nu.'), html.p('Jag sitter här och stickar och håller brasan vid liv tills han kommer hem.')],
    topics: [
      {
        label: '☕ Hur gör du din varma choklad?',
        pages: () => [html.p('Riktig mörk choklad, smält i varm mjölk. En nypa kanel, en nypa salt och en klick vispgrädde.'), html.p('Och marshmallows. Tomten säger att man inte kan ha för många. Han har fel, men jag låter honom hållas.')],
      },
      {
        label: '🧦 Vems är strumporna över brasan?',
        pages: () => [html.p('Den ena är Tomtens och den andra är min. Det står på dem, ser du.'), html.p('Någon måste ju fylla Tomtens strumpa också. Det gör jag, varje år, när han har somnat på julaftonskvällen.')],
      },
      {
        label: '🧶 Vad stickar du?',
        pages: () => [html.p('En halsduk till Rudolf. Han fryser om halsen när han flyger högt.'), html.p('Den blir röd, så att den matchar nosen.')],
      },
    ],
    bye: 'Hej då, kära du! Ta en pepparkaka på vägen.',
  }
}

/** For the talk that can't start the trip yet (main.ts sets it to its toast). */
let say0: (text: string) => void = () => {}
export const tomtegardenToast = (fn: (text: string) => void) => (say0 = fn)
