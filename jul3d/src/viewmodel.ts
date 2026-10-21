// The player's own arms, drawn in a second pass on top of the world so they never poke into walls.
// Everything here lives in camera space: x right, y up, -z forward.
import * as THREE from 'three'

const std = (color: number, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness })
const COAT = 0x31507a
const MITT = 0xb3202a

/** A mitten with a knitted sleeve trailing back towards the shoulder. */
function arm(sleeveDir: THREE.Vector3) {
  const g = new THREE.Group()
  const mitt = new THREE.Group()
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), std(MITT))
  palm.scale.set(1, 1.15, 0.8)
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), std(MITT))
  thumb.position.set(-0.045, 0.01, -0.02)
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), std(0xf7f4ee, 0.95))
  mitt.add(palm, thumb)
  const dir = sleeveDir.clone().normalize()
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.5, 12), std(COAT))
  sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  sleeve.position.copy(dir).multiplyScalar(0.3)
  cuff.quaternion.copy(sleeve.quaternion)
  cuff.position.copy(dir).multiplyScalar(0.06)
  g.add(mitt, cuff, sleeve)
  return { g, mitt }
}

export class Viewmodel {
  readonly scene = new THREE.Scene()
  private root = new THREE.Group()
  private throwArm = arm(new THREE.Vector3(0.35, -0.7, 0.6))
  readonly ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), std(0xffffff, 0.9))
  private hands = new THREE.Group()
  private left = arm(new THREE.Vector3(-0.3, -0.8, 0.5))
  private right = arm(new THREE.Vector3(0.3, -0.8, 0.5))
  private stick = new THREE.Group()
  private throwT = 9
  // the bullring: a muleta (red cloth on a stick) in the right hand, the left free – or up at your mouth
  private ring = new THREE.Group()
  private capeArm = arm(new THREE.Vector3(0.3, -0.8, 0.5))
  private freeArm = arm(new THREE.Vector3(-0.3, -0.8, 0.5))
  private cloth: THREE.Mesh
  private clothRest: Float32Array

  constructor() {
    this.scene.add(this.root)
    this.scene.add(new THREE.HemisphereLight(0xcfdcff, 0x3a2a20, 1.3))
    const key = new THREE.DirectionalLight(0xffd9a0, 1.6)
    key.position.set(1, 2, 1)
    this.scene.add(key)
    this.ball.position.set(0.005, 0.07, -0.015)
    this.throwArm.mitt.add(this.ball)
    this.throwArm.g.visible = false
    this.root.add(this.throwArm.g)

    // arcade: left hand on a little joystick, right hand over the buttons
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), std(0xe5383b, 0.4))
    knob.position.y = 0.09
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), std(0x222222, 0.4))
    shaft.position.y = 0.045
    this.stick.add(shaft, knob)
    this.stick.position.set(-0.24, -0.52, -0.58)
    this.hands.scale.setScalar(0.85)
    this.hands.add(this.stick, this.left.g, this.right.g)
    this.hands.visible = false
    this.root.add(this.hands)

    // the muleta: a stick held across, the cloth hanging from it (mitt space: the stick runs out along +x)
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.62, 6), std(0x6b4226, 0.6))
    stick.rotation.z = Math.PI / 2
    stick.position.x = 0.29
    const geo = new THREE.PlaneGeometry(0.62, 0.55, 10, 8)
    geo.translate(0.31, -0.275, 0)
    this.cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.85, side: THREE.DoubleSide }))
    this.clothRest = (geo.attributes.position.array as Float32Array).slice()
    this.capeArm.mitt.add(stick, this.cloth)
    this.ring.add(this.capeArm.g, this.freeArm.g)
    this.ring.visible = false
    this.root.add(this.ring)
  }

  /**
   * In the bullring. `raise` 0..1 holds the muleta out to the right, `bite` 0..1 brings the left mitt up to
   * your mouth (nails!), `whip` 0..1 is a bull tearing past the cloth, `shake` how much you tremble.
   */
  matador(on: boolean, t = 0, o: { raise?: number; bite?: number; whip?: number; shake?: number } = {}) {
    this.ring.visible = on
    if (!on) return
    const raise = o.raise ?? 0
    const bite = o.bite ?? 0
    const whip = o.whip ?? 0
    const shake = o.shake ?? 0
    const jit = (f: number) => Math.sin(t * f) * 0.004 * shake
    // cape arm: down by your side, or out to the right with the cloth hanging across your view
    const ca = this.capeArm
    ca.g.position.set(THREE.MathUtils.lerp(0.36, 0.2, raise) + jit(53), THREE.MathUtils.lerp(-0.6, -0.25, raise) + jit(41), THREE.MathUtils.lerp(-0.5, -0.68, raise))
    ca.g.rotation.set(0, THREE.MathUtils.lerp(0.9, 0.5, raise), THREE.MathUtils.lerp(-1.1, 0.06, raise) + Math.sin(t * 2.1) * 0.03)
    // the cloth sways, and flies up when the bull goes through it
    const pos = this.cloth.geometry.attributes.position as THREE.BufferAttribute
    const r = this.clothRest
    for (let i = 0; i < pos.count; i++) {
      const x = r[i * 3]
      const y = r[i * 3 + 1]
      const down = -y / 0.55
      const wave = Math.sin(x * 9 - t * 5) * 0.03 * down + Math.sin(t * 3 + x * 4) * 0.02 * down
      pos.setXYZ(i, x, y * (1 - whip * 0.5 * down), r[i * 3 + 2] + wave + whip * down * 0.35 * Math.sin(t * 30 + x * 8))
    }
    pos.needsUpdate = true
    this.cloth.geometry.computeVertexNormals()
    // free arm: out of sight, or up at your mouth
    const fa = this.freeArm
    fa.g.position.set(THREE.MathUtils.lerp(-0.4, -0.03, bite) + jit(61) * 2, THREE.MathUtils.lerp(-0.8, -0.17, bite) + Math.abs(Math.sin(t * 13)) * 0.012 * bite, THREE.MathUtils.lerp(-0.5, -0.26, bite))
    fa.g.rotation.set(-0.4 * bite, 0, -0.6 * bite)
  }

  /**
   * Throwing arm. `charge` 0..1 while winding up (null = not holding a snowball);
   * call `release()` to play the throw.
   */
  pose(dt: number, t: number, charge: number | null) {
    this.throwT += dt
    const g = this.throwArm.g
    const rest = new THREE.Vector3(0.34, -0.75, -0.62)
    const ready = new THREE.Vector3(0.26, -0.3, -0.62)
    const back = new THREE.Vector3(0.4, -0.06, -0.42)
    const follow = new THREE.Vector3(0.02, -0.38, -0.85)
    if (charge !== null) {
      g.visible = true
      this.ball.visible = true
      // pull back over the shoulder, trembling a little at full power
      const p = ready.clone().lerp(back, THREE.MathUtils.smoothstep(charge, 0, 1))
      if (charge > 0.95) p.add(new THREE.Vector3(Math.sin(t * 61) * 0.003, Math.sin(t * 47) * 0.003, 0))
      g.position.lerp(p, 1 - Math.exp(-18 * dt))
      g.rotation.set(0.5 * charge, -0.3 * charge, -0.4 * charge)
    } else if (this.throwT < 0.45) {
      // swing through, then drop out of view
      const k = this.throwT / 0.45
      this.ball.visible = false
      const p = k < 0.35 ? back.clone().lerp(follow, k / 0.35) : follow.clone().lerp(rest, (k - 0.35) / 0.65)
      g.position.copy(p)
      g.rotation.set(-0.6 * (1 - k), 0.2, 0)
    } else {
      g.position.lerp(rest, 1 - Math.exp(-10 * dt))
      if (g.position.y < -0.7) g.visible = false
    }
  }

  release() {
    this.throwT = 0
  }

  /** Arcade hands: `stick` -1..1 tilts the joystick, `press` 0..1 pushes the button. */
  arcade(on: boolean, stick = 0, press = 0, t = 0) {
    this.hands.visible = on
    if (!on) return
    this.stick.rotation.z = -stick * 0.45
    this.left.g.position.set(-0.24 + stick * 0.025, -0.43 + Math.sin(t * 2) * 0.002, -0.58)
    this.left.g.rotation.z = -stick * 0.3
    this.right.g.position.set(0.25, -0.44 - press * 0.035, -0.58)
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    if (!this.throwArm.g.visible && !this.hands.visible && !this.ring.visible) return
    this.root.position.copy(camera.position)
    this.root.quaternion.copy(camera.quaternion)
    renderer.clearDepth()
    renderer.render(this.scene, camera)
  }
}
