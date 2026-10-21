// Los tres matadores: three bullfighters hanging about by the side wall of Tomtens verkstad, leaning on it,
// chewing straws and flipping coins. Walk up and they ask if you want a challenge – say yes and they blindfold
// you and take you to Madrid (corrida.ts). Everything is in matador space: feet at the origin, facing +z.
import * as THREE from 'three'
import { rod, std } from './sleigh'
import { FONT, makeCanvas, toTexture } from './tex'
import type { Circle } from './world'

const skin = std(0xd9a27a, 0.6)
const gold = std(0xf2c230, 0.3, 0.7)
const black = std(0x141416, 0.5)
const white = std(0xf7f4ee, 0.7)
const stocking = std(0xf2a7b8, 0.6)
const straw = new THREE.MeshStandardMaterial({ color: 0xf2d470, roughness: 0.7, emissive: 0x3a3010 })

export type MatadorLook = {
  suit: number
  /** How he leans: back flat to the wall with a foot up on it, a shoulder on it, or arms crossed. */
  pose: 'foot' | 'shoulder' | 'arms'
  coin?: boolean
  glasses?: boolean
  mustache?: boolean
  /** A pink-and-gold capote over the shoulder. */
  cape?: boolean
}

function ball(r: number, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  return m
}

export class Matador {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly head = new THREE.Group()
  readonly armR = new THREE.Group()
  readonly armL = new THREE.Group()
  readonly legs: THREE.Group[] = []
  /** The coin, in his right hand (or up in the air). */
  readonly coin: THREE.Mesh | null = null
  private straw = new THREE.Group()
  private phase = Math.random() * 10
  private flipT = 9 - Math.random() * 6
  /** Leaning on the wall (false while he walks over to you). */
  leaning = true

  constructor(readonly look: MatadorLook) {
    const suit = std(look.suit, 0.45)
    // legs: knee breeches in the suit colour, pink stockings, flat black slippers
    for (const x of [-0.1, 0.1]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.86, 0)
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.42, 10), suit)
      thigh.position.y = -0.21
      const knee = new THREE.Group()
      knee.position.y = -0.42
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.4, 10), stocking)
      shin.position.y = -0.2
      const tassel = ball(0.03, gold, x > 0 ? 0.07 : -0.07, 0.02, 0)
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.24), black)
      shoe.position.set(0, -0.42, 0.05)
      knee.add(shin, tassel, shoe)
      // gold stripe down the outside of the leg
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.04), gold)
      stripe.position.set(x > 0 ? 0.08 : -0.08, -0.21, 0)
      hip.add(thigh, stripe, knee)
      hip.userData.knee = knee
      this.legs.push(hip)
      this.body.add(hip)
    }
    // the short gold-heavy jacket over a white shirt, a thin black tie and a sash
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.14, 14), std(0xd8202c, 0.6))
    waist.position.y = 0.9
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 14), white)
    shirt.position.y = 1.17
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.36, 14, 1, true, 0.5, Math.PI * 2 - 1.0), suit)
    jacket.position.y = 1.22
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 18), gold)
    trim.rotation.x = Math.PI / 2
    trim.position.y = 1.05
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.01), black)
    tie.position.set(0, 1.25, 0.175)
    this.body.add(waist, shirt, jacket, trim, tie)
    // gold shoulder pads
    for (const s of [-1, 1]) this.body.add(ball(0.08, gold, s * 0.2, 1.38, 0, 1.2, 0.6, 1))
    // arms, hinged at the shoulder, with an elbow
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.24, 1.36, 0)
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.3, 10), suit)
      upper.position.y = -0.15
      const elbow = new THREE.Group()
      elbow.position.y = -0.3
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.27, 10), suit)
      fore.position.y = -0.135
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), gold)
      cuff.position.y = -0.25
      const hand = ball(0.045, skin, 0, -0.3, 0)
      elbow.add(fore, cuff, hand)
      g.add(upper, elbow)
      g.userData.elbow = elbow
      g.rotation.z = side * 0.12
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    // head: tanned, slick black hair, the two-lobed montera hat
    this.head.position.y = 1.58
    this.head.add(ball(0.13, skin, 0, 0, 0, 1, 1.1, 1))
    this.head.add(ball(0.135, black, 0, 0.04, -0.02, 1, 0.95, 1))
    this.head.add(ball(0.03, skin, 0, -0.01, 0.13))
    for (const s of [-1, 1]) this.head.add(ball(0.016, black, s * 0.045, 0.03, 0.115))
    // a little smirk
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 5, 10, Math.PI * 0.7), std(0x7a2a22, 0.5))
    smile.position.set(0.01, -0.06, 0.12)
    smile.rotation.z = Math.PI + 0.4
    this.head.add(smile)
    if (look.mustache) this.head.add(ball(0.04, black, 0, -0.04, 0.125, 1.8, 0.4, 0.6))
    if (look.glasses) {
      for (const s of [-1, 1]) this.head.add(ball(0.035, std(0x0a0a0a, 0.1, 0.6), s * 0.048, 0.03, 0.12, 1.2, 0.8, 0.4))
      this.head.add(rod(new THREE.Vector3(-0.02, 0.035, 0.13), new THREE.Vector3(0.02, 0.035, 0.13), 0.006, black))
    }
    const montera = new THREE.Group()
    montera.position.set(0, 0.12, -0.01)
    montera.add(ball(0.11, black, 0, 0, 0, 1.25, 0.45, 0.95))
    for (const s of [-1, 1]) montera.add(ball(0.06, black, s * 0.13, 0.01, 0, 1, 0.8, 1))
    this.head.add(montera)
    // the straw, from the corner of his mouth
    this.straw.position.set(0.03, -0.06, 0.12)
    this.straw.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, -0.03, 0.15), 0.009, straw))
    this.head.add(this.straw)

    if (look.cape) {
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75, 1, 4), new THREE.MeshStandardMaterial({ color: 0xe86aa6, roughness: 0.8, side: THREE.DoubleSide }))
      cape.position.set(-0.24, 1.08, 0.02)
      cape.rotation.set(0, Math.PI / 2, 0.08)
      const lining = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.8 }))
      lining.position.x = -0.005
      lining.rotation.y = Math.PI
      cape.add(lining)
      this.body.add(cape)
    }
    if (look.coin) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 16), new THREE.MeshStandardMaterial({ color: 0xf6c453, roughness: 0.25, metalness: 0.9, emissive: 0x4a3008 }))
      this.coin = c
      this.group.add(c)
    }

    this.body.add(this.head)
    this.group.add(this.body)
    this.group.rotation.order = 'YXZ'
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
    this.rest()
  }

  /** The leaning pose (relative to the wall behind him, at -z). */
  rest() {
    const [l, r] = this.legs
    for (const leg of this.legs) {
      leg.rotation.set(0, 0, 0)
      leg.userData.knee.rotation.set(0, 0, 0)
    }
    this.armL.rotation.set(0, 0, -0.12)
    this.armR.rotation.set(0, 0, 0.12)
    this.armL.userData.elbow.rotation.set(0, 0, 0)
    this.armR.userData.elbow.rotation.set(0, 0, 0)
    this.body.position.set(0, 0, 0)
    if (this.look.pose === 'foot') {
      // back flat to the wall, one foot up on it behind him
      this.body.rotation.set(-0.12, 0, 0)
      l.rotation.x = -0.75
      l.userData.knee.rotation.x = 2.0
      // thumbs in his sash
      this.armL.rotation.set(0.1, 0, -0.35)
      this.armR.rotation.set(0.1, 0, 0.35)
      this.armL.userData.elbow.rotation.set(-0.3, 0, 0.9)
      this.armR.userData.elbow.rotation.set(-0.3, 0, -0.9)
    } else if (this.look.pose === 'shoulder') {
      // side on, a shoulder to the wall (on his -x side), ankles crossed
      this.body.rotation.set(0, 0, 0.12)
      l.rotation.z = -0.12
      r.rotation.z = 0.06
      this.armL.rotation.set(0.15, 0, -0.1)
    } else {
      // arms crossed, leaning back
      this.body.rotation.set(-0.14, 0, 0)
      this.armL.rotation.set(-0.5, 0.2, -0.15)
      this.armR.rotation.set(-0.5, -0.2, 0.15)
      this.armL.userData.elbow.rotation.set(-1.2, 0, 1.1)
      this.armR.userData.elbow.rotation.set(-1.2, 0, -1.1)
    }
  }

  /** Swing legs and arms. `amt` 0 = standing, 1 = walking. */
  walkPose(phase: number, amt: number) {
    const s = Math.sin(phase) * amt
    this.body.rotation.set(0, 0, 0)
    this.legs[0].rotation.set(s * 0.6, 0, 0)
    this.legs[1].rotation.set(-s * 0.6, 0, 0)
    for (const leg of this.legs) leg.userData.knee.rotation.x = Math.max(0, Math.sin(phase + (leg === this.legs[0] ? 0 : Math.PI))) * 0.5 * amt
    this.armL.rotation.set(-s * 0.5, 0, -0.1)
    this.armL.userData.elbow.rotation.set(0, 0, 0)
    this.body.position.y = Math.abs(Math.cos(phase)) * 0.03 * amt
  }

  /** Both hands up in front of his face, holding something (the blindfold). */
  holdUp(k: number) {
    for (const [a, s] of [
      [this.armL, -1],
      [this.armR, 1],
    ] as const) {
      a.rotation.set(-2.2 * k, 0, s * (0.12 + 0.25 * k))
      a.userData.elbow.rotation.set(-0.5 * k, 0, 0)
    }
  }

  /** Chew the straw, flip the coin now and then, look at you when you're close. */
  update(t: number, dt: number, player: THREE.Vector3, yaw: number) {
    // the straw wags up and down
    this.straw.rotation.set(Math.sin(t * 3.1 + this.phase) * 0.25, Math.sin(t * 1.3 + this.phase) * 0.4, 0)
    this.body.scale.set(1, 1 + Math.sin(t * 1.8 + this.phase) * 0.012, 1)
    // look at you (head only – they're far too cool to turn round)
    const p = this.group.getWorldPosition(new THREE.Vector3())
    const dx = player.x - p.x
    const dz = player.z - p.z
    const near = Math.hypot(dx, dz) < 8
    const want = near ? Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw)) : Math.sin(t * 0.3 + this.phase) * 0.3
    this.head.rotation.y += (THREE.MathUtils.clamp(want, -0.9, 0.9) - this.head.rotation.y) * Math.min(1, dt * 4)
    this.head.rotation.x = near ? 0.08 : -0.05
    if (!this.coin || !this.leaning) return
    // flip: thumb up, coin spins up and drops back into the hand
    this.flipT += dt
    if (this.flipT > 3.2 + (this.phase % 2)) this.flipT = 0
    const k = this.flipT
    const hand = this.armR.userData.elbow.localToWorld(new THREE.Vector3(0, -0.3, 0.05))
    this.group.worldToLocal(hand)
    const up = k < 0.9 ? Math.sin((k / 0.9) * Math.PI) * 0.55 : 0
    this.coin.position.copy(hand).add(new THREE.Vector3(0, 0.05 + up, 0))
    this.coin.rotation.set(k < 0.9 ? k * 30 : 0, 0, 0)
    // hand flicks as it throws and catches
    const flick = k < 0.15 ? Math.sin((k / 0.15) * Math.PI) : k > 0.8 && k < 1.0 ? -Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.5 : 0
    this.armR.rotation.set(-0.9 - flick * 0.3, 0, 0.15)
    this.armR.userData.elbow.rotation.set(-0.9, 0, 0)
  }
}

/** "Vill du ha en utmaning?" in a speech bubble. */
function bubbleSprite() {
  const [c, ctx] = makeCanvas(800, 220)
  ctx.fillStyle = '#fffdf6'
  ctx.strokeStyle = '#1b1b1d'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.roundRect(10, 10, 780, 150, 60)
  ctx.moveTo(370, 156)
  ctx.lineTo(400, 210)
  ctx.lineTo(430, 156)
  ctx.fill()
  ctx.stroke()
  ctx.fillRect(374, 148, 52, 14)
  ctx.fillStyle = '#1b1b1d'
  ctx.font = `700 58px ${FONT.sans}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Vill du ha en utmaning? 🐂', 400, 88)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(c), transparent: true, depthWrite: false }))
  sp.scale.set(3.2, 0.88, 1)
  sp.renderOrder = 5
  return sp
}

/** Where they stand along the wall (shop space: just outside the left side wall, facing away from it). */
const SPOTS = [
  { z: -1.7, look: { suit: 0x1f3a8a, pose: 'foot', coin: true, mustache: true } },
  { z: 0.0, look: { suit: 0xb3202a, pose: 'arms', glasses: true, cape: true } },
  { z: 1.6, look: { suit: 0x1d6e48, pose: 'shoulder', coin: true } },
] as const
const OUT = -5.5

export class Matadors {
  readonly crew: Matador[] = SPOTS.map((s) => new Matador({ ...s.look }))
  readonly bubble = bubbleSprite()
  private wallYaw = 0
  private home: THREE.Vector3[] = []
  private bubbleOn = 0
  /** False while they're away in Madrid with you. */
  out = true

  constructor(private scene: THREE.Scene) {}

  /** Line them up along the left outside wall of `shop` (its group). */
  place(shop: THREE.Object3D) {
    shop.updateMatrixWorld(true)
    // facing out from the wall: shop-space -x
    this.wallYaw = shop.rotation.y - Math.PI / 2
    this.home = SPOTS.map((s) => shop.localToWorld(new THREE.Vector3(OUT, 0, s.z)))
    this.crew.forEach((m) => this.scene.add(m.group))
    this.reset()
    this.scene.add(this.bubble)
    this.bubble.visible = false
  }

  /** Facing out from the wall – or along it, for the one leaning on a shoulder. */
  yawOf(i: number) {
    return this.crew[i].look.pose === 'shoulder' ? this.wallYaw - Math.PI / 2 : this.wallYaw + (i - 1) * 0.15
  }

  /** Back against the wall, as if nothing happened. */
  reset() {
    this.crew.forEach((m, i) => {
      this.scene.add(m.group)
      m.group.position.copy(this.home[i])
      m.group.rotation.set(0, this.yawOf(i), 0)
      m.group.visible = true
      m.leaning = true
      m.rest()
    })
    this.out = true
  }

  /** The middle of the three (for walking up and talking). */
  middle() {
    return this.crew[1].group.position.clone().setY(1.4)
  }

  /** A spot `dist` metres out in front of the middle one, facing him. */
  front(dist = 3.2) {
    const m = this.middle()
    const y = this.crew[1].group.rotation.y
    const p = m.clone().add(new THREE.Vector3(Math.sin(y), 0, Math.cos(y)).multiplyScalar(dist)).setY(0)
    return { pos: p, yaw: Math.atan2(-(m.x - p.x), -(m.z - p.z)) }
  }

  colliders(): Circle[] {
    return this.home.map((p) => ({ x: p.x, z: p.z, r: 0.35 }))
  }

  update(t: number, dt: number, player: THREE.Vector3) {
    if (!this.out) return
    for (const m of this.crew) m.update(t, dt, player, m.group.rotation.y)
    const p = this.middle()
    const near = Math.hypot(player.x - p.x, player.z - p.z) < 6.5
    this.bubbleOn = THREE.MathUtils.clamp(this.bubbleOn + (near ? dt : -dt) * 4, 0, 1)
    this.bubble.visible = this.bubbleOn > 0
    if (this.bubble.visible) {
      const k = THREE.MathUtils.smootherstep(this.bubbleOn, 0, 1)
      this.bubble.position.copy(p).setY(2.3 + Math.sin(t * 2.5) * 0.04)
      this.bubble.scale.set(3.2 * k, 0.88 * k, 1)
      ;(this.bubble.material as THREE.SpriteMaterial).opacity = k
    }
  }
}
