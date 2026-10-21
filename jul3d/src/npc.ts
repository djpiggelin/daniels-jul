// Shopkeepers: a nisse built from primitives that breathes, turns to look at you and waves.
import * as THREE from 'three'

export type NisseLook = {
  coat: number
  hat: number
  pants?: number
  apron?: number
  trim?: boolean
  scale?: number
  longBeard?: boolean
  /** Young elves: no beard, pointy ears. */
  beard?: boolean
  ears?: boolean
}

const std = (color: number, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness })

export class Nisse {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly head = new THREE.Group()
  readonly armR = new THREE.Group()
  readonly armL = new THREE.Group()
  private legs: THREE.Group[] = []
  private baseYaw = 0
  private hitT = 9
  private wave = 0
  private phase = Math.random() * 10
  private nearFor = 0

  constructor(look: NisseLook) {
    const skin = std(0xf1c7a5, 0.6)
    const coat = std(look.coat)
    const white = std(0xf7f4ee, 0.9)
    const dark = std(look.pants ?? 0x2b2b33)
    const boot = std(0x1c1410, 0.5)

    // legs + boots, hinged at the hip so they can walk
    for (const x of [-0.1, 0.1]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.42, 0)
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.36, 10), dark)
      leg.position.y = -0.18
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.24), boot)
      b.position.set(0, -0.37, 0.03)
      hip.add(leg, b)
      this.legs.push(hip)
      this.body.add(hip)
    }
    // coat
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.31, 0.62, 16), coat)
    torso.position.y = 0.68
    this.body.add(torso)
    if (look.trim) {
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 24), white)
      hem.rotation.x = Math.PI / 2
      hem.position.y = 0.39
      this.body.add(hem)
    }
    if (look.apron) {
      const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.322, 0.5, 16, 1, true, -0.9, 1.8), std(look.apron, 0.9))
      apron.position.y = 0.62
      this.body.add(apron)
    }
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.27, 0.07, 16), std(0x1c1410, 0.4))
    belt.position.y = 0.6
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.03), new THREE.MeshStandardMaterial({ color: 0xf6c453, metalness: 0.8, roughness: 0.3 }))
    buckle.position.set(0, 0.6, 0.27)
    this.body.add(belt, buckle)

    // arms
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.24, 0.92, 0)
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.42, 10), coat)
      sleeve.position.y = -0.2
      const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), look.trim ? std(0x1c1410, 0.5) : std(0xb3202a))
      mitt.position.y = -0.43
      g.add(sleeve, mitt)
      g.rotation.z = side * 0.18
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))

    // head
    this.head.position.y = 1.12
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), skin)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std(0xe08a7a, 0.5))
    nose.position.set(0, -0.01, 0.19)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 })
    for (const x of [-0.065, 0.065]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat)
      eye.position.set(x, 0.045, 0.165)
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), std(0xf2a2a0, 0.7))
      cheek.position.set(x * 1.6, -0.02, 0.14)
      cheek.scale.z = 0.4
      this.head.add(eye, cheek)
    }
    this.head.add(face, nose)
    if (look.beard !== false) {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), white)
      beard.scale.set(1, look.longBeard ? 1.6 : 1.15, 0.75)
      beard.position.set(0, look.longBeard ? -0.2 : -0.11, 0.07)
      const mustache = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), white)
      mustache.scale.set(1.8, 0.6, 0.8)
      mustache.position.set(0, -0.06, 0.17)
      this.head.add(beard, mustache)
    } else {
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), std(0x8e1b1b, 0.5))
      smile.position.set(0, -0.07, 0.175)
      smile.rotation.z = Math.PI
      this.head.add(smile)
    }
    if (look.ears) {
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 8), skin)
        ear.position.set(side * 0.2, 0.02, -0.01)
        ear.rotation.z = -side * 1.15
        this.head.add(ear)
      }
    }

    // floppy hat
    const hatMat = std(look.hat, 0.85)
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 10, 24), look.trim ? white : hatMat)
    brim.rotation.x = Math.PI / 2
    brim.position.y = 0.1
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 18), hatMat)
    cone.position.set(0, 0.32, -0.04)
    cone.rotation.x = -0.35
    const tip = new THREE.Group()
    tip.position.set(0, 0.55, -0.13)
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), white)
    tip.add(pom)
    this.head.add(brim, cone, tip)

    this.body.add(this.head)
    this.group.add(this.body)
    this.group.scale.setScalar(look.scale ?? 1.18)
    this.group.rotation.order = 'YXZ'
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }

  /** Face direction when idle (world yaw). */
  setYaw(yaw: number) {
    this.baseYaw = yaw
    this.group.rotation.y = yaw
  }

  /** Swing legs and arms. `amt` 0 = standing, 1 = running. */
  walkPose(phase: number, amt: number) {
    const s = Math.sin(phase) * amt
    this.legs[0].rotation.x = s * 0.8
    this.legs[1].rotation.x = -s * 0.8
    this.armL.rotation.x = -s * 0.7
    this.armR.rotation.x = s * 0.7
    this.body.position.y = Math.abs(Math.cos(phase)) * 0.05 * amt
    this.body.rotation.x = 0.18 * amt
  }

  /** Sitting down (Tomten in his sleigh, or in the snow): legs straight out in front, `kick` scissors them. */
  sit(on: boolean, kick = 0) {
    this.legs.forEach((l, i) => (l.rotation.x = on ? -Math.PI / 2 + (i ? kick : -kick) : 0))
  }

  /** Hit by a snowball: a little hop and a shake of the head. */
  flinch() {
    this.hitT = 0
  }

  update(t: number, dt: number, player: THREE.Vector3, talking: boolean) {
    const p = this.group.getWorldPosition(new THREE.Vector3())
    const dx = player.x - p.x
    const dz = player.z - p.z
    const dist = Math.hypot(dx, dz)
    const near = dist < 6
    // body turns slowly, head follows faster
    let want = near ? Math.atan2(dx, dz) : this.baseYaw
    let diff = Math.atan2(Math.sin(want - this.group.rotation.y), Math.cos(want - this.group.rotation.y))
    this.group.rotation.y += diff * Math.min(1, dt * 2.5)
    want = near ? Math.atan2(dx, dz) - this.group.rotation.y : 0
    diff = Math.atan2(Math.sin(want), Math.cos(want))
    this.head.rotation.y += (THREE.MathUtils.clamp(diff, -0.8, 0.8) - this.head.rotation.y) * Math.min(1, dt * 6)
    // breathe + bob
    const s = 1 + Math.sin(t * 2 + this.phase) * 0.015
    this.body.scale.set(1, s, 1)
    this.body.position.y = talking ? Math.abs(Math.sin(t * 9)) * 0.03 : 0
    this.hitT += dt
    if (this.hitT < 0.6) {
      const k = 1 - this.hitT / 0.6
      this.body.position.y += Math.sin(this.hitT * Math.PI / 0.6) * 0.12
      this.head.rotation.z = Math.sin(this.hitT * 30) * 0.3 * k
    } else this.head.rotation.z = 0
    // wave hello for a moment when you come close
    this.nearFor = near ? this.nearFor + dt : 0
    const waving = near && !talking && this.nearFor < 2.5
    this.wave += ((waving ? 1 : 0) - this.wave) * Math.min(1, dt * 3)
    this.armR.rotation.z = 0.18 + this.wave * (2.4 + Math.sin(t * 8) * 0.35)
  }
}
