// Husvagnen: a cream camper hitched to an old car, parked at the edge of the square, with Musse Pigg and
// Kalle Anka waving beside it. Walk up and press E for the trip (trip.ts). The car and the trailer are two
// groups so they can bend at the hitch when you drive; parked they stand in a straight line.
// Car and trailer space: -z forward, the middle at the origin, wheels on the ground.
import * as THREE from 'three'
import { Nisse } from './npc'
import { rod, std } from './sleigh'
import { FONT, makeCanvas, toTexture } from './tex'
import { Kalle, Musse } from './toons'
import type { Circle } from './world'

/** Where the camper waits: behind and to the left of where you arrive (Arkitektkontoret has the right),
 * parked along the edge of the square with its door side facing out (so from the door you look across it at the julgran). */
export const CAMP = { x: -21.5, z: 21.5 }
/** Car middle, in trailer space (straight ahead of it). */
export const CAR_AHEAD = 4.6
/** The hitch ball, in car space. */
export const HITCH = 1.7
/** From the hitch back to the trailer's axle. */
export const TRAILER_ARM = 3.2
/** Trailer axle, in trailer space. */
export const AXLE = 0.3
/** The car's wheelbase. */
export const WHEELBASE = 2.0
const WHEEL_R = 0.42

const cream = std(0xf3e2b0, 0.6)
const creamDark = std(0xd9c48e, 0.7)
const blue = std(0x1f3a6b, 0.45)
const black = std(0x141416, 0.45)
const brass = std(0xd8a93a, 0.3, 0.8)
const rubber = std(0x1b1b1d, 0.85)
const wood = std(0x7a4a26, 0.8)
const glass = new THREE.MeshStandardMaterial({ color: 0x9cc3d8, roughness: 0.15, metalness: 0.1 })

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}

/** Red and white stripes for the awnings, with a scalloped hem. */
function awningTexture() {
  const [c, ctx] = makeCanvas(256, 128)
  ctx.fillStyle = '#fff6ea'
  ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = '#d8202c'
  for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 32, 104)
  ctx.clearRect(0, 104, 256, 24)
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = x % 64 ? '#fff6ea' : '#d8202c'
    ctx.beginPath()
    ctx.arc(x + 16, 104, 16, 0, Math.PI)
    ctx.fill()
  }
  return toTexture(c)
}

/** A spoked wheel standing on the ground, spinning about its x axis. */
function wheel(spokeMat: THREE.Material) {
  const g = new THREE.Group()
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.05, 0.06, 8, 24), rubber)
  tyre.rotation.y = Math.PI / 2
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 10), spokeMat)
  hub.rotation.z = Math.PI / 2
  g.add(tyre, hub)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, Math.cos(a) * (WHEEL_R - 0.08), Math.sin(a) * (WHEEL_R - 0.08)), 0.016, spokeMat))
  }
  return g
}

function buildTrailer(awnings: THREE.Group[]) {
  const g = new THREE.Group()
  // rounded side profile (u forward, v up), extruded across the width
  const s = new THREE.Shape()
  s.moveTo(-1.7, 0.55)
  s.lineTo(1.75, 0.55)
  s.quadraticCurveTo(2.15, 0.55, 2.15, 1.05)
  s.lineTo(2.15, 1.55)
  s.quadraticCurveTo(2.1, 2.55, 1.15, 2.55)
  s.lineTo(-1.05, 2.55)
  s.quadraticCurveTo(-2.15, 2.55, -2.15, 1.4)
  s.lineTo(-2.15, 1.0)
  s.quadraticCurveTo(-2.15, 0.55, -1.7, 0.55)
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 3, curveSegments: 12 })
  geo.rotateY(Math.PI / 2)
  geo.translate(-0.95, 0, 0)
  g.add(new THREE.Mesh(geo, [cream, creamDark]))
  // a red stripe round the waist
  for (const x of [-1.03, 1.03]) g.add(box(0.02, 0.09, 4.0, std(0xd8202c, 0.5), x, 1.05, 0))
  // side windows with flower boxes and striped awnings over them (the door is on the left, -x)
  const stripes = awningTexture()
  const awningMat = new THREE.MeshStandardMaterial({ map: stripes, side: THREE.DoubleSide, roughness: 0.8 })
  const flowers = [0xd8202c, 0xf2c230, 0xf7f4ee, 0xe86aa6]
  const win = (side: number, z: number, w: number) => {
    const x = side * 1.03
    g.add(box(0.03, 0.62, w, glass, x, 1.75, z))
    g.add(box(0.04, 0.08, w + 0.12, std(0xffffff, 0.6), x, 2.1, z), box(0.04, 0.08, w + 0.12, std(0xffffff, 0.6), x, 1.4, z))
    // window box with a row of flowers
    g.add(box(0.22, 0.16, w, wood, side * 1.12, 1.3, z))
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(flowers[(i + (z > 0 ? 1 : 0)) % 4], 0.6))
      f.position.set(side * 1.12, 1.43, z - w / 2 + 0.1 + (i * (w - 0.2)) / 4)
      g.add(f)
    }
    // awning, hinged at the wall over the window: folds flat against the side
    const hinge = new THREE.Group()
    hinge.position.set(side * 1.05, 2.3, z)
    // flat, stripes running out from the wall, scalloped hem on the outer edge (+x, mirrored on the left)
    const geo = new THREE.PlaneGeometry(w + 0.3, 0.6)
    geo.rotateZ(Math.PI / 2)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0.3, 0, 0)
    const cloth = new THREE.Mesh(geo, awningMat)
    cloth.scale.x = side
    hinge.userData.side = side
    hinge.add(cloth)
    g.add(hinge)
    awnings.push(hinge)
  }
  win(-1, -1.0, 1.0)
  win(1, -0.6, 1.4)
  win(1, 1.1, 0.8)
  // the door, its awning and two little steps
  g.add(box(0.04, 1.5, 0.75, std(0xb3202a, 0.6), -1.04, 1.32, 0.95))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), brass).translateX(-1.08).translateY(1.3).translateZ(0.7))
  g.add(box(0.3, 0.06, 0.7, wood, -1.25, 0.45, 0.95), box(0.25, 0.06, 0.7, wood, -1.45, 0.22, 0.95))
  // a stovepipe on the roof (breakfast is cooked in here)
  g.add(rod(new THREE.Vector3(0.5, 2.5, 1.2), new THREE.Vector3(0.5, 3.05, 1.2), 0.07, black))
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 10), black).translateX(0.5).translateY(3.1).translateZ(1.2))
  // wheels under mudguards, and the A-frame hitch out front
  const wheels: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const w = wheel(creamDark)
    w.position.set(side * 0.98, WHEEL_R, AXLE)
    g.add(w)
    wheels.push(w)
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 16, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xd9c48e, roughness: 0.7, side: THREE.DoubleSide }))
    guard.rotation.z = Math.PI / 2
    guard.position.set(side * 1.0, WHEEL_R, AXLE)
    g.add(guard)
  }
  for (const side of [-1, 1]) g.add(rod(new THREE.Vector3(side * 0.6, 0.55, -1.9), new THREE.Vector3(0, 0.5, -2.9), 0.04, black))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black).translateY(0.5).translateZ(-2.9))
  g.add(rod(new THREE.Vector3(0, 0.55, -2.5), new THREE.Vector3(0, 0.08, -2.5), 0.03, black))
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
  })
  return { group: g, wheels }
}

function buildCar() {
  const g = new THREE.Group()
  // chassis, running boards and the hitch out the back
  g.add(box(1.2, 0.18, 3.2, black, 0, 0.5, 0))
  for (const side of [-1, 1]) g.add(box(0.28, 0.05, 1.5, black, side * 0.78, 0.42, 0.1))
  g.add(rod(new THREE.Vector3(0, 0.5, 1.5), new THREE.Vector3(0, 0.5, HITCH), 0.04, black))
  // bonnet + brass radiator + headlamps
  g.add(box(0.9, 0.55, 1.05, blue, 0, 0.88, -1.0))
  g.add(box(1.0, 0.75, 0.12, brass, 0, 0.95, -1.56))
  g.add(box(0.8, 0.55, 0.02, std(0x2a2a2a, 0.6), 0, 0.95, -1.63))
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), brass)
    lamp.position.set(side * 0.62, 1.05, -1.5)
    lamp.scale.z = 0.8
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 14), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }))
    lens.position.set(side * 0.62, 1.05, -1.6)
    lens.rotation.y = Math.PI
    g.add(lamp, lens)
  }
  // tub body, seat, a tall black roof on four posts, windscreen and the steering wheel
  g.add(box(1.4, 0.65, 1.6, blue, 0, 0.92, 0.55))
  g.add(box(1.2, 0.2, 0.6, std(0x5a3418, 0.8), 0, 1.2, 0.85))
  g.add(box(1.2, 0.55, 0.15, std(0x5a3418, 0.8), 0, 1.5, 1.2))
  g.add(box(1.5, 0.07, 1.9, black, 0, 2.1, 0.45))
  for (const x of [-0.68, 0.68]) for (const z of [-0.45, 1.33]) g.add(rod(new THREE.Vector3(x, 1.22, z), new THREE.Vector3(x, 2.08, z), 0.03, black))
  g.add(box(1.3, 0.5, 0.03, glass, 0, 1.55, -0.45))
  const steer = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 18), black)
  steer.position.set(-0.3, 1.45, -0.15)
  steer.rotation.x = -0.9
  g.add(steer, rod(new THREE.Vector3(-0.3, 1.45, -0.15), new THREE.Vector3(-0.3, 0.95, -0.55), 0.025, black))
  // wheels under black mudguards
  const wheels: THREE.Group[] = []
  for (const z of [-WHEELBASE / 2, WHEELBASE / 2])
    for (const side of [-1, 1]) {
      const w = wheel(std(0xf2c230, 0.5))
      w.position.set(side * 0.72, WHEEL_R, z)
      g.add(w)
      wheels.push(w)
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.26, 16, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.45, side: THREE.DoubleSide }))
      guard.rotation.z = Math.PI / 2
      guard.position.set(side * 0.74, WHEEL_R + 0.02, z)
      g.add(guard)
    }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
  })
  return { group: g, wheels }
}

/** "Redo att åka?" in a speech bubble over Kalle. */
function bubbleSprite() {
  const [c, ctx] = makeCanvas(512, 220)
  ctx.fillStyle = '#fffdf6'
  ctx.strokeStyle = '#1b1b1d'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.roundRect(10, 10, 492, 150, 60)
  ctx.moveTo(230, 156)
  ctx.lineTo(256, 210)
  ctx.lineTo(290, 156)
  ctx.fill()
  ctx.stroke()
  // cover the outline where the tail meets the bubble
  ctx.fillRect(234, 148, 52, 14)
  ctx.fillStyle = '#1b1b1d'
  ctx.font = `700 64px ${FONT.sans}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Redo att åka? 🚐', 256, 88)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(c), transparent: true, depthWrite: false }))
  sp.scale.set(2.2, 0.95, 1)
  sp.renderOrder = 5
  return sp
}

export class Camper {
  readonly car: THREE.Group
  readonly trailer: THREE.Group
  readonly musse = new Musse()
  readonly kalle = new Kalle()
  /** You, behind the wheel (only while you drive). */
  readonly driver = new Nisse({ coat: 0x31507a, hat: 0xb3202a, beard: false, ears: true, scale: 1.05 })
  readonly bubble = bubbleSprite()
  private awnings: THREE.Group[] = []
  private carWheels: THREE.Group[]
  private trailerWheels: THREE.Group[]
  private bubbleOn = 0
  /** Village spots for Musse and Kalle (trailer space): on the square side, waving you over. */
  private static readonly SPOTS = { musse: new THREE.Vector3(2.0, 0, 1.6), kalle: new THREE.Vector3(2.1, 0, 0.1) }

  constructor(private scene: THREE.Scene) {
    const t = buildTrailer(this.awnings)
    this.trailer = t.group
    this.trailerWheels = t.wheels
    const c = buildCar()
    this.car = c.group
    this.carWheels = c.wheels
    this.seatDriver(false)
    this.park()
  }

  /** Back in the village, parked in a straight line, with Musse and Kalle outside waving. */
  park() {
    // side on to the square: +x (the side without the door) faces the julgran
    const yaw = Math.atan2(CAMP.z, -CAMP.x)
    this.scene.add(this.trailer, this.car, this.musse.group, this.kalle.group, this.bubble)
    this.trailer.position.set(CAMP.x, 0, CAMP.z)
    this.trailer.rotation.set(0, yaw, 0, 'YXZ')
    this.trailer.updateMatrixWorld(true)
    this.car.position.copy(this.trailer.localToWorld(new THREE.Vector3(0, 0, -CAR_AHEAD)))
    this.car.rotation.set(0, yaw, 0, 'YXZ')
    this.car.updateMatrixWorld(true)
    this.seatDriver(false)
    this.trailer.scale.setScalar(1)
    this.foldAwnings(0)
    for (const [toon, spot] of [
      [this.musse, Camper.SPOTS.musse],
      [this.kalle, Camper.SPOTS.kalle],
    ] as const) {
      toon.group.position.copy(this.trailer.localToWorld(spot.clone()))
      toon.group.scale.setScalar(toon instanceof Musse ? 1.25 : 1.3)
      const p = toon.group.position
      toon.setYaw(Math.atan2(-p.x, -p.z) + (toon instanceof Musse ? 0.3 : -0.2))
      toon.group.visible = toon.out = true
    }
    this.bubble.visible = false
    this.bubbleOn = 0
  }

  /** You, back behind the wheel (hands on it), shown or not. */
  seatDriver(visible: boolean) {
    const d = this.driver
    this.car.add(d.group)
    d.sit(true)
    d.group.position.set(-0.3, 0.72, 0.75)
    d.group.rotation.set(0, Math.PI, 0)
    d.armL.rotation.set(-1.0, 0, -0.2)
    d.armR.rotation.set(-1.0, 0, 0.2)
    d.group.visible = visible
  }

  /** Where Musse and Kalle stand (for walking up and talking). */
  crewWorld() {
    return this.trailer.localToWorld(new THREE.Vector3(2.1, 1.2, 0.8))
  }

  /** Round the back of the camper and in through the door, from where toon `i` (0 Musse, 1 Kalle) stands. */
  walkPath(i: number) {
    const from = i ? Camper.SPOTS.kalle : Camper.SPOTS.musse
    return [from, new THREE.Vector3(1.7, 0, 3.2), new THREE.Vector3(-1.7, 0, 3.2), new THREE.Vector3(-1.5, 0, 0.95)].map((p) => this.trailer.localToWorld(p.clone()))
  }

  /** In front of the door, a step out from it (trailer space → world), for the walk-in. */
  doorStep(k = 0) {
    return this.trailer.localToWorld(new THREE.Vector3(-1.2 - (1 - k) * 0.5, 0.45, 0.95))
  }

  /** 0 = awnings out (sloping down and away), 1 = folded down flat over the windows for the road. */
  foldAwnings(k: number) {
    for (const a of this.awnings) a.rotation.z = -a.userData.side * THREE.MathUtils.lerp(0.5, Math.PI / 2 - 0.06, k)
  }

  /** Roll the wheels along by `dist` metres (car and trailer separately). */
  roll(carDist: number, trailerDist: number) {
    for (const w of this.carWheels) w.rotation.x -= carDist / WHEEL_R
    for (const w of this.trailerWheels) w.rotation.x -= trailerDist / WHEEL_R
  }

  colliders(): Circle[] {
    const out: Circle[] = []
    const at = (g: THREE.Object3D, x: number, z: number, r: number) => {
      const p = g.localToWorld(new THREE.Vector3(x, 0, z))
      out.push({ x: p.x, z: p.z, r })
    }
    at(this.trailer, 0, -1.2, 1.15)
    at(this.trailer, 0, 1.2, 1.15)
    at(this.car, 0, -0.9, 0.85)
    at(this.car, 0, 0.7, 0.85)
    at(this.musse.group, 0, 0, 0.3)
    at(this.kalle.group, 0, 0, 0.3)
    return out
  }

  /** Musse and Kalle wave at you; the bubble pops up when you come close. */
  update(t: number, dt: number, player: THREE.Vector3) {
    for (const toon of [this.musse, this.kalle]) if (toon.out && toon.group.parent === this.scene) toon.update(t, dt, player)
    const p = this.crewWorld()
    const near = this.kalle.out && Math.hypot(player.x - p.x, player.z - p.z) < 6
    this.bubbleOn = THREE.MathUtils.clamp(this.bubbleOn + (near ? dt : -dt) * 4, 0, 1)
    this.bubble.visible = this.bubbleOn > 0
    if (this.bubble.visible) {
      const k = THREE.MathUtils.smootherstep(this.bubbleOn, 0, 1)
      this.bubble.position.copy(this.kalle.group.position).setY(2.25 + Math.sin(t * 2.5) * 0.04)
      this.bubble.scale.set(2.2 * k, 0.95 * k, 1)
      ;(this.bubble.material as THREE.SpriteMaterial).opacity = k
    }
  }
}
