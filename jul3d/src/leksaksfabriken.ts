// Leksaksfabriken: Tomtens great toy factory up at the North Pole, through the forest north of the
// square. A brick hall as big as a cathedral – a clock tower over the arched entrance, round corner
// towers, rows of lit windows, string lights up every edge and nutcracker guards at the door – with
// a giant tree and a mountain of presents in the yard in front.
//
// Inside, under the roof trusses: galleries round three walls, a tree reaching for the ceiling with
// a train going round it, presents riding a belt overhead and sliding down a spiral chute, great
// brass gears turning by the clock, toy planes circling, the mail room, wrapping tables, benches
// of hammering nissar – and Lasse Långnisse, the grown-up raised by the nissar, twice their height.
import * as THREE from 'three'
import { EVENTS, PARTICIPANTS } from './data'
import { bakeStatic, keepApart, mergeRigid } from './batch'
import { Nisse } from './npc'
import { Shop, sheet } from './shop'
import { drawBoard, glowTexture, makeCanvas, planksTexture, toTexture } from './tex'
import { html, type Talk } from './ui'
import type { BuiltShop } from './shops'
import { parade, stamping } from './verkstadslek'
import { chute as slideway } from './rutschkana'
import { wallClock } from './korsang'

/** Whether the great doors are open (December until tjugondag Knut): shut, the band inside is silent too (main.ts). */
export const factoryDoors = { open: true }
/** Shut, the doorway stops snowballs (added to the hitboxes; shown only while the doors are shut). */
const shutHit = keepApart(new THREE.Group())

/** The star on the big tree in the yard (the calendar's door 14 takes it away, until you bring it back). */
export const yardTree = { star: null as THREE.Object3D | null }

const JULAFTON = EVENTS.find((e) => e.santa) ?? EVENTS[EVENTS.length - 1]

/* ---------- the plan (shop-local metres: +z faces the village, the facade is at z = 12) ---------- */

/** The hall: walls at x = ±18, z = ±12, 13 m to the eaves and 8 more to the ridge. */
const W = 36
const D = 24
const H = 13
const RIDGE = 8
const IN_X = W / 2 - 0.6
const IN_Z = D / 2 - 0.6
/** The way in: an arched passage through the foot of the clock tower. */
const DOOR_W = 7
const DOOR_H = 9
/** How far the front walls reach below the ground. */
const SUNK = 0.4
const TOWER = { x: 5, z0: D / 2, z1: D / 2 + 6 }
/** The round towers' centres (±x, ±z) and radius. */
const CORNER = { x: W / 2 + 1.6, z: D / 2 + 1.6, r: 3.2 }
/** The galleries round the back and sides, and the stairs up to them along the front wall. */
const GALLERY_Y = 5.5
const GALLERY_D = 3
/** How far north it stands: the tower's foot is where the yard ends. */
const RADIUS = 86
/** Brick, plaster and roofs repeat every this many metres. */
const TILE = 3
const COLORS = { wall: '#8e3b2c', trim: 0xd4a64a, roof: 0x2c4f45 }

/* ---------- shared materials (merged by batch.ts) ---------- */

const mats = new Map<string, THREE.MeshStandardMaterial>()
const mat = (color: number, roughness = 0.7, metalness = 0) => {
  const k = `${color}|${roughness}|${metalness}`
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness }))
  return mats.get(k)!
}
const C = { wood: 0x8a5a32, dark: 0x4a2c1c, red: 0xc8102e, green: 0x1d6e48, blue: 0x2b5fa8, gold: 0xd4a64a, white: 0xfbf8f2, black: 0x1a1a1f, skin: 0xf1c7a5, yellow: 0xf2c94c, brown: 0x7a4a24, stone: 0xe6dcc6, snow: 0xf4f8ff, copper: 0x4f9a86, roof: 0x2c4f45, tower: 0x8e1f24 }

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}
/** Something that moves as one: its meshes merged into as few as possible, then left out of the room's bake. */
const moving = <T extends THREE.Object3D>(o: T): T => {
  mergeRigid(o)
  return keepApart(o)
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, n = 14) => new THREE.CylinderGeometry(rt, rb, h, n)
const ball = (r: number, n = 12) => new THREE.SphereGeometry(r, n, Math.max(6, n - 4))
// (lights shine through the fog: from the square the factory is a dim shape with its lights twinkling)
const glowMat = (inner: string, outer: string) => new THREE.SpriteMaterial({ map: glowTexture(inner, outer), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
function glow(parent: THREE.Object3D, x: number, y: number, z: number, size: number, inner = 'rgba(255,210,140,0.7)') {
  const s = new THREE.Sprite(glowMat(inner, 'rgba(255,170,80,0)'))
  s.position.set(x, y, z)
  s.scale.setScalar(size)
  parent.add(s)
  return s
}

/** Stretch a geometry's UVs so its texture repeats every TILE metres instead of once per face. */
function tiled<T extends THREE.BufferGeometry>(geo: T, su = 1 / TILE, sv = 1 / TILE): T {
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  return geo
}
/** A box whose texture keeps the same scale on every face. */
function tiledBox(w: number, h: number, d: number) {
  const g = box(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // faces: +x, -x (d × h), +y, -y (w × d), +z, -z (w × h); four corners each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = dims[Math.floor(i / 4)]
    uv.setXY(i, (uv.getX(i) * su) / TILE, (uv.getY(i) * sv) / TILE)
  }
  return g
}

function repeating(c: HTMLCanvasElement) {
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Red-brown brick with cream mortar, TILE metres square. */
function brickMaterial() {
  const [c, ctx] = makeCanvas(512, 512)
  ctx.fillStyle = '#d8cdbb'
  ctx.fillRect(0, 0, 512, 512)
  const rows = 12
  const cols = 6
  const bh = 512 / rows
  const bw = 512 / cols
  let seed = 3
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0
    for (let k = -1; k < cols; k++) {
      const shade = 0.82 + rand() * 0.3
      ctx.fillStyle = `rgb(${Math.round(150 * shade)},${Math.round(62 * shade)},${Math.round(46 * shade)})`
      ctx.fillRect(k * bw + off + 3, r * bh + 3, bw - 6, bh - 6)
    }
  }
  // a little frost settling in the mortar
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  for (let i = 0; i < 400; i++) ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 6, 1 + rand() * 2)
  return new THREE.MeshStandardMaterial({ map: repeating(c), roughness: 0.9 })
}

function plankMaterial(base: string, boards = 10) {
  const t = planksTexture(base, { boards, seed: base.length * 7 })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })
}

/** Warm plaster with a faint daub texture. */
function plasterMaterial() {
  const [c, ctx] = makeCanvas(256, 256)
  ctx.fillStyle = '#efe0c2'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(180,150,110,0.06)' : 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.arc((i * 97) % 256, (i * 57) % 256, 2 + (i % 7), 0, Math.PI * 2)
    ctx.fill()
  }
  return new THREE.MeshStandardMaterial({ map: repeating(c), roughness: 0.95 })
}

/** An arch (a rectangle with a half circle on top), standing on y = 0. */
function arch(w: number, h: number, path: THREE.Path = new THREE.Path(), x = 0, y = 0) {
  path.moveTo(x - w / 2, y)
  path.lineTo(x + w / 2, y)
  path.lineTo(x + w / 2, y + h - w / 2)
  path.absarc(x, y + h - w / 2, w / 2, 0, Math.PI, false)
  path.lineTo(x - w / 2, y)
  return path
}

/* ---------- little toys ---------- */

function present(color: number, ribbon: number, s = 0.16) {
  const g = new THREE.Group()
  add(g, box(s, s * 0.85, s), mat(color, 0.6), 0, (s * 0.85) / 2, 0)
  add(g, box(s + 0.004, s * 0.86, s * 0.18), mat(ribbon, 0.4), 0, (s * 0.85) / 2, 0)
  add(g, box(s * 0.18, s * 0.86, s + 0.004), mat(ribbon, 0.4), 0, (s * 0.85) / 2, 0)
  return g
}

function teddy(color = C.brown, s = 1) {
  const g = new THREE.Group()
  const fur = mat(color, 0.95)
  add(g, ball(0.07 * s), fur, 0, 0.07 * s, 0).scale.set(1, 1.15, 0.9)
  add(g, ball(0.05 * s), fur, 0, 0.18 * s, 0)
  for (const x of [-1, 1]) add(g, ball(0.018 * s, 8), fur, x * 0.035 * s, 0.225 * s, 0)
  add(g, ball(0.02 * s, 8), mat(0xe8c9a0, 0.9), 0, 0.17 * s, 0.04 * s)
  for (const x of [-1, 1]) add(g, ball(0.024 * s, 8), fur, x * 0.07 * s, 0.09 * s, 0.02 * s)
  return g
}

function drum(color = C.red) {
  const g = new THREE.Group()
  add(g, cyl(0.07, 0.07, 0.09, 16), mat(color, 0.5), 0, 0.045, 0)
  for (const y of [0.003, 0.087]) add(g, cyl(0.072, 0.072, 0.01, 16), mat(C.gold, 0.3, 0.7), 0, y, 0)
  add(g, cyl(0.066, 0.066, 0.002, 16), mat(C.white, 0.6), 0, 0.091, 0)
  return g
}

function doll(dress = C.blue) {
  const g = new THREE.Group()
  add(g, new THREE.ConeGeometry(0.05, 0.12, 12), mat(dress, 0.7), 0, 0.06, 0)
  add(g, ball(0.03), mat(C.skin, 0.6), 0, 0.15, 0)
  add(g, ball(0.032), mat(0xc98a2b, 0.9), 0, 0.165, -0.008).scale.set(1, 0.8, 1)
  return g
}

function rockingHorse() {
  const g = new THREE.Group()
  const wood = mat(0xf2e6d0, 0.6)
  const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 6, 24, 1.1), mat(C.red, 0.5))
  rocker.rotation.set(0, Math.PI / 2, -Math.PI / 2 - 0.55)
  for (const x of [-0.09, 0.09]) {
    const r = rocker.clone()
    r.position.set(x, 0.43, 0)
    g.add(r)
  }
  add(g, box(0.16, 0.14, 0.42), wood, 0, 0.36, 0)
  for (const [x, z] of [[-0.06, -0.15], [0.06, -0.15], [-0.06, 0.15], [0.06, 0.15]]) add(g, cyl(0.02, 0.02, 0.26, 8), wood, x, 0.2, z).rotation.x = z * 0.9
  const neck = add(g, box(0.1, 0.24, 0.1), wood, 0, 0.5, 0.2)
  neck.rotation.x = 0.4
  add(g, box(0.1, 0.1, 0.2), wood, 0, 0.62, 0.3)
  add(g, box(0.03, 0.2, 0.12), mat(C.dark, 0.9), 0, 0.55, 0.15).rotation.x = 0.4
  add(g, box(0.17, 0.03, 0.14), mat(C.red, 0.6), 0, 0.445, -0.02)
  return g
}

/** A small biplane, for circling the hall. */
function plane(body: number, wing: number) {
  const g = new THREE.Group()
  add(g, cyl(0.12, 0.08, 0.9, 12), mat(body, 0.45), 0, 0, 0).rotation.x = Math.PI / 2
  for (const y of [-0.1, 0.14]) add(g, box(1.3, 0.03, 0.28), mat(wing, 0.5), 0, y, 0.12)
  for (const x of [-0.5, 0.5]) add(g, box(0.02, 0.24, 0.02), mat(C.dark, 0.6), x, 0.02, 0.12)
  add(g, box(0.45, 0.025, 0.16), mat(wing, 0.5), 0, 0.02, -0.4)
  add(g, box(0.025, 0.2, 0.16), mat(body, 0.5), 0, 0.12, -0.4)
  add(g, ball(0.09, 10), mat(C.gold, 0.3, 0.7), 0, 0, 0.47)
  const prop = keepApart(new THREE.Group())
  add(prop, box(0.5, 0.05, 0.015), mat(C.dark, 0.6), 0, 0, 0)
  prop.position.z = 0.53
  g.add(prop)
  g.userData.prop = prop
  return g
}

/* ---------- people ---------- */

const LOOKS = [
  { coat: C.green, hat: C.red },
  { coat: C.red, hat: C.green },
  { coat: C.blue, hat: C.red },
  { coat: 0x8e3fb0, hat: C.green },
  { coat: 0xd4782a, hat: C.green },
  { coat: C.green, hat: C.white },
]
/** A nissa at work, merged with the room; a `busy` one keeps its right arm (and head) free to move. */
function worker(parent: THREE.Object3D, i: number, x: number, z: number, yaw: number, busy = false, y = 0) {
  const look = LOOKS[i % LOOKS.length]
  const n = new Nisse({ ...look, beard: false, ears: true, scale: 0.68, apron: i % 2 ? 0x8a6a4a : C.white })
  n.group.position.set(x, y, z)
  n.setYaw(yaw)
  n.armR.rotation.x = -1.1
  n.armL.rotation.x = -0.9
  n.head.rotation.x = 0.25
  parent.add(n.group)
  if (busy) {
    moving(n.armR)
    moving(n.head)
  }
  return n
}

/** The nutcracker guards at the door: tall black shakos, red coats, white beards and gold buttons. */
function nutcracker() {
  const g = new THREE.Group()
  // the pedestal
  add(g, box(1.7, 0.9, 1.7), mat(C.stone, 0.8), 0, 0.45, 0)
  add(g, box(1.85, 0.12, 1.85), mat(C.gold, 0.35, 0.7), 0, 0.9, 0)
  const s = new THREE.Group()
  s.position.y = 0.96
  s.scale.setScalar(2.2)
  g.add(s)
  for (const x of [-0.12, 0.12]) {
    add(s, box(0.16, 0.22, 0.26), mat(C.black, 0.35), x, 0.11, 0.03)
    add(s, cyl(0.075, 0.075, 0.5, 12), mat(C.white, 0.6), x, 0.47, 0)
  }
  add(s, cyl(0.25, 0.22, 0.55, 16), mat(C.red, 0.5), 0, 0.98, 0)
  add(s, cyl(0.235, 0.235, 0.08, 16), mat(C.black, 0.4), 0, 0.76, 0)
  add(s, box(0.11, 0.08, 0.03), mat(C.gold, 0.3, 0.8), 0, 0.76, 0.235)
  for (let i = 0; i < 4; i++) add(s, ball(0.025, 8), mat(C.gold, 0.3, 0.8), 0, 0.86 + i * 0.1, 0.245)
  // a white sash, gold epaulettes and the arms, holding a golden staff
  add(s, box(0.08, 0.62, 0.02), mat(C.white, 0.6), 0, 1.0, 0.0).rotation.z = 0.6
  for (const x of [-1, 1]) {
    add(s, cyl(0.1, 0.12, 0.06, 14), mat(C.gold, 0.3, 0.8), x * 0.27, 1.24, 0)
    const arm = new THREE.Group()
    arm.position.set(x * 0.3, 1.2, 0)
    arm.rotation.z = x * 0.12
    add(arm, cyl(0.06, 0.065, 0.5, 10), mat(C.red, 0.5), 0, -0.25, 0)
    add(arm, ball(0.07, 10), mat(C.white, 0.6), 0, -0.52, 0)
    s.add(arm)
  }
  add(s, cyl(0.02, 0.02, 1.7, 8), mat(C.gold, 0.3, 0.8), 0.33, 0.85, 0.05)
  add(s, new THREE.ConeGeometry(0.06, 0.16, 8), mat(C.gold, 0.3, 0.8), 0.33, 1.76, 0.05)
  // the head: a square jaw, a big white beard and moustache, rosy cheeks
  add(s, box(0.3, 0.32, 0.3), mat(C.skin, 0.55), 0, 1.45, 0)
  add(s, box(0.34, 0.16, 0.16), mat(C.white, 0.9), 0, 1.33, 0.1)
  add(s, box(0.24, 0.05, 0.04), mat(C.black, 0.5), 0, 1.4, 0.17)
  for (const x of [-0.07, 0.07]) {
    add(s, ball(0.025, 8), mat(C.black, 0.3), x, 1.52, 0.155)
    add(s, ball(0.035, 8), mat(0xe58a8a, 0.6), x * 1.7, 1.45, 0.14).scale.z = 0.4
  }
  for (const x of [-1, 1]) add(s, box(0.05, 0.3, 0.26), mat(C.white, 0.9), x * 0.17, 1.47, -0.02)
  // the shako with a gold band and a plume
  add(s, cyl(0.17, 0.16, 0.42, 16), mat(C.black, 0.35), 0, 1.82, 0)
  add(s, cyl(0.172, 0.172, 0.05, 16), mat(C.gold, 0.3, 0.8), 0, 1.66, 0)
  add(s, new THREE.CircleGeometry(0.07, 5), mat(C.gold, 0.3, 0.8), 0, 1.84, 0.172)
  add(s, new THREE.ConeGeometry(0.06, 0.26, 10), mat(C.white, 0.8), 0, 2.15, 0)
  add(s, ball(0.05, 8), mat(C.red, 0.6), 0, 2.05, 0)
  return g
}

/* ---------- moving parts ---------- */

/** A clock face with hands that go round: `speed` 1 is the workshop's own (very fast) time, null the village's real time. */
function clockFace(r: number, updaters: Shop['updaters'], speed: number | null = 1) {
  const [c, ctx] = makeCanvas(256, 256)
  ctx.fillStyle = '#fbf3e4'
  ctx.beginPath()
  ctx.arc(128, 128, 120, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#7a4c2a'
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.fillStyle = '#3a2410'
  ctx.font = '700 30px Fraunces, Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    ctx.fillText(String(i), 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92)
  }
  const g = new THREE.Group()
  add(g, cyl(r * 1.12, r * 1.12, 0.12, 40), mat(C.gold, 0.35, 0.7), 0, 0, -0.06).rotation.x = Math.PI / 2
  const face = add(g, new THREE.CircleGeometry(r, 40), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.6, emissive: 0xffe2b0, emissiveIntensity: 0.35 }), 0, 0, 0.005)
  face.castShadow = false
  const hand = (len: number, w: number) => {
    const h = keepApart(new THREE.Group())
    add(h, box(w, len, 0.02), mat(C.black, 0.4), 0, len / 2, 0)
    h.position.z = 0.02
    g.add(h)
    return h
  }
  const hour = hand(r * 0.52, r * 0.08)
  const minute = hand(r * 0.78, r * 0.05)
  updaters.push((t) => {
    if (speed === null) {
      // what the village clock says (the pretend ?tid= one too), the minute hand creeping on second by second
      const d = new Date(wallClock())
      const min = d.getUTCMinutes() + d.getUTCSeconds() / 60
      minute.rotation.z = -(min / 60) * Math.PI * 2
      hour.rotation.z = -(((d.getUTCHours() % 12) + min / 60) / 12) * Math.PI * 2
      return
    }
    minute.rotation.z = -t * 0.6 * speed
    hour.rotation.z = -t * 0.05 * speed
  })
  return g
}

/** A brass gear with `teeth` teeth, turning about its own axis (z). */
function gear(r: number, teeth: number) {
  const s = new THREE.Shape()
  const depth = Math.min(0.28, r * 0.16)
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2
    const rr = i % 4 < 2 ? r : r - depth
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  s.closePath()
  s.holes.push(new THREE.Path().absarc(0, 0, r * 0.22, 0, Math.PI * 2, true))
  // spokes: four windows cut out of the wheel
  for (let k = 0; k < 4; k++) {
    const a0 = (k / 4) * Math.PI * 2 + 0.25
    const a1 = a0 + Math.PI / 2 - 0.5
    const h = new THREE.Path()
    h.absarc(0, 0, r * 0.72, a0, a1, false)
    h.absarc(0, 0, r * 0.36, a1, a0, true)
    s.holes.push(h)
  }
  const g = keepApart(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false, curveSegments: 10 }), mat(0xc8963c, 0.35, 0.8)))
  g.castShadow = true
  return g
}

/** A giant decorated fir: tiers of snowy branches, a spiral of twinkling bulbs and a star. */
function bigTree(height: number, updaters: Shop['updaters'], bulbsN = 240) {
  const g = new THREE.Group()
  const k = height / 9
  add(g, cyl(0.4 * k, 0.55 * k, 1.8 * k, 12), mat(0x4a2c1c, 0.9), 0, 0.9 * k, 0)
  const tiers = [
    { r: 3.3, h: 3.4, y: 2.8 },
    { r: 2.7, h: 3.0, y: 4.5 },
    { r: 2.05, h: 2.6, y: 6.0 },
    { r: 1.35, h: 2.1, y: 7.3 },
    { r: 0.7, h: 1.5, y: 8.3 },
  ]
  // (the undersides get their own lighter green: you look up at them, and lit from above they'd be black)
  const under = new THREE.MeshStandardMaterial({ color: 0x2a6a46, emissive: 0x123a24, roughness: 0.95 })
  for (const t of tiers) {
    add(g, new THREE.ConeGeometry(t.r * k, t.h * k, 28, 1, true), mat(0x1d5236, 0.9), 0, t.y * k, 0)
    const disc = add(g, new THREE.CircleGeometry(t.r * k, 28), under, 0, (t.y - t.h / 2) * k + 0.01, 0)
    disc.rotation.x = Math.PI / 2
    disc.castShadow = false
    add(g, new THREE.ConeGeometry(t.r * k * 0.4, t.h * k * 0.28, 28), mat(C.snow, 0.9), 0, (t.y + t.h * 0.37) * k, 0).castShadow = false
  }
  // baubles (still) and bulbs (twinkling)
  const baubleCols = [C.red, C.gold, 0x4a7bd0, C.white]
  for (let i = 0; i < 40; i++) {
    const y = 1.6 + (i / 40) * 6.4
    const rr = THREE.MathUtils.lerp(3.15, 0.5, (y - 1.6) / 6.6) * 0.92
    const a = i * 2.39
    add(g, ball(0.16 * k, 12), mat(baubleCols[i % 4], 0.25, 0.5), Math.cos(a) * rr * k, y * k, Math.sin(a) * rr * k)
  }
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08 * k, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbsN)
  // (faintly lit through the dark of the Lucia procession – see korsang.ts)
  bulbs.material.userData.glimmer = 0.22
  const colors = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff, 0xff8de1, 0xfff4d6].map((c) => new THREE.Color(c))
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < bulbsN; i++) {
    const f = i / bulbsN
    const y = 1.5 + f * 7.2
    const rr = THREE.MathUtils.lerp(3.25, 0.2, (y - 1.5) / 7.3) + 0.05
    const a = f * Math.PI * 2 * 9
    m4.makeTranslation(Math.cos(a) * rr * k, y * k, Math.sin(a) * rr * k)
    bulbs.setMatrixAt(i, m4)
    bulbs.setColorAt(i, colors[i % colors.length])
  }
  g.add(bulbs)
  const star = keepApart(new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.7 * k, 0.3 * k), { depth: 0.18 * k, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false, fog: false })))
  star.geometry.center()
  star.position.y = 9.25 * k
  g.add(star)
  g.userData.star = star
  glow(g, 0, 9.25 * k, 0, 5 * k, 'rgba(255,220,120,0.9)')
  const tmp = new THREE.Color()
  updaters.push((t) => {
    for (let i = 0; i < bulbsN; i++) bulbs.setColorAt(i, tmp.copy(colors[i % colors.length]).multiplyScalar(0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + i * 1.37))))
    bulbs.instanceColor!.needsUpdate = true
    star.rotation.y = t * 0.6
  })
  return g
}

function starShape(outer: number, inner: number) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return s
}

/** String lights: one instanced mesh for every bulb along `lines`, each twinkling on its own. */
function stringLights(parent: THREE.Object3D, updaters: Shop['updaters'], lines: [THREE.Vector3, THREE.Vector3][], gap = 0.45, size = 0.09) {
  const spots: THREE.Vector3[] = []
  for (const [a, b] of lines) {
    const n = Math.max(2, Math.round(a.distanceTo(b) / gap))
    for (let i = 0; i <= n; i++) spots.push(a.clone().lerp(b, i / n))
  }
  const cols = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff, 0xfff1cf].map((c) => new THREE.Color(c))
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }), spots.length)
  const m4 = new THREE.Matrix4()
  spots.forEach((p, i) => {
    bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z))
    bulbs.setColorAt(i, cols[i % cols.length])
  })
  bulbs.computeBoundingSphere()
  parent.add(bulbs)
  const tmp = new THREE.Color()
  updaters.push((t) => {
    for (let i = 0; i < spots.length; i++) bulbs.setColorAt(i, tmp.copy(cols[i % cols.length]).multiplyScalar(0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 + i * 0.9))))
    bulbs.instanceColor!.needsUpdate = true
  })
}

/* ---------- the building ---------- */

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Lit arched windows, shared shapes and materials so they all merge into a few meshes. */
const litGlass = new THREE.MeshStandardMaterial({ color: 0x3a2410, emissive: 0xffb35a, emissiveIntensity: 1.25, roughness: 0.3, fog: false })
const nightGlass = new THREE.MeshStandardMaterial({ color: 0x0d1a3a, emissive: 0x1d3270, emissiveIntensity: 0.7, roughness: 0.2 })
const archGeos = new Map<string, { glass: THREE.ShapeGeometry; frame: THREE.ShapeGeometry }>()
function archWindow(w: number, h: number, night = false) {
  const key = `${w}|${h}`
  if (!archGeos.has(key)) {
    const frame = arch(w + 0.5, h + 0.35, new THREE.Shape(), 0, -0.2) as THREE.Shape
    archGeos.set(key, { glass: new THREE.ShapeGeometry(arch(w, h, new THREE.Shape()) as THREE.Shape, 16), frame: new THREE.ShapeGeometry(frame, 16) })
  }
  const geos = archGeos.get(key)!
  const g = new THREE.Group()
  add(g, geos.frame, mat(C.stone, 0.8), 0, 0, 0.01).castShadow = false
  add(g, geos.glass, night ? nightGlass : litGlass, 0, 0, 0.03).castShadow = false
  const bars = mat(night ? C.dark : C.white, 0.6)
  add(g, box(0.07, h - 0.1, 0.06), bars, 0, h / 2, 0.06)
  for (const y of [0.33, 0.66]) add(g, box(w, 0.06, 0.06), bars, 0, (h - w / 2) * y + (y > 0.5 ? 0.2 : 0), 0.06)
  if (!night) add(g, box(w + 0.6, 0.12, 0.3), mat(C.snow, 0.9), 0, -0.22, 0.14)
  return g
}

/** Put a flat thing (facing +z) on a wall's outer face. `face`: which way that face looks. */
function onFace(parent: THREE.Object3D, o: THREE.Object3D, face: 'front' | 'back' | 'left' | 'right', along: number, y: number, offset: number) {
  if (face === 'front') o.position.set(along, y, offset)
  else if (face === 'back') o.position.set(along, y, -offset)
  else if (face === 'left') o.position.set(-offset, y, along)
  else o.position.set(offset, y, along)
  o.rotation.y = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[face]
  parent.add(o)
  return o
}

function exterior(shop: Shop) {
  const g = shop.group
  const brick = brickMaterial()
  const stone = mat(C.stone, 0.8)
  const gold = mat(C.gold, 0.35, 0.7)
  const snow = mat(C.snow, 0.9)

  // the walls
  add(g, tiledBox(W, H, 0.6), brick, 0, H / 2, -D / 2 + 0.3)
  for (const s of [-1, 1]) add(g, tiledBox(0.6, H, D), brick, s * (W / 2 - 0.3), H / 2, 0)
  // the facade, with the arch cut out where the tower's passage comes through
  const facade = new THREE.Shape()
  // (the wall and the opening both reach a little way into the ground: an opening that started right at
  // ground level would leave a sliver of brick lying in the snow, flickering with it)
  facade.moveTo(-W / 2, -SUNK)
  facade.lineTo(W / 2, -SUNK)
  facade.lineTo(W / 2, H)
  facade.lineTo(-W / 2, H)
  facade.closePath()
  facade.holes.push(arch(DOOR_W, DOOR_H + SUNK / 2, new THREE.Path(), 0, -SUNK / 2))
  add(g, tiled(new THREE.ExtrudeGeometry(facade, { depth: 0.6, bevelEnabled: false, curveSegments: 20 })), brick, 0, 0, D / 2 - 0.6)
  // (at every height – up on the galleries too)
  for (const s of [-1, 1]) shop.block(s * (W / 4 + DOOR_W / 4), D / 2 - 0.3, W / 4 - DOOR_W / 4, 0.35, -Infinity, Infinity)
  shop.block(0, -D / 2 + 0.3, W / 2, 0.35, -Infinity, Infinity)
  for (const s of [-1, 1]) shop.block(s * (W / 2 - 0.3), 0, 0.35, D / 2, -Infinity, Infinity)

  // stone plinth and cornices round the whole hall
  for (const [y, h, out] of [[0.5, 1, 0.12], [6.4, 0.4, 0.2], [H - 0.2, 0.5, 0.35]] as const) {
    add(g, box(W + out * 2, h, out * 2), stone, 0, y, -D / 2)
    for (const s of [-1, 1]) {
      add(g, box(out * 2, h, D), stone, (s * W) / 2, y, 0)
      add(g, box(W / 2 - DOOR_W / 2, h, out * 2), stone, s * (W / 4 + DOOR_W / 4), y, D / 2)
    }
  }

  // windows: two rows round the hall
  const rows = [{ y: 1.4, h: 3.6 }, { y: 7.3, h: 4.3 }]
  for (const r of rows) {
    for (const x of [-13.4, -10.3, -7.2, 7.2, 10.3, 13.4]) onFace(g, archWindow(2.0, r.h), 'front', x, r.y, D / 2 + 0.01)
    for (const x of [-9, -4, 4, 9]) onFace(g, archWindow(2.0, r.h), 'back', x, r.y, D / 2 + 0.01)
    for (const z of [-7.5, -3.5, 0.5, 4.5]) {
      onFace(g, archWindow(2.0, r.h), 'left', -z, r.y, W / 2 + 0.01)
      onFace(g, archWindow(2.0, r.h), 'right', z, r.y, W / 2 + 0.01)
    }
  }

  // the roof: long slopes front and back, snow on top, brick gables at the ends
  const a = Math.atan2(RIDGE, D / 2)
  const over = 0.9
  const len = (D / 2 + over) / Math.cos(a)
  const roofMat = mat(C.roof, 0.75)
  const under = plankMaterial('#6b4226', 8)
  for (const s of [-1, 1]) {
    const cz = (s * (D / 2 + over)) / 2
    const cy = H - over * Math.tan(a) + (RIDGE + over * Math.tan(a)) / 2
    const n = v(0, Math.cos(a), s * Math.sin(a))
    const panel = add(g, box(W + 1.4, 0.35, len), roofMat, 0, cy, cz)
    panel.rotation.x = s * a
    const cover = add(g, box(W + 1.2, 0.3, len * 0.97), snow, n.x * 0.3, cy + n.y * 0.3, cz + n.z * 0.3)
    cover.rotation.x = s * a
    const ceil = add(g, tiledBox(W - 1.2, 0.05, len - 1.6), under, 0, cy - n.y * 0.24, cz - n.z * 0.24)
    ceil.rotation.x = s * a
  }
  const tri = new THREE.Shape()
  tri.moveTo(-D / 2, 0)
  tri.lineTo(D / 2, 0)
  tri.lineTo(0, RIDGE)
  tri.closePath()
  for (const s of [-1, 1]) {
    // the triangle stands in x/y; turned a quarter round it faces along x, extruded across the wall
    const gable = add(g, tiled(new THREE.ExtrudeGeometry(tri, { depth: 0.6, bevelEnabled: false })), brick, s * (W / 2) - 0.3, H, 0)
    gable.rotation.y = Math.PI / 2
    // a round window high in each gable
    const rose = onFace(g, new THREE.Group(), s < 0 ? 'left' : 'right', 0, H + 3, W / 2 + 0.02)
    add(rose, new THREE.CircleGeometry(1.25, 24), stone, 0, 0, 0).castShadow = false
    add(rose, new THREE.CircleGeometry(1.0, 24), litGlass, 0, 0, 0.02).castShadow = false
    for (let k = 0; k < 4; k++) add(rose, box(2, 0.08, 0.05), mat(C.white, 0.6), 0, 0, 0.05).rotation.z = (k * Math.PI) / 4
  }

  // dormers along the front slope
  const roofY = (z: number) => H + RIDGE * (1 - Math.abs(z) / (D / 2))
  for (const x of [-12.5, -8.5, 8.5, 12.5]) {
    const z = 8.2
    const by = roofY(z + 0.9)
    // the body, in side view: its foot follows the roof, so nothing pokes through the ceiling inside
    const side = new THREE.Shape()
    side.moveTo(z + 0.9, by - 0.1)
    side.lineTo(z + 0.9, by + 2.7)
    side.lineTo(z - 1.1, by + 2.7)
    side.lineTo(z - 1.1, roofY(z - 1.1) - 0.1)
    side.closePath()
    const body = add(g, tiled(new THREE.ExtrudeGeometry(side, { depth: 2.4, bevelEnabled: false })), brick, x + 1.2, 0, 0)
    body.rotation.y = -Math.PI / 2
    const tr = new THREE.Shape()
    tr.moveTo(-1.55, 0)
    tr.lineTo(1.55, 0)
    tr.lineTo(0, 1.4)
    tr.closePath()
    add(g, new THREE.ExtrudeGeometry(tr, { depth: 3.3, bevelEnabled: false }), mat(C.tower, 0.75), x, by + 2.7, z - 2.3)
    add(g, new THREE.ExtrudeGeometry(tr, { depth: 3.3, bevelEnabled: false }), snow, x, by + 2.85, z - 2.4).scale.set(0.85, 0.7, 1)
    onFace(g, archWindow(1.2, 1.9), 'front', x, by + 0.35, z + 0.91)
  }

  // chimneys on the back slope, smoking
  const smoke = glowTexture('rgba(235,235,240,0.5)', 'rgba(220,220,230,0)')
  for (const [x, z] of [[-11, -6], [2.5, -5], [12, -7]]) {
    const y = roofY(z)
    add(g, tiledBox(1.6, 4, 1.6), brick, x, y + 1.4, z)
    add(g, box(1.9, 0.3, 1.9), stone, x, y + 3.5, z)
    add(g, box(1.8, 0.2, 1.8), snow, x, y + 3.72, z)
    const puffs = Array.from({ length: 6 }, () => {
      const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: smoke, depthWrite: false, transparent: true }))
      g.add(p)
      return p
    })
    shop.updaters.push((t) => {
      puffs.forEach((p, i) => {
        const k = (t * 0.18 + i / puffs.length + x * 0.1) % 1
        p.position.set(x + k * 2.4 + Math.sin(t + i) * 0.3, y + 4.1 + k * 6, z + k * 0.8)
        p.scale.setScalar(1 + k * 3.4)
        p.material.opacity = (1 - k) * 0.8
      })
    })
  }

  // round towers on all four corners (just outside them, so they don't crowd the hall), with
  // pointed red roofs and gold finials
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * CORNER.x
      const z = sz * CORNER.z
      const r = CORNER.r
      const th = 17
      add(g, tiled(cyl(r, r + 0.15, th, 28), (2 * Math.PI * r) / TILE, th / TILE), brick, x, th / 2, z)
      for (const y of [0.5, 6.4, th - 0.2]) add(g, cyl(r + 0.25, r + 0.25, y < 1 ? 1 : 0.4, 28), stone, x, y, z)
      add(g, new THREE.ConeGeometry(r + 0.7, 8.5, 28), mat(C.tower, 0.75), x, th + 4.25, z)
      add(g, new THREE.ConeGeometry(1.3, 2.2, 28), snow, x, th + 7.5, z).castShadow = false
      add(g, cyl(0.05, 0.05, 1.6, 6), gold, x, th + 9.2, z)
      add(g, ball(0.3), gold, x, th + 8.7, z)
      const flag = add(g, box(1.1, 0.6, 0.03), mat(sx < 0 ? C.red : C.green, 0.7), x + 0.6, th + 9.6, z)
      flag.castShadow = false
      // windows looking out of the tower
      const out = Math.atan2(sx, sz)
      for (const y of [2, 8.4]) {
        // narrow, so a flat window sits on the curve without its edges sinking in
        const wdw = archWindow(0.9, y < 3 ? 2.4 : 2.8)
        wdw.position.set(x + Math.sin(out) * (r + 0.12), y, z + Math.cos(out) * (r + 0.12))
        wdw.rotation.y = out
        g.add(wdw)
      }
      shop.block(x, z, r * 0.9, r * 0.9)
    }

  // the clock tower over the entrance: an arched passage through its foot
  const base = new THREE.Shape()
  base.moveTo(-TOWER.x, -SUNK)
  base.lineTo(TOWER.x, -SUNK)
  base.lineTo(TOWER.x, H)
  base.lineTo(-TOWER.x, H)
  base.closePath()
  base.holes.push(arch(DOOR_W, DOOR_H + SUNK / 2, new THREE.Path(), 0, -SUNK / 2))
  add(g, tiled(new THREE.ExtrudeGeometry(base, { depth: TOWER.z1 - TOWER.z0, bevelEnabled: false, curveSegments: 20 })), brick, 0, 0, TOWER.z0)
  for (const s of [-1, 1]) shop.block(s * (TOWER.x + DOOR_W / 2) / 2, (TOWER.z0 + TOWER.z1) / 2, (TOWER.x - DOOR_W / 2) / 2 + 0.1, (TOWER.z1 - TOWER.z0) / 2)
  // gold trim round the arch, a stone keystone and candy-cane columns either side
  const archTrim = add(g, new THREE.TorusGeometry(DOOR_W / 2 + 0.15, 0.2, 10, 40, Math.PI), gold, 0, DOOR_H - DOOR_W / 2, TOWER.z1 + 0.05)
  archTrim.castShadow = false
  for (const s of [-1, 1]) add(g, box(0.4, DOOR_H - DOOR_W / 2, 0.4), gold, s * (DOOR_W / 2 + 0.15), (DOOR_H - DOOR_W / 2) / 2, TOWER.z1 + 0.05)
  add(g, box(0.9, 1.2, 0.5), stone, 0, DOOR_H + 0.35, TOWER.z1 + 0.1)
  const cane = caneMaterial()
  for (const s of [-1, 1]) {
    const x = s * (TOWER.x + 0.6)
    add(g, cyl(0.38, 0.38, 10, 18), cane, x, 5, TOWER.z1 + 0.5)
    const hook = add(g, new THREE.TorusGeometry(0.75, 0.38, 12, 24, Math.PI), cane, x - s * 0.75, 10, TOWER.z1 + 0.5)
    hook.rotation.y = s < 0 ? Math.PI : 0
    shop.block(x, TOWER.z1 + 0.5, 0.45, 0.45)
  }
  // garland and bulbs over the arch
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * Math.PI
    add(g, ball(0.32, 8), mat(0x1d5e3a, 0.9), Math.cos(t) * (DOOR_W / 2 + 0.55), DOOR_H - DOOR_W / 2 + Math.sin(t) * (DOOR_W / 2 + 0.55), TOWER.z1 + 0.2).castShadow = false
  }
  // the sign over the arch, then the tower above the roof line with the clocks
  shop.signMesh.scale.setScalar(7.6 / (shop.signMesh.geometry as THREE.PlaneGeometry).parameters.width)
  shop.signMesh.position.set(0, 11.3, TOWER.z1 + 0.06)
  const upper = new THREE.Group()
  upper.position.set(0, H, (TOWER.z0 + TOWER.z1) / 2 + 0.1)
  g.add(upper)
  const uw = 8.4
  const ud = 5.2
  add(upper, tiledBox(uw, 13, ud), brick, 0, 6.5, 0)
  for (const y of [0, 13]) add(upper, box(uw + 0.6, 0.45, ud + 0.6), stone, 0, y, 0)
  for (const [x, z, ry] of [[0, ud / 2 + 0.07, 0], [uw / 2 + 0.07, 0, Math.PI / 2], [-uw / 2 - 0.07, 0, -Math.PI / 2]] as const) {
    // (the tower tells the real time, for everyone in the village)
    const f = clockFace(2.5, shop.updaters, null)
    f.position.set(x, 7.4, z)
    f.rotation.y = ry
    upper.add(f)
  }
  // a wreath under the front clock
  const wreath = add(upper, new THREE.TorusGeometry(1.0, 0.32, 10, 28), mat(0x1d5e3a, 0.85), 0, 2.4, ud / 2 + 0.25)
  wreath.castShadow = false
  for (let i = 0; i < 10; i++) add(upper, ball(0.12, 8), mat(C.red, 0.35), Math.cos(i * 0.628) * 1.0, 2.4 + Math.sin(i * 0.628) * 1.0, ud / 2 + 0.55)
  add(upper, box(0.8, 0.35, 0.15), mat(C.red, 0.5), 0, 1.35, ud / 2 + 0.5)
  // the belfry: four corner posts round a golden bell
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(upper, box(1, 4, 1), stone, sx * (uw / 2 - 0.5), 15.2, sz * (ud / 2 - 0.5))
  add(upper, box(uw + 0.8, 0.5, ud + 0.8), stone, 0, 17.4, 0)
  const bell = new THREE.Group()
  bell.position.set(0, 16.6, 0)
  add(bell, new THREE.CylinderGeometry(0.45, 1.15, 1.7, 24, 1, true), new THREE.MeshStandardMaterial({ color: C.gold, roughness: 0.25, metalness: 0.85, side: THREE.DoubleSide }), 0, -0.9, 0)
  add(bell, ball(0.48), gold, 0, -0.05, 0)
  add(bell, ball(0.22), mat(C.dark, 0.4, 0.6), 0, -1.75, 0)
  upper.add(moving(bell))
  shop.updaters.push((t) => (bell.rotation.z = Math.sin(t * 1.1) * 0.12))
  glow(upper, 0, 15.3, 0, 4.5, 'rgba(255,200,120,0.55)')
  // the copper spire with a big gold star
  // (a square pyramid squeezed to the tower's oblong top: the cone turns inside, the group squeezes)
  const spire = new THREE.Group()
  spire.position.y = 22.6
  spire.scale.z = (ud / 2 + 0.4) / (uw / 2 + 0.4)
  add(spire, new THREE.ConeGeometry((uw / 2 + 0.4) * Math.SQRT2, 10, 4), mat(C.copper, 0.55, 0.3)).rotation.y = Math.PI / 4
  upper.add(spire)
  add(upper, cyl(0.08, 0.08, 2, 8), gold, 0, 28.4, 0)
  const star = keepApart(add(upper, new THREE.ExtrudeGeometry(starShape(1.2, 0.5), { depth: 0.3, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false, fog: false }), 0, 30, 0))
  star.geometry.center()
  glow(upper, 0, 30, 0, 9, 'rgba(255,220,120,0.9)')
  shop.updaters.push((t) => (star.rotation.y = t * 0.5))

  // string lights up every edge
  const e = H - over * Math.tan(a) - 0.12
  const lines: [THREE.Vector3, THREE.Vector3][] = [
    [v(-W / 2 + 2, e, D / 2 + over), v(-TOWER.x, e, D / 2 + over)],
    [v(TOWER.x, e, D / 2 + over), v(W / 2 - 2, e, D / 2 + over)],
    [v(-W / 2 + 2, H + RIDGE + 0.5, 0), v(W / 2 - 2, H + RIDGE + 0.5, 0)],
    [v(-TOWER.x, H + 0.3, TOWER.z1 + 0.35), v(TOWER.x, H + 0.3, TOWER.z1 + 0.35)],
    [v(-TOWER.x - 0.05, 0.3, TOWER.z1 + 0.05), v(-TOWER.x - 0.05, H, TOWER.z1 + 0.05)],
    [v(TOWER.x + 0.05, 0.3, TOWER.z1 + 0.05), v(TOWER.x + 0.05, H, TOWER.z1 + 0.05)],
  ]
  // down the spire's four edges and up the upper tower's corners
  const uz = (TOWER.z0 + TOWER.z1) / 2 + 0.1
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      lines.push([v(sx * (uw / 2 + 0.45), H + 17.75, uz + sz * (ud / 2 + 0.45)), v(0, H + 27.4, uz)])
      lines.push([v(sx * (uw / 2 + 0.05), H + 0.4, uz + sz * (ud / 2 + 0.05)), v(sx * (uw / 2 + 0.05), H + 12.8, uz + sz * (ud / 2 + 0.05))])
    }
  // and up the gables' roof edges
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lines.push([v(sx * (W / 2 + 0.72), e, sz * (D / 2 + over)), v(sx * (W / 2 + 0.72), H + RIDGE + 0.4, 0)])
  stringLights(g, shop.updaters, lines, 0.5, 0.11)

  // stone steps, a stone floor through the passage and a red carpet all the way in
  add(g, box(DOOR_W + 2, 0.12, 1.2), stone, 0, 0.06, TOWER.z1 + 0.6)
  add(g, box(DOOR_W + 3, 0.06, 1.2), stone, 0, 0.03, TOWER.z1 + 1.7)
  // (from just inside the hall, over the threshold, to the steps – a little above the hall floor so they never fight)
  add(g, box(DOOR_W, 0.06, TOWER.z1 - TOWER.z0 + 0.8), mat(0xb8ad98, 0.85), 0, 0.03, (TOWER.z0 + TOWER.z1) / 2 - 0.4).castShadow = false
  const carpetLen = TOWER.z1 + 2.3 - (D / 2 - 0.6)
  const carpet = add(g, new THREE.PlaneGeometry(3.2, carpetLen), mat(0xa0132a, 0.9), 0, 0.14, D / 2 - 0.6 + carpetLen / 2)
  carpet.rotation.x = -Math.PI / 2
  carpet.castShadow = false

  // the great doors, standing open into the hall – from the 1st of December until it all comes down after
  // tjugondag Knut; the rest of the year they're shut, with a note on them
  const open = 1.75
  const hinges: { hinge: THREE.Group; sx: number }[] = []
  for (const sx of [-1, 1]) {
    const dh = DOOR_H - DOOR_W / 2
    const hinge = keepApart(new THREE.Group())
    hinges.push({ hinge, sx })
    hinge.position.set(sx * (DOOR_W / 2 - 0.1), 0, D / 2 - 0.7)
    hinge.rotation.y = -sx * open
    const leaf = new THREE.Group()
    leaf.position.x = (-sx * DOOR_W) / 4
    add(leaf, box(DOOR_W / 2 - 0.1, dh, 0.18), mat(0xa0132a, 0.6), 0, dh / 2, 0)
    for (const y of [0.8, dh / 2, dh - 0.8]) {
      add(leaf, box(DOOR_W / 2 - 0.1, 0.16, 0.24), gold, 0, y, 0)
      for (let i = 0; i < 5; i++) for (const f of [-1, 1]) add(leaf, ball(0.05, 8), gold, -DOOR_W / 4 + 0.35 + i * ((DOOR_W / 2 - 0.7) / 4), y, f * 0.13)
    }
    for (const f of [-1, 1]) add(leaf, new THREE.TorusGeometry(0.22, 0.04, 8, 20), gold, sx * (DOOR_W / 4 - 0.45), 2.4, f * 0.14)
    hinge.add(leaf)
    g.add(hinge)
    const ox = (-sx * DOOR_W) / 4
    shop.block(hinge.position.x + ox * Math.cos(hinge.rotation.y), hinge.position.z - ox * Math.sin(hinge.rotation.y), 0.35, DOOR_W / 4)
  }
  const shut = shop.block(0, D / 2 - 0.7, DOOR_W / 2, 0.25, -Infinity, Infinity)
  // (shut, the doorway is filled right up into its arch – behind the leaves, so nothing shows through
  // the gaps between them – and snowballs stop at it)
  const filled = new THREE.Shape()
  arch(DOOR_W + 0.1, DOOR_H + 0.05, filled)
  const lunette = keepApart(add(g, new THREE.ShapeGeometry(filled, 24), mat(0x8a1020, 0.6), 0, 0, D / 2 - 0.85))
  ;(lunette.material as THREE.Material).side = THREE.DoubleSide
  const door = new THREE.Mesh(box(DOOR_W, DOOR_H, 0.4), new THREE.MeshBasicMaterial())
  door.position.set(0, DOOR_H / 2, D / 2 - 0.75)
  door.visible = false
  shutHit.add(door)
  const [nc, nctx] = makeCanvas(512, 256)
  nctx.fillStyle = '#fbf3e0'
  nctx.fillRect(0, 0, 512, 256)
  nctx.strokeStyle = '#c8102e'
  nctx.lineWidth = 10
  nctx.strokeRect(8, 8, 496, 240)
  nctx.fillStyle = '#8a1a1e'
  nctx.textAlign = 'center'
  nctx.font = "600 64px Fraunces, Georgia, serif"
  nctx.fillText('Out of Office 🎅', 256, 108)
  nctx.font = "600 40px 'DM Sans', sans-serif"
  nctx.fillText('Åter 1 december', 256, 178)
  nctx.font = "italic 26px Georgia, serif"
  nctx.fillText('– Tomten & nissarna', 256, 222)
  const note = keepApart(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshStandardMaterial({ map: toTexture(nc), roughness: 0.8, emissive: 0xffffff, emissiveMap: toTexture(nc), emissiveIntensity: 0.2 })))
  note.position.set(0, 2.2, D / 2 - 0.45)
  g.add(note)
  shop.updaters.push(() => {
    const d = new Date(wallClock())
    const m = d.getUTCMonth() + 1
    const isOpen = m === 12 || (m === 1 && d.getUTCDate() <= 13)
    for (const { hinge, sx } of hinges) hinge.rotation.y = isOpen ? -sx * open : 0
    shut.y0 = isOpen ? 99 : -Infinity
    note.visible = lunette.visible = shutHit.visible = !isOpen
    factoryDoors.open = isOpen
  })

  // the nutcracker guards
  for (const s of [-1, 1]) {
    const n = nutcracker()
    n.position.set(s * 8.2, 0, TOWER.z1 + 2.4)
    n.rotation.y = -s * 0.25
    g.add(n)
    shop.block(s * 8.2, TOWER.z1 + 2.4, 0.95, 0.95)
  }

  // light on the facade
  const front = new THREE.PointLight(0xffc98a, 90, 34, 1.3)
  front.position.set(0, 9, TOWER.z1 + 9)
  g.add(front)
}

function caneMaterial() {
  const [c, ctx] = makeCanvas(64, 256)
  ctx.fillStyle = '#fbf8f2'
  ctx.fillRect(0, 0, 64, 256)
  ctx.fillStyle = '#c8102e'
  for (let y = -64; y < 256; y += 48) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(64, y + 32)
    ctx.lineTo(64, y + 52)
    ctx.lineTo(0, y + 20)
    ctx.fill()
  }
  const t = repeating(c)
  t.repeat.set(1, 6)
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 })
}

/* ---------- the yard and the way there ---------- */

function yard(shop: Shop) {
  const g = shop.group
  // trampled snow over the yard, the forest standing round it (the cobbled path up to it is the village's)
  const [pc, pctx] = makeCanvas(256, 256)
  pctx.fillStyle = '#d6dde9'
  pctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 500; i++) {
    pctx.fillStyle = i % 2 ? 'rgba(160,170,190,0.18)' : 'rgba(255,255,255,0.35)'
    pctx.beginPath()
    pctx.ellipse((i * 73) % 256, (i * 151) % 256, 2 + (i % 7), 1 + (i % 4), i, 0, Math.PI * 2)
    pctx.fill()
  }
  const trampled = repeating(pc)
  trampled.repeat.set(10, 10)
  const ground = new THREE.MeshStandardMaterial({ map: trampled, roughness: 1 })
  const plaza = add(g, new THREE.PlaneGeometry(52, 22), ground, 0, 0.012, TOWER.z1 + 11)
  plaza.rotation.x = -Math.PI / 2
  plaza.castShadow = false

  // the giant tree on the left of the yard and a mountain of presents on the right, waiting for the sleigh (julaftonsrunda.ts)
  const tree = bigTree(17, shop.updaters, 320)
  tree.position.set(-13.5, 0, TOWER.z1 + 9)
  g.add(tree)
  yardTree.star = tree.userData.star
  // and heaps and heaps of presents under it, in rings and piles all the way round
  {
    const cols = [C.red, C.green, C.gold, C.blue, C.white, 0x8e3fb0, 0xd4782a, 0x2fa3a3]
    const ribbons = [C.gold, C.white, C.red, C.green]
    let n = 0
    // (the tree's lowest branches reach six metres out, so the heap starts under their tips and spills out past them)
    for (const [r, count, y, size] of [
      [4.6, 26, 0, 0.9], [5.5, 32, 0, 1.05], [6.4, 38, 0, 0.9], [7.2, 44, 0, 0.7],
      [5.0, 24, 0.8, 0.8], [5.9, 30, 0.85, 0.7], [6.7, 32, 0.65, 0.55],
      [5.4, 18, 1.5, 0.6], [6.2, 20, 1.4, 0.5], [5.8, 12, 2.0, 0.45],
    ] as const)
      for (let k = 0; k < count; k++, n++) {
        const a = (k / count) * Math.PI * 2 + r * 1.7
        const s = size * (0.75 + ((n * 37) % 10) / 20)
        const p = present(cols[n % cols.length], ribbons[(n * 3) % ribbons.length], s)
        p.position.set(-13.5 + Math.cos(a) * (r + ((n * 13) % 5) * 0.08), y, TOWER.z1 + 9 + Math.sin(a) * r)
        p.rotation.y = a * 2.7 + n
        g.add(p)
      }
  }
  shop.block(-13.5, TOWER.z1 + 9, 6.2, 6.2)
  const treeLight = new THREE.PointLight(0xffc77a, 50, 24, 1.5)
  treeLight.position.set(-13.5, 5, TOWER.z1 + 12)
  g.add(treeLight)
  const cols = [C.red, C.green, C.gold, C.blue, C.white, 0x8e3fb0]
  let i = 0
  for (const [n, r, y, s] of [[14, 2.6, 0, 0.9], [10, 1.8, 0.75, 0.8], [6, 1.0, 1.4, 0.7], [1, 0, 2.0, 0.8]] as const)
    for (let k = 0; k < n; k++, i++) {
      const a = (k / n) * Math.PI * 2 + y
      const p = present(cols[i % cols.length], cols[(i + 2) % cols.length], s * (0.8 + ((i * 7) % 5) * 0.08))
      p.position.set(13.5 + Math.cos(a) * r, y, TOWER.z1 + 5 + Math.sin(a) * r)
      p.rotation.y = a * 2.3
      g.add(p)
    }
  // a big red sack, bulging
  add(g, ball(1.1, 18), mat(0xa0132a, 0.9), 16.6, 0.95, TOWER.z1 + 3.2).scale.set(1, 1.15, 0.9)
  add(g, cyl(0.3, 0.45, 0.5, 12), mat(0xa0132a, 0.9), 16.6, 2.15, TOWER.z1 + 3.2)
  add(g, new THREE.TorusGeometry(0.33, 0.07, 6, 16), mat(C.gold, 0.4, 0.6), 16.6, 2.0, TOWER.z1 + 3.2).rotation.x = Math.PI / 2
  shop.block(13.5, TOWER.z1 + 5, 3.2, 3.2)
  shop.block(16.6, TOWER.z1 + 3.2, 1.1, 1.1)

  // lamp posts along the path and the yard
  const iron = mat(0x15151c, 0.5, 0.6)
  const flame = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })
  for (const z of [TOWER.z1 + 5, TOWER.z1 + 12, TOWER.z1 + 19]) {
    for (const s of [-1, 1]) {
      const x = s * (z > TOWER.z1 + 20 ? 3.1 : 4.6)
      add(g, cyl(0.08, 0.12, 3.6, 8), iron, x, 1.8, z)
      add(g, cyl(0.18, 0.26, 0.55, 6), iron, x, 3.85, z).castShadow = false
      add(g, ball(0.16, 10), flame, x, 3.85, z).castShadow = false
      add(g, new THREE.ConeGeometry(0.34, 0.32, 6), iron, x, 4.28, z)
      add(g, new THREE.ConeGeometry(0.27, 0.14, 6), mat(C.snow, 0.9), x, 4.42, z)
      glow(g, x, 3.85, z, 2.8)
      shop.block(x, z, 0.2, 0.2)
    }
  }

  // the gate where the path leaves the village: candy-cane posts and an arched sign
  const gz = RADIUS - 43
  const cane = caneMaterial()
  for (const s of [-1, 1]) {
    add(g, cyl(0.28, 0.28, 6.4, 16), cane, s * 3.8, 3.2, gz)
    add(g, ball(0.42, 14), mat(C.gold, 0.3, 0.8), s * 3.8, 6.6, gz)
    shop.block(s * 3.8, gz, 0.35, 0.35)
  }
  const top = add(g, new THREE.TorusGeometry(3.8, 0.16, 8, 40, Math.PI), mat(C.gold, 0.35, 0.7), 0, 5.4, gz)
  top.castShadow = false
  const [sc, sctx] = makeCanvas(1024, 256)
  sctx.fillStyle = '#7a1d1d'
  sctx.beginPath()
  sctx.roundRect(8, 8, 1008, 240, 60)
  sctx.fill()
  sctx.strokeStyle = '#f6c453'
  sctx.lineWidth = 12
  sctx.stroke()
  sctx.fillStyle = '#fff3dc'
  sctx.textAlign = 'center'
  sctx.textBaseline = 'middle'
  sctx.font = "600 100px Fraunces, Georgia, serif"
  sctx.fillText('Nordpolen', 512, 104)
  sctx.font = "600 48px 'DM Sans', sans-serif"
  sctx.fillStyle = '#f6c453'
  sctx.fillText('✦  LEKSAKSFABRIKEN  ✦', 512, 190)
  const signTex = toTexture(sc)
  const board = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25 })
  const sign = add(g, new THREE.PlaneGeometry(6.4, 1.6), board, 0, 6.2, gz)
  sign.castShadow = false
  // the back of the sign faces the factory, the right way round
  const back = add(g, new THREE.PlaneGeometry(6.4, 1.6), board, 0, 6.2, gz - 0.02)
  back.rotation.y = Math.PI
  back.castShadow = false
  stringLights(g, shop.updaters, Array.from({ length: 12 }, (_, k) => {
    const a0 = (k / 12) * Math.PI
    const a1 = ((k + 1) / 12) * Math.PI
    return [v(Math.cos(a0) * 3.8, 5.4 + Math.sin(a0) * 3.8, gz + 0.18), v(Math.cos(a1) * 3.8, 5.4 + Math.sin(a1) * 3.8, gz + 0.18)] as [THREE.Vector3, THREE.Vector3]
  }), 0.4, 0.09)
}

/* ---------- inside ---------- */

/** Where the foreman stands, behind his desk on the left as you come in. */
const SPOT = { x: -6.05, z: 8, yaw: Math.PI / 2 }

function hallInside(shop: Shop) {
  const g = shop.group
  const planks = plankMaterial('#b07a48', 10)
  const plaster = plasterMaterial()
  const timber = mat(0x4a2c1c, 0.8)
  const gold = mat(C.gold, 0.35, 0.7)

  // the floor, and a round red rug under the tree
  const floor = add(g, tiled(new THREE.PlaneGeometry(IN_X * 2, IN_Z * 2), (IN_X * 2) / 4, (IN_Z * 2) / 4), plankMaterial('#7a5232', 8), 0, 0.03, 0)
  floor.rotation.x = -Math.PI / 2
  floor.castShadow = false
  const rug = add(g, new THREE.CircleGeometry(7.4, 48), mat(0x8e1f24, 0.95), 0, 0.04, -2)
  rug.rotation.x = -Math.PI / 2
  rug.castShadow = false
  const rugEdge = add(g, new THREE.RingGeometry(7.0, 7.25, 48), mat(C.gold, 0.6), 0, 0.045, -2)
  rugEdge.rotation.x = -Math.PI / 2
  rugEdge.castShadow = false
  add(g, new THREE.PlaneGeometry(3.2, IN_Z - 5.4), mat(0xa0132a, 0.9), 0, 0.045, (IN_Z + 5.4) / 2).rotation.x = -Math.PI / 2

  // panelled walls below the galleries, plaster and timber above
  const panel = (w: number, h: number, x: number, y: number, z: number, ry: number, m: THREE.Material) => {
    const p = add(g, tiled(new THREE.PlaneGeometry(w, h), w / TILE, h / TILE), m, x, y, z)
    p.rotation.y = ry
    p.castShadow = false
    return p
  }
  panel(IN_X * 2, GALLERY_Y, 0, GALLERY_Y / 2, -IN_Z + 0.01, 0, planks)
  panel(IN_X * 2, H - GALLERY_Y, 0, (H + GALLERY_Y) / 2, -IN_Z + 0.01, 0, plaster)
  for (const s of [-1, 1]) {
    panel(IN_Z * 2, GALLERY_Y, s * (IN_X - 0.01), GALLERY_Y / 2, 0, -s * Math.PI / 2, planks)
    panel(IN_Z * 2, H - GALLERY_Y, s * (IN_X - 0.01), (H + GALLERY_Y) / 2, 0, -s * Math.PI / 2, plaster)
    // the front wall either side of the arch
    const fw = IN_X - DOOR_W / 2
    panel(fw, GALLERY_Y, s * (DOOR_W / 2 + fw / 2), GALLERY_Y / 2, IN_Z - 0.01, Math.PI, planks)
    panel(fw, H - GALLERY_Y, s * (DOOR_W / 2 + fw / 2), (H + GALLERY_Y) / 2, IN_Z - 0.01, Math.PI, plaster)
  }
  panel(DOOR_W, H - DOOR_H, 0, (H + DOOR_H) / 2, IN_Z - 0.01, Math.PI, plaster)
  // timber posts up the plaster
  for (let x = -IN_X + 0.1; x <= IN_X; x += IN_X / 4) add(g, box(0.3, H - GALLERY_Y, 0.15), timber, x, (H + GALLERY_Y) / 2, -IN_Z + 0.08)
  for (const s of [-1, 1]) for (let z = -IN_Z + 0.1; z <= IN_Z; z += IN_Z / 3) add(g, box(0.15, H - GALLERY_Y, 0.3), timber, s * (IN_X - 0.08), (H + GALLERY_Y) / 2, z)
  // night windows high on the side walls (the warm light is coming from in here)
  for (const z of [-7.5, -3.5, 0.5, 4.5]) {
    onFace(g, archWindow(2.0, 4.3, true), 'left', z, 7.3, -(IN_X - 0.02))
    onFace(g, archWindow(2.0, 4.3, true), 'right', -z, 7.3, -(IN_X - 0.02))
  }

  // the roof trusses
  for (let x = -IN_X + 2; x <= IN_X - 1.9; x += (IN_X * 2 - 4) / 7) {
    add(g, box(0.4, 0.5, IN_Z * 2), timber, x, H - 0.25, 0)
    add(g, box(0.35, RIDGE - 0.8, 0.35), timber, x, H + (RIDGE - 0.8) / 2, 0)
    for (const s of [-1, 1]) {
      const r = add(g, box(0.35, 0.45, Math.hypot(IN_Z, RIDGE - 0.6)), timber, x, H + (RIDGE - 0.6) / 2 - 0.25, (s * IN_Z) / 2)
      r.rotation.x = s * Math.atan2(RIDGE - 0.6, IN_Z)
      const strut = add(g, box(0.25, 0.3, 4.2), timber, x, H + 1.5, s * 2.2)
      strut.rotation.x = -s * 0.75
    }
  }

  // galleries round the back and both sides, on columns, with railings
  const deck = mat(0x6b4226, 0.8)
  const gy = GALLERY_Y
  const gd = GALLERY_D
  add(g, box(IN_X * 2, 0.35, gd), deck, 0, gy, -IN_Z + gd / 2)
  for (const s of [-1, 1]) add(g, box(gd, 0.35, IN_Z * 2 - gd), deck, s * (IN_X - gd / 2), gy, gd / 2)
  // you can walk up there: the decks to stand on, and railings to stop you stepping off
  const deckTop = gy + 0.175
  shop.floor(0, -IN_Z + gd / 2, IN_X, gd / 2, deckTop, false)
  for (const s of [-1, 1]) shop.floor(s * (IN_X - gd / 2), gd / 2, gd / 2, IN_Z - gd / 2, deckTop, false)
  const rail = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const r = add(g, box(len, 0.1, 0.12), gold, mid.x, gy + 1.05, mid.z)
    r.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x)
    add(g, box(len, 0.08, 0.08), timber, mid.x, gy + 0.55, mid.z).rotation.y = r.rotation.y
    const n = Math.round(len / 0.45)
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n)
      add(g, cyl(0.03, 0.03, 0.9, 6), timber, p.x, gy + 0.6, p.z).castShadow = false
    }
  }
  const ix = IN_X - gd
  const iz = -IN_Z + gd
  rail(v(-ix, 0, iz), v(ix, 0, iz))
  for (const s of [-1, 1]) rail(v(s * ix, 0, iz), v(s * ix, 0, IN_Z - 1.4))
  // (the railings only stop you up there: down on the floor you walk under the galleries)
  const UP = gy - 1
  shop.block(0, iz, ix, 0.08, UP, Infinity)
  for (const s of [-1, 1]) shop.block(s * ix, (iz + IN_Z - 1.4) / 2, 0.08, (IN_Z - 1.4 - iz) / 2, UP, Infinity)
  // columns holding the galleries up, with gold capitals
  const column = (x: number, z: number) => {
    add(g, cyl(0.24, 0.28, gy - 0.2, 14), timber, x, (gy - 0.2) / 2, z)
    add(g, cyl(0.38, 0.26, 0.3, 14), gold, x, gy - 0.3, z)
    shop.block(x, z, 0.3, 0.3)
  }
  for (let x = -ix; x <= ix + 0.01; x += (ix * 2) / 6) column(x, iz)
  for (const s of [-1, 1]) for (const z of [-3.6, 0.8, 5.2, 9.6]) column(s * ix, z)
  // stairs up to them along the front wall
  for (const s of [-1, 1]) {
    const steps = 20
    for (let i = 0; i < steps; i++) {
      const x = s * (DOOR_W / 2 + 2.6 + (i * (ix - DOOR_W / 2 - 2.6)) / steps)
      add(g, box((ix - DOOR_W / 2 - 2.6) / steps + 0.02, ((i + 1) * gy) / steps, 1.3), deck, x, ((i + 1) * gy) / steps / 2, IN_Z - 0.65)
      shop.floor(x, IN_Z - 0.65, (ix - DOOR_W / 2 - 2.6) / steps / 2 + 0.01, 0.65, ((i + 1) * gy) / steps, true)
    }
    const sx = s * ((DOOR_W / 2 + 2.6 + ix) / 2)
    const sl = add(g, box(Math.hypot(ix - DOOR_W / 2 - 2.6, gy), 0.1, 0.1), gold, sx, gy / 2 + 1, IN_Z - 1.35)
    sl.rotation.z = s * Math.atan2(gy, ix - DOOR_W / 2 - 2.6)
    // a handrail on the open side stops you, once you are a few steps up
    shop.block(sx, IN_Z - 1.38, (ix - DOOR_W / 2 - 2.6) / 2, 0.08, 1.2, Infinity)
    // a landing joining the stairs to the side gallery
    add(g, box(gd + 0.25, 0.35, 1.4), deck, s * (IN_X - gd / 2 - 0.12), gy, IN_Z - 0.7)
    // (reaching back over the top step, so there is no gap to fall through)
    shop.floor(s * (IN_X - gd / 2 - 0.12), IN_Z - 0.7, gd / 2 + 0.13, 0.7, deckTop, false)
  }

  // chandeliers
  const candle = mat(C.white, 0.6)
  const flame = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })
  for (const [x, z] of [[-8, -2], [8, -2], [-8, 6.5], [8, 6.5]]) {
    const y = 9.6
    add(g, cyl(0.03, 0.03, H - y, 6), mat(C.black, 0.5, 0.5), x, (H + y) / 2, z).castShadow = false
    add(g, new THREE.TorusGeometry(1.2, 0.07, 8, 32), gold, x, y, z).rotation.x = Math.PI / 2
    add(g, new THREE.TorusGeometry(0.6, 0.06, 8, 24), gold, x, y + 0.5, z).rotation.x = Math.PI / 2
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      add(g, cyl(0.04, 0.04, 0.26, 6), candle, x + Math.cos(a) * 1.2, y + 0.17, z + Math.sin(a) * 1.2).castShadow = false
      add(g, ball(0.05, 6), flame, x + Math.cos(a) * 1.2, y + 0.36, z + Math.sin(a) * 1.2).castShadow = false
    }
    glow(g, x, y + 0.3, z, 4.2, 'rgba(255,210,140,0.45)')
  }

  // bunting across the hall
  const flags = [C.red, C.green, C.gold, C.blue, C.white]
  for (const z of [-6.5, 1.5, 8.5]) {
    const n = 46
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n
      const x = -IN_X + k * IN_X * 2
      const flag = add(g, new THREE.ConeGeometry(0.2, 0.45, 3), mat(flags[i % flags.length], 0.7), x, H - 0.9 - Math.sin(k * Math.PI) * 1.6, z)
      flag.rotation.x = Math.PI
      flag.castShadow = false
    }
  }

  // warm light
  const main = new THREE.PointLight(0xffc98a, 120, 42, 1.2)
  main.position.set(0, 10, 2)
  g.add(main)
  const low = new THREE.PointLight(0xffb070, 30, 16, 1.4)
  low.position.set(0, 3.5, 7)
  g.add(low)
}

/** The tree in the middle of the hall, and a train going round it. */
function treeAndTrain(shop: Shop) {
  const cz = -2
  const tree = bigTree(11.6, shop.updaters, 260)
  tree.position.set(0, 0, cz)
  shop.group.add(tree)
  shop.block(0, cz, 3.6, 3.6)
  // presents round its foot
  const cols = [C.red, C.green, C.gold, C.blue, C.white]
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const p = present(cols[i % 5], cols[(i + 2) % 5], 0.35 + ((i * 5) % 4) * 0.08)
    p.position.set(Math.cos(a) * 3.3, 0.04, cz + Math.sin(a) * 3.3)
    p.rotation.y = a * 3
    shop.group.add(p)
  }
  train(shop, 0, cz, 5.4, 7)
}

/** A train going round its track on the floor. */
function train(shop: Shop, cx: number, cz: number, R: number, n: number) {
  const g = shop.group
  for (const r of [R - 0.12, R + 0.12]) {
    const track = add(g, new THREE.TorusGeometry(r, 0.03, 6, 96), mat(0x8a8f98, 0.4, 0.6), cx, 0.06, cz)
    track.rotation.x = -Math.PI / 2
    track.castShadow = false
  }
  const ties = Math.round(R * 14)
  for (let i = 0; i < ties; i++) {
    const a = (i / ties) * Math.PI * 2
    const s = add(g, box(0.08, 0.03, 0.4), mat(C.dark, 0.8), cx + Math.cos(a) * R, 0.045, cz + Math.sin(a) * R)
    s.rotation.y = -a
    s.castShadow = false
  }
  const colors = [C.red, C.blue, C.green, C.yellow, C.red, C.blue, C.green]
  const cols = [C.red, C.green, C.gold, C.blue]
  const cars = colors.slice(0, n).map((col, i) => {
    const c = new THREE.Group()
    const s = 2.2
    add(c, box(0.12 * s, 0.08 * s, 0.2 * s), mat(col, 0.5), 0, 0.09 * s, 0)
    if (i === 0) {
      add(c, cyl(0.04 * s, 0.04 * s, 0.14 * s, 12), mat(C.black, 0.5), 0, 0.12 * s, 0.04 * s).rotation.x = Math.PI / 2
      add(c, cyl(0.018 * s, 0.024 * s, 0.08 * s, 10), mat(C.black, 0.5), 0, 0.2 * s, 0.08 * s)
      add(c, box(0.12 * s, 0.1 * s, 0.07 * s), mat(C.red, 0.5), 0, 0.16 * s, -0.07 * s)
      add(c, ball(0.03 * s, 8), new THREE.MeshBasicMaterial({ color: 0xfff1b0, toneMapped: false }), 0, 0.12 * s, 0.115 * s)
    } else {
      const load = i % 2 ? present(cols[i % cols.length], C.gold, 0.16) : teddy(i % 3 ? C.brown : 0xc98a2b, 1)
      load.position.set(0, 0.13 * s, 0)
      c.add(load)
    }
    for (const wz of [-0.06, 0.06]) for (const wx of [-0.065, 0.065]) add(c, cyl(0.025 * s, 0.025 * s, 0.015 * s, 10), mat(C.black, 0.5), wx * s, 0.04 * s, wz * s).rotation.z = Math.PI / 2
    g.add(c)
    return moving(c)
  })
  // a puff of steam from the engine
  const steam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,0.6)', 'rgba(255,255,255,0)'), depthWrite: false, transparent: true }))
  g.add(steam)
  shop.updaters.push((t) => {
    cars.forEach((car, i) => {
      const a = t * 0.32 - i * (0.62 / R) * 1.1
      car.position.set(cx + Math.cos(a) * R, 0.06, cz + Math.sin(a) * R)
      car.rotation.y = -a
    })
    const k = (t * 1.3) % 1
    steam.position.set(cars[0].position.x, 0.75 + k * 0.8, cars[0].position.z)
    steam.scale.setScalar(0.3 + k * 0.7)
    steam.material.opacity = 1 - k
  })
}

/** Presents riding a belt round the hall overhead, on iron legs. */
function overheadBelt(shop: Shop) {
  const g = shop.group
  const y = 4.5
  const x0 = -11
  const x1 = 11
  const z0 = -7.5
  const z1 = 4.5
  const iron = mat(0x8e1f24, 0.45, 0.4)
  const corners = [v(x0, y, z0), v(x1, y, z0), v(x1, y, z1), v(x0, y, z1)]
  // the belt: a scrolling striped texture on each side of the loop
  const [c, ctx] = makeCanvas(64, 32)
  ctx.fillStyle = '#2b2b30'
  ctx.fillRect(0, 0, 32, 32)
  ctx.fillStyle = '#3d3d46'
  ctx.fillRect(32, 0, 32, 32)
  const tex = toTexture(c, { live: true })
  tex.wrapS = THREE.RepeatWrapping
  const beltMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
  const perimeter = 2 * (x1 - x0 + z1 - z0)
  for (let i = 0; i < 4; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % 4]
    const len = a.distanceTo(b)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const ry = -Math.atan2(b.z - a.z, b.x - a.x)
    // across the belt, for the gold rims on each side
    const nx = -(b.z - a.z) / len
    const nz = (b.x - a.x) / len
    add(g, box(len + 0.8, 0.1, 0.8), iron, mid.x, y - 0.06, mid.z).rotation.y = ry
    for (const s of [-1, 1]) add(g, box(len + 0.8, 0.12, 0.06), mat(C.gold, 0.35, 0.7), mid.x + s * nx * 0.42, y + 0.06, mid.z + s * nz * 0.42).rotation.y = ry
    const belt = add(g, tiled(new THREE.PlaneGeometry(len, 0.66), len * 2, 1), beltMat, mid.x, y + 0.005, mid.z)
    belt.rotation.set(-Math.PI / 2, 0, ry)
    belt.castShadow = false
  }
  // legs
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, -1.5], [x1, -1.5], [-5.5, z0], [5.5, z0], [-5.5, z1], [5.5, z1]]) {
    add(g, cyl(0.07, 0.09, y - 0.1, 8), iron, x, (y - 0.1) / 2, z)
    add(g, box(0.5, 0.06, 0.5), iron, x, 0.06, z)
    shop.block(x, z, 0.18, 0.18)
  }
  // the presents
  const N = 44
  const cols = [0xc8102e, 0x1d6e48, 0xd4a64a, 0x2b5fa8, 0xfbf8f2, 0x8e3fb0].map((c) => new THREE.Color(c))
  const boxes = new THREE.InstancedMesh(box(0.42, 0.36, 0.42), new THREE.MeshStandardMaterial({ roughness: 0.55 }), N)
  const ribbons = new THREE.InstancedMesh(box(0.44, 0.37, 0.09), new THREE.MeshStandardMaterial({ color: C.gold, roughness: 0.4, metalness: 0.3 }), N * 2)
  for (let i = 0; i < N; i++) boxes.setColorAt(i, cols[i % cols.length])
  boxes.castShadow = ribbons.castShadow = true
  g.add(boxes, ribbons)
  const at = (s: number) => {
    let d = ((s % perimeter) + perimeter) % perimeter
    for (let i = 0; i < 4; i++) {
      const a = corners[i]
      const b = corners[(i + 1) % 4]
      const len = a.distanceTo(b)
      if (d <= len) return a.clone().lerp(b, d / len)
      d -= len
    }
    return corners[0].clone()
  }
  const one = new THREE.Object3D()
  shop.updaters.push((t) => {
    tex.offset.x = -(t * 0.9) % 1
    for (let i = 0; i < N; i++) {
      const p = at(t * 0.9 + (i * perimeter) / N)
      one.position.set(p.x, y + 0.19, p.z)
      one.rotation.set(0, i * 0.4, 0)
      one.updateMatrix()
      boxes.setMatrixAt(i, one.matrix)
      ribbons.setMatrixAt(i * 2, one.matrix)
      one.rotation.y += Math.PI / 2
      one.updateMatrix()
      ribbons.setMatrixAt(i * 2 + 1, one.matrix)
    }
    boxes.instanceMatrix.needsUpdate = true
    ribbons.instanceMatrix.needsUpdate = true
  })
  boxes.frustumCulled = ribbons.frustumCulled = false
}

/** A spiral chute from the right-hand gallery down to a basket on the floor, presents sliding down. */
function chute(shop: Shop) {
  const g = shop.group
  const cx = 12.4
  const cz = -5.6
  const r = 1.75
  const turns = 2.25
  const top = GALLERY_Y + 0.55
  // start pointing at the gallery
  const a0 = 0
  const pt = (k: number) => {
    const a = a0 + k * turns * Math.PI * 2
    return v(cx + Math.cos(a) * r, top - k * (top - 0.75), cz + Math.sin(a) * r)
  }
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 60 }, (_, i) => pt(i / 59)))
  add(g, new THREE.TubeGeometry(curve, 200, 0.34, 10), mat(C.red, 0.35), 0, 0, 0)
  add(g, new THREE.TubeGeometry(curve, 200, 0.06, 6), mat(C.gold, 0.35, 0.7), 0, 0.36, 0).castShadow = false
  add(g, cyl(0.16, 0.16, top + 1.2, 12), mat(C.gold, 0.35, 0.7), cx, (top + 1.2) / 2, cz)
  add(g, ball(0.32), mat(C.gold, 0.3, 0.8), cx, top + 1.3, cz)
  // the basket at the bottom
  const end = pt(1)
  const bx = end.x + 0.6
  const bz = end.z
  add(g, new THREE.CylinderGeometry(0.85, 0.7, 0.8, 18, 1, true), mat(0xb0864a, 0.95), bx, 0.4, bz).material = new THREE.MeshStandardMaterial({ color: 0xb0864a, roughness: 0.95, side: THREE.DoubleSide })
  for (let i = 0; i < 6; i++) {
    const p = present([C.red, C.green, C.gold][i % 3], C.white, 0.32)
    p.position.set(bx + Math.cos(i) * 0.4, 0.3 + (i > 3 ? 0.25 : 0), bz + Math.sin(i) * 0.4)
    p.rotation.y = i
    g.add(p)
  }
  shop.block(cx, cz, r + 0.5, r + 0.5)
  shop.block(bx, bz, 0.9, 0.9)
  // (and you can go down it too: rutschkana.ts)
  slideway.curve = curve
  slideway.room = g
  slideway.basket.set(bx, 0, bz)
  const sliders = Array.from({ length: 6 }, (_, i) => {
    const p = moving(present([C.blue, C.red, C.green, C.gold, 0x8e3fb0, C.white][i], C.gold, 0.38))
    g.add(p)
    return p
  })
  shop.updaters.push((t) => {
    sliders.forEach((p, i) => {
      const k = (t * 0.16 + i / sliders.length) % 1
      const q = curve.getPointAt(k)
      p.position.set(q.x, q.y + 0.3, q.z)
      p.rotation.y = -k * turns * Math.PI * 2
    })
  })
  // a nissa on the gallery feeding it
  const n = worker(g, 2, cx + r + 0.9, cz - 0.6, -Math.PI / 2 - 0.4, true, GALLERY_Y + 0.17)
  shop.updaters.push((t) => (n.armR.rotation.x = -1.6 + Math.sin(t * 2.5) * 0.5))
}

/** The great brass gears turning on the back wall either side of the big clock. */
function gearsAndClock(shop: Shop) {
  const z = -IN_Z + 0.25
  const clock = clockFace(2.0, shop.updaters)
  clock.position.set(0, 9.4, z + 0.05)
  shop.group.add(clock)
  const spec: [number, number, number, number][] = [
    // x, y, radius, teeth (each turns the next, the other way round)
    [-4.95, 9.4, 2.45, 24],
    [-8.6, 10.9, 1.5, 15],
    [-10.9, 8.5, 1.15, 11],
    [-13.6, 10.3, 1.7, 17],
  ]
  for (const s of [-1, 1]) {
    spec.forEach(([x, y, r, teeth], i) => {
      const gr = gear(r, teeth)
      gr.position.set(s * x, y, z + (i % 2) * 0.04)
      shop.group.add(gr)
      const hub = add(shop.group, cyl(r * 0.24, r * 0.24, 0.4, 16), mat(C.dark, 0.5, 0.6), s * x, y, z + 0.2)
      hub.rotation.x = Math.PI / 2
      const speed = ((i % 2 ? -1 : 1) * s * 0.35) / r
      shop.updaters.push((t) => (gr.rotation.z = t * speed + i * 0.13))
    })
  }
  // a banner over it all
  const [c, ctx] = makeCanvas(1024, 160)
  ctx.fillStyle = '#1d6e48'
  ctx.fillRect(0, 0, 1024, 160)
  ctx.strokeStyle = '#f6c453'
  ctx.lineWidth = 10
  ctx.strokeRect(10, 10, 1004, 140)
  ctx.fillStyle = '#fff3dc'
  ctx.font = '600 76px Fraunces, Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Varje önskan räknas', 512, 84)
  const banner = add(shop.group, new THREE.PlaneGeometry(7.2, 1.12), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.8 }), 0, 11.95, z + 0.02)
  banner.castShadow = false
}

/** Planes circling high over the tree, and stars hanging from the trusses. */
function overhead(shop: Shop) {
  const g = shop.group
  const planes = [plane(C.red, C.white), plane(C.blue, C.yellow), plane(C.green, C.red)].map((p) => {
    g.add(p)
    return moving(p)
  })
  const gold = new THREE.MeshStandardMaterial({ color: C.gold, roughness: 0.3, metalness: 0.7, emissive: 0x6a4a10, emissiveIntensity: 0.5 })
  const stars = [[-12, 9.8, -4], [12, 10.2, 3], [-4, 11, 7], [4, 10.6, -8], [-13, 10.6, 6.5], [13, 9.6, -8.5]].map(([x, y, z]) => {
    const s = keepApart(add(g, new THREE.ExtrudeGeometry(starShape(0.6, 0.26), { depth: 0.12, bevelEnabled: false }), gold, x, y, z))
    s.geometry.center()
    add(g, cyl(0.01, 0.01, H - y, 4), mat(C.gold, 0.4, 0.6), x, (H + y) / 2 + 0.3, z).castShadow = false
    return s
  })
  shop.updaters.push((t) => {
    planes.forEach((p, i) => {
      const a = t * 0.35 + (i * Math.PI * 2) / planes.length
      const r = 7.6 + Math.sin(t * 0.5 + i) * 0.6
      p.position.set(Math.cos(a) * r, 7.6 + Math.sin(t * 0.8 + i * 2) * 0.5, -2 + Math.sin(a) * r)
      p.rotation.set(0, -a + Math.PI, 0.35)
      ;(p.userData.prop as THREE.Group).rotation.z = t * 25
    })
    stars.forEach((s, i) => (s.rotation.y = t * 0.4 + i))
  })
}

/** The mail room under the back gallery on the left: pigeonholes full of letters, sacks of them on the floor. */
function mailRoom(shop: Shop) {
  const g = shop.group
  const z = -IN_Z + 0.25
  const x0 = -IN_X + 0.6
  const w = 6
  const h = 3.8
  const cols = 12
  const rows = 8
  const wood = mat(C.wood, 0.75)
  add(g, box(w, h, 0.5), mat(C.dark, 0.8), x0 + w / 2, 0.4 + h / 2, z)
  for (let i = 0; i <= cols; i++) add(g, box(0.05, h, 0.55), wood, x0 + (i * w) / cols, 0.4 + h / 2, z + 0.03)
  for (let j = 0; j <= rows; j++) add(g, box(w, 0.05, 0.55), wood, x0 + w / 2, 0.4 + (j * h) / rows, z + 0.03)
  const paper = mat(C.white, 0.9)
  const pink = mat(0xf7d6d6, 0.9)
  const blue = mat(0xd6e4f7, 0.9)
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 3) % 5 === 0) continue
      const m = [paper, pink, blue][(i + j) % 3]
      add(g, box(w / cols - 0.12, (h / rows) * 0.55, 0.06), m, x0 + ((i + 0.5) * w) / cols, 0.4 + (j * h) / rows + (h / rows) * 0.32, z + 0.18).rotation.z = ((i * j) % 3) * 0.06 - 0.06
    }
  // the sign
  const [c, ctx] = makeCanvas(512, 128)
  ctx.fillStyle = '#7a1d1d'
  ctx.fillRect(0, 0, 512, 128)
  ctx.fillStyle = '#fff3dc'
  ctx.font = '600 58px Fraunces, Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Brev till Tomten', 256, 66)
  add(g, new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.8 }), x0 + w / 2, 4.75, z + 0.3).castShadow = false
  // sacks of letters, and loose ones on the floor
  for (const [x, zz, s] of [[-15.2, -9.5, 1], [-13.8, -9.7, 0.85], [-16.5, -8.8, 0.9], [-12.6, -9.8, 0.75]] as const) {
    add(g, ball(0.55 * s, 14), mat(0xc9b48a, 0.95), x, 0.5 * s, zz).scale.set(1, 1.1, 0.85)
    add(g, cyl(0.16 * s, 0.26 * s, 0.3 * s, 10), mat(0xc9b48a, 0.95), x, 1.05 * s, zz)
    add(g, box(0.3, 0.2, 0.02), paper, x + 0.1, 1.2 * s, zz + 0.1).rotation.z = 0.4
  }
  for (let i = 0; i < 14; i++) {
    const l = add(g, box(0.28, 0.01, 0.18), [paper, pink, blue][i % 3], -14.5 + ((i * 37) % 30) / 10, 0.045, -10.3 + ((i * 53) % 18) / 10)
    l.rotation.y = i
    l.castShadow = false
  }
  shop.block(x0 + w / 2, z + 0.1, w / 2, 0.45)
  shop.block(-14.6, -9.4, 2.2, 0.7)
  // a nissa sorting at a desk beside it
  const dx = -9.4
  const dz = -9.6
  add(g, box(1.6, 0.06, 0.8), wood, dx, 0.78, dz)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.06, 0.78, 0.06), mat(C.dark, 0.7), dx + sx * 0.7, 0.39, dz + sz * 0.32)
  for (let i = 0; i < 5; i++) add(g, box(0.28, 0.012, 0.19), paper, dx - 0.4 + i * 0.18, 0.82 + i * 0.012, dz).rotation.y = i * 0.3
  shop.block(dx, dz, 0.85, 0.45)
  const n = worker(g, 0, dx, dz + 0.75, Math.PI, true)
  shop.updaters.push((t) => {
    n.armR.rotation.x = -1.3 + Math.sin(t * 4) * 0.4
    n.head.rotation.y = Math.sin(t * 0.7) * 0.4
  })
}

/** Long tables of nissar wrapping presents. */
function wrapping(shop: Shop, x: number, z: number, first: number) {
  const g = shop.group
  const len = 5
  add(g, box(len, 0.08, 1.1), mat(C.wood, 0.7), x, 0.82, z)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.08, 0.82, 0.08), mat(C.dark, 0.7), x + sx * (len / 2 - 0.2), 0.41, z + sz * 0.45)
  const papers = [0xc8102e, 0x1d6e48, 0x2b5fa8, 0xd4a64a]
  for (let i = 0; i < 4; i++) {
    const roll = add(g, cyl(0.07, 0.07, 1.0, 12), mat(papers[i], 0.6), x - len / 2 + 0.6 + i * 1.3, 0.93, z + 0.35)
    roll.rotation.z = Math.PI / 2
    const p = present(papers[(i + 1) % 4], C.gold, 0.3)
    p.position.set(x - len / 2 + 0.9 + i * 1.3, 0.86, z - 0.1)
    p.rotation.y = i * 0.5
    g.add(p)
    // a bow on a spool, ribbons trailing
    add(g, cyl(0.06, 0.06, 0.05, 10), mat(C.gold, 0.4, 0.5), x - len / 2 + 0.4 + i * 1.3, 0.88, z - 0.35)
  }
  shop.block(x, z, len / 2 + 0.1, 0.6)
  for (let i = 0; i < 3; i++) worker(g, first + i, x - 1.6 + i * 1.6, z - 0.95, 0)
}

/** A nisse up a ladder, painting a rocking horse. */
/**
 * The chessboard nisse, as on the ordinary 2D page (see Scenery.tsx): a nod to the painting nisse in
 * Tomtens verkstad on Kalle Anka – the paint in his bucket is already checkered, so every stroke leaves
 * orange-and-black squares. The board on its easel is half done and stays that way; he just keeps dabbing.
 */
function chessNisse(shop: Shop, x: number, z: number, yaw: number) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = yaw
  const S = 1.3
  // the board: the left side painted, a ragged brush edge towards the right, wet drips at the edge
  const [c, ctx] = makeCanvas(512, 512)
  ctx.fillStyle = '#8b5a2b'
  ctx.fillRect(0, 0, 512, 512)
  ctx.fillStyle = '#ecd3ac'
  ctx.fillRect(16, 16, 480, 480)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(16, 16)
  ctx.lineTo(16 + 480 * 0.62, 16)
  const edge = [[0.6, 0.08], [0.65, 0.2], [0.6, 0.32], [0.67, 0.44], [0.62, 0.55], [0.7, 0.67], [0.66, 0.8], [0.74, 0.9], [0.78, 1]]
  for (const [ex, ey] of edge) ctx.lineTo(16 + 480 * ex, 16 + 480 * ey)
  ctx.lineTo(16, 496)
  ctx.closePath()
  ctx.clip()
  const cell = 480 / 8
  for (let r = 0; r < 8; r++)
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = (r + k) % 2 ? '#14141a' : '#f6a623'
      ctx.fillRect(16 + k * cell, 16 + r * cell, cell, cell)
    }
  ctx.restore()
  // the drips: checkered, of course
  const drip = (dx: number, dy: number) => {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#14141a' : '#f6a623'
      ctx.fillRect(16 + 480 * dx - 6, 16 + 480 * dy + i * 8, 12, 8)
    }
  }
  drip(0.64, 0.14)
  drip(0.7, 0.5)
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2 * S, 1.2 * S, 0.05), [mat(C.wood, 0.7), mat(C.wood, 0.7), mat(C.wood, 0.7), mat(C.wood, 0.7), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.7 }), mat(C.wood, 0.7)])
  board.position.set(0, 1.3 * S, 0)
  board.rotation.x = -0.12
  g.add(board)
  // the easel: two legs in front, one behind, a ledge under the board
  for (const s of [-1, 1]) {
    const leg = add(g, box(0.05, 2.0 * S, 0.05), mat(C.wood, 0.7), s * 0.45 * S, 0.95 * S, 0.05)
    leg.rotation.z = s * 0.1
  }
  const back = add(g, box(0.05, 2.0 * S, 0.05), mat(C.wood, 0.7), 0, 0.92 * S, -0.35 * S)
  back.rotation.x = 0.3
  add(g, box(1.3 * S, 0.06, 0.12), mat(C.wood, 0.7), 0, 0.5 * S, 0.06)
  // the bucket – the paint inside it already checkered
  const [bc, bctx] = makeCanvas(64, 64)
  for (let r = 0; r < 8; r++)
    for (let k = 0; k < 8; k++) {
      bctx.fillStyle = (r + k) % 2 ? '#14141a' : '#f6a623'
      bctx.fillRect(k * 8, r * 8, 8, 8)
    }
  const checks = new THREE.MeshStandardMaterial({ map: toTexture(bc), roughness: 0.3 })
  const bucket = new THREE.Group()
  bucket.position.set(0.95 * S, 0, 0.35)
  add(bucket, cyl(0.17, 0.14, 0.3, 14), mat(0x5a3b22, 0.6), 0, 0.15, 0)
  add(bucket, cyl(0.16, 0.16, 0.01, 14), checks, 0, 0.29, 0)
  const handle = add(bucket, new THREE.TorusGeometry(0.17, 0.008, 6, 16, Math.PI), mat(C.black, 0.4), 0, 0.3, 0)
  handle.rotation.y = 0.4
  for (const a of [0.4, 2.2]) add(bucket, box(0.04, 0.12, 0.02), checks, Math.cos(a) * 0.165, 0.24, Math.sin(a) * 0.165).rotation.y = -a
  g.add(bucket)
  // the nisse, brush in hand, dab-dab-dabbing at the edge of the painted part
  const nisse = new Nisse({ coat: C.green, hat: C.red, beard: false, ears: true, scale: 0.85, apron: C.white })
  nisse.group.position.set(0.75 * S, 0, 0.55)
  nisse.setYaw(-2.6)
  const brush = new THREE.Group()
  add(brush, cyl(0.012, 0.012, 0.28, 6), mat(C.wood, 0.6), 0, -0.14, 0)
  add(brush, cyl(0.024, 0.017, 0.07, 8), checks, 0, -0.31, 0)
  brush.position.set(0, -0.5, 0.05)
  nisse.armR.add(brush)
  g.add(nisse.group)
  moving(nisse.armR)
  moving(nisse.head)
  shop.group.add(g)
  shop.block(x, z, 1.1, 0.9)
  shop.updaters.push((t) => {
    // dab – dab – dab, a step back to look, and on again
    const look = Math.sin(t * 0.4) > 0.75
    nisse.armR.rotation.x = look ? -0.4 : -1.35 + Math.abs(Math.sin(t * 6)) * 0.25
    nisse.armR.rotation.z = look ? 0.2 : -0.35 + Math.sin(t * 0.9) * 0.12
    nisse.head.rotation.z = look ? Math.sin(t * 1.5) * 0.15 : 0
  })
}

function paintingCorner(shop: Shop, x: number, z: number) {
  const horse = moving(rockingHorse())
  horse.position.set(x, 0, z)
  horse.rotation.y = 0.6
  horse.scale.setScalar(1.6)
  shop.group.add(horse)
  const ladder = new THREE.Group()
  for (const s of [-1, 1]) add(ladder, box(0.05, 1.8, 0.05), mat(C.wood, 0.7), s * 0.22, 0.9, 0)
  for (let i = 0; i < 6; i++) add(ladder, box(0.44, 0.04, 0.04), mat(C.wood, 0.7), 0, 0.25 + i * 0.28, 0)
  ladder.position.set(x - 0.8, 0, z + 0.4)
  ladder.rotation.set(-0.12, 0.9, 0)
  shop.group.add(ladder)
  const painter = new Nisse({ coat: C.green, hat: C.red, beard: false, ears: true, scale: 0.62, apron: C.white })
  painter.group.position.set(x - 0.75, 0.7, z + 0.32)
  painter.setYaw(2.2)
  const brush = new THREE.Group()
  add(brush, cyl(0.012, 0.012, 0.28, 6), mat(C.wood, 0.6), 0, -0.14, 0)
  add(brush, cyl(0.022, 0.016, 0.06, 8), mat(C.red, 0.5), 0, -0.3, 0)
  painter.armR.add(brush)
  brush.position.set(0, -0.5, 0.05)
  shop.group.add(painter.group)
  moving(painter.armR)
  for (let i = 0; i < 3; i++) add(shop.group, cyl(0.07, 0.06, 0.1, 12), mat([C.red, C.blue, C.gold][i], 0.3), x - 0.5 + i * 0.22, 0.05, z + 0.9)
  shop.block(x - 0.3, z + 0.2, 1.0, 0.8)
  shop.updaters.push((t) => {
    painter.armR.rotation.x = -1.2 + Math.sin(t * 3) * 0.35
    painter.armR.rotation.z = 0.3 + Math.sin(t * 1.5) * 0.15
    horse.rotation.z = Math.sin(t * 1.2) * 0.05
  })
}

/** A nisse at the bench, hammering away at a wooden engine. */
function workbench(shop: Shop, x: number, z: number, coat: number, hat: number, beat = 0) {
  const g = new THREE.Group()
  add(g, box(1.4, 0.06, 0.7), mat(C.wood, 0.7), 0, 0.72, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.07, 0.72, 0.07), mat(C.dark, 0.7), sx * 0.6, 0.36, sz * 0.28)
  add(g, box(0.24, 0.12, 0.12), mat(C.red, 0.6), -0.2, 0.81, 0)
  add(g, cyl(0.045, 0.045, 0.14, 12), mat(C.blue, 0.5), -0.06, 0.83, 0).rotation.z = Math.PI / 2
  for (const wx of [-0.28, -0.12]) add(g, cyl(0.035, 0.035, 0.03, 12), mat(C.black, 0.5), wx, 0.77, 0.07).rotation.x = Math.PI / 2
  for (let i = 0; i < 6; i++) add(g, box(0.12, 0.025, 0.04), mat(0xc98a5a, 0.8), 0.3 + (i % 3) * 0.13, 0.765 + Math.floor(i / 3) * 0.026, -0.1)
  g.position.set(x, 0, z)
  shop.group.add(g)
  shop.block(x, z, 0.75, 0.4)
  const maker = new Nisse({ coat, hat, beard: false, ears: true, scale: 0.7, apron: 0x8a6a4a })
  maker.group.position.set(x, 0, z - 0.6)
  maker.setYaw(0)
  const hammer = new THREE.Group()
  add(hammer, cyl(0.012, 0.012, 0.26, 6), mat(C.wood, 0.6), 0, -0.13, 0)
  add(hammer, box(0.1, 0.05, 0.05), mat(0x8a8f98, 0.4, 0.7), 0, -0.27, 0)
  maker.armR.add(hammer)
  hammer.position.set(0, -0.5, 0.05)
  shop.group.add(maker.group)
  moving(maker.armR)
  shop.updaters.push((t) => {
    // up slowly, down hard
    const k = (t * 1.6 + beat) % 1
    maker.armR.rotation.x = -1.6 + (k < 0.75 ? (k / 0.75) * 1.0 : 1.0 - ((k - 0.75) / 0.25) * 1.0)
  })
}

/** Shelves full of finished toys, standing against a wall (facing +z before turning by `ry`). */
function shelves(shop: Shop, x: number, z: number, ry: number) {
  const g = new THREE.Group()
  const w = 2.8
  const s = 1.3
  for (const sx of [-1, 1]) add(g, box(0.06, 2.6, 0.5), mat(C.dark, 0.7), sx * (w / 2), 1.3, 0.25)
  for (const y of [0.35, 1.0, 1.65, 2.3]) add(g, box(w, 0.05, 0.5), mat(C.wood, 0.7), 0, y, 0.25)
  const rows: (() => THREE.Object3D)[][] = [
    [() => teddy(C.brown, s), () => teddy(0xc98a2b, s), () => present(C.red, C.gold, 0.22), () => teddy(0xf2e6d0, s), () => present(C.green, C.red, 0.22)],
    [() => doll(C.blue), () => drum(C.red), () => doll(C.red), () => drum(C.green), () => doll(C.green), () => drum(C.blue)],
    [() => present(C.blue, C.white, 0.24), () => teddy(C.brown, 1.5), () => present(C.gold, C.red, 0.24), () => present(C.red, C.green, 0.2)],
    [() => drum(C.gold), () => teddy(0xf2e6d0, s), () => doll(C.blue), () => drum(C.red), () => teddy(C.brown, s)],
  ]
  rows.forEach((row, ri) => {
    const y = [0.38, 1.03, 1.68, 2.33][ri]
    row.forEach((make, i) => {
      const toy = make()
      toy.position.set(-w / 2 + 0.3 + (i * (w - 0.6)) / (row.length - 1), y, 0.25)
      toy.rotation.y = i % 2 ? 0.3 : -0.2
      if (ri === 1) toy.scale.setScalar(1.5)
      g.add(toy)
    })
  })
  g.position.set(x, 0, z)
  g.rotation.y = ry
  shop.group.add(g)
  const across = Math.abs(Math.sin(ry)) > 0.5
  shop.block(x, z, across ? 0.4 : w / 2, across ? w / 2 : 0.4)
}

/** Boards to read on the right-hand wall: the wish list (its end unrolled over the floor) and the nice list. */
function lists(shop: Shop) {
  const x = IN_X - 0.06
  const items = ['En röd cykel', 'Skridskor', 'En valp (helst två)', 'Legobitar – alla', 'Ett pepparkakshus utan spricka', 'Snö till julafton', 'Pyjamas med fötter', 'En trumma (förlåt, grannar)', 'En docka med riktigt hår', 'Ett tåg som tutar', 'Godis. Mycket godis.', 'Att Lasse slutar växa']
  const list = drawBoard({ style: 'parchment', title: 'Önskelistan', subtitle: 'Kontrollerad två gånger', items, marker: 'check', w: 512, h: 1400, seed: 21 })
  const wish = sheet(list, 1.1)
  wish.position.set(x, 2.3, 3.2)
  wish.rotation.y = -Math.PI / 2
  shop.group.add(wish)
  shop.exhibit(wish, { title: 'Önskelistan', caption: 'Kontrollerad två gånger – och den tar aldrig slut.', image: () => list.toDataURL('image/jpeg', 0.9) })
  const [c, ctx] = makeCanvas(256, 512)
  ctx.fillStyle = '#f3e6c4'
  ctx.fillRect(0, 0, 256, 512)
  ctx.strokeStyle = 'rgba(60,35,15,0.35)'
  ctx.lineWidth = 3
  for (let y = 30; y < 512; y += 34) {
    ctx.beginPath()
    ctx.moveTo(30, y)
    ctx.lineTo(60 + ((y * 37) % 150), y)
    ctx.stroke()
  }
  const floor = add(shop.group, new THREE.PlaneGeometry(1.1, 2.6), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.9 }), x - 1.4, 0.05, 3.6)
  floor.rotation.set(-Math.PI / 2, 0, 1.3)
  floor.castShadow = false
  add(shop.group, cyl(0.09, 0.09, 1.12, 14), mat(0xf3e6c4, 0.9), x - 2.7, 0.09, 3.9).rotation.set(0, 1.3, Math.PI / 2)

  const names = PARTICIPANTS.map((p) => p.name)
  const nice = drawBoard({ style: 'parchment', title: 'Snälla listan', subtitle: 'Alla i byn – kontrollerat två gånger', items: names.length ? names : ['Alla som kommer hit'], marker: 'check', w: 512, h: 1100, seed: 5 })
  const niceSheet = sheet(nice, 1.1)
  niceSheet.position.set(x, 2.3, 0.4)
  niceSheet.rotation.y = -Math.PI / 2
  shop.group.add(niceSheet)
  shop.exhibit(niceSheet, { title: 'Snälla listan', caption: 'Alla står på den. Tomten har kollat. Två gånger.', image: () => nice.toDataURL('image/jpeg', 0.9) })
}

/** The foreman's desk by the door. */
function counter(shop: Shop) {
  const g = new THREE.Group()
  add(g, box(0.9, 1.0, 2.8), mat(C.wood, 0.7), 0, 0.5, 0)
  add(g, box(1.05, 0.08, 2.95), mat(C.dark, 0.5), 0, 1.04, 0)
  add(g, box(0.04, 0.6, 2.4), mat(C.green, 0.6), 0.47, 0.52, 0)
  add(g, box(0.05, 0.08, 2.5), mat(C.gold, 0.35, 0.7), 0.5, 0.86, 0)
  const book = add(g, box(0.4, 0.06, 0.55), mat(0x7a1d1d, 0.7), 0, 1.11, -0.4)
  book.rotation.y = 0.2
  const t = teddy(C.brown, 1.4)
  t.position.set(0, 1.08, 0.75)
  g.add(t)
  g.position.set(SPOT.x + 0.85, 0, SPOT.z)
  shop.group.add(g)
  shop.block(SPOT.x + 0.85, SPOT.z, 0.55, 1.5)
}

/* ---------- the two you can talk to ---------- */

function foreman(): { npc: Nisse; talk: Talk } {
  const npc = new Nisse({ coat: C.red, hat: C.green, apron: 0x8a6a4a, trim: true })
  const talk: Talk = {
    name: 'Verkmästarnissen',
    avatar: '🧸',
    avatarBg: '#1d6e48',
    greeting: () => [html.p('Välkommen till Leksaksfabriken – den största verkstaden norr om allting! Här blir varenda julklapp till, från första spik till sista rosett.') + html.p('Se dig omkring, men akta tåget. Det har förtur.')],
    topics: [
      {
        label: '🧸 Vad tillverkar ni här?',
        pages: () => [html.p('Nallar, dockor, trummor, tåg, gunghästar, flygplan och tennsoldater. Bandet där uppe går dygnet runt från oktober, och det som är klart åker ner i rutschkanan.') + html.p('Allt kontrolleras två gånger innan det slås in – det är tradition.')],
      },
      {
        label: '📮 Hur många brev får ni?',
        pages: () => [html.p('Postrummet där bak tar emot några miljoner om året. Varenda ett läses. Vissa två gånger, för handstilens skull.')],
      },
      {
        label: '📜 Vad står på önskelistan?',
        pages: () => [html.p('Den hänger på väggen till höger – och fortsätter ut över golvet. Den blir längre varje år.') + html.p('Bredvid hänger snälla listan. Kolla om du står med. (Det gör du.)')],
      },
      {
        label: '🚂 Får jag köra tåget?',
        pages: () => [html.p('Tåget kör sig självt runt granen. Det har det gjort sedan 1932 och vi vågar inte röra det.')],
      },
      {
        label: '🙋 Vem är den där långa?',
        pages: () => [html.p('Det är Lasse. Han kom hit som liten och växte… och växte. Han är vår bästa leksakstestare.') + html.p('Säg hej till honom, han blir jätteglad. Han blir alltid jätteglad.')],
      },
    ],
    bye: 'Tack för besöket – och lämna tåget ifred!',
  }
  return { npc, talk }
}

function lasse(): { npc: Nisse; talk: Talk } {
  // a grown-up among nissar: twice their size – green tunic, red apron, white trousers, a red hat
  const npc = new Nisse({ coat: 0x2f8a3a, hat: C.red, pants: 0xfbf8f2, trim: true, beard: false, ears: true, scale: 1.75, apron: 0xc8102e })
  const talk: Talk = {
    name: 'Lasse Långnisse',
    avatar: '🤩',
    avatarBg: '#2f8a3a',
    greeting: () => [html.p('HEJ!! Är du ny här? Jag ÄLSKAR nya! Jag heter Lasse!') + html.p('Jag är leksakstestare. Det är världens bästa jobb. Kanske världens bästa allt.')],
    topics: [
      {
        label: '🙋 Vem är du?',
        pages: () => [
          html.p('Jag kom hit när jag var liten. Nissarna tog hand om mig, och sen växte jag lite. Och lite till.') +
            html.p('Alla säger att jag är lång för att vara nisse. Jag tror bara att dörrarna är för låga. Fast inte här. Här är dörrarna jättebra.'),
        ],
      },
      {
        label: '🔨 Vad gör en leksakstestare?',
        pages: () => [
          html.p('Jag testar ALLT! I morse testade jag 312 skallror. Alla skallrade. Fantastiskt.') +
            html.p('Igår åkte jag rutschkanan fyrtio gånger. Den är godkänd. Jag också.'),
        ],
      },
      {
        label: '🍬 Vad äter du?',
        pages: () => [html.p('Frukost: pannkakor med polkagrisar. Lunch: knäck. Mellanmål: knäck. Middag: pannkakor med knäck.') + html.p('Grönsaker? Jo – det finns ju gröna kolor!')],
      },
      {
        label: '❄️ Gillar du snö?',
        pages: () => [html.p('SNÖ! Har du sett snön idag?! Den kommer från HIMLEN! Gratis!') + html.p('Jag har gjort 40 snöänglar sedan frukost. Två av dem var jag själv.')],
      },
    ],
    bye: 'Hejdå! Ha en riktigt glittrig dag!!',
  }
  return { npc, talk }
}

/* ---------- hitboxes ---------- */

/** Simple invisible boxes for aiming and snowballs, so they don't test the building's every triangle. */
function hitboxes() {
  const g = keepApart(new THREE.Group())
  g.add(shutHit)
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
  // (the walls' boxes are only their outer half, so from inside the boards on them are hit first)
  const boxes: [number, number, number, number, number, number][] = [
    [0, H / 2, -D / 2 + 0.15, W, H, 0.3],
    [-W / 2 + 0.15, H / 2, 0, 0.3, H, D],
    [W / 2 - 0.15, H / 2, 0, 0.3, H, D],
    [-(W / 4 + DOOR_W / 4), H / 2, D / 2 - 0.15, W / 2 - DOOR_W / 2, H, 0.3],
    [W / 4 + DOOR_W / 4, H / 2, D / 2 - 0.15, W / 2 - DOOR_W / 2, H, 0.3],
    [0, H + RIDGE / 2, 0, W, RIDGE, D],
    [-(TOWER.x + DOOR_W / 2) / 2, H / 2, (TOWER.z0 + TOWER.z1) / 2, TOWER.x - DOOR_W / 2, H, TOWER.z1 - TOWER.z0],
    [(TOWER.x + DOOR_W / 2) / 2, H / 2, (TOWER.z0 + TOWER.z1) / 2, TOWER.x - DOOR_W / 2, H, TOWER.z1 - TOWER.z0],
    [0, (H + DOOR_H) / 2, (TOWER.z0 + TOWER.z1) / 2, DOOR_W, H - DOOR_H, TOWER.z1 - TOWER.z0],
    [0, H + 15, (TOWER.z0 + TOWER.z1) / 2, 8.4, 30, 5.2],
    [-CORNER.x, 12, -CORNER.z, 5.6, 24, 5.6],
    [CORNER.x, 12, -CORNER.z, 5.6, 24, 5.6],
    [-CORNER.x, 12, CORNER.z, 5.6, 24, 5.6],
    [CORNER.x, 12, CORNER.z, 5.6, 24, 5.6],
    [-8.2, 2.6, TOWER.z1 + 2.4, 1.8, 5.2, 1.8],
    [8.2, 2.6, TOWER.z1 + 2.4, 1.8, 5.2, 1.8],
    [-13.5, 8, TOWER.z1 + 9, 6, 16, 6],
    [13.5, 1.4, TOWER.z1 + 5, 6, 2.8, 6],
    [0, 5.5, -2, 5, 11, 5],
  ]
  for (const [x, y, z, w, h, d] of boxes) {
    const b = new THREE.Mesh(box(w, h, d), m)
    b.position.set(x, y, z)
    b.visible = false
    g.add(b)
  }
  return g
}

/* ---------- all of it ---------- */

export async function buildLeksaksfabriken(): Promise<BuiltShop> {
  // a bare Shop: just the sign – the factory builds its own walls. The size is its roof, for the snow.
  const shop = new Shop('Leksaksfabriken', COLORS, { bare: true, w: W + 6, d: D + 14, h: H, ridge: RIDGE + 2 })
  // straight north, through the forest at the end of the square
  shop.place(0, RADIUS)
  exterior(shop)
  yard(shop)

  // Everything inside is built in a room of its own, baked into a few meshes here and only drawn
  // from close by: from the square you couldn't see it through the arch anyway, and it's most of
  // the factory's draw calls.
  const room = new Shop('', COLORS, { bare: true })
  room.group.remove(room.signMesh)
  hallInside(room)
  treeAndTrain(room)
  overheadBelt(room)
  chute(room)
  gearsAndClock(room)
  overhead(room)
  mailRoom(room)
  wrapping(room, -11.2, 1.8, 0)
  // the two things to do: stamping toys at Kvalitetskontrollen, and the tin soldiers' parade
  stamping.build(room, 11.2, 6.3, () => dispatchEvent(new Event('jul:stampla')))
  parade.build(room, -11.0, 6.6, 6.4, 3.4)
  workbench(room, 7.8, 1.8, C.blue, C.green)
  workbench(room, 10.4, 1.8, C.red, C.white, 0.33)
  workbench(room, 13.0, 1.8, C.green, C.red, 0.66)
  for (const [i, x] of [-6.5, -2, 2.5, 7].entries()) workbench(room, x, -9.4, LOOKS[i].coat, LOOKS[i].hat, i * 0.27)
  paintingCorner(room, -15.2, 9.8)
  chessNisse(room, -12.4, -6.0, 0.5)
  for (const z of [-5.2, -1.6, 2.0]) shelves(room, -IN_X + 0.05, z, Math.PI / 2)
  shelves(room, IN_X - 0.05, -3.6, -Math.PI / 2)
  shelves(room, 14.6, -IN_Z + 0.05, 0)
  lists(room)
  counter(room)
  // a pile of finished presents in the front right corner, under the gallery
  const cols = [C.red, C.green, C.gold, C.blue, C.white]
  for (let i = 0; i < 18; i++) {
    const layer = i < 10 ? 0 : i < 15 ? 1 : 2
    const k = layer === 0 ? i : layer === 1 ? i - 10 : i - 15
    const p = present(cols[i % 5], cols[(i + 2) % 5], 0.4 + ((i * 7) % 5) * 0.06)
    p.position.set(IN_X - 0.7 - (k % 4) * 0.6 - layer * 0.3, layer * 0.45, IN_Z - 2.2 - Math.floor(k / 4) * 0.6 - layer * 0.3)
    p.rotation.y = i * 0.7
    room.group.add(p)
  }
  room.block(IN_X - 1.6, IN_Z - 2.8, 1.4, 1.0)

  // what the room needs from its house: walls to bump into, things to animate, things to look at
  shop.boxes.push(...room.boxes)
  shop.floors.push(...room.floors)
  shop.updaters.push(...room.updaters)
  shop.exhibits.push(...room.exhibits)
  // its lights stay on all the time (lights coming and going would rebuild every shader)
  const lights: THREE.Light[] = []
  room.group.traverse((o) => (o as THREE.Light).isLight && lights.push(o as THREE.Light))
  for (const l of lights) shop.group.add(l)
  bakeStatic(room.group, new Set(room.exhibits.map((e) => e.target)))
  const lod = keepApart(new THREE.LOD())
  lod.addLevel(room.group, 0)
  lod.addLevel(new THREE.Object3D(), 44)
  shop.group.add(lod)
  // it stands far outside the moon's shadow map, so nothing of it needs to cast shadows
  shop.group.traverse((o) => (o.castShadow = false))

  const { npc, talk } = foreman()
  const l = lasse()
  // Lasse stands a few steps in, right of the carpet – clear of the open door – the first one you meet
  const lx = 5.4
  const lz = 5.8
  shop.block(lx, lz, 0.4, 0.4)
  const hits = hitboxes()
  shop.group.add(hits)
  return { shop, event: JULAFTON, npc, talk, emoji: '🧸', spot: SPOT, hitboxes: hits, extras: [{ ...l, x: lx, z: lz, yaw: -0.6 }] }
}
