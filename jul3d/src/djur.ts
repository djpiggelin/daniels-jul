// The forest's animals, round the village:
// - the bird feeder (fågelbordet) at the south-east edge, with bullfinches and great tits that flutter up
//   into the birch beside it when you come close, and come back when you've gone;
// - a roe deer and her young one, who come out of the forest to eat under it when nobody's near, and
//   bound off with their white rumps flashing when someone is;
// - a fox slinking along the forest edge at night, listening for mice under the snow and pouncing –
//   by day it sleeps curled up under the firs;
// - a white mountain hare, and all their tracks in the snow;
// - and every twelve minutes by the village clock, a moose: it walks out of the forest, stands a while on
//   the path to Leksaksfabriken and walks back. Everyone meets it at the same time.
// Snowballs scare them all off, except the moose, who isn't impressed.
import * as THREE from 'three'
import type { SnowballHit } from './snowballs'
import { makeCanvas, rng, toTexture } from './tex'
import { WILD, groundHeight, outside, type Circle } from './world'

const std = (color: number, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness })
const ease = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt))
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const rand = rng(1225)
const between = (a: number, b: number) => a + rand() * (b - a)
/** A point `r` from the middle of the village, `deg` degrees round from south (+z) towards east (+x). */
const round = (deg: number, r: number) => ({ x: Math.sin((deg * Math.PI) / 180) * r, z: Math.cos((deg * Math.PI) / 180) * r })

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}
const ball = (r: number, sx = 1, sy = 1, sz = 1, seg = 12) => new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.75))).scale(sx, sy, sz)
/** A rod from a to b (in the parent's space), r0 thick at a and r1 at b. */
function rod(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, mat: THREE.Material) {
  const d = b.clone().sub(a)
  const m = mesh(parent, new THREE.CylinderGeometry(r1, r0, d.length(), 8), mat)
  m.position.copy(a).addScaledVector(d, 0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  return m
}

/* ---------- four legs ---------- */

type Leg = { hip: THREE.Group; knee: THREE.Group; front: boolean; side: number }
/** A leg hanging from (x, y, z): upper and lower part, hinged at the knee, a hoof or paw at the end. */
function leg(parent: THREE.Object3D, x: number, y: number, z: number, upper: number, lower: number, r: number, mats: [THREE.Material, THREE.Material, THREE.Material], front: boolean): Leg {
  const hip = new THREE.Group()
  hip.position.set(x, y, z)
  parent.add(hip)
  mesh(hip, new THREE.CylinderGeometry(r, r * 0.75, upper, 7).translate(0, -upper / 2, 0), mats[0])
  const knee = new THREE.Group()
  knee.position.y = -upper
  hip.add(knee)
  mesh(knee, new THREE.CylinderGeometry(r * 0.75, r * 0.6, lower, 7).translate(0, -lower / 2, 0), mats[1])
  mesh(knee, ball(r * 0.85, 1, 0.7, 1.4, 8), mats[2], 0, -lower + r * 0.3, r * 0.25)
  return { hip, knee, front, side: Math.sign(x) || 1 }
}

/** Something on four legs that walks about on the snow: where it is and which way it faces (its front is +z). */
class Beast {
  readonly group = new THREE.Group()
  /** bobs and pitches as it goes */
  readonly body = new THREE.Group()
  /** the neck pivots where it meets the body (down to graze), the head turns on it (to look) */
  readonly neck = new THREE.Group()
  readonly head = new THREE.Group()
  legs: Leg[] = []
  ears: THREE.Object3D[] = []
  tail: THREE.Object3D | null = null
  readonly pos = new THREE.Vector3()
  yaw = 0
  speed = 0
  phase = rand() * 10
  /** how far the neck is bent down (0 head up … 1 nose in the snow), eased */
  graze = 0
  /** where it looks, relative to its front (eased) */
  look = 0

  constructor() {
    this.group.add(this.body)
    this.body.add(this.neck)
    this.neck.add(this.head)
  }
  /** Towards (x, z) at up to `v` m/s; true once there. */
  go(x: number, z: number, v: number, dt: number, turn = 2.5) {
    const dx = x - this.pos.x
    const dz = z - this.pos.z
    const d = Math.hypot(dx, dz)
    if (d < 0.2) {
      this.speed = ease(this.speed, 0, 8, dt)
      return true
    }
    const diff = wrap(Math.atan2(dx, dz) - this.yaw)
    this.yaw += THREE.MathUtils.clamp(diff, -turn * dt, turn * dt)
    this.speed = ease(this.speed, v * Math.max(0.15, Math.cos(diff)) * Math.min(1, d / 1.2 + 0.25), 4, dt)
    this.pos.x += Math.sin(this.yaw) * this.speed * dt
    this.pos.z += Math.cos(this.yaw) * this.speed * dt
    return false
  }
  stop(dt: number) {
    this.speed = ease(this.speed, 0, 6, dt)
  }
  turnTo(x: number, z: number, dt: number, turn = 1.5) {
    const diff = wrap(Math.atan2(x - this.pos.x, z - this.pos.z) - this.yaw)
    this.yaw += THREE.MathUtils.clamp(diff, -turn * dt, turn * dt)
  }
  /** The head towards (x, z) as far as the neck lets it (or straight ahead with `null`). */
  lookAt(p: { x: number; z: number } | null, dt: number, reach = 1.2) {
    const want = p ? THREE.MathUtils.clamp(wrap(Math.atan2(p.x - this.pos.x, p.z - this.pos.z) - this.yaw), -reach, reach) : 0
    this.look = ease(this.look, want, 3, dt)
  }
  /** Legs, body, neck and head for how it's moving now: walking, or (`bound`) leaping along. */
  pose(dt: number, stridePerMetre: number, bound: boolean, grazeDown = 1.1) {
    this.phase += this.speed * dt * stridePerMetre
    const k = Math.min(1, this.speed / 0.25)
    for (const l of this.legs) {
      const off = bound ? (l.front ? 0 : Math.PI) + (l.side > 0 ? 0.3 : 0) : (l.front ? 0 : Math.PI / 2) + (l.side > 0 ? Math.PI : 0)
      const s = Math.sin(this.phase + off)
      l.hip.rotation.x = -s * (bound ? 0.85 : 0.4) * k
      // the foot lifts as the leg swings forward
      l.knee.rotation.x = (l.front ? 1 : -1) * Math.max(0, -Math.cos(this.phase + off)) * (bound ? 1.1 : 0.7) * k
    }
    this.body.position.y = bound ? Math.abs(Math.sin(this.phase)) * 0.18 * k : Math.abs(Math.sin(this.phase * 2)) * 0.015 * k
    this.body.rotation.x = bound ? Math.cos(this.phase) * 0.14 * k : 0
    this.neck.rotation.x = this.graze * grazeDown
    this.head.rotation.y = this.look
    this.group.position.set(this.pos.x, groundHeight(this.pos.x, this.pos.z), this.pos.z)
    this.group.rotation.y = this.yaw
  }
  /** Ears flick now and then. */
  flick(t: number) {
    for (const [i, e] of this.ears.entries()) e.rotation.x = Math.max(0, Math.sin(t * 1.3 + this.phase * 3 + i * 2) - 0.92) * 6
  }
  set onSnowball(cb: SnowballHit) {
    this.group.userData.onSnowball = cb
  }
}

/* ---------- the animals ---------- */

/** A roe deer in its grey-brown winter coat, the big white patch on its rump, black nose, white chin. */
function roeDeer(size: number) {
  const b = new Beast()
  const coat = std(0x8c7660)
  const dark = std(0x4a3a2e)
  const white = std(0xf2eee6)
  const black = std(0x141010, 0.4)
  const B = b.body
  // a slim body, deep at the chest, the white rump patch behind
  mesh(B, ball(0.2, 0.78, 0.95, 2.1), coat, 0, 0.66, -0.04)
  mesh(B, ball(0.16, 0.85, 1.1, 1.05), coat, 0, 0.67, 0.27)
  mesh(B, ball(0.14, 1.05, 1.05, 0.5), white, 0, 0.71, -0.42)
  // the neck held high, a white patch at the throat
  b.neck.position.set(0, 0.76, 0.33)
  rod(b.neck, v3(0, 0, 0), v3(0, 0.33, 0.1), 0.07, 0.05, coat)
  mesh(b.neck, ball(0.04, 1, 1.4, 0.6, 8), white, 0, 0.24, 0.1)
  b.head.position.set(0, 0.36, 0.12)
  // a short wedge of a head: the skull, the muzzle tapering to a black nose, a white chin
  mesh(b.head, ball(0.075, 0.85, 0.9, 1.1), coat)
  const muzzle = mesh(b.head, new THREE.CylinderGeometry(0.028, 0.06, 0.15, 10).rotateX(Math.PI / 2 + 0.35), coat, 0, -0.035, 0.1)
  muzzle.scale.x = 0.85
  mesh(b.head, ball(0.026, 1.1, 0.8, 0.8, 10), black, 0, -0.06, 0.175)
  mesh(b.head, ball(0.028, 1, 0.5, 1.2, 8), white, 0, -0.09, 0.12)
  for (const s of [-1, 1]) {
    mesh(b.head, ball(0.017, 1, 1, 1, 8), black, s * 0.055, 0.015, 0.05)
    const ear = new THREE.Group()
    ear.position.set(s * 0.05, 0.05, -0.03)
    ear.rotation.set(-0.2, 0, -s * 0.55)
    b.head.add(ear)
    mesh(ear, ball(0.05, 0.55, 1.5, 0.28), coat, 0, 0.065, 0)
    mesh(ear, ball(0.04, 0.4, 1.3, 0.1), white, 0, 0.06, 0.012)
    b.ears.push(ear)
    for (const front of [true, false]) b.legs.push(leg(B, s * 0.07, 0.58, front ? 0.27 : -0.32, 0.3, 0.29, 0.03, [coat, dark, black], front))
  }
  b.group.scale.setScalar(size)
  return b
}

/** A moose: almost black, pale legs, a hump over the shoulders, the long overhanging nose, the bell under
 *  the throat and broad palmate antlers. */
function moose() {
  const b = new Beast()
  const coat = std(0x4a3426)
  const legs = std(0xb3a38f)
  const muzzle = std(0x5a4232)
  const black = std(0x0e0a08, 0.4)
  const antler = std(0xd8c7a3, 0.8)
  const B = b.body
  mesh(B, ball(0.46, 0.88, 0.95, 2.1), coat, 0, 1.55, -0.15)
  mesh(B, ball(0.42, 0.9, 1.05, 1.1), coat, 0, 1.78, 0.45)
  mesh(B, ball(0.38, 0.95, 0.95, 1), coat, 0, 1.52, -0.8)
  b.neck.position.set(0, 1.8, 0.7)
  rod(b.neck, v3(0, 0, 0), v3(0, 0.22, 0.42), 0.26, 0.2, coat)
  b.head.position.set(0, 0.22, 0.46)
  // the long head, sloping down to the big soft nose
  const skull = mesh(b.head, ball(0.15, 0.85, 0.95, 1.9), coat, 0, -0.08, 0.16)
  skull.rotation.x = 0.55
  mesh(b.head, ball(0.15, 1, 0.9, 1.25), muzzle, 0, -0.27, 0.42)
  for (const s of [-1, 1]) mesh(b.head, ball(0.03, 0.6, 1, 1, 8), black, s * 0.06, -0.27, 0.58)
  // the bell, hanging under the throat
  mesh(b.head, new THREE.CylinderGeometry(0.06, 0.02, 0.3, 8), coat, 0, -0.3, 0.02)
  for (const s of [-1, 1]) {
    mesh(b.head, ball(0.025, 1, 1, 1, 8), black, s * 0.11, -0.02, 0.18)
    const ear = new THREE.Group()
    ear.position.set(s * 0.12, 0.08, -0.04)
    ear.rotation.z = -s * 1.0
    b.head.add(ear)
    mesh(ear, ball(0.07, 0.5, 1.6, 0.35), coat, 0, 0.1, 0)
    b.ears.push(ear)
    // a palm of antler, its tines along the top edge
    const sh = new THREE.Shape()
    sh.moveTo(0, 0)
    for (const [x, y] of [[0.22, 0.04], [0.3, 0.18], [0.36, 0.33], [0.42, 0.2], [0.5, 0.38], [0.55, 0.23], [0.63, 0.36], [0.67, 0.2], [0.76, 0.27], [0.74, 0.1], [0.66, -0.01], [0.5, -0.06], [0.4, -0.2], [0.33, -0.05], [0.2, -0.04], [0.04, -0.05]]) sh.lineTo(x, y)
    const palm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }), antler)
    palm.castShadow = true
    const holder = new THREE.Group()
    holder.position.set(s * 0.08, 0.1, 0.02)
    holder.scale.set(s, 1, 1)
    holder.rotation.set(0, 0, 0)
    palm.rotation.set(-1.1, 0.25, 0.35)
    holder.add(palm)
    b.head.add(holder)
    ;(palm.material as THREE.Material).side = THREE.DoubleSide
    for (const front of [true, false]) b.legs.push(leg(B, s * 0.2, 1.3, front ? 0.5 : -0.85, 0.66, 0.66, 0.075, [coat, legs, black], front))
  }
  b.tail = mesh(B, ball(0.07, 1, 1.4, 0.6), coat, 0, 1.62, -1.15)
  return b
}

/** A red fox: white chest and chin, black socks and ear backs, a big bushy tail with a white tip. */
function fox() {
  const b = new Beast()
  const red = std(0xc2561c, 0.85)
  const white = std(0xf2eee6)
  const black = std(0x1a1210, 0.6)
  const B = b.body
  mesh(B, ball(0.12, 0.85, 0.9, 2.0), red, 0, 0.36, -0.02)
  mesh(B, ball(0.1, 0.9, 1, 0.9), white, 0, 0.34, 0.19)
  b.neck.position.set(0, 0.4, 0.2)
  rod(b.neck, v3(0, 0, 0), v3(0, 0.1, 0.1), 0.065, 0.055, red)
  b.head.position.set(0, 0.12, 0.12)
  mesh(b.head, ball(0.075, 1.05, 0.85, 1), red)
  mesh(b.head, ball(0.05, 1.15, 0.7, 1), white, 0, -0.03, 0.03)
  mesh(b.head, new THREE.ConeGeometry(0.038, 0.13, 8).rotateX(Math.PI / 2), red, 0, -0.015, 0.11)
  mesh(b.head, ball(0.014, 1, 1, 1, 8), black, 0, -0.015, 0.18)
  for (const s of [-1, 1]) {
    mesh(b.head, ball(0.011, 1, 1, 1, 8), black, s * 0.04, 0.02, 0.06)
    const ear = new THREE.Group()
    ear.position.set(s * 0.042, 0.06, -0.01)
    ear.rotation.z = -s * 0.25
    b.head.add(ear)
    mesh(ear, new THREE.ConeGeometry(0.032, 0.085, 6), black, 0, 0.04, -0.004).scale.z = 0.5
    mesh(ear, new THREE.ConeGeometry(0.028, 0.075, 6), red, 0, 0.038, 0.003).scale.z = 0.5
    b.ears.push(ear)
    for (const front of [true, false]) b.legs.push(leg(B, s * 0.05, 0.27, front ? 0.15 : -0.18, 0.13, 0.13, 0.022, [red, black, black], front))
  }
  // the brush: thick, held low behind, white at the tip
  const tail = new THREE.Group()
  tail.position.set(0, 0.36, -0.24)
  tail.rotation.x = -2.2
  B.add(tail)
  mesh(tail, ball(0.065, 0.9, 2.6, 0.9), red, 0, 0.16, 0)
  mesh(tail, ball(0.05, 1, 1.2, 1), white, 0, 0.33, 0)
  b.tail = tail
  return b
}

/** A mountain hare in its white winter coat, black tips on its long ears. Sits hunched, hops. */
class Hare {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly ears: THREE.Group[] = []
  readonly pos = new THREE.Vector3()
  yaw = 0
  hop = 0
  constructor() {
    const white = std(0xf6f6f2)
    const black = std(0x111111, 0.5)
    this.group.add(this.body)
    mesh(this.body, ball(0.15, 0.9, 0.85, 1.25), white, 0, 0.17, -0.03).rotation.x = -0.35
    mesh(this.body, ball(0.08, 0.95, 0.9, 1.05), white, 0, 0.29, 0.13)
    mesh(this.body, ball(0.03, 1, 1, 1, 8), white, 0, 0.2, -0.2)
    for (const s of [-1, 1]) {
      mesh(this.body, ball(0.014, 1, 1, 1, 8), black, s * 0.055, 0.31, 0.17)
      // the haunch over each hind foot
      mesh(this.body, ball(0.07, 0.6, 1, 1.2), white, s * 0.085, 0.12, -0.06)
      mesh(this.body, ball(0.03, 0.8, 0.5, 2.6, 8), white, s * 0.07, 0.025, 0.0)
      mesh(this.body, new THREE.CylinderGeometry(0.018, 0.013, 0.2, 6), white, s * 0.035, 0.1, 0.12)
      const ear = new THREE.Group()
      ear.position.set(s * 0.03, 0.35, 0.1)
      ear.rotation.set(-0.35, 0, -s * 0.2)
      this.body.add(ear)
      mesh(ear, ball(0.025, 0.9, 3.2, 0.5), white, 0, 0.07, 0)
      mesh(ear, ball(0.016, 0.9, 1.3, 0.5, 8), black, 0, 0.145, 0)
      this.ears.push(ear)
    }
  }
  set onSnowball(cb: SnowballHit) {
    this.group.userData.onSnowball = cb
  }
}

type BirdKind = 'domherre' | 'domherrehona' | 'talgoxe'
/** A little bird: bullfinch (the cock red-breasted, the hen soft brown) or great tit. Wings to flap. */
class Bird {
  readonly group = new THREE.Group()
  readonly wings: THREE.Group[] = []
  readonly tilt = new THREE.Group()
  constructor(kind: BirdKind) {
    const S = 1.5
    const grey = std(0x7d8590)
    const black = std(0x15151a, 0.6)
    const breast = std(kind === 'domherre' ? 0xe0533c : kind === 'domherrehona' ? 0xa58f7c : 0xf1d232, 0.8)
    const back = kind === 'talgoxe' ? std(0x7b8a3c) : grey
    const wing = kind === 'talgoxe' ? std(0x6c7e93) : black
    const head = kind === 'talgoxe' ? black : black
    const white = std(0xf4f4f4)
    this.group.add(this.tilt)
    const g = new THREE.Group()
    g.scale.setScalar(S)
    this.tilt.add(g)
    mesh(g, ball(0.045, 0.85, 0.85, 1.25, 10), back, 0, 0.05, 0)
    mesh(g, ball(0.042, 0.85, 0.8, 1.0, 10), breast, 0, 0.042, 0.012)
    mesh(g, ball(0.028, 1, 1, 1.05, 10), kind === 'talgoxe' ? head : grey, 0, 0.085, 0.045)
    if (kind === 'talgoxe') {
      for (const s of [-1, 1]) mesh(g, ball(0.014, 0.5, 1, 1.2, 8), white, s * 0.022, 0.08, 0.05)
      mesh(g, new THREE.BoxGeometry(0.012, 0.05, 0.01), black, 0, 0.035, 0.05)
    } else {
      mesh(g, ball(0.027, 1.05, 0.6, 1.1, 10), black, 0, 0.095, 0.05)
      if (kind === 'domherre') for (const s of [-1, 1]) mesh(g, ball(0.014, 0.5, 1, 1.2, 8), breast, s * 0.022, 0.075, 0.055)
    }
    mesh(g, new THREE.ConeGeometry(kind === 'talgoxe' ? 0.007 : 0.011, 0.02, 6).rotateX(Math.PI / 2), black, 0, 0.082, 0.077)
    for (const s of [-1, 1]) mesh(g, ball(0.005, 1, 1, 1, 6), black, s * 0.02, 0.09, 0.064)
    mesh(g, new THREE.BoxGeometry(0.03, 0.006, 0.06), wing, 0, 0.055, -0.07).rotation.x = 0.35
    // the bullfinch's white rump
    if (kind !== 'talgoxe') mesh(g, ball(0.018, 1.2, 0.6, 1, 8), white, 0, 0.06, -0.045)
    for (const s of [-1, 1]) {
      const w = new THREE.Group()
      w.position.set(s * 0.032, 0.065, 0.005)
      g.add(w)
      mesh(w, ball(0.035, 0.25, 0.5, 1.2, 8), wing, s * 0.01, -0.005, -0.012)
      if (kind !== 'talgoxe') mesh(w, new THREE.BoxGeometry(0.004, 0.006, 0.03), white, s * 0.02, 0.0, 0.0)
      this.wings.push(w)
    }
  }
  /** Wings: `flap` 0 folded … 1 beating. */
  flap(t: number, flap: number) {
    for (const [i, w] of this.wings.entries()) w.rotation.z = (i ? -1 : 1) * flap * (0.4 + Math.sin(t * 38) * 1.0)
  }
}

/* ---------- tracks in the snow ---------- */

function printTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const [c, ctx] = makeCanvas(w, h)
  ctx.filter = 'blur(2px)'
  ctx.fillStyle = 'rgba(92, 112, 160, 0.55)'
  draw(ctx, w, h)
  return toTexture(c)
}
const oval = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}
type Print = { x: number; z: number; yaw: number }
/** Prints of one kind, w × d each, lying on the snow along the way they went. */
function tracks(parent: THREE.Object3D, tex: THREE.Texture, w: number, d: number, prints: Print[]) {
  const list = prints.filter((p) => outside(p.x, p.z) > 0.3)
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat, list.length)
  const o = new THREE.Object3D()
  list.forEach((p, i) => {
    o.position.set(p.x, groundHeight(p.x, p.z) + 0.02, p.z)
    o.rotation.set(0, p.yaw, 0)
    o.updateMatrix()
    m.setMatrixAt(i, o.matrix)
  })
  m.receiveShadow = true
  m.computeBoundingSphere()
  parent.add(m)
}
/** A wandering way from (x, z): `n` steps of `step` metres, turning a little each time. */
function wander(x: number, z: number, yaw: number, n: number, step: number, turn = 0.5) {
  const out: Print[] = []
  for (let i = 0; i < n; i++) {
    yaw += (rand() - 0.5) * turn
    x += Math.sin(yaw) * step
    z += Math.cos(yaw) * step
    out.push({ x, z, yaw })
  }
  return out
}
/** Straight from a to b, a print every `step`, left and right foot by turns. */
function walkPrints(a: { x: number; z: number }, b: { x: number; z: number }, step: number, gauge: number) {
  const yaw = Math.atan2(b.x - a.x, b.z - a.z)
  const n = Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / step)
  const out: Print[] = []
  for (let i = 0; i < n; i++) {
    const s = (i % 2 ? 1 : -1) * gauge
    const u = i / n
    out.push({ x: a.x + (b.x - a.x) * u + Math.cos(yaw) * s, z: a.z + (b.z - a.z) * u - Math.sin(yaw) * s, yaw: yaw + (rand() - 0.5) * 0.2 })
  }
  return out
}

/* ---------- the feeder and the birch ---------- */

function buildFeeder(parent: THREE.Object3D) {
  const g = new THREE.Group()
  g.position.set(WILD.feeder.x, 0, WILD.feeder.z)
  g.rotation.y = 0.7
  parent.add(g)
  const wood = std(0x6b4a2e)
  const roof = std(0x8a2a22)
  const snow = std(0xffffff, 0.8)
  mesh(g, new THREE.BoxGeometry(0.09, 1.3, 0.09), wood, 0, 0.65, 0)
  mesh(g, new THREE.BoxGeometry(0.8, 0.04, 0.6), wood, 0, 1.3, 0)
  for (const [x, z, w, d] of [[0, 0.29, 0.8, 0.03], [0, -0.29, 0.8, 0.03], [0.39, 0, 0.03, 0.6], [-0.39, 0, 0.03, 0.6]]) mesh(g, new THREE.BoxGeometry(w, 0.05, d), wood, x, 1.34, z)
  // seeds and nuts on the tray
  const [c, ctx] = makeCanvas(128, 96)
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = ['#2a2420', '#e8dcc0', '#c9a36a', '#4a3a2a'][i % 4]
    ctx.beginPath()
    ctx.ellipse(8 + rand() * 112, 8 + rand() * 80, 3 + rand() * 2, 1.6, rand() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  const seeds = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.54).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: toTexture(c), transparent: true, roughness: 1 }))
  seeds.position.y = 1.325
  g.add(seeds)
  // a little roof on four posts, with snow on it
  for (const [x, z] of [[-0.36, -0.26], [0.36, -0.26], [-0.36, 0.26], [0.36, 0.26]]) mesh(g, new THREE.BoxGeometry(0.03, 0.42, 0.03), wood, x, 1.53, z)
  for (const s of [-1, 1]) {
    const p = mesh(g, new THREE.BoxGeometry(1.0, 0.03, 0.46), roof, 0, 1.86, s * 0.19)
    p.rotation.x = s * 0.55
    const sn = mesh(g, new THREE.BoxGeometry(0.98, 0.05, 0.4), snow, 0, 1.89, s * 0.18)
    sn.rotation.x = s * 0.55
  }
  // a fat ball in its green net, hanging from the eave
  rod(g, v3(0.3, 1.74, 0.36), v3(0.3, 1.55, 0.36), 0.004, 0.004, std(0x222222))
  mesh(g, ball(0.055), std(0xc9ae74), 0.3, 1.5, 0.36)
  mesh(g, ball(0.058, 1, 1, 1, 6), new THREE.MeshStandardMaterial({ color: 0x2e7a3a, wireframe: true }), 0.3, 1.5, 0.36)
  // spilt seeds on the snow below
  const smallSeeds = toTexture(c)
  smallSeeds.wrapS = smallSeeds.wrapT = THREE.RepeatWrapping
  smallSeeds.repeat.set(2.5, 2.5)
  const spill = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: smallSeeds, transparent: true, opacity: 0.6, roughness: 1, depthWrite: false }))
  spill.position.y = 0.02
  g.add(spill)
  g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  // where the birds sit: spots on the tray (feeder space → world)
  const spots = [[-0.25, 0.1], [0.05, 0.15], [0.25, -0.08], [-0.1, -0.15], [0.2, 0.18], [-0.3, -0.05]].map(([x, z]) => g.localToWorld(v3(x, 1.33, z)))
  // (and the last one: hanging on the fat ball)
  spots.push(g.localToWorld(v3(0.3, 1.47, 0.42)))
  return { group: g, spots }
}

/** A birch beside the feeder: white bark with black marks, bare branches the birds wait on. */
function buildBirch(parent: THREE.Object3D) {
  const g = new THREE.Group()
  g.position.set(WILD.birch.x, 0, WILD.birch.z)
  parent.add(g)
  const [c, ctx] = makeCanvas(64, 256)
  ctx.fillStyle = '#ece9e2'
  ctx.fillRect(0, 0, 64, 256)
  ctx.fillStyle = '#1f1d1b'
  for (let i = 0; i < 40; i++) ctx.fillRect(rand() * 60, rand() * 256, 4 + rand() * 18, 1.5 + rand() * 3)
  const bark = new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.9 })
  const twig = std(0x4a3426)
  rod(g, v3(0, 0, 0), v3(0.15, 6.5, -0.1), 0.17, 0.05, bark)
  const perches: THREE.Vector3[] = []
  for (let i = 0; i < 9; i++) {
    const y = 2.3 + i * 0.45
    const a = i * 2.4
    const len = 1.6 - i * 0.1
    const from = v3(0.02 * y, y, -0.015 * y)
    const to = from.clone().add(v3(Math.sin(a) * len, len * 0.55, Math.cos(a) * len))
    rod(g, from, to, 0.04, 0.012, i < 4 ? bark : twig)
    // and twigs hanging down from it, as birches' do
    for (let k = 1; k <= 3; k++) {
      const p = from.clone().lerp(to, k / 3.5)
      rod(g, p, p.clone().add(v3(Math.sin(a + k) * 0.2, -0.5 - k * 0.15, Math.cos(a + k) * 0.2)), 0.008, 0.004, twig)
    }
    perches.push(g.localToWorld(from.clone().lerp(to, 0.55).add(v3(0, 0.035, 0))))
  }
  g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  return { group: g, perches }
}

/* ---------- all of it ---------- */

export type Wildlife = ReturnType<typeof buildWildlife>

export function buildWildlife(scene: THREE.Scene, say: (text: string) => void) {
  const group = new THREE.Group()
  scene.add(group)
  const colliders: Circle[] = [
    { x: WILD.feeder.x, z: WILD.feeder.z, r: 0.45 },
    { x: WILD.birch.x, z: WILD.birch.z, r: 0.3 },
  ]
  const feeder = buildFeeder(group)
  const birch = buildBirch(group)
  const solids: THREE.Object3D[] = [feeder.group, birch.group]
  const near = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)

  /* --- birds --- */
  type BirdState = { bird: Bird; at: THREE.Vector3; from: THREE.Vector3; to: THREE.Vector3; mode: 'sit' | 'fly'; u: number; dur: number; wait: number; spot: number; perch: boolean; yaw: number; peck: number }
  const kinds: BirdKind[] = ['domherre', 'domherre', 'domherrehona', 'talgoxe', 'talgoxe', 'talgoxe']
  const taken = new Set<string>()
  const birds: BirdState[] = kinds.map((k, i) => {
    const bird = new Bird(k)
    group.add(bird.group)
    solids.push(bird.group)
    const spot = i === 5 ? feeder.spots.length - 1 : i
    const at = feeder.spots[spot].clone()
    taken.add(`f${spot}`)
    return { bird, at, from: at.clone(), to: at.clone(), mode: 'sit', u: 0, dur: 1, wait: between(2, 6), spot, perch: false, yaw: rand() * 6, peck: rand() * 5 }
  })
  let birdsScared = 0
  const flyTo = (b: BirdState, perch: boolean) => {
    const key = (p: boolean, i: number) => `${p ? 'p' : 'f'}${i}`
    taken.delete(key(b.perch, b.spot))
    const pool = perch ? birch.perches : feeder.spots
    const free = pool.map((_, i) => i).filter((i) => !taken.has(key(perch, i)))
    const i = free.length ? free[Math.floor(rand() * free.length)] : Math.floor(rand() * pool.length)
    taken.add(key(perch, i))
    b.from.copy(b.at)
    b.to.copy(pool[i])
    b.spot = i
    b.perch = perch
    b.mode = 'fly'
    b.u = 0
    b.dur = Math.max(0.5, b.from.distanceTo(b.to) / 4.5)
  }
  const scareBirds = () => {
    birdsScared = between(6, 12)
    for (const b of birds) if (!b.perch) flyTo(b, true)
  }
  feeder.group.userData.onSnowball = scareBirds
  for (const b of birds) b.bird.group.userData.onSnowball = scareBirds

  /* --- roe deer --- */
  type DeerState = { b: Beast; mode: 'home' | 'come' | 'feed' | 'flee' | 'leave'; wait: number; feed: { x: number; z: number }; home: { x: number; z: number } }
  const deer: DeerState[] = [roeDeer(1), roeDeer(0.78)].map((b, i) => {
    group.add(b.group)
    solids.push(b.group)
    const home = { x: WILD.deerHome.x + i * 1.6, z: WILD.deerHome.z - i * 1.2 }
    b.pos.set(home.x, 0, home.z)
    b.yaw = Math.atan2(WILD.feeder.x - home.x, WILD.feeder.z - home.z)
    return { b, mode: 'home', wait: between(5, 15), feed: WILD.deerFeed[i], home }
  })
  const fleeDeer = () => {
    for (const d of deer) if (d.mode !== 'home') d.mode = 'flee'
  }
  for (const d of deer) d.b.onSnowball = fleeDeer

  /* --- the fox --- */
  const fx = fox()
  group.add(fx.group)
  solids.push(fx.group)
  const foxWay = [70, 80, 92, 104, 116, 124].map((deg, i) => round(deg, 47.2 + (i % 2) * 1.3))
  const den = round(98, 50.5)
  fx.pos.set(den.x, 0, den.z)
  let foxMode: 'sleep' | 'trot' | 'listen' | 'leap' | 'dig' | 'flee' | 'hide' = 'sleep'
  let foxNext = 1
  let foxDir = 1
  let foxT = 0
  let foxHop = { x: 0, z: 0 }
  const foxFlee = () => {
    if (foxMode !== 'sleep') {
      foxMode = 'flee'
      foxT = 0
    }
  }
  fx.onSnowball = () => {
    if (foxMode === 'sleep') foxMode = 'trot'
    foxFlee()
  }

  /* --- the hare --- */
  const hare = new Hare()
  group.add(hare.group)
  solids.push(hare.group)
  const hareHome = round(-42, 46.8)
  hare.pos.set(hareHome.x, 0, hareHome.z)
  let hareMode: 'sit' | 'hop' | 'flee' | 'hide' = 'sit'
  let hareT = between(3, 8)
  let hareTo = { ...hareHome }
  let hareTall = 0
  const hareFlee = () => {
    hareMode = 'flee'
    hareT = 0
    const out = Math.atan2(hare.pos.x, hare.pos.z)
    hareTo = { x: Math.sin(out) * 60, z: Math.cos(out) * 60 }
  }
  hare.onSnowball = hareFlee

  /* --- the moose --- */
  const mo = moose()
  group.add(mo.group)
  solids.push(mo.group)
  mo.group.visible = false
  const [mA, mB] = WILD.moose
  const PERIOD = 720
  const WALK = Math.hypot(mB.x - mA.x, mB.z - mA.z) / 1.05
  const STAY = 60
  const mooseBody = [
    { x: 0, z: 0, r: -1 },
    { x: 0, z: 0, r: -1 },
  ]
  colliders.push(...mooseBody)
  let mooseToldAt = -1
  mo.onSnowball = () => {
    mo.look = 0.9
    say('🫎 Älgen tittar på dig. Länge. Sen tuggar den vidare.')
  }

  /* --- tracks --- */
  const hareTex = printTexture((ctx) => {
    oval(ctx, 40, 50, 15, 40)
    oval(ctx, 88, 50, 15, 40)
    oval(ctx, 64, 150, 12, 16)
    oval(ctx, 60, 205, 12, 16)
  }, 128, 256)
  const pawTex = printTexture((ctx) => {
    oval(ctx, 32, 38, 12, 14)
    for (const [x, y] of [[20, 18], [44, 18], [27, 9], [37, 9]]) oval(ctx, x, y, 5, 6)
  }, 64, 64)
  const hoofTex = printTexture((ctx) => {
    oval(ctx, 23, 32, 9, 24)
    oval(ctx, 41, 32, 9, 24)
  }, 64, 64)
  const harePrints: Print[] = []
  for (let i = 0; i < 7; i++) {
    const p = round(between(-72, -14), between(45.5, 54))
    harePrints.push(...wander(p.x, p.z, rand() * 6, 12 + Math.floor(rand() * 8), 1.3, 0.7))
  }
  tracks(group, hareTex, 0.3, 0.6, harePrints)
  const foxPrints: Print[] = []
  for (let i = 0; i + 1 < foxWay.length; i++) foxPrints.push(...walkPrints(foxWay[i], foxWay[i + 1], 0.34, 0.02))
  foxPrints.push(...walkPrints(foxWay[2], den, 0.34, 0.02))
  for (let i = 0; i < 3; i++) {
    const p = round(between(60, 130), between(46, 52))
    let { x, z } = p
    let yaw = rand() * 6
    for (let k = 0; k < 6; k++) {
      yaw += (rand() - 0.5) * 0.8
      const nx = x + Math.sin(yaw) * 3
      const nz = z + Math.cos(yaw) * 3
      foxPrints.push(...walkPrints({ x, z }, { x: nx, z: nz }, 0.34, 0.02))
      x = nx
      z = nz
    }
  }
  tracks(group, pawTex, 0.09, 0.09, foxPrints)
  const deerPrints: Print[] = []
  for (const d of deer) deerPrints.push(...walkPrints(d.home, d.feed, 0.45, 0.08), ...walkPrints(d.feed, d.home, 0.45, 0.08).map((p) => ({ ...p, x: p.x + 0.3 })))
  tracks(group, hoofTex, 0.08, 0.1, deerPrints)
  tracks(group, hoofTex, 0.17, 0.2, walkPrints(mA, mB, 0.75, 0.18))

  /* --- every frame --- */
  let lastScareCheck = 0
  /**
   * `player`: where you are (or null up in the sleigh, where nothing notices you); `clock`: the village's
   * wall clock (the moose's timetable); `day`: 0 night … 1 day (the fox sleeps by day).
   */
  function update(t: number, dt: number, player: THREE.Vector3 | null, clock: number, day: number) {
    const far = { x: 1e4, z: 1e4 }
    const me = player ?? far

    // birds: peck about on the tray; up into the birch when someone comes close, back when they've gone
    const crowd = near(me, WILD.feeder) < 3.2
    if (crowd && t - lastScareCheck > 0.2) {
      lastScareCheck = t
      if (birds.some((b) => !b.perch)) scareBirds()
    }
    birdsScared = Math.max(0, birdsScared - dt)
    for (const [i, b] of birds.entries()) {
      const bird = b.bird
      if (b.mode === 'fly') {
        b.u = Math.min(1, b.u + dt / b.dur)
        const u = b.u
        b.at.lerpVectors(b.from, b.to, u)
        b.at.y += Math.sin(u * Math.PI) * Math.min(1.2, b.from.distanceTo(b.to) * 0.25)
        b.yaw = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z)
        bird.flap(t + i, 1)
        bird.tilt.rotation.x = -0.25
        if (u >= 1) {
          b.mode = 'sit'
          b.wait = between(1.5, 5)
        }
      } else {
        bird.flap(t, 0)
        b.wait -= dt
        if (b.perch) {
          // waiting in the birch: look about, and back down once the coast is clear
          bird.tilt.rotation.x = 0
          if (b.wait <= 0) {
            b.wait = between(1, 3)
            b.yaw += (rand() - 0.5) * 2
            if (!crowd && birdsScared <= 0 && rand() < 0.5) flyTo(b, false)
          }
        } else if (b.spot === feeder.spots.length - 1) {
          // on the fat ball: hanging on and pecking
          bird.tilt.rotation.x = 0.9 + Math.max(0, Math.sin(t * 9 + b.peck)) * 0.3
        } else {
          // on the tray: peck, peck, look up, hop
          b.peck += dt
          const pecking = Math.sin(b.peck * 0.7) > -0.3
          bird.tilt.rotation.x = pecking ? Math.max(0, Math.sin(b.peck * 14)) * 0.7 : 0
          if (b.wait <= 0) {
            b.wait = between(1.5, 4)
            b.yaw += (rand() - 0.5) * 2.5
            if (rand() < 0.3) flyTo(b, false)
          }
        }
      }
      bird.group.position.copy(b.at)
      bird.group.rotation.y = b.yaw
    }

    // the deer: out of the forest to eat by the feeder while nobody's near, off in great bounds if someone comes
    for (const d of deer) {
      const b = d.b
      const dist = near(me, b.pos)
      if ((d.mode === 'come' || d.mode === 'feed' || d.mode === 'leave') && dist < 6.5) d.mode = 'flee'
      if (d.mode === 'home') {
        b.stop(dt)
        b.graze = ease(b.graze, Math.sin(t * 0.2 + b.phase) > 0 ? 1 : 0.1, 1.5, dt)
        b.lookAt(null, dt)
        if ((d.wait -= dt) <= 0 && near(me, d.feed) > 10) d.mode = 'come'
        b.pose(dt, 2.2, false)
      } else if (d.mode === 'come' || d.mode === 'leave') {
        b.graze = ease(b.graze, 0, 3, dt)
        const there = d.mode === 'come' ? d.feed : d.home
        // (stops to look up now and then)
        if (Math.sin(t * 0.5 + b.phase) > 0.85) {
          b.stop(dt)
          b.lookAt(dist < 20 ? me : null, dt)
        } else {
          b.lookAt(null, dt)
          if (b.go(there.x, there.z, 0.7, dt)) {
            d.mode = d.mode === 'come' ? 'feed' : 'home'
            d.wait = d.mode === 'feed' ? between(60, 150) : between(20, 50)
          }
        }
        b.pose(dt, 2.2, false)
      } else if (d.mode === 'feed') {
        b.stop(dt)
        // nibbling the spilt seeds – head up and ears turned when someone's getting closer
        const wary = dist < 10
        b.graze = ease(b.graze, wary ? 0 : Math.sin(t * 0.35 + b.phase) > -0.6 ? 1 : 0, 2, dt)
        b.lookAt(wary ? me : null, dt)
        if (!wary) b.turnTo(WILD.feeder.x, WILD.feeder.z, dt, 0.5)
        if ((d.wait -= dt) <= 0) d.mode = 'leave'
        b.pose(dt, 2.2, false)
      } else {
        b.graze = ease(b.graze, 0, 6, dt)
        b.lookAt(null, dt)
        if (b.go(d.home.x, d.home.z, 6, dt, 4)) {
          d.mode = 'home'
          d.wait = between(35, 70)
        }
        b.pose(dt, 1.0, b.speed > 1.5)
      }
      b.flick(t)
    }

    // the fox: asleep by day; at night along the forest edge, stopping to listen for mice and pounce
    {
      const b = fx
      const dist = near(me, b.pos)
      if (day > 0.55 && (foxMode === 'trot' || foxMode === 'hide')) {
        // dawn: home to sleep
        if (b.go(den.x, den.z, 1.2, dt)) foxMode = 'sleep'
      } else if (foxMode === 'sleep') {
        b.stop(dt)
        if (day <= 0.55) foxMode = 'trot'
      } else if (foxMode !== 'flee' && foxMode !== 'hide' && dist < 7) {
        foxFlee()
      }
      foxT += dt
      let crouch = 0
      let dive = 0
      if (foxMode === 'trot') {
        const w = foxWay[foxNext]
        b.lookAt(null, dt)
        if (b.go(w.x, w.z, 1.1, dt)) {
          if (foxNext === foxWay.length - 1) foxDir = -1
          if (foxNext === 0) foxDir = 1
          foxNext += foxDir
          if (rand() < 0.5) {
            foxMode = 'listen'
            foxT = 0
          }
        }
      } else if (foxMode === 'listen') {
        // head cocked one way, then the other, ears forward…
        b.stop(dt)
        b.look = Math.sin(foxT * 2.5) * 0.35
        crouch = Math.min(1, foxT)
        if (foxT > 3) {
          foxMode = 'leap'
          foxT = 0
          foxHop = { x: b.pos.x + Math.sin(b.yaw) * 1.1, z: b.pos.z + Math.cos(b.yaw) * 1.1 }
        }
      } else if (foxMode === 'leap') {
        // …and up, and nose first into the snow
        const u = Math.min(1, foxT / 0.8)
        b.pos.x += (foxHop.x - b.pos.x) * Math.min(1, dt * 4)
        b.pos.z += (foxHop.z - b.pos.z) * Math.min(1, dt * 4)
        b.speed = 0
        dive = u
        if (u >= 1) {
          foxMode = 'dig'
          foxT = 0
        }
      } else if (foxMode === 'dig') {
        dive = 1 - Math.max(0, foxT - 1.4) / 0.4
        if (foxT > 1.8) {
          foxMode = 'trot'
          foxT = 0
        }
      } else if (foxMode === 'flee') {
        const out = Math.atan2(b.pos.x, b.pos.z)
        if (b.go(Math.sin(out) * 62, Math.cos(out) * 62, 5, dt, 5) || foxT > 6) {
          foxMode = 'hide'
          foxT = 0
        }
      } else if (foxMode === 'hide') {
        b.stop(dt)
        if (foxT > 30 && near(me, foxWay[foxNext]) > 12) foxMode = 'trot'
      }
      b.pose(dt, foxMode === 'flee' ? 1.4 : 2.6, foxMode === 'flee' && b.speed > 2)
      if (foxMode === 'sleep') {
        // curled up: legs tucked, nose under the tail
        b.body.position.y = -0.2
        b.body.rotation.z = 0.35
        for (const l of b.legs) l.hip.rotation.x = l.front ? -1.4 : 1.4
        b.neck.rotation.x = 0.9
        b.head.rotation.y = 0.8
        b.tail!.rotation.set(-1.7, 0.9, 0)
      } else {
        b.body.rotation.z = 0
        b.tail!.rotation.set(-2.2 + Math.min(1, b.speed / 3) * 0.5, Math.sin(t * 2) * 0.1, 0)
        if (dive > 0) {
          // the arc of the pounce, then the front end down in the snow and the tail straight up
          b.body.position.y = foxMode === 'leap' ? Math.sin(dive * Math.PI) * 0.7 - dive * 0.25 : -0.25 * dive
          b.body.rotation.x = foxMode === 'leap' ? -0.4 + dive * 1.4 : 1.0 * dive
          b.neck.rotation.x = 0.5 * dive
        } else {
          b.neck.rotation.x = crouch * 0.6
          b.body.position.y -= crouch * 0.05
        }
      }
      b.flick(t)
    }

    // the hare: sits, hops a little, sits up to listen; off in a zigzag if you come near
    {
      const dist = near(me, hare.pos)
      if ((hareMode === 'sit' || hareMode === 'hop') && dist < 6) hareFlee()
      hareT -= dt
      let moving = false
      if (hareMode === 'sit') {
        hareTall = ease(hareTall, Math.sin(t * 0.4) > 0.8 ? 1 : 0, 3, dt)
        if (hareT <= 0) {
          hareMode = 'hop'
          const a = rand() * Math.PI * 2
          hareTo = { x: hareHome.x + Math.cos(a) * 3, z: hareHome.z + Math.sin(a) * 3 }
          if (outside(hareTo.x, hareTo.z) < 1) hareTo = { ...hareHome }
        }
      } else if (hareMode === 'hide') {
        if (hareT <= 0 && near(me, hareHome) > 12) {
          hareMode = 'hop'
          hareTo = { ...hareHome }
        }
      } else {
        const fast = hareMode === 'flee'
        const dx = hareTo.x - hare.pos.x
        const dz = hareTo.z - hare.pos.z
        const d = Math.hypot(dx, dz)
        // (fleeing, it zigzags)
        const want = Math.atan2(dx, dz) + (fast ? Math.sin(t * 3) * 0.6 : 0)
        hare.yaw += THREE.MathUtils.clamp(wrap(want - hare.yaw), -8 * dt, 8 * dt)
        const sp = fast ? 7 : 1.2
        hare.pos.x += Math.sin(hare.yaw) * sp * dt
        hare.pos.z += Math.cos(hare.yaw) * sp * dt
        moving = true
        hare.hop += dt * (fast ? 4 : 3)
        hareTall = ease(hareTall, 0, 8, dt)
        if (d < 0.4 || (fast && d < 3)) {
          hareMode = fast ? 'hide' : 'sit'
          hareT = fast ? between(25, 45) : between(4, 10)
          if (fast) hare.pos.set(hareTo.x, 0, hareTo.z)
        }
      }
      const arc = moving ? Math.abs(Math.sin(hare.hop * Math.PI)) : 0
      hare.group.position.set(hare.pos.x, groundHeight(hare.pos.x, hare.pos.z) + arc * (hareMode === 'flee' ? 0.35 : 0.18), hare.pos.z)
      hare.group.rotation.y = hare.yaw
      hare.body.rotation.x = moving ? -0.25 + arc * 0.3 : -hareTall * 0.6
      hare.body.position.y = hareTall * 0.08
      for (const [i, e] of hare.ears.entries()) e.rotation.x = moving ? 0.6 : -0.35 + Math.max(0, Math.sin(t * 1.7 + i * 1.3) - 0.9) * 4
      hare.group.visible = hareMode !== 'hide'
    }

    // the moose: out of the forest, a minute on the path north, and back – on the village clock's time
    {
      const s = ((clock / 1000) % PERIOD + PERIOD) % PERIOD
      const b = mo
      const there = s < WALK * 2 + STAY + 5
      b.group.visible = there
      const ab = Math.atan2(mB.x - mA.x, mB.z - mA.z)
      if (!there) {
        for (const c of mooseBody) c.r = -1
      } else {
        if (s < WALK) {
          const u = s / WALK
          b.pos.set(mA.x + (mB.x - mA.x) * u, 0, mA.z + (mB.z - mA.z) * u)
          b.yaw = ab
          b.speed = 1.05
          b.graze = ease(b.graze, 0, 2, dt)
          b.lookAt(null, dt)
        } else if (s < WALK + STAY) {
          // standing on the path, broadside, chewing; looks at you if you're near
          b.pos.set(mB.x, 0, mB.z)
          b.yaw = ab
          b.speed = 0
          const k = s - WALK
          b.graze = ease(b.graze, Math.sin(k * 0.15) > 0.5 ? 0.7 : 0, 1.2, dt)
          b.lookAt(near(me, b.pos) < 25 ? me : null, dt, 1.4)
          if (mooseToldAt !== Math.floor(clock / 1000 / PERIOD) && player && near(me, mB) < 40) {
            mooseToldAt = Math.floor(clock / 1000 / PERIOD)
            say('🫎 Psst! En älg står på stigen mot Leksaksfabriken. Gå försiktigt.')
          }
        } else {
          // turn round, and back the way it came
          const k = s - WALK - STAY
          const turn = Math.min(1, k / 5)
          const u = Math.max(0, (k - 5) / WALK)
          b.pos.set(mB.x + (mA.x - mB.x) * u, 0, mB.z + (mA.z - mB.z) * u)
          b.yaw = ab + Math.PI * turn
          b.speed = u > 0 ? 1.05 : 0.3
          b.graze = ease(b.graze, 0, 2, dt)
          b.lookAt(null, dt)
        }
        b.pose(dt, 0.9, false, 0.9)
        b.flick(t)
        for (const [i, c] of mooseBody.entries()) {
          const o = i ? 0.7 : -0.6
          c.x = b.pos.x + Math.sin(b.yaw) * o
          c.z = b.pos.z + Math.cos(b.yaw) * o
          c.r = 0.75
        }
      }
    }
  }

  const api = {
    group,
    colliders,
    solids,
    update,
    birds,
    deer,
    fox: fx,
    hare,
    moose: mo,
  }
  return api
}
