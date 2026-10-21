// The room in Julbordet, set like the photo: a long table with a grey linen cloth and a wine-red
// runner, white chargers with Christmas plates, red napkins, glasses and brass candelabras, red
// velvet chairs on one side and white spindle chairs on the other, candy-cane lights on white
// panelled walls – and along the back, a buffet with every dish on the knytis list, each one
// clickable to paxa it, with a name card strip saying who brings what.
//
// Everything that stands still shares a handful of materials, so batch.ts merges it all into a
// few draw calls (see the material cache below).
import * as THREE from 'three'
import type { Claims } from '../../src/lib/api'
import { DISHES, type Dish } from './data'
import { D, type Shop } from './shop'
import { glowTexture, makeCanvas, toTexture } from './tex'
import { openKnytis } from './knytis'

/* ---------- shared materials ---------- */

const mats = new Map<string, THREE.Material>()
const mat = (color: number, roughness = 0.7, metalness = 0) => {
  const k = `${color}|${roughness}|${metalness}`
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness }))
  return mats.get(k)!
}
const glass = new THREE.MeshStandardMaterial({ color: 0xe8f0ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false })
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })
const caneMat = new THREE.MeshBasicMaterial({ color: 0xff6a2a, toneMapped: false })

const C = {
  linen: 0x8a8177,
  runner: 0x5e1520,
  white: 0xfbf8f2,
  velvet: 0x8e1b2a,
  brass: 0xb8913a,
  candle: 0xc8102e,
  silver: 0xd8dce2,
  green: 0x1f4a2e,
  wood: 0x6b4226,
  darkCloth: 0x1d1a22,
}

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, n = 16) => new THREE.CylinderGeometry(rt, rb, h, n)

/** The Christmas plate: white with a holly rim and a little tree in the middle. */
function plateTexture() {
  const [c, ctx] = makeCanvas(256, 256)
  ctx.fillStyle = '#fbf8f2'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = '#2f6b3a'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(128, 128, 112, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    ctx.fillStyle = i % 3 ? '#2f6b3a' : '#b3202a'
    ctx.beginPath()
    ctx.ellipse(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100, i % 3 ? 10 : 6, i % 3 ? 5 : 6, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#2f6b3a'
  ctx.beginPath()
  ctx.moveTo(128, 70)
  ctx.lineTo(160, 170)
  ctx.lineTo(96, 170)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7a4c2a'
  ctx.fillRect(122, 170, 12, 16)
  ctx.fillStyle = '#b3202a'
  for (const [x, y] of [[118, 120], [140, 140], [112, 155], [133, 105]]) ctx.fillRect(x, y, 6, 6)
  return c
}

/* ---------- the long table ---------- */

const TABLE = { x: 0.3, z: -0.6, len: 5.0, depth: 1.0, h: 0.78 }

function diningTable(shop: Shop) {
  const g = new THREE.Group()
  const { len, depth, h } = TABLE
  add(g, box(len, 0.05, depth), mat(C.wood, 0.6), 0, h - 0.025, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.07, h - 0.05, 0.07), mat(C.wood, 0.6), sx * (len / 2 - 0.1), (h - 0.05) / 2, sz * (depth / 2 - 0.1))
  // linen cloth hanging over the edges, the runner down the middle
  add(g, box(len + 0.12, 0.012, depth + 0.12), mat(C.linen, 1), 0, h + 0.006, 0)
  for (const sz of [-1, 1]) add(g, box(len + 0.12, 0.22, 0.012), mat(C.linen, 1), 0, h - 0.1, sz * (depth / 2 + 0.06))
  add(g, box(len - 0.2, 0.004, 0.3), mat(C.runner, 0.95), 0, h + 0.014, 0)

  // ten places
  const plateTex = toTexture(plateTexture())
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.35 })
  const charger = cyl(0.17, 0.17, 0.012, 28)
  const plate = new THREE.CircleGeometry(0.135, 28)
  const napkin = new THREE.ConeGeometry(0.06, 0.13, 4)
  const bowlG = new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
  const stem = cyl(0.004, 0.004, 0.09, 6)
  const foot = cyl(0.03, 0.03, 0.004, 12)
  const shot = cyl(0.018, 0.015, 0.05, 10)
  for (let i = 0; i < 5; i++) {
    for (const side of [-1, 1]) {
      const x = (i - 2) * 0.95
      const z = side * 0.3
      const y = h + 0.02
      add(g, charger, mat(C.white, 0.3), x, y, z)
      const p = add(g, plate, plateMat, x, y + 0.008, z)
      p.rotation.x = -Math.PI / 2
      p.rotation.z = side > 0 ? Math.PI : 0
      const n = add(g, napkin, mat(C.velvet, 0.95), x, y + 0.04, z)
      n.rotation.set(Math.PI / 2, 0, 0.6)
      n.scale.set(1.2, 1, 0.35)
      // cutlery either side
      add(g, box(0.015, 0.004, 0.18), mat(C.silver, 0.25, 0.9), x - 0.22, y - 0.004, z)
      add(g, box(0.015, 0.004, 0.18), mat(C.silver, 0.25, 0.9), x + 0.22, y - 0.004, z)
      // a wine glass and a snaps glass towards the runner
      const gz = z - side * 0.2
      add(g, foot, glass, x + 0.12, y, gz)
      add(g, stem, glass, x + 0.12, y + 0.045, gz)
      const b = add(g, bowlG, glass, x + 0.12, y + 0.12, gz)
      b.rotation.x = Math.PI
      add(g, shot, glass, x - 0.05, y + 0.025, gz)
    }
  }
  // candelabras with red tapers
  for (const cx of [-1.2, 1.2]) candelabra(g, cx, h + 0.016, 0)
  // sprigs of spruce and a little gold lantern along the runner
  for (let i = 0; i < 9; i++) {
    const s = add(g, new THREE.ConeGeometry(0.03, 0.16, 5), mat(C.green, 0.9), -2 + i * 0.5, h + 0.03, (i % 2 ? 1 : -1) * 0.06)
    s.rotation.set(Math.PI / 2, 0, i * 0.7)
  }
  add(g, new THREE.OctahedronGeometry(0.07, 0), mat(0xd4a64a, 0.3, 0.8), 0, h + 0.08, 0)

  // chairs: red velvet covers on the far side, white spindle chairs on the near side
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.95
    velvetChair(g, x, -(depth / 2 + 0.32))
    spindleChair(g, x, depth / 2 + 0.32)
  }
  g.position.set(TABLE.x, 0, TABLE.z)
  shop.group.add(g)
  shop.block(TABLE.x, TABLE.z, len / 2 + 0.1, depth / 2 + 0.6)
}

function candelabra(parent: THREE.Object3D, x: number, y: number, z: number) {
  const brass = mat(C.brass, 0.35, 0.8)
  add(parent, cyl(0.06, 0.08, 0.02, 16), brass, x, y + 0.01, z)
  add(parent, cyl(0.012, 0.016, 0.3, 8), brass, x, y + 0.17, z)
  add(parent, box(0.5, 0.014, 0.014), brass, x, y + 0.3, z)
  for (let k = -2; k <= 2; k++) {
    const cx = x + k * 0.12
    const cy = y + 0.3 + (k === 0 ? 0.05 : 0)
    add(parent, cyl(0.02, 0.014, 0.03, 10), brass, cx, cy + 0.015, z)
    add(parent, cyl(0.011, 0.011, 0.24, 8), mat(C.candle, 0.6), cx, cy + 0.15, z)
    const f = add(parent, new THREE.SphereGeometry(0.012, 6, 5), flameMat, cx, cy + 0.285, z)
    f.scale.y = 1.9
    f.castShadow = false
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }))
  glow.position.set(x, y + 0.56, z)
  glow.scale.set(0.9, 0.5, 1)
  parent.add(glow)
}

function velvetChair(parent: THREE.Object3D, x: number, z: number) {
  const g = new THREE.Group()
  const v = mat(C.velvet, 1)
  add(g, box(0.44, 0.06, 0.42), v, 0, 0.46, 0)
  add(g, box(0.46, 0.34, 0.44), v, 0, 0.27, 0) // the cover hangs down over the seat
  add(g, box(0.44, 0.62, 0.06), v, 0, 0.8, -0.2)
  add(g, box(0.4, 0.14, 0.07), v, 0, 1.06, -0.2)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.035, 0.12, 0.035), mat(0x2b2b33, 0.6), sx * 0.19, 0.06, sz * 0.18)
  g.position.set(x, 0, z)
  parent.add(g)
}

function spindleChair(parent: THREE.Object3D, x: number, z: number) {
  const g = new THREE.Group()
  const w = mat(C.white, 0.5)
  add(g, box(0.42, 0.04, 0.4), w, 0, 0.45, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, cyl(0.016, 0.016, 0.45, 8), w, sx * 0.18, 0.225, sz * 0.17)
  for (const sx of [-1, 1]) add(g, cyl(0.016, 0.016, 0.5, 8), w, sx * 0.18, 0.72, 0.18)
  for (let k = -2; k <= 2; k++) add(g, cyl(0.008, 0.008, 0.4, 6), w, k * 0.065, 0.67, 0.18)
  add(g, box(0.42, 0.06, 0.03), w, 0, 0.96, 0.18)
  g.position.set(x, 0, z)
  parent.add(g)
}

/* ---------- walls: white panels and candy-cane lights ---------- */

function caneGeometry() {
  const pts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.45, 0)]
  for (let i = 1; i <= 10; i++) {
    const a = Math.PI - (i / 10) * Math.PI
    pts.push(new THREE.Vector3(0.09 + Math.cos(a) * 0.09, 0.45 + Math.sin(a) * 0.09, 0))
  }
  pts.push(new THREE.Vector3(0.18, 0.38, 0))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.018, 6)
}

function walls(shop: Shop) {
  const trim = mat(0xfdfaf3, 0.6)
  // panel mouldings low on the side walls
  for (const wall of ['left', 'right'] as const) {
    for (const along of [-2.6, -1.1, 0.4, 1.9, 3.3]) {
      const g = new THREE.Group()
      const w = 1.15
      const hh = 0.7
      add(g, box(w, 0.035, 0.02), trim, 0, hh / 2, 0)
      add(g, box(w, 0.035, 0.02), trim, 0, -hh / 2, 0)
      add(g, box(0.035, hh, 0.02), trim, -w / 2, 0, 0)
      add(g, box(0.035, hh, 0.02), trim, w / 2, 0, 0)
      shop.hang(g, wall, along, 0.62)
    }
    const rail = new THREE.Group()
    add(rail, box(D - 0.3, 0.05, 0.03), trim, 0, 0, 0)
    shop.hang(rail, wall, 0, 1.08)
  }
  // candy canes glowing on the walls, like the photo
  const cane = caneGeometry()
  const glowTex = glowTexture('rgba(255,140,60,0.9)', 'rgba(255,90,30,0)')
  const spots: [('left' | 'right' | 'back'), number, number][] = [
    ['left', -0.4, 1.35], ['left', 0.9, 1.4], ['left', 3.1, 1.35],
    ['right', 1.6, 1.4], ['right', 2.7, 1.35], ['right', 3.6, 1.4],
    ['back', -4.3, 1.45], ['back', -0.35, 1.5], ['back', 4.2, 1.45],
  ]
  for (const [wall, along, y] of spots) {
    const g = new THREE.Group()
    add(g, cane, caneMat, -0.09, -0.25, 0).castShadow = false
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }))
    glow.scale.set(0.75, 0.9, 1)
    glow.position.z = 0.05
    g.add(glow)
    shop.hang(g, wall, along, y)
  }
}

/* ---------- the buffet: every dish on the knytis list ---------- */

const BUFFET = { x: 0.1, z: -3.45, len: 6.8, depth: 0.72, h: 0.86 }
const slotX = (i: number) => BUFFET.x - BUFFET.len / 2 + 0.3 + (i * (BUFFET.len - 0.6)) / (DISHES.length - 1)

/** A little model of each dish – recognisable from a step away, nothing fancy. */
function dishModel(d: Dish) {
  const g = new THREE.Group()
  const white = mat(C.white, 0.3)
  const platter = (sx = 1, sz = 1.4) => {
    const p = add(g, cyl(0.12, 0.11, 0.02, 24), white, 0, 0.01, 0)
    p.scale.set(sx, 1, sz)
  }
  const bowl = (food: number) => {
    add(g, cyl(0.1, 0.06, 0.07, 18), white, 0, 0.035, 0)
    add(g, cyl(0.09, 0.09, 0.012, 18), mat(food, 0.7), 0, 0.066, 0)
  }
  const jar = (food: number, x = 0) => {
    add(g, cyl(0.045, 0.045, 0.13, 14), glass, x, 0.065, 0)
    add(g, cyl(0.04, 0.04, 0.1, 14), mat(food, 0.5), x, 0.05, 0)
    add(g, cyl(0.047, 0.047, 0.02, 14), mat(0xb8913a, 0.4, 0.7), x, 0.14, 0)
  }
  const bottle = (color: number, x = 0, h = 0.26, label = 0xfdfaf3) => {
    add(g, cyl(0.035, 0.037, h * 0.65, 14), mat(color, 0.15, 0.2), x, (h * 0.65) / 2, 0)
    add(g, cyl(0.013, 0.03, h * 0.18, 12), mat(color, 0.15, 0.2), x, h * 0.65 + h * 0.09, 0)
    add(g, cyl(0.014, 0.014, h * 0.12, 10), mat(0x1a1a1a, 0.5), x, h * 0.95, 0)
    add(g, cyl(0.037, 0.037, h * 0.2, 14), mat(label, 0.8), x, h * 0.33, 0)
  }
  const pieces = (n: number, geo: THREE.BufferGeometry, m: THREE.Material, r: number, y: number, s?: THREE.Vector3) => {
    for (let i = 0; i < n; i++) {
      const a = i * 2.39
      const k = Math.sqrt((i + 0.5) / n) * r
      const p = add(g, geo, m, Math.cos(a) * k, y, Math.sin(a) * k * 1.3)
      p.rotation.y = a
      if (s) p.scale.copy(s)
    }
  }
  switch (d.id) {
    case 'gravad-lax':
    case 'rokt-lax':
      platter()
      pieces(5, box(0.06, 0.012, 0.16), mat(d.id === 'gravad-lax' ? 0xf08a5d : 0xe36d4f, 0.5), 0.05, 0.028)
      pieces(6, new THREE.SphereGeometry(0.008, 4, 3), mat(0x3f7a3a, 0.9), 0.08, 0.04)
      break
    case 'gravlaxsas':
      bowl(0xc9a03c)
      break
    case 'laxrora':
      bowl(0xf2b8a0)
      break
    case 'inlagd-sill':
      jar(0xe9e2cf)
      break
    case 'smaksill':
      jar(0xd9a520, -0.055)
      jar(0xb33a2a, 0.055)
      break
    case 'julskinka': {
      platter(1.1, 1.3)
      const ham = add(g, new THREE.SphereGeometry(0.1, 16, 10), mat(0xe9a3a0, 0.6), 0, 0.07, 0)
      ham.scale.set(1.1, 0.7, 1.4)
      const crust = add(g, new THREE.SphereGeometry(0.102, 16, 10, 0, Math.PI * 2, 0, 1.0), mat(0xc8862f, 0.5), 0, 0.07, 0)
      crust.scale.copy(ham.scale)
      break
    }
    case 'prinskorv':
      platter()
      // little sausages lying on their side
      pieces(9, new THREE.CapsuleGeometry(0.012, 0.04, 3, 6).rotateZ(Math.PI / 2), mat(0xa4462a, 0.5), 0.08, 0.03)
      break
    case 'kottbullar':
      bowl(0x6b3a1e)
      pieces(9, new THREE.SphereGeometry(0.022, 8, 6), mat(0x6b3a1e, 0.8), 0.06, 0.08)
      break
    case 'ribs':
      platter(1.1, 1.4)
      pieces(4, box(0.05, 0.03, 0.15), mat(0x7a3a1c, 0.6), 0.04, 0.035)
      break
    case 'agg':
      platter()
      pieces(6, new THREE.SphereGeometry(0.025, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), white, 0.07, 0.02, new THREE.Vector3(1, 0.6, 1.4))
      pieces(6, cyl(0.012, 0.012, 0.006, 8), mat(0xf2b632, 0.6), 0.07, 0.036)
      break
    case 'potatis':
      bowl(0xe8d9a8)
      pieces(7, new THREE.SphereGeometry(0.025, 8, 6), mat(0xe2cf96, 0.7), 0.055, 0.085)
      break
    case 'rodbetssallad':
      bowl(0xb0245a)
      break
    case 'jansson':
      add(g, box(0.2, 0.05, 0.28), white, 0, 0.025, 0)
      add(g, box(0.18, 0.012, 0.26), mat(0xd9a54a, 0.6), 0, 0.054, 0)
      break
    case 'vortbrod': {
      add(g, box(0.18, 0.015, 0.3), mat(0x9c6b3c, 0.8), 0, 0.008, 0)
      const loaf = add(g, new THREE.SphereGeometry(0.07, 14, 8), mat(0x3d2414, 0.8), 0, 0.045, 0)
      loaf.scale.set(0.9, 0.6, 1.8)
      break
    }
    case 'ostar':
      add(g, box(0.22, 0.015, 0.3), mat(0x9c6b3c, 0.8), 0, 0.008, 0)
      for (const [i, c] of [0xf2c94c, 0xfdf3d6, 0xe8a73a].entries()) {
        // a quarter wheel of cheese each
        add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12, 1, false, 0, Math.PI / 2), mat(c, 0.6), -0.05 + i * 0.05, 0.04, -0.08 + i * 0.08)
      }
      break
    case 'glogg':
      add(g, cyl(0.09, 0.08, 0.16, 18), mat(0x6e1a24, 0.25, 0.4), 0, 0.08, 0)
      add(g, cyl(0.085, 0.085, 0.01, 18), mat(0x3a0a10, 0.2), 0, 0.15, 0)
      break
    case 'julmust':
      bottle(0x3b1d0e, 0, 0.3, 0xc8102e)
      break
    case 'julol':
      bottle(0x4a2a10, -0.045, 0.26, 0xd4a64a)
      bottle(0x4a2a10, 0.045, 0.26, 0x1d6e48)
      break
    case 'vin':
      bottle(0x1f3a24, -0.045, 0.3, 0xfdfaf3)
      bottle(0x5a0f1a, 0.045, 0.3, 0xfdfaf3)
      break
    case 'snaps':
      bottle(0xd8e4f0, -0.04, 0.22, 0x1d6e48)
      for (const [x, z] of [[0.05, -0.05], [0.07, 0.03], [0.03, 0.08]]) add(g, cyl(0.016, 0.013, 0.045, 10), glass, x, 0.022, z)
      break
    default:
      bowl(d.category === 'Dryck' ? 0x6e1a24 : 0xd9a54a)
  }
  return g
}

/** The name cards along the front of the buffet: one canvas for all of them, redrawn as dishes are claimed. */
const STRIP_W = 4096
const STRIP_H = 180
const strip = makeCanvas(STRIP_W, STRIP_H)
const stripTex = toTexture(strip[0], { live: true })

function drawStrip(claims: Claims) {
  const ctx = strip[1]
  ctx.clearRect(0, 0, STRIP_W, STRIP_H)
  ctx.fillStyle = '#1d1a22'
  ctx.fillRect(0, 0, STRIP_W, STRIP_H)
  const slot = STRIP_W / DISHES.length
  DISHES.forEach((d, i) => {
    const cx = slot * i + slot / 2
    const who = claims[d.id] ?? []
    // a little folded card
    ctx.fillStyle = who.length ? '#e9f7ef' : '#fffaf0'
    ctx.beginPath()
    ctx.roundRect(cx - slot / 2 + 8, 14, slot - 16, STRIP_H - 28, 14)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#2a1a10'
    let fs = 34
    ctx.font = `700 ${fs}px Caveat, cursive`
    while (ctx.measureText(d.name).width > slot - 30 && fs > 20) ctx.font = `700 ${(fs -= 2)}px Caveat, cursive`
    ctx.fillText(d.name, cx, 58)
    const status = who.length ? `✓ ${who.map((c) => c.name).join(', ')}` : 'Ledig – paxa!'
    fs = 30
    ctx.font = `600 ${fs}px "DM Sans", sans-serif`
    while (ctx.measureText(status).width > slot - 26 && fs > 16) ctx.font = `600 ${(fs -= 2)}px "DM Sans", sans-serif`
    ctx.fillStyle = who.length ? '#1d6e48' : '#8e1b1b'
    ctx.fillText(status, cx, 118)
  })
  stripTex.needsUpdate = true
}

function buffet(shop: Shop) {
  const g = new THREE.Group()
  const { len, depth, h } = BUFFET
  add(g, box(len, 0.05, depth), mat(C.wood, 0.6), 0, h - 0.025, 0)
  // a dark cloth over it, hanging down at the front
  add(g, box(len + 0.06, 0.012, depth + 0.06), mat(C.darkCloth, 1), 0, h + 0.006, 0)
  add(g, box(len + 0.06, h - 0.06, 0.012), mat(C.darkCloth, 1), 0, (h - 0.06) / 2 + 0.06, depth / 2 + 0.03)
  for (const sx of [-1, 1]) add(g, box(0.012, h - 0.06, depth + 0.06), mat(C.darkCloth, 1), sx * (len / 2 + 0.03), (h - 0.06) / 2 + 0.06, 0)
  // name cards along the front edge, tilted up so you can read them
  const cards = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.2, ((len - 0.2) * STRIP_H) / STRIP_W), new THREE.MeshStandardMaterial({ map: stripTex, roughness: 0.8 }))
  cards.position.set(0, h + 0.06, depth / 2 - 0.02)
  cards.rotation.x = -0.5
  g.add(cards)
  // candles at the ends, like the photo
  for (const sx of [-1, 1]) {
    add(g, cyl(0.025, 0.025, 0.28, 10), mat(0xfdfaf3, 0.6), sx * (len / 2 - 0.12), h + 0.15, -0.2)
    const f = add(g, new THREE.SphereGeometry(0.014, 6, 5), flameMat, sx * (len / 2 - 0.12), h + 0.31, -0.2)
    f.scale.y = 1.9
  }
  g.position.set(BUFFET.x, 0, BUFFET.z)
  shop.group.add(g)
  shop.block(BUFFET.x, BUFFET.z, len / 2 + 0.05, depth / 2 + 0.05)

  // the dishes – each one with an (invisible) box to click on
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })
  DISHES.forEach((d, i) => {
    const model = dishModel(d)
    model.position.set(slotX(i), h + 0.012, BUFFET.z - 0.08)
    shop.group.add(model)
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.62), hitMat)
    hit.position.set(slotX(i), h + 0.18, BUFFET.z + 0.05)
    shop.group.add(hit)
    shop.exhibit(hit, { title: `${d.emoji} ${d.name}`, image: () => '', open: () => openKnytis(d.id), prompt: `Paxa ${d.emoji} ${d.name}` })
  })
}

/** The room: long table, walls, buffet. Call once when building Julbordet. */
export function furnishJulbord(shop: Shop) {
  diningTable(shop)
  walls(shop)
  buffet(shop)
  drawStrip({})
}

/** Who brings what changed: redraw the name cards (the chalkboard is redrawn in shops.ts). */
export function showClaimsOnBuffet(claims: Claims) {
  drawStrip(claims)
}

/** The chalkboard's lines: ticked off with names once someone has claimed a dish. */
export function knytisBoardItems(claims: Claims) {
  const cats = ['Fisk', 'Kött', 'Tillbehör', 'Dryck'] as const
  return cats.flatMap((cat) => [
    `# ${cat}`,
    ...DISHES.filter((d) => d.category === cat).map((d) => {
      const who = claims[d.id] ?? []
      return who.length ? `✓ ${d.emoji} ${d.name} – ${who.map((c) => c.name).join(', ')}` : `${d.emoji} ${d.name}`
    }),
  ])
}

