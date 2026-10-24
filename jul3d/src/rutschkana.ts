// Down Leksaksfabriken's spiral chute, the way the presents go: from the top up on the right-hand
// gallery, faster and faster round and round, and out into the basket of presents at the bottom.
import * as THREE from 'three'
import { noise, puff, thud } from './sfx'
import type { Player } from './player'

/** Where the chute is: set by the factory as it builds it (room-local points, and the room). */
export const chute = {
  curve: null as THREE.CatmullRomCurve3 | null,
  room: null as THREE.Object3D | null,
  /** The basket at the bottom, room-local. */
  basket: new THREE.Vector3(),
}

/** How far down from the tube's middle you sit, and your eye above that. */
const SEAT = 0.12
const EYE = 0.8

export class Slide {
  active = false
  private s = 0
  private v = 0
  private length = 0
  private points: THREE.Vector3[] = []
  private tangents: THREE.Vector3[] = []
  private roll = 0
  onDone: () => void = () => {}

  constructor(
    private player: Player,
    private camera: THREE.PerspectiveCamera,
  ) {}

  /** The top of the chute, in the world (null until the factory is built). */
  top() {
    if (!chute.curve || !chute.room) return null
    return chute.room.localToWorld(chute.curve.getPointAt(0))
  }

  /** Standing up on the gallery at the top of it, facing it? */
  near(pos: THREE.Vector3, floor: number, fwd: THREE.Vector3) {
    const t = this.top()
    if (!t || floor < 4) return false
    const dx = t.x - pos.x
    const dz = t.z - pos.z
    const d = Math.hypot(dx, dz)
    return d < 2.2 && (d < 0.4 || (dx * fwd.x + dz * fwd.z) / d > 0.3)
  }

  start() {
    if (!chute.curve || !chute.room) return
    // the chute in the world, sampled finely: position and direction along it
    chute.room.updateMatrixWorld(true)
    const n = 400
    this.points = chute.curve.getSpacedPoints(n).map((p) => chute.room!.localToWorld(p.clone()))
    this.tangents = this.points.map((p, i) => this.points[Math.min(n, i + 1)].clone().sub(this.points[Math.max(0, i - 1)]).normalize())
    this.length = chute.curve.getLength()
    this.s = 0
    this.v = 1.5
    this.roll = 0
    this.active = true
    // the long rush of sliding down
    noise(5.5, 260, 1400, 0.09, 0.7)
  }

  private at(s: number, out: THREE.Vector3, dir: THREE.Vector3) {
    const k = THREE.MathUtils.clamp(s / this.length, 0, 1) * (this.points.length - 1)
    const i = Math.min(this.points.length - 2, Math.floor(k))
    const f = k - i
    out.lerpVectors(this.points[i], this.points[i + 1], f)
    dir.lerpVectors(this.tangents[i], this.tangents[i + 1], f).normalize()
  }

  private pos = new THREE.Vector3()
  private dir = new THREE.Vector3()
  private ahead = new THREE.Vector3()
  private aheadDir = new THREE.Vector3()

  update(dt: number) {
    if (!this.active) return
    // speeding up all the way down
    this.v = Math.min(6.2, this.v + dt * 2.2)
    this.s += this.v * dt
    const p = this.player
    if (this.s >= this.length) return this.finish()
    this.at(this.s, this.pos, this.dir)
    this.at(this.s + 1.2, this.ahead, this.aheadDir)
    // you, sitting in the chute: the others see you there too
    p.pos.set(this.pos.x, 0, this.pos.z)
    p.floor = this.pos.y - SEAT
    p.height = 0
    p.vel.copy(this.dir).setY(0).multiplyScalar(this.v)
    // looking a little ahead and down the chute, leaning into the turn
    p.yaw = Math.atan2(-this.dir.x, -this.dir.z)
    const turn = Math.atan2(this.dir.x * this.aheadDir.z - this.dir.z * this.aheadDir.x, this.dir.x * this.aheadDir.x + this.dir.z * this.aheadDir.z)
    this.roll += (THREE.MathUtils.clamp(turn * 0.5, -0.14, 0.14) - this.roll) * Math.min(1, dt * 5)
    const c = this.camera
    c.position.set(this.pos.x, this.pos.y - SEAT + EYE, this.pos.z)
    c.rotation.set(-0.28 + this.dir.y * 0.5, p.yaw, this.roll, 'YXZ')
  }

  private finish() {
    const p = this.player
    this.active = false
    // out over the lip and into the presents (a soft landing)
    // (tumbling out beside the basket, clear of the chute)
    const b = chute.room!.localToWorld(chute.basket.clone().add(new THREE.Vector3(0, 0, 1.75)))
    const out = this.tangents[this.tangents.length - 1]
    p.pos.set(b.x, 0, b.z)
    p.floor = 0
    p.height = 0
    p.vel.copy(out).setY(0).multiplyScalar(2)
    p.pitch = -0.1
    thud()
    puff(0.5)
    this.onDone()
  }
}
