// Musse Pigg and Kalle Anka, built from primitives like the nissar: they stand by the camper, turn to
// look at you and wave. Everything is in toon space: feet on the ground at the origin, facing +z.
import * as THREE from 'three'
import { rod, std } from './sleigh'

const black = std(0x16161a, 0.55)
const white = std(0xfbfaf6, 0.7)
const glove = std(0xffffff, 0.6)
const pupil = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.2 })

function ball(r: number, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  return m
}

/** Big oval cartoon eyes with a pupil looking straight ahead. */
function eyes(head: THREE.Group, y: number, z: number, gap: number, r: number) {
  for (const s of [-1, 1]) {
    head.add(ball(r, white, s * gap, y, z, 0.75, 1.15, 0.5))
    head.add(ball(r * 0.42, pupil, s * gap * 0.9, y - r * 0.15, z + r * 0.4, 0.8, 1.3, 0.5))
  }
}

export abstract class Toon {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly head = new THREE.Group()
  readonly armR = new THREE.Group()
  readonly armL = new THREE.Group()
  protected legs: THREE.Group[] = []
  private baseYaw = 0
  private wave = 0
  private nearFor = 0
  private phase = Math.random() * 10
  /** False while they're inside the camper. */
  out = true

  protected finish(scale: number) {
    this.body.add(this.head)
    this.group.add(this.body)
    this.group.scale.setScalar(scale)
    this.group.rotation.order = 'YXZ'
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }

  setYaw(yaw: number) {
    this.baseYaw = yaw
    this.group.rotation.y = yaw
  }

  /** Swing legs and arms. `amt` 0 = standing, 1 = trotting. */
  walkPose(phase: number, amt: number) {
    const s = Math.sin(phase) * amt
    this.legs[0].rotation.x = s * 0.7
    this.legs[1].rotation.x = -s * 0.7
    this.armL.rotation.x = -s * 0.6
    this.body.position.y = Math.abs(Math.cos(phase)) * 0.04 * amt
  }

  /** Breathe, look at you and wave for a moment when you come close (like a nisse). */
  update(t: number, dt: number, player: THREE.Vector3) {
    const p = this.group.getWorldPosition(new THREE.Vector3())
    const dx = player.x - p.x
    const dz = player.z - p.z
    const near = Math.hypot(dx, dz) < 7
    let want = near ? Math.atan2(dx, dz) : this.baseYaw
    let diff = Math.atan2(Math.sin(want - this.group.rotation.y), Math.cos(want - this.group.rotation.y))
    this.group.rotation.y += diff * Math.min(1, dt * 2.5)
    want = near ? Math.atan2(dx, dz) - this.group.rotation.y : 0
    diff = Math.atan2(Math.sin(want), Math.cos(want))
    this.head.rotation.y += (THREE.MathUtils.clamp(diff, -0.8, 0.8) - this.head.rotation.y) * Math.min(1, dt * 6)
    this.body.scale.set(1, 1 + Math.sin(t * 2.2 + this.phase) * 0.02, 1)
    // these two are a bit more eager than the nissar: they keep waving while you're close
    this.nearFor = near ? this.nearFor + dt : 0
    const waving = near || Math.sin(t * 0.5 + this.phase) > 0.93
    this.wave += ((waving ? 1 : 0) - this.wave) * Math.min(1, dt * 3)
    this.armR.rotation.set(0, 0, 0.25 + this.wave * (2.3 + Math.sin(t * 9 + this.phase) * 0.4))
  }
}

export class Musse extends Toon {
  constructor() {
    super()
    const red = std(0xd8202c, 0.6)
    const yellow = std(0xf2c230, 0.5)
    const skin = std(0xf3c9a0, 0.65)
    // legs + big yellow shoes
    for (const x of [-0.08, 0.08]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.4, 0)
      hip.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.33, 0), 0.032, black))
      hip.add(ball(0.09, yellow, 0, -0.34, 0.07, 1, 0.62, 1.55))
      this.legs.push(hip)
      this.body.add(hip)
    }
    // red shorts with two white buttons, black body
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.2, 16), red)
    shorts.position.y = 0.45
    this.body.add(shorts)
    for (const x of [-0.06, 0.06]) this.body.add(ball(0.03, white, x, 0.48, 0.165, 1, 1.3, 0.5))
    this.body.add(ball(0.15, black, 0, 0.62, 0, 1, 1.15, 0.95))
    // tail
    this.body.add(rod(new THREE.Vector3(0, 0.42, -0.15), new THREE.Vector3(0, 0.2, -0.38), 0.012, black))
    // arms: thin black, big white gloves
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.14, 0.72, 0)
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.3, 0), 0.026, black))
      g.add(ball(0.06, glove, 0, -0.33, 0, 1.1, 1, 0.9))
      g.rotation.z = side * 0.25
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    // head: black ball, peach face, long snout with a black nose, two big round ears
    this.head.position.y = 0.98
    this.head.add(ball(0.19, black, 0, 0, 0))
    this.head.add(ball(0.16, skin, 0, -0.04, 0.07, 1.05, 0.85, 0.9))
    this.head.add(ball(0.085, skin, 0, -0.07, 0.19, 1.1, 0.8, 1.3))
    this.head.add(ball(0.04, black, 0, -0.04, 0.3, 1.2, 0.9, 1))
    this.head.add(ball(0.035, red, 0, -0.13, 0.2, 1.4, 0.6, 0.6))
    eyes(this.head, 0.04, 0.15, 0.05, 0.045)
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.025, 24), black)
      ear.rotation.x = Math.PI / 2
      ear.position.set(s * 0.19, 0.19, -0.03)
      this.head.add(ear)
    }
    this.finish(1.25)
  }
}

export class Kalle extends Toon {
  constructor() {
    super()
    const orange = std(0xf29a1d, 0.55)
    const blue = std(0x2f6fc6, 0.7)
    const bow = std(0xd8202c, 0.5)
    // short orange legs + flat webbed feet
    for (const x of [-0.08, 0.08]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.18, 0)
      hip.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.15, 0), 0.03, orange))
      hip.add(ball(0.08, orange, 0, -0.16, 0.06, 1.1, 0.3, 1.7))
      this.legs.push(hip)
      this.body.add(hip)
    }
    // plump white body and tail feathers, a blue sailor shirt on top
    this.body.add(ball(0.2, white, 0, 0.34, 0, 1, 1.05, 1))
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), white)
    tail.position.set(0, 0.36, -0.22)
    tail.rotation.x = -1.0
    this.body.add(tail)
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.205, 0.26, 16), blue)
    shirt.position.y = 0.48
    this.body.add(shirt)
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.16), blue)
    collar.position.set(0, 0.6, -0.08)
    collar.rotation.x = 0.3
    this.body.add(collar)
    for (const s of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 8), bow)
      lobe.rotation.z = s * Math.PI / 2
      lobe.position.set(s * 0.035, 0.6, 0.14)
      this.body.add(lobe)
    }
    // arms: blue sleeves, white feathery hands
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.16, 0.56, 0)
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.2, 0), 0.04, blue))
      g.add(ball(0.05, white, 0, -0.24, 0, 1, 1.2, 0.9))
      g.rotation.z = side * 0.3
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    // head: white, a long orange beak, and the little sailor cap with its ribbon
    this.head.position.y = 0.78
    this.head.add(ball(0.17, white, 0, 0, 0))
    this.head.add(ball(0.1, orange, 0, -0.05, 0.16, 1.05, 0.32, 1.35))
    this.head.add(ball(0.08, orange, 0, -0.09, 0.13, 0.95, 0.25, 1.2))
    eyes(this.head, 0.06, 0.12, 0.055, 0.045)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 18), blue)
    cap.position.set(0.02, 0.17, -0.02)
    cap.rotation.z = -0.25
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 6, 20), black)
    band.rotation.x = Math.PI / 2
    band.position.y = -0.025
    cap.add(band)
    this.head.add(cap)
    this.finish(1.3)
  }
}
