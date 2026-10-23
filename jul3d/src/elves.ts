// Small elves running around the square. Two of them play tag, the rest dash between spots,
// stop to look around, and – if you hit one with a snowball – fall over and often throw one back.
import * as THREE from 'three'
import { Nisse } from './npc'
import { blip } from './sfx'
import type { SnowballHit } from './snowballs'
import { makeCanvas, toTexture } from './tex'

const LOOKS = [
  { coat: 0x2fa36b, hat: 0xc8102e },
  { coat: 0xc8102e, hat: 0x2fa36b },
  { coat: 0x1d6e48, hat: 0xf6c453 },
  { coat: 0x4a7bd0, hat: 0xc8102e },
  { coat: 0x8e3fb0, hat: 0x2fa36b },
  { coat: 0xd4782a, hat: 0x1d6e48 },
  { coat: 0x2fa36b, hat: 0xf7f4ee },
  { coat: 0xc8102e, hat: 0xf6c453 },
]
const OUCH = ['Aj!', 'Hörru!', 'Oj!', 'Haha!', 'Nämen!', 'Fusk!']
const R_MIN = 4.8
const R_MAX = 16

function bubble(text: string) {
  const [c, ctx] = makeCanvas(256, 112)
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#2a1a10'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.roundRect(8, 8, 240, 76, 30)
  ctx.moveTo(110, 84)
  ctx.lineTo(128, 106)
  ctx.lineTo(146, 84)
  ctx.fill()
  ctx.stroke()
  ctx.fillRect(112, 78, 32, 8)
  ctx.fillStyle = '#b3202a'
  ctx.font = "700 46px 'DM Sans', sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 48)
  return toTexture(c)
}

type State = 'run' | 'idle' | 'down' | 'up' | 'aim' | 'flee'

export type ElfWorld = {
  player: THREE.Vector3
  /** Push a point out of the static colliders. */
  collide: (p: THREE.Vector3, r: number) => void
  /** Spots elves shouldn't stand on (cabinets, lamp posts…). */
  blocked: { x: number; z: number; r: number }[]
  throwAt: (from: THREE.Vector3, to: THREE.Vector3, owner: THREE.Object3D) => void
}

export class Elf {
  readonly nisse: Nisse
  readonly pos = new THREE.Vector3()
  private yaw = 0
  private target = new THREE.Vector3()
  private speed = 3
  private state: State = 'run'
  private t = 0
  private phase = Math.random() * 10
  private walk = 0
  private stuck = 0
  private lastDist = 0
  /** Speech bubble – lives in the scene, not the elf, so it stays upright when the elf falls over. */
  readonly say: THREE.Sprite
  private sayT = 9
  /** Tag: who this elf is chasing (or running from). */
  partner: Elf | null = null
  it = false

  constructor(i: number, private world: ElfWorld) {
    const look = LOOKS[i % LOOKS.length]
    this.nisse = new Nisse({ ...look, scale: 0.72 + Math.random() * 0.1, beard: false, ears: true, trim: i % 3 === 0 })
    const a = Math.random() * Math.PI * 2
    const r = R_MIN + Math.random() * (R_MAX - R_MIN)
    this.pos.set(Math.cos(a) * r, 0, Math.sin(a) * r)
    this.pickTarget()
    this.say = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
    this.say.scale.set(0.75, 0.33, 1)
    this.say.visible = false
    const onHit: SnowballHit = (from) => this.hit(from)
    this.nisse.group.userData.onSnowball = onHit
  }

  get group() {
    return this.nisse.group
  }

  private pickTarget(awayFrom?: THREE.Vector3) {
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2
      const r = R_MIN + Math.random() * (R_MAX - R_MIN)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (this.world.blocked.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + 0.8)) continue
      if (awayFrom && Math.hypot(x - awayFrom.x, z - awayFrom.z) < 7) continue
      this.target.set(x, 0, z)
      break
    }
    this.speed = 2.2 + Math.random() * 1.6
    this.lastDist = this.pos.distanceTo(this.target)
    this.stuck = 0
  }

  private shout(text: string) {
    const m = this.say.material as THREE.SpriteMaterial
    m.map?.dispose()
    m.map = bubble(text)
    m.needsUpdate = true
    this.say.visible = true
    this.sayT = 0
  }

  hit(from: THREE.Vector3) {
    if (this.state === 'down' || this.state === 'up') return
    // face the thrower, so the fall goes away from them
    const f = from.clone().sub(this.pos)
    this.yaw = Math.atan2(f.x, f.z)
    this.state = 'down'
    this.t = 0
    this.shout(OUCH[Math.floor(Math.random() * OUCH.length)])
    blip(700 + Math.random() * 300, 0.12, 'triangle', 0.05)
  }

  update(dt: number, time: number) {
    this.t += dt
    this.sayT += dt
    if (this.sayT > 1.4) this.say.visible = false
    else this.say.position.set(this.pos.x, 1.45 + this.sayT * 0.15, this.pos.z)
    const g = this.nisse.group
    const toPlayer = this.world.player.clone().sub(this.pos).setY(0)

    let moving = false
    switch (this.state) {
      case 'run':
      case 'flee': {
        if (this.partner) this.target.copy(this.it ? this.partner.pos : this.pos.clone().multiplyScalar(2).sub(this.partner.pos))
        if (this.partner && !this.it) {
          // the chased one keeps to the ring
          const r = Math.hypot(this.target.x, this.target.z)
          if (r > R_MAX || r < R_MIN) this.target.multiplyScalar(THREE.MathUtils.clamp(r, R_MIN, R_MAX) / r)
        }
        const d = this.target.clone().sub(this.pos).setY(0)
        const dist = d.length()
        if (this.partner && this.it && dist < 0.7) {
          // tagged! swap roles
          this.it = false
          this.partner.it = true
          this.partner.t = -0.6 // the new chaser counts to… well, a bit
          this.shout('Kull!')
        }
        // keep a little distance from the player
        const away = toPlayer.length() < 1.4 ? toPlayer.clone().normalize().multiplyScalar(-1.5) : new THREE.Vector3()
        if (!this.partner && dist < 0.4) {
          if (Math.random() < 0.45) {
            this.state = 'idle'
            this.t = -Math.random() * 2
          } else this.pickTarget()
          break
        }
        if (this.t < 0) break
        const dir = d.normalize().add(away).normalize()
        const sp = this.state === 'flee' ? 4.4 : this.partner ? (this.it ? 3.9 : 3.7) : this.speed
        this.pos.addScaledVector(dir, sp * dt)
        this.world.collide(this.pos, 0.3)
        this.turnTo(Math.atan2(dir.x, dir.z), dt, 8)
        moving = true
        // stuck behind something? try elsewhere
        this.stuck += dt
        if (this.stuck > 1) {
          if (!this.partner && this.lastDist - dist < 0.5) this.pickTarget()
          this.lastDist = dist
          this.stuck = 0
        }
        if (this.state === 'flee' && this.t > 3) {
          this.state = 'run'
          this.pickTarget()
        }
        break
      }
      case 'idle':
        // look around (and at you, if you're close)
        if (toPlayer.length() < 5) this.turnTo(Math.atan2(toPlayer.x, toPlayer.z), dt, 4)
        else this.turnTo(this.yaw + Math.sin(time * 0.8 + this.phase) * 0.02, dt, 2)
        if (this.t > 1.5) {
          this.state = 'run'
          this.pickTarget()
        }
        break
      case 'down': {
        // topple over backwards
        g.rotation.x = -THREE.MathUtils.smoothstep(this.t, 0, 0.3) * 1.45
        if (this.t > 1.3) {
          this.state = 'up'
          this.t = 0
        }
        break
      }
      case 'up':
        g.rotation.x = -(1 - THREE.MathUtils.smoothstep(this.t, 0, 0.45)) * 1.45
        if (this.t > 0.5) {
          g.rotation.x = 0
          const near = toPlayer.length() < 15
          if (near && Math.random() < 0.7) {
            this.state = 'aim'
            this.shout(Math.random() < 0.5 ? 'Vänta du!' : 'Nu jäklar!')
          } else {
            this.state = 'flee'
            this.pickTarget(this.world.player)
          }
          this.t = 0
        }
        break
      case 'aim': {
        // turn to you, wind up, throw, run
        this.turnTo(Math.atan2(toPlayer.x, toPlayer.z), dt, 10)
        const k = THREE.MathUtils.smoothstep(this.t, 0, 0.6)
        this.nisse.armR.rotation.x = -k * 2.6
        this.nisse.body.rotation.x = -k * 0.2
        if (this.t > 0.7) {
          const hand = this.pos.clone().setY(1.05)
          hand.addScaledVector(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), -0.15)
          this.world.throwAt(hand, this.world.player, g)
          this.nisse.armR.rotation.x = 0.8
          this.state = 'flee'
          this.t = 0
          this.pickTarget(this.world.player)
        }
        break
      }
    }

    this.walk += ((moving ? 1 : 0) - this.walk) * Math.min(1, dt * 8)
    if (moving) this.phase += dt * (this.state === 'flee' || this.partner ? 15 : 12)
    if (this.state !== 'aim') {
      this.nisse.walkPose(this.phase, this.walk)
      if (!moving && this.state === 'idle') this.nisse.body.position.y = Math.sin(time * 2 + this.phase) * 0.008
    }
    g.position.copy(this.pos)
    g.rotation.y = this.yaw
  }

  private turnTo(want: number, dt: number, rate: number) {
    const diff = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw))
    this.yaw += diff * Math.min(1, dt * rate)
  }
}

export function buildElves(scene: THREE.Scene, world: ElfWorld, count: number) {
  const elves = Array.from({ length: count }, (_, i) => new Elf(i, world))
  // the first two play tag
  if (count >= 2) {
    elves[0].partner = elves[1]
    elves[1].partner = elves[0]
    elves[0].it = true
  }
  for (const e of elves) scene.add(e.group, e.say)
  return elves
}
