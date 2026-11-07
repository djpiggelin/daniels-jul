// Zoom out of your own head: the camera backs off behind and a little above you, and you see your own
// nisse – the same one the others in the village see (multiplayer.ts), in the colour your name gives you.
// Mouse wheel on a computer, a pinch on a phone, or the 👤 button. All the way in is the usual first-person view.
// The minigames move the camera themselves: while one of them (or a popup) is on, it's first person, as before.
import * as THREE from 'three'
import { Nisse } from './npc'
import { mergeRigid } from './batch'
import type { Player } from './player'

const KEY = 'jul3d:kamera'
/** Closer than this is first person; the wheel / a pinch jumps across the gap. */
export const NEAR = 1.6
export const FAR = 7
const SCALE = 1.3
const LOOK = new THREE.Vector3(1e6, 0, 1e6)

export class ThirdPerson {
  /** Where you'd like the camera (0 = in your head), and where it is right now (eased). */
  want = 0
  dist = 0
  private nisse: Nisse | null = null
  private color = -1
  private phase = 0
  private saved = { pos: new THREE.Vector3(), applied: false }
  private v = new THREE.Vector3()
  private dir = new THREE.Vector3()
  /** Something shown in the corner when the view changes. */
  onChange: (want: number) => void = () => {}

  constructor(
    private scene: THREE.Scene,
    private player: Player,
    private camera: THREE.PerspectiveCamera,
    /** How far (0–1) along from → to the camera can go before it'd end up in a wall. */
    private clear: (from: THREE.Vector3, to: THREE.Vector3) => number,
    /** How high the ground is at (x, z), so the camera stays above it. */
    private ground: (x: number, z: number) => number,
  ) {
    try {
      const d = Number(localStorage.getItem(KEY))
      if (d >= NEAR && d <= FAR) this.want = d
    } catch {
      /* fine */
    }
  }

  /** Your nisse, in your colour (a new name, a new coat). */
  look(color: number) {
    if (color === this.color) return
    this.color = color
    if (this.nisse) {
      this.scene.remove(this.nisse.group)
      this.nisse.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    }
    const n = new Nisse({ coat: color, hat: color, pants: 0x2b2b33, trim: true, scale: SCALE })
    mergeRigid(n.group)
    n.group.visible = false
    // (never in the way of your own snowballs or the things you aim at: it isn't in any of those lists)
    this.scene.add(n.group)
    this.nisse = n
  }

  get on() {
    return this.want > 0
  }

  /** Steps out (+) or in (−): one wheel notch, a bit of a pinch. */
  zoom(by: number) {
    let w = this.want
    if (w === 0) {
      if (by <= 0) return
      w = NEAR + 0.6
    } else w += by
    if (w < NEAR) w = 0
    this.set(Math.min(FAR, w))
  }

  /** The button: first person → a bit back → further back → first person. */
  cycle() {
    this.set(this.want === 0 ? 3.2 : this.want < 5 ? 5.6 : 0)
  }

  private set(w: number) {
    if (w === this.want) return
    this.want = w
    try {
      localStorage.setItem(KEY, String(w))
    } catch {
      /* fine */
    }
    this.onChange(w)
  }

  /** Ease the camera towards where you want it – straight back into your head when `allowed` is false. */
  update(t: number, dt: number, allowed: boolean) {
    const goal = allowed ? this.want : 0
    // (a game starting snaps straight back: it wants the camera where it puts it)
    this.dist = allowed ? this.dist + (goal - this.dist) * (1 - Math.exp(-8 * dt)) : 0
    if (Math.abs(this.dist - goal) < 0.01) this.dist = goal
    const n = this.nisse
    if (!n) return
    n.group.visible = this.dist > 0.9
    if (!n.group.visible) return
    const p = this.player
    n.group.position.set(p.pos.x, p.floor + p.height, p.pos.z)
    // the camera looks down -z at yaw 0, a nisse's face points down +z: turn it round
    n.setYaw(p.yaw + Math.PI)
    n.update(t, dt, LOOK, false)
    const speed = Math.min(1, p.vel.length() / 6.8)
    this.phase += dt * (4 + speed * 8) * Math.min(1, speed * 3)
    if (speed > 0.02) n.walkPose(this.phase, Math.min(1, speed * 1.4))
  }

  /** Just before drawing: back the camera off (and back into your head with `restore`, so aiming, throwing and getting hit still work from there). */
  apply() {
    if (this.dist <= 0.05) return false
    const c = this.camera
    this.saved.pos.copy(c.position)
    this.saved.applied = true
    c.updateMatrixWorld()
    const k = Math.min(1, this.dist / 3)
    // back along where you look, up a little and over your right shoulder, so you don't hide what you aim at
    this.dir.set(0, 0, 1).applyQuaternion(c.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion)
    this.v.copy(c.position).addScaledVector(this.dir, this.dist).addScaledVector(right, 0.45 * k)
    this.v.y += 0.35 * k
    const free = this.clear(c.position, this.v)
    c.position.lerp(this.v, Math.max(0, free))
    c.position.y = Math.max(c.position.y, this.ground(c.position.x, c.position.z) + 0.25)
    c.updateMatrixWorld()
    return true
  }

  restore() {
    if (!this.saved.applied) return
    this.saved.applied = false
    this.camera.position.copy(this.saved.pos)
    this.camera.updateMatrixWorld()
  }
}
