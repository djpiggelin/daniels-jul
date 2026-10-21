// A fighting bull built from primitives, and Ferdinand (bigger, softer, with a flower). Bull space: feet on the
// ground at the origin, facing +z. The poses are plain functions of a phase so corrida.ts can drive them.
import * as THREE from 'three'
import { rod, std } from './sleigh'

export type BullLook = {
  coat: number
  belly?: number
  scale?: number
  /** Ferdinand: a softer face, long lashes, a flower in his mouth. */
  ferdinand?: boolean
}

function ball(r: number, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  return m
}

/** A horn sweeping out and forward from the side of the head. */
function horn(side: number, mat: THREE.Material, size: number) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(side * 0.12, 0.1, 0),
    new THREE.Vector3(side * 0.42 * size, 0.12, -0.02),
    new THREE.Vector3(side * 0.4 * size, 0.38 * size, 0.22 * size),
  )
  const geo = new THREE.TubeGeometry(curve, 8, 0.045, 6)
  // taper the tube towards the tip
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / 7) / 8
    v.fromBufferAttribute(pos, i)
    const c = curve.getPoint(t)
    v.sub(c).multiplyScalar(1 - t * 0.8).add(c)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, mat)
}

export class Bull {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly neck = new THREE.Group()
  readonly head = new THREE.Group()
  readonly tail = new THREE.Group()
  readonly legs: { hip: THREE.Group; knee: THREE.Group; front: boolean; side: number }[] = []
  readonly flower: THREE.Group | null = null
  private eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, emissive: 0xff2010, emissiveIntensity: 0 })
  private tongue: THREE.Mesh
  readonly scale: number

  constructor(readonly look: BullLook) {
    const coat = std(look.coat, 0.75)
    const belly = std(look.belly ?? look.coat, 0.8)
    const hornMat = std(look.ferdinand ? 0xf0e6cc : 0xe8dcc0, 0.5)
    const hoof = std(0x1a1410, 0.5)
    const nose = std(look.ferdinand ? 0xc98a8a : 0x2a2224, 0.5)
    this.scale = look.scale ?? 1

    // body: a long barrel, a big hump over the shoulders, a lighter belly
    const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 6, 14), coat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 1.05, -0.05)
    barrel.scale.set(1, 1, 1.05)
    const hump = ball(0.5, coat, 0, 1.2, 0.45, 1.0, 1.0, 1.0)
    const under = ball(0.38, belly, 0, 0.86, 0.05, 1.0, 0.6, 1.6)
    this.body.add(barrel, hump, under)

    // neck + head, hinged where the neck meets the hump so the head can drop for the charge
    this.neck.position.set(0, 1.25, 0.8)
    this.neck.add(ball(0.33, coat, 0, -0.05, 0.12, 1, 1, 1.1))
    this.head.position.set(0, -0.12, 0.42)
    const skull = ball(0.26, coat, 0, 0, 0, 1, 0.95, 1.15)
    const muzzle = ball(0.2, nose, 0, -0.17, 0.25, 1.05, 0.8, 0.9)
    this.head.add(skull, muzzle)
    for (const s of [-1, 1]) {
      this.head.add(ball(0.035, std(0x0a0a0a, 0.3), s * 0.07, -0.18, 0.43))
      // eyes, set wide; the iris glows red when he's angry
      const white = ball(0.055, std(0xf7f4ee, 0.4), s * 0.18, 0.06, 0.15)
      const pupil = ball(0.032, this.eyeMat, s * 0.205, 0.06, 0.19)
      this.head.add(white, pupil)
      // ears
      const ear = ball(0.09, coat, s * 0.28, 0.08, -0.05, 1.3, 0.5, 0.7)
      ear.rotation.z = s * 0.3
      this.head.add(ear)
      this.head.add(horn(s, hornMat, look.ferdinand ? 0.65 : 1))
      if (look.ferdinand) {
        // long, sleepy lashes
        for (let i = 0; i < 3; i++) this.head.add(rod(new THREE.Vector3(s * (0.16 + i * 0.025), 0.1, 0.19), new THREE.Vector3(s * (0.2 + i * 0.04), 0.16, 0.2), 0.006, std(0x1a1410)))
      }
    }
    // tongue, out when he's tired
    this.tongue = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.16), std(0xd8667a, 0.5))
    this.tongue.position.set(0.04, -0.3, 0.38)
    this.tongue.rotation.x = 0.6
    this.tongue.visible = false
    this.head.add(this.tongue)
    if (look.ferdinand) {
      // a daisy between his teeth
      const f = new THREE.Group()
      f.add(rod(new THREE.Vector3(-0.15, 0, 0), new THREE.Vector3(0.12, 0.08, 0.05), 0.008, std(0x3d8b3d)))
      const bloom = new THREE.Group()
      bloom.position.set(0.14, 0.09, 0.06)
      for (let i = 0; i < 8; i++) {
        const p = ball(0.035, std(0xffffff, 0.6), Math.cos((i / 8) * Math.PI * 2) * 0.045, Math.sin((i / 8) * Math.PI * 2) * 0.045, 0, 1.3, 0.6, 0.3)
        p.rotation.z = (i / 8) * Math.PI * 2
        bloom.add(p)
      }
      bloom.add(ball(0.025, std(0xf2c230, 0.5), 0, 0, 0.01))
      f.add(bloom)
      f.position.set(0, -0.3, 0.38)
      this.head.add(f)
      this.flower = f
      // and a softer, rounder look
      this.body.add(ball(0.2, std(0xf2e0c8, 0.8), 0, 0.8, 0.6, 1.2, 0.8, 1.2))
    }
    this.neck.add(this.head)
    this.body.add(this.neck)

    // legs: hip, knee, hoof
    for (const [z, front] of [
      [0.6, true],
      [-0.65, false],
    ] as const)
      for (const side of [-1, 1]) {
        const hip = new THREE.Group()
        hip.position.set(side * 0.24, 0.95, z)
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.5, 10), coat)
        upper.position.y = -0.22
        const knee = new THREE.Group()
        knee.position.y = -0.45
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.42, 8), coat)
        lower.position.y = -0.2
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 8), hoof)
        h.position.y = -0.45
        knee.add(lower, h)
        hip.add(upper, knee)
        this.body.add(hip)
        this.legs.push({ hip, knee, front, side })
      }

    // tail with a tuft
    this.tail.position.set(0, 1.3, -0.95)
    this.tail.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.75, -0.08), 0.025, coat))
    this.tail.add(ball(0.07, std(0x15110d, 0.9), 0, -0.8, -0.08, 0.8, 1.6, 0.8))
    this.body.add(this.tail)

    this.group.add(this.body)
    this.group.scale.setScalar(this.scale)
    this.group.rotation.order = 'YXZ'
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }

  /** 0 calm … 1 seeing red. */
  setAngry(k: number) {
    this.eyeMat.emissiveIntensity = k * 2.5
  }

  setTired(on: boolean) {
    this.tongue.visible = on
  }

  /** Back to standing square on all four. */
  stand() {
    this.body.scale.set(1, 1, 1)
    this.body.position.set(0, 0, 0)
    this.body.rotation.set(0, 0, 0)
    this.neck.rotation.set(0, 0, 0)
    this.head.rotation.set(0, 0, 0)
    for (const l of this.legs) {
      l.hip.rotation.set(0, 0, 0)
      l.knee.rotation.set(0, 0, 0)
    }
  }

  /** Running: `amt` 0 = standing … 1 = flat-out gallop. `headDown` lowers the horns for the charge. */
  gallop(phase: number, amt: number, headDown: number) {
    this.stand()
    for (const l of this.legs) {
      // a rotary gallop: the front pair and the hind pair each a little out of step
      const p = phase + (l.front ? 0 : Math.PI * 0.9) + (l.side > 0 ? 0.5 : 0)
      l.hip.rotation.x = Math.sin(p) * 0.75 * amt
      l.knee.rotation.x = (l.front ? -1 : 1) * Math.max(0, Math.cos(p)) * 0.9 * amt
    }
    this.body.position.y = Math.abs(Math.sin(phase)) * 0.12 * amt
    this.body.rotation.x = Math.sin(phase) * 0.06 * amt
    this.neck.rotation.x = headDown * 0.55 + Math.sin(phase + 1) * 0.05 * amt
    this.head.rotation.x = headDown * 0.25
    this.tail.rotation.x = -0.4 * amt + Math.sin(phase * 2) * 0.2
  }

  /** Scraping the ground with a front hoof, head low, ready to go. */
  paw(t: number) {
    this.stand()
    const fl = this.legs.find((l) => l.front && l.side > 0)!
    const k = Math.sin(t * 9)
    fl.hip.rotation.x = 0.3 + k * 0.45
    fl.knee.rotation.x = -0.6 - Math.max(0, k) * 0.5
    this.neck.rotation.x = 0.5
    this.head.rotation.x = 0.2 + Math.sin(t * 3) * 0.05
    this.tail.rotation.set(-0.3, 0, Math.sin(t * 6) * 0.4)
    this.body.rotation.z = Math.sin(t * 9) * 0.02
  }

  /** Sitting on his haunches (`k` 0 … 1), front legs straight, like Ferdinand under his tree. */
  sit(k: number) {
    this.stand()
    this.body.position.y = -0.38 * k
    this.body.rotation.x = -0.32 * k
    for (const l of this.legs) {
      if (l.front) l.hip.rotation.x = 0.32 * k
      else {
        l.hip.rotation.x = -1.3 * k
        l.knee.rotation.x = 2.2 * k
      }
    }
    this.neck.rotation.x = 0.1 * k
    this.tail.rotation.x = 0.8 * k
  }

  /** Worn out: head hanging, sides heaving. */
  tired(t: number) {
    this.stand()
    this.neck.rotation.x = 0.75
    this.head.rotation.x = 0.3
    this.body.scale.set(1 + Math.sin(t * 7) * 0.03, 1 + Math.sin(t * 7) * 0.03, 1)
    this.tail.rotation.x = 0.2
  }
}
