// Tomtens släde, parked in the yard outside Leksaksfabriken: the sleigh, five reindeer (Rudolf in front) and
// Tomten himself in the seat. Walk up, press E, push him out into the snow and take the reins –
// the flying is in flight.ts. Everything here is in sleigh space: -z forward, the sleigh's middle at the origin.
import * as THREE from 'three'
import { keepApart } from './batch'
import { Nisse } from './npc'
import { blip } from './sfx'
import { glowTexture } from './tex'
import type { Circle } from './world'

export const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

/** Where the sleigh waits: in Leksaksfabriken's yard by the sacks, side on to the path so you see the whole team. */
export const PARK = { x: 10, z: -52.5, yaw: -Math.PI / 2 }
/** Your eyes when you sit in it. */
export const EYE = new THREE.Vector3(0, 2.8, 0.8)
/** Where the reins are held. */
const HOLD = new THREE.Vector3(0, 1.95, -0.55)
const SEAT_Y = 0.95

const fur = std(0x7b4a2b, 0.9)
const furLight = std(0xd9b48a, 0.9)
const hoof = std(0x2a1a10, 0.5)
const antler = std(0xe8d6b0, 0.8)
const strap = std(0xa3162b, 0.5)
const gold = std(0xf6c453, 0.3, 0.8)
const black = std(0x111111, 0.3)

/** A cylinder from a to b. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const d = b.clone().sub(a)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, d.length(), 6), mat)
  m.position.copy(a).addScaledVector(d, 0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  return m
}

class Reindeer {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  private legs: { hip: THREE.Group; front: boolean }[] = []
  private head = new THREE.Group()
  private tail: THREE.Mesh
  private nose: THREE.Sprite | null = null
  readonly phase = Math.random() * 10
  /** Collar, where the reins are tied (deer space). */
  static readonly COLLAR = new THREE.Vector3(0, 1.3, -0.45)

  constructor(rudolf: boolean) {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.8, 6, 12), fur)
    torso.rotation.x = Math.PI / 2
    torso.position.y = 1.05
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), furLight)
    chest.scale.set(1, 1.1, 0.8)
    chest.position.set(0, 1.0, -0.5)
    const neck = rod(new THREE.Vector3(0, 1.15, -0.45), new THREE.Vector3(0, 1.62, -0.72), 0.14, fur)
    // harness round the belly and a collar of bells
    const belly = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.035, 6, 20), strap)
    belly.position.set(0, 1.05, -0.12)
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), strap)
    collar.position.copy(Reindeer.COLLAR)
    collar.rotation.x = Math.PI / 2 - 0.55
    for (const x of [-0.11, 0, 0.11]) {
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), gold)
      bell.position.set(x, 1.2, -0.6)
      this.body.add(bell)
    }
    this.tail = keepApart(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(0xf7f4ee, 0.9)))
    this.tail.position.set(0, 1.18, 0.66)
    this.body.add(torso, chest, neck, belly, collar, this.tail)

    // head
    this.head.position.set(0, 1.7, -0.78)
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), fur)
    skull.scale.set(0.95, 1, 1.15)
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.26, 10), fur)
    snout.rotation.x = -Math.PI / 2
    snout.position.set(0, -0.05, -0.2)
    const noseMesh = new THREE.Mesh(
      new THREE.SphereGeometry(rudolf ? 0.065 : 0.045, 10, 8),
      rudolf ? new THREE.MeshBasicMaterial({ color: 0xff2d2d, toneMapped: false }) : black,
    )
    noseMesh.position.set(0, -0.04, -0.34)
    this.head.add(skull, snout, noseMesh)
    if (rudolf) {
      this.nose = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,70,70,1)', 'rgba(255,40,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
      this.nose.scale.setScalar(0.8)
      this.nose.position.copy(noseMesh.position)
      this.head.add(this.nose)
    }
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), black)
      eye.position.set(s * 0.085, 0.05, -0.1)
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), fur)
      ear.position.set(s * 0.13, 0.08, 0.04)
      ear.rotation.z = -s * 1.25
      // antlers: a beam up and out, a few tines
      const base = new THREE.Vector3(s * 0.07, 0.11, 0.02)
      const mid = new THREE.Vector3(s * 0.17, 0.32, 0.08)
      const top = new THREE.Vector3(s * 0.26, 0.5, 0.14)
      this.head.add(
        eye,
        ear,
        rod(base, mid, 0.024, antler),
        rod(mid, top, 0.02, antler),
        rod(mid, new THREE.Vector3(s * 0.15, 0.46, -0.06), 0.016, antler),
        rod(top, new THREE.Vector3(s * 0.4, 0.6, 0.1), 0.014, antler),
        rod(top, new THREE.Vector3(s * 0.22, 0.66, 0.22), 0.014, antler),
      )
    }
    this.body.add(this.head)

    // legs, hinged at the shoulder / hip
    for (const z of [-0.38, 0.4])
      for (const x of [-0.14, 0.14]) {
        const hip = new THREE.Group()
        hip.position.set(x, 0.95, z)
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.86, 6), fur)
        leg.position.y = -0.43
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.11), hoof)
        h.position.y = -0.89
        hip.add(leg, h)
        this.body.add(hip)
        this.legs.push({ hip, front: z < 0 })
      }
    this.group.add(this.body)
    this.group.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  }

  /** `gallop` 0 = standing about, 1 = flying flat out. */
  update(t: number, gallop: number) {
    const p = t * 7 + this.phase
    for (const [i, l] of this.legs.entries()) {
      // flying: front legs reach forward, back legs kick back, all paddling together
      const stand = l.front && i === 0 ? Math.max(0, Math.sin(t * 0.7 + this.phase) - 0.85) * 4 : 0
      const fly = (l.front ? -0.7 : 0.6) + Math.sin(p + (l.front ? 0 : 1.6) + (i % 2) * 0.3) * 0.55
      l.hip.rotation.x = THREE.MathUtils.lerp(stand * Math.sin(t * 9), fly, gallop)
    }
    this.body.position.y = Math.sin(p) * 0.06 * gallop
    this.body.rotation.x = Math.sin(p + 0.8) * 0.05 * gallop
    // now and then a parked one dips its head to sniff the snow
    const sniff = THREE.MathUtils.smoothstep(Math.sin(t * 0.31 + this.phase * 2), 0.6, 0.95) * (1 - gallop)
    this.head.rotation.x = sniff * 0.9 - gallop * 0.15 + Math.sin(p) * 0.06 * gallop
    this.tail.position.y = 1.18 + Math.max(0, Math.sin(t * 3 + this.phase)) * 0.04
    if (this.nose) this.nose.scale.setScalar(0.75 + Math.sin(t * 4) * 0.12)
  }
}

/** The sleigh itself: a curly red body on golden runners, a seat and a sack of presents. */
function buildSleigh() {
  const g = new THREE.Group()
  const red = std(0xb3122a, 0.45)
  // side profile (u forward, v up), extruded across the width
  const s = new THREE.Shape()
  s.moveTo(-1.15, 0.38)
  s.lineTo(1.2, 0.38)
  s.quadraticCurveTo(1.62, 0.5, 1.5, 1.0)
  s.quadraticCurveTo(1.42, 1.32, 1.18, 1.2)
  s.quadraticCurveTo(1.0, 1.1, 0.95, SEAT_Y - 0.05)
  s.lineTo(-0.55, SEAT_Y - 0.05)
  s.quadraticCurveTo(-0.75, 1.0, -0.82, 1.5)
  s.quadraticCurveTo(-0.9, 1.75, -1.22, 1.62)
  s.lineTo(-1.15, 0.38)
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.3, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 10 })
  geo.rotateY(Math.PI / 2)
  geo.translate(-0.65, 0, 0)
  const body = new THREE.Mesh(geo, [red, std(0x7d0c1d, 0.5)])
  g.add(body)
  // gold stripe along each side
  for (const x of [-0.71, 0.71]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 2.3), gold)
    stripe.position.set(x, 0.55, 0)
    g.add(stripe)
  }
  // seat + backrest cushions
  const velvet = std(0x1f5c3a, 0.95)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 1.0), velvet)
  seat.position.set(0, SEAT_Y + 0.02, 0.15)
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 0.14), velvet)
  back.position.set(0, SEAT_Y + 0.35, 0.68)
  back.rotation.x = -0.2
  g.add(seat, back)
  // runners curling up at the front
  const runnerPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.14, 1.35),
    new THREE.Vector3(0, 0.06, 0.6),
    new THREE.Vector3(0, 0.06, -1.3),
    new THREE.Vector3(0, 0.3, -1.85),
    new THREE.Vector3(0, 0.78, -1.9),
    new THREE.Vector3(0, 0.9, -1.62),
  ])
  for (const x of [-0.6, 0.6]) {
    const r = new THREE.Mesh(new THREE.TubeGeometry(runnerPath, 40, 0.045, 6), gold)
    r.position.x = x
    g.add(r)
    for (const z of [-0.8, 0.0, 0.8]) g.add(rod(new THREE.Vector3(x, 0.08, z), new THREE.Vector3(x, 0.42, z), 0.03, gold))
  }
  // a sack of presents on the back
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), std(0x8a5a32, 0.95))
  sack.scale.set(1.1, 0.95, 0.85)
  sack.position.set(0, 1.85, 1.0)
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 14), std(0xf6c453, 0.6))
  tie.rotation.x = Math.PI / 2
  tie.position.set(0, 2.3, 1.0)
  g.add(sack, tie)
  ;[0xe5383b, 0x2fa36b, 0x4a7bd0, 0xf6c453].forEach((c, i) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), std(c, 0.6))
    box.position.set(-0.3 + i * 0.2, 2.3 + (i % 2) * 0.08, 0.95 + (i % 2) * 0.12)
    box.rotation.set(i * 0.5, i * 0.8, 0.2)
    g.add(box)
  })
  // a lantern on the front curl
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false }))
  lantern.position.set(0.6, 1.08, -1.72)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,214,140,1)', 'rgba(255,170,70,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.scale.setScalar(0.7)
  ;(glow.material as THREE.SpriteMaterial).opacity = 0.7
  glow.position.copy(lantern.position)
  g.add(lantern, glow)
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
  })
  return g
}

/** Your own mittens on the reins (only while you fly). */
function buildHands() {
  const g = new THREE.Group()
  for (const s of [-1, 1]) {
    const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(0xb3202a, 0.85))
    mitt.scale.set(1, 0.9, 1.2)
    mitt.position.set(s * 0.17, HOLD.y, HOLD.z)
    const sleeve = rod(new THREE.Vector3(s * 0.3, HOLD.y - 0.25, HOLD.z + 0.6), new THREE.Vector3(s * 0.18, HOLD.y - 0.02, HOLD.z + 0.07), 0.075, std(0x31507a, 0.85))
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.03, 6, 12), std(0xf7f4ee, 0.95))
    cuff.position.set(s * 0.18, HOLD.y - 0.02, HOLD.z + 0.08)
    cuff.rotation.x = 1.2
    g.add(mitt, sleeve, cuff)
  }
  return g
}

type SantaState = 'seated' | 'flying' | 'down'

export class Sleigh {
  /** The whole rig: sleigh, team, reins. Moves as one when you fly. */
  readonly group = new THREE.Group()
  readonly santa = new Nisse({ coat: 0xc8102e, hat: 0xc8102e, pants: 0xc8102e, trim: true, longBeard: true, scale: 1.32 })
  readonly hands = buildHands()
  private deer: Reindeer[] = []
  private reins: { line: THREE.Line; deer: Reindeer; side: number }[] = []
  private santaState: SantaState = 'seated'
  private santaT = 0
  private fall = { from: new THREE.Vector3(), to: new THREE.Vector3(), yaw: 0 }
  private hop = 9
  private nearFor = 0
  /** 0 parked … 1 flying: how hard the team gallops. */
  gallop = 0
  /** Out on his rounds (julafton, see julaftonsrunda.ts): no pushing him out, he has no time to talk. */
  busy = false
  /** Tomten speaks (shown as a toast). */
  say: (text: string) => void = () => {}

  constructor(private scene: THREE.Scene) {
    this.group.add(buildSleigh())
    // two pairs and Rudolf leading
    const spots: [number, number, boolean][] = [
      [-0.55, -3.7, false],
      [0.55, -3.7, false],
      [-0.55, -5.7, false],
      [0.55, -5.7, false],
      [0, -7.7, true],
    ]
    for (const [x, z, rudolf] of spots) {
      const d = new Reindeer(rudolf)
      d.group.position.set(x, 0, z)
      this.deer.push(d)
      this.group.add(d.group)
    }
    // leather traces from the sleigh to each deer, and reins from the driver's hands
    const traceMat = new THREE.LineBasicMaterial({ color: 0x5a3018 })
    const traces: number[] = []
    for (const d of this.deer) {
      const c = d.group.position.clone().add(new THREE.Vector3(0, 1.0, 0.2))
      traces.push(Math.sign(d.group.position.x) * 0.4, 0.75, -1.5, c.x, c.y, c.z)
    }
    const tg = new THREE.BufferGeometry()
    tg.setAttribute('position', new THREE.Float32BufferAttribute(traces, 3))
    this.group.add(new THREE.LineSegments(tg, traceMat))
    for (const d of this.deer)
      for (const side of d.group.position.x === 0 ? [-1, 1] : [Math.sign(d.group.position.x)]) {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(10).fill(0).map(() => new THREE.Vector3())), traceMat)
        line.frustumCulled = false
        this.reins.push({ line, deer: d, side })
        this.group.add(line)
      }

    this.hands.visible = false
    this.group.add(this.hands)
    this.santa.group.userData.onSnowball = () => (this.hop = 0)
    // snowballs on the sleigh or the team just jingle the bells (no splat left hanging in the air after take-off)
    this.group.userData.onSnowball = () => [0, 50, 100].forEach((ms) => setTimeout(() => blip(2400 + Math.random() * 800, 0.06, 'triangle', 0.03), ms))
    this.reseat()
    this.park()
    scene.add(this.group)
  }

  /** Back in the parking spot, standing still. */
  park() {
    this.group.position.set(PARK.x, 0, PARK.z)
    this.group.rotation.set(0, PARK.yaw, 0, 'YXZ')
    this.gallop = 0
    for (const d of this.deer) d.group.position.y = 0
    this.group.updateMatrixWorld(true)
  }

  /** Tomten back in his seat, holding the reins. */
  reseat() {
    const s = this.santa
    this.group.add(s.group)
    s.group.position.set(0, SEAT_Y + 0.06 - 0.42 * 1.32, 0.2)
    s.group.rotation.set(0, Math.PI, 0, 'YXZ')
    s.sit(true)
    s.armL.rotation.set(-1.1, 0, -0.1)
    s.armR.rotation.set(-1.1, 0, 0.1)
    s.body.position.y = 0
    s.body.rotation.set(0, 0, 0)
    s.head.rotation.set(0, 0, 0)
    this.santaState = 'seated'
    // no "ho ho ho" for whoever is standing right here already
    this.nearFor = 1
    this.hands.visible = false
  }

  /** Can you push him out right now? */
  get ready() {
    return this.santaState === 'seated' && !this.busy
  }

  /** Middle of the seat, in the world. */
  seatWorld() {
    return this.group.localToWorld(new THREE.Vector3(0, 1.2, 0.2))
  }

  /** Push Tomten out of the sleigh, away from where you stand. He lands on his back in the snow. */
  push(from: THREE.Vector3) {
    const s = this.santa
    this.scene.attach(s.group)
    const p = s.group.position.clone()
    const dir = p.clone().sub(from).setY(0)
    // shoved from the front or back: he goes out over the side
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(this.group.quaternion)
    if (dir.lengthSq() < 0.01) dir.copy(side)
    dir.normalize()
    if (Math.abs(dir.dot(side)) < 0.5) dir.copy(side).multiplyScalar(Math.sign(dir.dot(side)) || 1)
    this.fall.from.copy(p)
    this.fall.to.copy(p).addScaledVector(dir, 2.9).setY(0.3)
    // facing back towards the sleigh as he goes over
    this.fall.yaw = Math.atan2(-dir.x, -dir.z)
    s.armL.rotation.set(0, 0, -0.18)
    s.armR.rotation.set(0, 0, 0.18)
    this.santaState = 'flying'
    this.santaT = 0
    this.hands.visible = true
  }

  /** Circles you can't walk through (world space, while parked). */
  colliders(): Circle[] {
    const out: Circle[] = []
    const at = (x: number, z: number, r: number) => {
      const p = this.group.localToWorld(new THREE.Vector3(x, 0, z))
      out.push({ x: p.x, z: p.z, r })
    }
    at(0, 0.7, 0.85)
    at(0, -0.8, 0.85)
    for (const d of this.deer) {
      at(d.group.position.x, d.group.position.z - 0.35, 0.38)
      at(d.group.position.x, d.group.position.z + 0.35, 0.38)
    }
    return out
  }

  update(t: number, dt: number, player: THREE.Vector3) {
    for (const [i, d] of this.deer.entries()) {
      d.update(t, this.gallop)
      // flying, each deer bobs on its own a little
      d.group.position.y = Math.sin(t * 2.1 + i * 1.3) * 0.18 * this.gallop - 0.75 * this.gallop
    }
    this.updateReins(t)
    this.updateSanta(t, dt, player)
  }

  private updateReins(t: number) {
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (const r of this.reins) {
      a.set(HOLD.x + r.side * 0.17, HOLD.y, HOLD.z - 0.05)
      b.copy(Reindeer.COLLAR).add(new THREE.Vector3(r.side * 0.14, 0, 0)).add(r.deer.group.position)
      const pos = r.line.geometry.attributes.position as THREE.BufferAttribute
      // they sag when parked and go taut (with a flutter) in the air
      const sag = THREE.MathUtils.lerp(0.35, 0.08 + Math.sin(t * 9 + r.side) * 0.03, this.gallop)
      for (let i = 0; i < 10; i++) {
        const k = i / 9
        pos.setXYZ(i, THREE.MathUtils.lerp(a.x, b.x, k), THREE.MathUtils.lerp(a.y, b.y, k) - Math.sin(k * Math.PI) * sag, THREE.MathUtils.lerp(a.z, b.z, k))
      }
      pos.needsUpdate = true
    }
  }

  private updateSanta(t: number, dt: number, player: THREE.Vector3) {
    const s = this.santa
    this.santaT += dt
    this.hop += dt
    const hop = this.hop < 0.5 ? Math.sin((this.hop / 0.5) * Math.PI) * 0.15 : 0

    if (this.santaState === 'seated') {
      // breathe, look at you, wave when you come close
      s.body.scale.set(1, 1 + Math.sin(t * 2) * 0.015, 1)
      s.body.position.y = hop
      const p = s.group.getWorldPosition(new THREE.Vector3())
      const dx = player.x - p.x
      const dz = player.z - p.z
      const near = Math.hypot(dx, dz) < 7
      const yaw = this.group.rotation.y + Math.PI
      const want = near ? Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw)) : 0
      s.head.rotation.y += (THREE.MathUtils.clamp(want, -1.1, 1.1) - s.head.rotation.y) * Math.min(1, dt * 4)
      this.nearFor = near ? this.nearFor + dt : 0
      const wave = near && this.nearFor < 2.5
      s.armR.rotation.set(wave ? -0.4 : -1.1, 0, wave ? 2.5 + Math.sin(t * 8) * 0.35 : 0.1)
      if (this.nearFor > 0 && this.nearFor <= dt)
        this.say(this.busy ? '🎅 Ho ho ho! Ingen tid nu – det är JULAFTON! En säck till, sen bär det av igen!' : '🎅 Ho ho ho! Titta gärna – men rör inte min släde!')
      return
    }

    if (this.santaState === 'flying') {
      // a backwards somersault out of the sleigh, landing flat on his back with his boots in the air
      const k = Math.min(1, this.santaT / 0.8)
      s.group.position.lerpVectors(this.fall.from, this.fall.to, k)
      s.group.position.y += Math.sin(k * Math.PI) * 1.4
      s.group.rotation.set(-THREE.MathUtils.smootherstep(k, 0, 1) * (Math.PI * 2.5), this.fall.yaw, 0, 'YXZ')
      s.armL.rotation.z = -0.18 - Math.sin(t * 20) * 0.8
      s.armR.rotation.z = 0.18 + Math.sin(t * 20) * 0.8
      if (k >= 1) {
        this.santaState = 'down'
        this.santaT = 0
      }
      return
    }

    // down in the snow: kick a bit, sit up, shake a fist at the sky
    const T = this.santaT
    const up = THREE.MathUtils.smoothstep(T, 1.3, 1.9)
    s.group.rotation.set(THREE.MathUtils.lerp(-Math.PI / 2, -0.12, up), this.fall.yaw, 0, 'YXZ')
    s.group.position.y = THREE.MathUtils.lerp(0.3, -0.5, up) + hop
    const kick = T < 1.3 ? Math.sin(T * 14) * 0.35 * (1 - T / 1.3) : 0
    s.sit(true, kick)
    const fist = up > 0.5
    s.armR.rotation.set(fist ? -0.3 : 0, 0, fist ? 2.7 + Math.sin(t * 13) * 0.25 : 0.4)
    s.armL.rotation.set(0, 0, fist ? -0.5 : -0.4)
    s.head.rotation.z = fist ? Math.sin(t * 7) * 0.15 : 0
  }
}
