// First Sunday of Advent: the choir sings on a riser on the west side of the big tree, in violet robes, with the
// whole village sitting on benches below them in their winter coats and knitted hats, listening and
// swaying along. Beside the riser stands the village's advent candlestick: Mimmi lights the first
// candle before the concert, and it stays there all through the season with one candle more lit
// every Sunday (the first ones burnt the furthest down), until it's put away at tjugondag Knut.
import * as THREE from 'three'
import { keepApart } from './batch'
import type { Circle } from './world'

const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

/** Where the riser stands: on the west side of the big tree (the arcade cabinets have the south side),
 *  facing west over the benches. Everything here is laid out stage-local, the audience towards +z. */
export const STAGE = new THREE.Vector3(-5.0, 0, 0)
export const STAGE_YAW = -Math.PI / 2
/** A stage-local point in the world. */
export function stageToWorld(x: number, z: number, out = new THREE.Vector3()) {
  const c = Math.cos(STAGE_YAW)
  const s = Math.sin(STAGE_YAW)
  return out.set(STAGE.x + x * c + z * s, 0, STAGE.z - x * s + z * c)
}
/** The advent candlestick, stage-local: off one end of the riser. */
export const STAKE_AT = new THREE.Vector3(3.3, 0, 0.2)
/** Where Mimmi stands to light it (stage-local), facing it. */
export const LIGHTER_AT = new THREE.Vector3(2.55, 0, 0.2)
/** The riser's height: the back row stands on it, as in their nook. */
export const RISER = 0.38

/* ---------- the stage and the audience ---------- */

/** The rows of benches, stage-local. */
const ROWS = [4.0, 5.4, 6.8, 8.2, 9.6]
const SEATS = 5
const SEAT_GAP = 0.62
/** Seats start this far either side of the aisle down the middle. */
const AISLE = 0.95

export function buildAdventConcert(scene: THREE.Scene) {
  const group = new THREE.Group()
  group.position.copy(STAGE)
  group.rotation.y = STAGE_YAW
  const colliders: Circle[] = []
  const collide = (x: number, z: number, r: number) => {
    const p = stageToWorld(x, z)
    colliders.push({ x: p.x, z: p.z, r })
  }

  // the riser, draped in violet, with a fringe of snow
  const riser = new THREE.Mesh(new THREE.BoxGeometry(4.0, RISER, 1.0), std(0x7a4a24, 0.8))
  riser.position.set(0, RISER / 2, -0.72)
  riser.castShadow = riser.receiveShadow = true
  group.add(riser)
  const drape = new THREE.Mesh(new THREE.BoxGeometry(4.04, RISER - 0.04, 0.02), std(0x4a2470, 0.85))
  drape.position.set(0, RISER / 2, -0.21)
  group.add(drape)
  const gold = new THREE.MeshStandardMaterial({ color: 0xf6c453, roughness: 0.35, metalness: 0.7, emissive: 0x5a3a08, emissiveIntensity: 0.4 })
  const trim = new THREE.Mesh(new THREE.BoxGeometry(4.06, 0.035, 0.03), gold)
  trim.position.set(0, RISER - 0.03, -0.2)
  group.add(trim)
  // a gold star on the drape
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), gold)
  star.scale.z = 0.3
  star.position.set(0, RISER / 2, -0.19)
  group.add(star)
  const rim = new THREE.Mesh(new THREE.BoxGeometry(4.04, 0.05, 1.04), std(0xf4f8ff, 0.9))
  rim.position.set(0, RISER + 0.02, -0.72)
  group.add(rim)
  for (const x of [-1.4, 0, 1.4]) collide(x, -0.72, 0.62)

  // benches either side of an aisle, row on row
  const wood = std(0x8a5a32, 0.85)
  const darkWood = std(0x5a3a22, 0.9)
  const snow = std(0xf4f8ff, 0.9)
  const len = (SEATS - 1) * SEAT_GAP + 0.5
  for (const z of ROWS)
    for (const side of [-1, 1]) {
      const cx = side * (AISLE + ((SEATS - 1) * SEAT_GAP) / 2)
      const bench = new THREE.Group()
      bench.position.set(cx, 0, z)
      bench.add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.34), wood).translateY(0.28).translateZ(-0.03))
      for (const lx of [-len / 2 + 0.12, len / 2 - 0.12]) {
        bench.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.28), darkWood).translateX(lx).translateY(0.14).translateZ(-0.03))
        bench.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), darkWood).translateX(lx).translateY(0.5).translateZ(0.17))
      }
      for (const y of [0.5, 0.66]) bench.add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.03), wood).translateY(y).translateZ(0.18))
      bench.add(new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.03, 0.06), snow).translateY(0.715).translateZ(0.18))
      group.add(bench)
      for (let k = 0; k < 4; k++) collide(cx + (k - 1.5) * (len / 4), z + 0.05, 0.36)
    }
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
  })

  /* ---------- the villagers in the audience, instanced ---------- */
  const seats: { x: number; z: number; phase: number; s: number; look: number }[] = []
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const z of ROWS)
    for (const side of [-1, 1])
      for (let k = 0; k < SEATS; k++) {
        // (a few seats empty, here and there)
        if (rnd() < 0.12) continue
        seats.push({ x: side * (AISLE + k * SEAT_GAP), z, phase: rnd() * 10, s: 0.92 + rnd() * 0.14, look: (rnd() - 0.5) * 0.5 })
      }
  const N = seats.length
  const skin = std(0xf1c7a5, 0.6)
  const parts = {
    coat: new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.155, 0.42, 12), std(0xffffff, 0.85), N),
    shoulders: new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 8), std(0xffffff, 0.85), N),
    thighs: new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.09, 0.26), std(0x2e3446, 0.85), N * 2),
    shins: new THREE.InstancedMesh(new THREE.BoxGeometry(0.085, 0.24, 0.085), std(0x2e3446, 0.85), N * 2),
    boots: new THREE.InstancedMesh(new THREE.BoxGeometry(0.095, 0.07, 0.15), std(0x3a2418, 0.7), N * 2),
    hands: new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 8, 6), std(0xffffff, 0.8), N * 2),
    head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 14, 10), skin, N),
    hat: new THREE.InstancedMesh(new THREE.SphereGeometry(0.108, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), std(0xffffff, 0.9), N),
    brim: new THREE.InstancedMesh(new THREE.TorusGeometry(0.098, 0.022, 6, 18), std(0xffffff, 0.9), N),
    bobble: new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), std(0xfbf8f2, 0.95), N),
    scarf: new THREE.InstancedMesh(new THREE.TorusGeometry(0.085, 0.032, 6, 16), std(0xffffff, 0.9), N),
    eyes: new THREE.InstancedMesh(new THREE.SphereGeometry(0.013, 8, 6), std(0x1a1210, 0.3), N * 2),
    cheeks: new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 8, 6), std(0xe8908a, 0.7), N * 2),
    nose: new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), std(0xe8b090, 0.6), N),
    mouth: new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 10, 6), std(0x5a1a1c, 0.6), N),
  }
  const coats = [0x8a1f2a, 0x2f4f7a, 0x3a6a42, 0x6a4a8a, 0x9a6a2a, 0x2a2a34, 0xb84a3a, 0x4a7a8a].map((c) => new THREE.Color(c))
  const knits = [0xd8202c, 0xfbf8f2, 0x2f6fc6, 0x2f9a4a, 0xf2c230, 0xe86aa0, 0x6a4a8a].map((c) => new THREE.Color(c))
  for (let i = 0; i < N; i++) {
    const coat = coats[(i * 3) % coats.length]
    const knit = knits[(i * 5 + 2) % knits.length]
    parts.coat.setColorAt(i, coat)
    parts.shoulders.setColorAt(i, coat)
    parts.hat.setColorAt(i, knit)
    parts.brim.setColorAt(i, knit)
    parts.scarf.setColorAt(i, knits[(i * 2 + 4) % knits.length])
    // mittens to match the hat
    parts.hands.setColorAt(i * 2, knit)
    parts.hands.setColorAt(i * 2 + 1, knit)
  }
  const audience = keepApart(new THREE.Group())
  for (const m of Object.values(parts)) {
    m.frustumCulled = false
    m.castShadow = false
    audience.add(m)
  }
  group.add(audience)

  const m4 = new THREE.Matrix4()
  const base = new THREE.Matrix4()
  const head = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const tmp = new THREE.Vector3()
  const size = new THREE.Vector3()
  const at = (frame: THREE.Matrix4, x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z).premultiply(frame)
  /** The seat (0.3 m up) and the head above it, in seated villager units. */
  const SEAT = 0.3
  const H = 0.89
  let last = -1
  /** How much music there is, smoothed over a few seconds (the loudness itself jumps every syllable). */
  let music = 0
  /** `voice`: how loud the singing is, 0 … 1 – they sway slowly along while it goes on. */
  function update(time: number, voice: number) {
    const dt = last < 0 ? 0 : Math.min(0.1, time - last)
    last = time
    music += ((voice > 0 ? 1 : 0) - music) * Math.min(1, dt * 0.6)
    for (let i = 0; i < N; i++) {
      const p = seats[i]
      // facing the stage, rocking slowly side to side while the choir sings
      const sway = Math.sin(time * 1.1 + p.phase) * 0.035 * music
      e.set(0, Math.PI, sway, 'YXZ')
      q.setFromEuler(e)
      base.compose(tmp.set(p.x, 0, p.z), q, size.setScalar(p.s))
      parts.coat.setMatrixAt(i, at(base, 0, SEAT + 0.21, 0))
      parts.shoulders.setMatrixAt(i, at(base, 0, SEAT + 0.42, 0).multiply(m4.makeScale(1, 0.55, 0.85)))
      parts.scarf.setMatrixAt(i, at(base, 0, SEAT + 0.49, 0.01).multiply(m4.makeRotationX(Math.PI / 2)))
      for (const sx of [-1, 1]) {
        const j = i * 2 + (sx > 0 ? 1 : 0)
        parts.thighs.setMatrixAt(j, at(base, sx * 0.06, SEAT + 0.04, 0.12))
        parts.shins.setMatrixAt(j, at(base, sx * 0.06, SEAT - 0.13, 0.23))
        parts.boots.setMatrixAt(j, at(base, sx * 0.06, 0.035, 0.27))
        parts.hands.setMatrixAt(j, at(base, sx * 0.05, SEAT + 0.12, 0.17))
      }
      // the head: towards the singers, nodding along; now and then a look at the neighbour
      const glance = Math.max(0, Math.sin(time * 0.21 + p.phase * 1.7)) ** 6 * 0.6 * Math.sign(Math.sin(p.phase * 3.1))
      e.set(-0.06 + Math.sin(time * 2.2 + p.phase) * 0.025 * music, p.look * 0.3 + glance, 0, 'YXZ')
      head.copy(at(base, 0, H, 0)).multiply(m4.makeRotationFromEuler(e))
      parts.head.setMatrixAt(i, head)
      parts.hat.setMatrixAt(i, at(head, 0, 0.02, -0.006))
      parts.brim.setMatrixAt(i, at(head, 0, 0.035, -0.006).multiply(m4.makeRotationX(Math.PI / 2 - 0.12)))
      parts.bobble.setMatrixAt(i, at(head, 0, 0.13, -0.02))
      for (const sx of [-1, 1]) {
        const j = i * 2 + (sx > 0 ? 1 : 0)
        parts.eyes.setMatrixAt(j, at(head, sx * 0.033, 0.0, 0.088).multiply(m4.makeScale(1, 1.25, 0.6)))
        parts.cheeks.setMatrixAt(j, at(head, sx * 0.054, -0.035, 0.076).multiply(m4.makeScale(1, 0.8, 0.4)))
      }
      parts.nose.setMatrixAt(i, at(head, 0, -0.022, 0.099))
      // (a contented little smile)
      parts.mouth.setMatrixAt(i, at(head, 0, -0.058, 0.088).multiply(m4.makeScale(1.7, 0.22, 0.55)))
    }
    for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true
  }

  function show(on: boolean) {
    group.visible = on
    // (a collider with a negative radius never pushes)
    for (const c of colliders) c.r = on ? Math.abs(c.r) : -Math.abs(c.r)
  }
  scene.add(group)
  show(false)
  return { group, colliders, update, show }
}

/* ---------- the advent candlestick ---------- */

/**
 * The village's advent candlestick: four tall white candles in a long brass holder on a stand, dressed
 * with moss, lingonberries and little red apples.
 */
export function buildAdventStake(scene: THREE.Scene, glowTex: THREE.Texture) {
  const group = new THREE.Group()
  stageToWorld(STAKE_AT.x, STAKE_AT.z, group.position)
  // (its long side to the benches)
  group.rotation.y = STAGE_YAW
  const colliders: Circle[] = [{ x: group.position.x, z: group.position.z, r: 0.5 }]
  const wood = std(0x5a3a22, 0.8)
  const brass = new THREE.MeshStandardMaterial({ color: 0xd8a84a, roughness: 0.3, metalness: 0.85 })
  const moss = std(0x4f7a3a, 1)
  const berry = std(0xc8102e, 0.4)
  // a stand, like a little table, with snow on its edges
  const TOP = 0.78
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.38), wood).translateY(TOP))
  for (const x of [-0.4, 0.4]) for (const z of [-0.14, 0.14]) group.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, TOP, 0.05), wood).translateX(x).translateY(TOP / 2).translateZ(z))
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.02, 0.06), std(0xf4f8ff, 0.9)).translateY(TOP + 0.04).translateZ(-0.17))
  // the holder: a long brass tray on little feet, four cups
  const Y = TOP + 0.03
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.04, 0.16), brass).translateY(Y + 0.05))
  for (const x of [-0.38, 0.38]) group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.04, 8), brass).translateX(x).translateY(Y + 0.01))
  const CUP = Y + 0.09
  const X = [-0.3, -0.1, 0.1, 0.3]
  for (const x of X) group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.05, 12), brass).translateX(x).translateY(CUP))
  // moss, lingonberries, apples
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035 + rnd() * 0.025, 8, 6), moss)
    m.position.set(-0.4 + rnd() * 0.8, Y + 0.08, (rnd() - 0.5) * 0.16)
    m.scale.y = 0.6
    group.add(m)
  }
  for (let i = 0; i < 18; i++) group.add(new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5), berry).translateX(-0.4 + rnd() * 0.8).translateY(Y + 0.105).translateZ((rnd() - 0.5) * 0.17))
  for (const x of [-0.2, 0.0, 0.2]) group.add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), std(0xb8161e, 0.35)).translateX(x).translateY(Y + 0.11).translateZ(0.06))

  // the candles: white, thick, each burnt a little further down for every week it has been lit
  const TALL = 0.4
  const wax = std(0xfbf8f2, 0.5)
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })
  const candles = X.map((x) => {
    const c = keepApart(new THREE.Group())
    c.position.set(x, CUP + 0.02, 0)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 14), wax)
    body.position.y = 0.5
    const stick = new THREE.Group()
    stick.add(body)
    c.add(stick)
    const flame = new THREE.Group()
    flame.add(new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 8), flameMat).translateY(0.035))
    flame.add(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 4), std(0x1a1210, 0.8)).translateY(0.005))
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    glow.position.y = 0.04
    glow.scale.setScalar(0.36)
    flame.add(glow)
    c.add(flame)
    group.add(c)
    return { stick, flame, lit: false, height: TALL, growing: 0, phase: rnd() * 10 }
  })
  const light = new THREE.PointLight(0xffb060, 0, 6, 1.5)
  light.position.set(0, TOP + 0.7, 0.3)
  group.add(light)
  scene.add(group)

  /**
   * How it looks today: `lit` candles alight (the first ones first), `weeks[i]` how many weeks
   * candle i has burnt. `light` true lights a candle with a little flare (Mimmi's match).
   */
  function set(lit: number, weeks: number[]) {
    candles.forEach((c, i) => {
      const on = i < lit
      if (on && !c.lit) c.growing = 1
      c.lit = on
      c.height = TALL * (1 - Math.min(0.7, (weeks[i] ?? 0) * 0.17))
      c.stick.scale.y = c.height
      c.flame.position.y = c.height
    })
  }
  set(0, [])
  /** Where candle `i`'s wick is, in the world. */
  const wick = (i: number) => candles[i].flame.getWorldPosition(new THREE.Vector3())

  function update(time: number, dt: number) {
    let n = 0
    for (const c of candles) {
      c.flame.visible = c.lit
      if (!c.lit) continue
      n++
      c.growing = Math.max(0, c.growing - dt * 0.8)
      const flicker = 0.88 + Math.sin(time * 13 + c.phase) * 0.07 + Math.sin(time * 29 + c.phase * 2) * 0.05
      const s = 1 - c.growing * 0.7 + c.growing * Math.max(0, Math.sin(c.growing * 9)) * 0.6
      c.flame.scale.set(s, s * flicker, s)
    }
    light.intensity = n ? 1.2 + n * 0.7 : 0
  }
  return { group, colliders, set, update, wick }
}
