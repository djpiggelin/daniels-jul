// Log cabins: the village's houses (shop.ts) and Tomtegården's stable and slädverkstad (tomtegarden.ts)
// are built like fjällstugor – round logs stacked course on course, their ends crossing and sticking
// out at the corners, pale end grain, gables of shorter and shorter logs – with Christmas on them:
// garlands of spruce with red bows, lanterns, little decorated firs by the door, a julkärve for the birds.
// Everything here is added onto a group in its own space; nothing here moves (it's all baked).
import * as THREE from 'three'
import { makeCanvas, toTexture } from './tex'

/** A log's radius and how far apart the courses are (they sit a little into each other). */
export const LOG_R = 0.15
const COURSE = LOG_R * 1.85

const barkTex = (() => {
  const [c, ctx] = makeCanvas(256, 64)
  ctx.fillStyle = '#7a5434'
  ctx.fillRect(0, 0, 256, 64)
  let s = 7
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(${r() < 0.5 ? '40,24,12' : '160,120,80'},${0.15 + r() * 0.25})`
    ctx.lineWidth = 1 + r() * 2
    ctx.beginPath()
    const y = r() * 64
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(80, y + (r() - 0.5) * 6, 170, y + (r() - 0.5) * 6, 256, y + (r() - 0.5) * 4)
    ctx.stroke()
  }
  // a knot here and there
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(50,30,15,0.5)'
    ctx.beginPath()
    ctx.ellipse(r() * 256, r() * 64, 5, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
})()
const endTex = (() => {
  const [c, ctx] = makeCanvas(64, 64)
  ctx.fillStyle = '#d2a878'
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = 'rgba(120,80,40,0.55)'
  for (let r = 4; r < 32; r += 5) {
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(32, 32, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(70,40,20,0.9)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(32, 32, 30, 0, Math.PI * 2)
  ctx.stroke()
  return toTexture(c)
})()

/** The materials for logs of one tone (`tint` shades the bark: tarred dark, weathered grey, honey). */
export function logMaterials(tint = 0xffffff) {
  const side = new THREE.MeshStandardMaterial({ map: barkTex, color: tint, roughness: 0.9 })
  const end = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.85 })
  return [side, end, end]
}

const logGeo = new Map<string, THREE.CylinderGeometry>()
/** One log along x, `len` long, centred at (x, y, z). */
function log(parent: THREE.Object3D, mats: THREE.Material[], len: number, x: number, y: number, z: number, r = LOG_R) {
  const key = `${len.toFixed(2)}|${r}`
  if (!logGeo.has(key)) {
    const g = new THREE.CylinderGeometry(r, r * 1.04, len, 10)
    g.rotateZ(Math.PI / 2)
    logGeo.set(key, g)
  }
  const m = new THREE.Mesh(logGeo.get(key)!, mats)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

/**
 * Courses of logs along x, from x0 to x1 (plus `over` sticking out at each end where it's a corner),
 * from y0 up to y1, in the plane z (the wall's outside face is at z ± LOG_R). `phase` 0 or 1 staggers
 * the courses by half a log, so two walls meeting at a corner interlock.
 */
export function logCourses(parent: THREE.Object3D, mats: THREE.Material[], x0: number, x1: number, y0: number, y1: number, z: number, opts: { over0?: number; over1?: number; phase?: number } = {}) {
  const over0 = opts.over0 ?? 0
  const over1 = opts.over1 ?? 0
  const start = y0 + LOG_R + (opts.phase ? COURSE / 2 : 0)
  for (let y = start; y < y1 - LOG_R * 0.4; y += COURSE) {
    const a = x0 - over0
    const b = x1 + over1
    log(parent, mats, b - a, (a + b) / 2, y, z)
  }
}

/** A gable of logs: shorter and shorter courses up to the ridge, `w` wide at `y0`, `rise` high, in the plane z. */
export function logGable(parent: THREE.Object3D, mats: THREE.Material[], w: number, y0: number, rise: number, z: number) {
  for (let y = y0 + LOG_R; y < y0 + rise - LOG_R; y += COURSE) {
    const half = (w / 2) * (1 - (y - y0) / rise)
    if (half < 0.25) break
    log(parent, mats, half * 2, 0, y, z)
  }
}

/** Round log posts (the open front of a shop). */
export function logPost(parent: THREE.Object3D, mats: THREE.Material[], x: number, z: number, h: number, r = 0.2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, 12), mats)
  m.position.set(x, h / 2, z)
  m.castShadow = true
  parent.add(m)
  return m
}

/* ---------- Christmas on it ---------- */

const SPRUCE = new THREE.MeshStandardMaterial({ color: 0x1d5236, roughness: 0.9 })
const BOW = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.45 })
const BRASS = new THREE.MeshStandardMaterial({ color: 0xc8962a, roughness: 0.35, metalness: 0.7 })
const IRON = new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.5, metalness: 0.5 })
const GLOW = new THREE.MeshStandardMaterial({ color: 0x3a2410, emissive: 0xffc070, emissiveIntensity: 1.4 })
const STRAW = new THREE.MeshStandardMaterial({ color: 0xd8b860, roughness: 0.95 })
const BULBS = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }))

/** A spruce garland swagged between x0 and x1 at height y (plane z), red bows where it's hung up. */
export function garland(parent: THREE.Object3D, x0: number, x1: number, y: number, z: number, swags = 3) {
  const n = Math.max(8, Math.round((x1 - x0) * 5))
  const geo = new THREE.IcosahedronGeometry(0.11, 0)
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const sag = Math.sin(((u * swags) % 1) * Math.PI) * 0.28
    const m = new THREE.Mesh(geo, SPRUCE)
    m.position.set(x0 + u * (x1 - x0), y - sag, z)
    m.rotation.set(i, i * 2, 0)
    m.scale.setScalar(0.9 + ((i * 7) % 5) * 0.06)
    parent.add(m)
  }
  for (let k = 0; k <= swags; k++) {
    const x = x0 + (k / swags) * (x1 - x0)
    const b = new THREE.Group()
    b.position.set(x, y, z + 0.08)
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), BOW)
      loop.scale.set(1.3, 0.8, 0.5)
      loop.position.x = s * 0.07
      b.add(loop)
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.02), BOW)
    tail.position.y = -0.12
    b.add(tail)
    parent.add(b)
  }
}

/** A lantern hanging from a bracket (a warm glow, no light of its own – lights cost every surface). */
export function lantern(parent: THREE.Object3D, x: number, y: number, z: number, out = 0.3) {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, out), IRON)
  arm.position.z = out / 2
  g.add(arm)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), GLOW)
  body.position.set(0, -0.22, out)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.14, 4), IRON)
  cap.position.set(0, -0.02, out)
  cap.rotation.y = Math.PI / 4
  g.add(body, cap)
  parent.add(g)
  return g
}

/** A little fir in a pot, with a few lights and a star – by the door. */
export function doorFir(parent: THREE.Object3D, x: number, z: number, h = 1.3) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x8a3a24, roughness: 0.8 }))
  pot.position.y = 0.15
  g.add(pot)
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.4 - k * 0.1, h * 0.4, 9), SPRUCE)
    c.position.y = 0.3 + h * 0.2 + k * h * 0.22
    g.add(c)
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4
    const y = 0.45 + (i / 9) * h * 0.65
    const rr = 0.34 * (1 - (i / 9) * 0.8)
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), BULBS[i % 4])
    b.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr)
    g.add(b)
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), BRASS)
  star.position.y = 0.3 + h * 0.9
  g.add(star)
  parent.add(g)
  return g
}

/** A julkärve: a sheaf of oats on a pole, for the birds at Christmas. */
export function julkarve(parent: THREE.Object3D, x: number, z: number) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }))
  pole.position.y = 1.1
  g.add(pole)
  const sheaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10, 1, true), STRAW)
  sheaf.position.y = 2.25
  sheaf.rotation.x = Math.PI
  ;(sheaf.material as THREE.Material).side = THREE.DoubleSide
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12), BOW)
  tie.rotation.x = Math.PI / 2
  tie.position.y = 2.15
  g.add(sheaf, tie)
  parent.add(g)
  return g
}
