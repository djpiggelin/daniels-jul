// Tjuren Ferdinand – the bullfight. The three matadors blindfold you in the village and you ride to Madrid in a
// horse cart, seeing only blurred glimpses under the cloth (a little Call of Duty opening). The blindfold comes
// off in the ring at noon, in front of a full house, and the bulls come out one at a time: dodge them, hold out
// the muleta so they go for the cloth instead of you, and after a while each one runs out of puff. Three bulls,
// then the finale: Ferdinand trots in to a roar, smells a bouquet, sits down – on a bumblebee – and goes mad.
// Everything in the ring is flat: x/z on the sand, the ring's middle at the origin, the bulls' gate at -z.
import * as THREE from 'three'
import { CAMEO, RING_R, ROAD, buildArena, buildBee, buildBouquet, buildFlowerRain, type Arena } from './arena'
import { Bull } from './bull'
import type { Matadors } from './matadors'
import type { Player } from './player'
import { TOUCH, walkFov } from './device'
import { PasoDoble, boo, buzz, clop, crowd, fanfare, heartbeat, snort, thud, whoosh } from './sfx'
import { glowTexture } from './tex'
import type { Viewmodel } from './viewmodel'

const BEST_KEY = 'jul3d.best.ferdinand'
const SEEN_KEY = 'jul3d.ferdinand.seen'
const touch = TOUCH

/**
 * How a bull fights. `tele`: how long he paws before a charge. `ignore`: the chance he goes for you, not the cloth.
 * `commit`: how many metres out he stops steering. `hook`: as he commits he swings his horns from the cloth towards
 * you (0 = not at all, 1 = right at you) – step away from the cloth then. `recharge`: the chance he turns and comes
 * straight back without pawing. `stalk`: how long he sizes you up. `drain`: how much a pass tires him.
 */
type Spec = {
  name: string
  coat: number
  belly?: number
  scale?: number
  speed: number
  turn: number
  tele: number
  time: number
  ignore: number
  commit: number
  hook: number
  recharge: number
  stalk: number
  drain: number
  ferdinand?: boolean
}
const BULLS: Spec[] = [
  { name: 'Bravucón', coat: 0x1c1616, speed: 9, turn: 0.55, tele: 0.95, time: 14, ignore: 0, commit: 3.2, hook: 0, recharge: 0, stalk: 0.9, drain: 1 },
  { name: 'Rayo', coat: 0x4a2c1c, belly: 0x5a3a28, speed: 11, turn: 1.2, tele: 0.7, time: 18, ignore: 0.2, commit: 2.8, hook: 0.45, recharge: 0.15, stalk: 0.6, drain: 0.7 },
  { name: 'El Diablo', coat: 0x0c0a0a, speed: 12.5, turn: 1.6, tele: 0.55, time: 22, ignore: 0.3, commit: 2.5, hook: 0.65, recharge: 0.3, stalk: 0.35, drain: 0.5 },
]
const FERDINAND: Spec = { name: 'Ferdinand', coat: 0x8a8090, belly: 0xc8bcc0, scale: 1.3, speed: 14, turn: 1.8, tele: 0.45, time: 28, ignore: 0.4, commit: 2.4, hook: 0.7, recharge: 0.35, stalk: 0.3, drain: 0.45, ferdinand: true }
/** No bull gives up sooner than this, however well you fight. */
const MIN_FIGHT = 10
const HEARTS = 3
const EYE = 1.62
/** The side-jump: how far, how quick, and how soon you can do it again. */
const DASH = { dist: 2.6, time: 0.25, cool: 0.75 }
const JUMP_V = 5.6
const GRAVITY = 15
/** Feet higher than this and the horns go under you. */
const CLEAR = 0.85
/** Where the cloth is, from you: to the right and out in front. */
const CAPE = { right: 1.2, ahead: 1.2 }
/** Ride: how long the cart takes, and how fast it rolls. */
const RIDE = 10.6
const RIDE_V = (ROAD.from - ROAD.to - 2) / RIDE

type State = 'blind' | 'ride' | 'reveal' | 'fight' | 'between' | 'ferdinand' | 'boss' | 'won' | 'lost' | 'fade'
type Mode = 'enter' | 'stalk' | 'paw' | 'charge' | 'feint' | 'skid' | 'turn' | 'tired' | 'leave' | 'sit' | 'show'

type Ai = {
  spec: Spec
  model: Bull
  pos: THREE.Vector3
  heading: number
  speed: number
  mode: Mode
  modeT: number
  stamina: number
  elapsed: number
  phase: number
  tele: number
  /** Charging the cloth (true) or you. */
  lured: boolean
  ignoreCape: boolean
  committed: boolean
  /** Where he swings his horns once he's committed (a hooking bull). */
  hookAt: THREE.Vector3 | null
  passed: boolean
  hit: boolean
  feinted: boolean
  minLat: number
  maxY: number
  overT: number
  y: number
  stepAt: number
}

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt))
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function readNum(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

export class Corrida {
  active = false
  /** True once we're in Madrid (main draws `world.scene` then). */
  inWorld = false
  world: Arena | null = null
  private state: State = 'blind'
  private stateT = 0
  private onceSet = new Set<string>()
  // you
  private pos = new THREE.Vector3()
  private vel = new THREE.Vector3()
  private y = 0
  private vy = 0
  private yaw = 0
  private pitch = 0
  private roll = 0
  private bob = 0
  private dash = { t: 0, x: 0, z: 0, cool: 0 }
  private invuln = 0
  private toss = { t: -1, from: new THREE.Vector3(), dir: new THREE.Vector3(), spin: 1 }
  private hearts = HEARTS
  private raise = 0
  private whip = 0
  private bite = 0
  private shake = 0
  private score = 0
  private combo = 0
  private best = readNum(BEST_KEY)
  private seen = readNum(SEEN_KEY)
  // bulls
  private bullNo = 0
  private bull: Ai | null = null
  private ferdinand: Bull | null = null
  private bulls: Bull[] = []
  private flowers: ReturnType<typeof buildFlowerRain> | null = null
  private bee = buildBee()
  private bouquet = buildBouquet()
  private beeT = 0
  private toss2 = { t: -1, from: new THREE.Vector3(), to: new THREE.Vector3() }
  private buzzT = 0
  private heartT = 0
  private clopT = 0
  private dustT = 0
  private puffs: { s: THREE.Sprite; v: THREE.Vector3; life: number; size: number }[] = []
  private from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  // input
  private keys = new Set<string>()
  private capeHeld = false
  private lastTap = { code: '', at: 0 }
  private joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }
  private look = { id: -1, x: 0, y: 0 }
  private armedAt = 0
  private el = {
    root: document.getElementById('corrida')!,
    hearts: document.querySelector<HTMLElement>('#corrida .co-hearts b')!,
    bullName: document.querySelector<HTMLElement>('#corrida .co-bull b')!,
    bullBar: document.querySelector<HTMLElement>('#corrida .co-bull u')!,
    bullBox: document.querySelector<HTMLElement>('#corrida .co-bull')!,
    score: document.querySelector<HTMLElement>('#corrida .fl-score b')!,
    best: document.querySelector<HTMLElement>('#corrida .fl-best')!,
    msg: document.querySelector<HTMLElement>('#corrida .fl-msg')!,
    arrow: document.querySelector<HTMLElement>('#corrida .fl-arrow')!,
    stamp: document.querySelector<HTMLElement>('#corrida .co-stamp')!,
    skip: document.querySelector<HTMLElement>('#corrida .co-skip')!,
    hit: document.querySelector<HTMLElement>('#corrida .co-hit')!,
    danger: document.querySelector<HTMLElement>('#corrida .co-danger')!,
    blindfold: document.getElementById('blindfold')!,
    fade: document.getElementById('fade')!,
    stick: document.getElementById('stick')!,
    knob: document.getElementById('knob')!,
  }
  /** The band in the ring (main swaps the village music for it, see `onMusic`). */
  readonly band = new PasoDoble()
  /** Called with true as you come into the ring, false when you're back in the village. */
  onMusic: (arena: boolean) => void = () => {}
  /** Called once you're back by the matadors in the village. */
  onDone: () => void = () => {}
  /** A line for the village toast when you're back. */
  say: (text: string) => void = () => {}
  private result: 'won' | 'lost' | 'left' = 'left'
  private winner = ''

  constructor(
    private renderer: THREE.WebGLRenderer,
    private camera: THREE.PerspectiveCamera,
    private player: Player,
    private vm: Viewmodel,
    private matadors: Matadors,
  ) {
    addEventListener('keydown', (e) => {
      if (!this.active || e.metaKey || e.ctrlKey || e.code === 'Escape') return
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault()
      if (e.timeStamp < this.armedAt) return
      if (e.code === 'KeyQ') return this.leave()
      if (this.paused) return this.unpause()
      if (e.code === 'Enter' || (e.code === 'Space' && this.cutscene)) return this.skip()
      if (e.repeat) return
      this.keys.add(e.code)
      if (e.code === 'Space') this.jump()
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dodge()
      if (e.code === 'KeyF') this.capeHeld = true
      // double-tap A or D: a side-jump that way
      if (e.code === 'KeyA' || e.code === 'KeyD') {
        if (this.lastTap.code === e.code && e.timeStamp - this.lastTap.at < 260) this.dodge(e.code === 'KeyA' ? -1 : 1)
        this.lastTap = { code: e.code, at: e.timeStamp }
      }
    })
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
      if (e.code === 'KeyF') this.capeHeld = false
    })
    addEventListener('blur', () => {
      this.keys.clear()
      this.capeHeld = false
      if (this.active && (this.state === 'fight' || this.state === 'boss' || this.state === 'between')) this.pause()
    })
    document.addEventListener('mousemove', (e) => {
      if (!this.active || touch || !this.free) return
      const k = (this.player.locked ? 0.0022 : 0.0035) * this.player.sens
      this.turn(e.movementX, e.movementY, k)
    })
    document.addEventListener('mousedown', (e) => {
      if (!this.active || (e.target as HTMLElement).closest('button')) return
      this.player.lock()
      if (this.paused) return this.unpause()
      if (e.button === 0) this.capeHeld = true
      if (e.button === 2) this.dodge()
    })
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.capeHeld = false
    })
    document.addEventListener('contextmenu', (e) => {
      if (this.active) e.preventDefault()
    })
    // touch: left thumb walks, drag on the right to look
    document.addEventListener('pointerdown', (e) => {
      if (!this.active || e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return
      if (this.paused) return this.unpause()
      if (this.cutscene) return this.skip()
      if (e.clientX < innerWidth * 0.45 && this.joy.id < 0) {
        this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 }
        this.el.stick.style.left = `${e.clientX}px`
        this.el.stick.style.top = `${e.clientY}px`
        this.el.stick.classList.add('on')
        this.el.knob.style.transform = ''
      } else if (this.look.id < 0) this.look = { id: e.pointerId, x: e.clientX, y: e.clientY }
    })
    document.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.ox
        let dy = e.clientY - this.joy.oy
        const len = Math.hypot(dx, dy)
        if (len > 50) {
          dx = (dx / len) * 50
          dy = (dy / len) * 50
        }
        this.joy.x = dx / 50
        this.joy.y = dy / 50
        this.el.knob.style.transform = `translate(${dx}px, ${dy}px)`
      } else if (e.pointerId === this.look.id) {
        if (this.free) this.turn(e.clientX - this.look.x, e.clientY - this.look.y, 0.0055)
        this.look.x = e.clientX
        this.look.y = e.clientY
      }
    })
    const lift = (e: PointerEvent) => {
      if (e.pointerId === this.joy.id) {
        this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }
        this.el.stick.classList.remove('on')
      }
      if (e.pointerId === this.look.id) this.look.id = -1
    }
    document.addEventListener('pointerup', lift)
    document.addEventListener('pointercancel', lift)
    const hold = (id: string, down: () => void, up = () => {}) => {
      const b = document.getElementById(id)!
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        down()
      })
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, up)
    }
    hold('co-cape', () => (this.capeHeld = true), () => (this.capeHeld = false))
    hold('co-jump', () => this.jump())
    hold('co-left', () => this.dodge(-1))
    hold('co-right', () => this.dodge(1))
    document.getElementById('corrida-exit')!.addEventListener('click', () => this.leave())
    this.el.skip.addEventListener('click', () => this.skip())
  }

  /** Build Madrid ahead of time (it takes a moment), and compile its shaders. */
  prepare() {
    if (this.world) return
    const w = (this.world = buildArena())
    this.ferdinand = new Bull({ coat: FERDINAND.coat, belly: FERDINAND.belly, scale: FERDINAND.scale, ferdinand: true })
    this.ferdinand.group.visible = false
    this.bulls = BULLS.map((b) => new Bull({ coat: b.coat, belly: b.belly, scale: b.scale }))
    for (const b of this.bulls) {
      b.group.visible = false
      w.scene.add(b.group)
    }
    this.flowers = buildFlowerRain(w.scene)
    this.bee.visible = this.bouquet.visible = false
    this.bee.scale.setScalar(1.8)
    this.bouquet.scale.setScalar(1.6)
    w.scene.add(this.ferdinand.group, this.bee, this.bouquet)
    const dust = glowTexture('rgba(220,180,120,0.9)', 'rgba(220,180,120,0)')
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dust, transparent: true, depthWrite: false }))
      s.visible = false
      w.scene.add(s)
      this.puffs.push({ s, v: new THREE.Vector3(), life: 0, size: 1 })
    }
    this.renderer.compile(w.scene, this.camera)
  }

  shadows(on: boolean) {
    if (this.world) this.world.sun.castShadow = on && !touch
  }

  /** You said yes: the middle matador comes over with the blindfold. */
  start() {
    if (this.active) return
    this.prepare()
    this.active = true
    this.state = 'blind'
    this.stateT = 0
    this.onceSet.clear()
    this.armedAt = performance.now() + 200
    this.keys.clear()
    this.capeHeld = false
    this.score = this.combo = 0
    this.hearts = HEARTS
    this.result = 'left'
    this.zoom = this.walk
    this.paused = false
    this.hookSaid.clear()
    this.from.pos.copy(this.camera.position)
    this.from.quat.copy(this.camera.quaternion)
    this.el.root.hidden = false
    this.el.root.className = 'cut'
    this.el.msg.hidden = true
    this.el.stamp.textContent = ''
    this.el.skip.hidden = true
    this.el.blindfold.className = ''
    this.el.blindfold.style.setProperty('--gap', '0')
  }

  /** For poking at from the console: `jul.corrida.jumpTo(2)` starts the fight with bull 3, `jumpTo(3)` Ferdinand. */
  jumpTo(bull: number) {
    if (!this.active) this.start()
    this.startRide()
    this.startReveal()
    this.el.root.className = ''
    this.renderer.domElement.style.filter = ''
    if (bull >= BULLS.length) return this.startFerdinand()
    this.state = 'fight'
    this.stateT = 0
    this.bullNo = bull
    this.spawn(BULLS[bull])
  }

  /** Bail out (Q / Esc / the button): fade back to the village. */
  leave() {
    if (!this.active || this.state === 'fade') return
    if (this.state === 'blind') return this.land()
    this.toFade()
  }

  private toFade() {
    this.state = 'fade'
    this.stateT = 0
    this.el.fade.classList.add('on')
  }

  /** Cutscenes: you only watch. */
  private get cutscene() {
    return this.state === 'blind' || this.state === 'ride' || this.state === 'ferdinand'
  }

  /** You can look about (in the ring, not tossed in the air). */
  private get free() {
    return (this.state === 'reveal' || this.state === 'fight' || this.state === 'between' || this.state === 'boss' || this.state === 'won' || this.state === 'lost') && this.toss.t < 0
  }

  private get fighting() {
    return (this.state === 'fight' || this.state === 'boss' || this.state === 'between') && this.toss.t < 0
  }

  private skip() {
    if (this.state === 'ride' && this.seen & 1) this.startReveal()
    else if (this.state === 'ferdinand' && this.seen & 2) this.startBoss()
  }

  private once(key: string, cond: boolean) {
    if (!cond || this.onceSet.has(key)) return false
    this.onceSet.add(key)
    return true
  }

  private markSeen(bit: number) {
    this.seen |= bit
    try {
      localStorage.setItem(SEEN_KEY, String(this.seen))
    } catch {
      /* fine */
    }
  }

  private turn(dx: number, dy: number, k: number) {
    this.yaw -= dx * k
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.2, 1.0)
  }

  private get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
  }

  private get right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
  }

  /** Where the cloth is, on the sand. */
  private capePoint() {
    return this.pos.clone().addScaledVector(this.right, CAPE.right).addScaledVector(this.forward, CAPE.ahead)
  }

  /* ---------- the frame ---------- */

  private paused = false

  private pause() {
    this.paused = true
    this.message(touch ? 'Pausat – tryck för att fortsätta' : 'Pausat – klicka för att fortsätta', 999)
  }

  private unpause() {
    this.paused = false
    this.message('', 0)
  }

  update(dt: number, t: number) {
    if (!this.active) return
    if (this.paused) return
    this.stateT += dt
    const s = this.state
    if (s === 'blind') return this.updateBlind(dt)
    if (s === 'ride') this.updateRide(dt, t)
    else if (s === 'reveal') this.updateReveal(dt, t)
    else if (s === 'fight' || s === 'boss' || s === 'between') this.updateFight(dt, t)
    else if (s === 'ferdinand') this.updateFerdinand(dt, t)
    else if (s === 'won' || s === 'lost') this.updateOver(dt, t)
    else if (s === 'fade' && this.stateT > 0.55) return this.land()
    this.world!.update(t, dt, this.state === 'ride' ? this.world!.carriage.position : new THREE.Vector3())
    this.updatePuffs(dt)
    if (this.msgTimer > 0 && (this.msgTimer -= dt) <= 0) this.el.msg.hidden = true
    this.syncHud()
  }

  /* ---------- in the village: the blindfold ---------- */

  private blindPath = { from: new THREE.Vector3(), to: new THREE.Vector3() }

  private updateBlind(dt: number) {
    const k = this.stateT
    const m = this.matadors.crew[1]
    if (this.once('walk', true)) {
      m.leaning = false
      // (the other two stop where they are, and the bubble goes)
      this.matadors.out = false
      this.matadors.bubble.visible = false
      const eye = this.from.pos
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.from.quat).setY(0).normalize()
      this.blindPath.from.copy(m.group.position)
      this.blindPath.to.set(eye.x + f.x * 1.05, 0, eye.z + f.z * 1.05)
      this.message('🕶️ ¡Vamos, amigo! Blunda nu…', 2.2)
    }
    // he pushes off the wall and strolls over, then lifts the cloth up to your eyes
    const w = THREE.MathUtils.smoothstep(k, 0.1, 1.3)
    m.group.position.lerpVectors(this.blindPath.from, this.blindPath.to, w)
    const to = this.from.pos.clone().sub(m.group.position)
    m.group.rotation.set(0, Math.atan2(to.x, to.z), 0)
    if (w < 1) m.walkPose(k * 11, 1)
    else {
      m.walkPose(0, 0)
      m.holdUp(THREE.MathUtils.smoothstep(k, 1.3, 1.8))
    }
    // you look at him (the village sets the camera every frame, so blend from where you were)
    const face = m.group.position.clone().setY(1.55)
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.from.pos, face, new THREE.Vector3(0, 1, 0)))
    this.camera.position.copy(this.from.pos)
    this.camera.quaternion.slerpQuaternions(this.from.quat, q, THREE.MathUtils.smoothstep(k, 0, 1.0))
    if (this.once('cloth', k > 1.6)) {
      this.el.blindfold.classList.add('on')
      whoosh()
    }
    if (this.msgTimer > 0 && (this.msgTimer -= dt) <= 0) this.el.msg.hidden = true
    if (k > 2.4) this.startRide()
  }

  /* ---------- the ride: a cart to Madrid, seen under the blindfold ---------- */

  private startRide() {
    const w = this.world!
    this.state = 'ride'
    this.stateT = 0
    this.inWorld = true
    for (const m of this.matadors.crew) m.group.visible = false
    this.matadors.bubble.visible = false
    w.carriage.visible = true
    w.carriage.position.set(0, 0, ROAD.from)
    w.carriage.rotation.set(0, 0, 0)
    w.setMood(0)
    this.yaw = 0
    this.pitch = -0.15
    this.el.skip.hidden = !(this.seen & 1)
    this.el.skip.textContent = touch ? 'Tryck för att hoppa över' : 'Enter hoppar över'
  }

  /** How far the blindfold has slipped (0 shut … 1 open) at time `k` of the ride. */
  private gapAt(k: number) {
    const open = (a: number, b: number, h: number) => h * THREE.MathUtils.smoothstep(k, a, a + 0.35) * (1 - THREE.MathUtils.smoothstep(k, b - 0.35, b))
    return open(1.4, 3.1, 0.3) + open(4.3, 6.7, 0.34) + open(7.7, 9.7, 0.4)
  }

  private updateRide(dt: number, t: number) {
    const w = this.world!
    const k = this.stateT
    const c = w.carriage
    // trot along the road towards the ring
    const v = k < RIDE - 0.8 ? RIDE_V : RIDE_V * Math.max(0, (RIDE - k) / 0.8)
    c.position.z -= v * dt
    w.roll(v * dt)
    w.horse.trot(k * 9, Math.min(1, v / RIDE_V))
    if ((this.clopT -= dt) <= 0 && v > 1) {
      this.clopT = 0.17
      clop(k > 9.7 ? 0.35 : 0.16)
    }
    if ((this.heartT -= dt) <= 0) {
      this.heartT = 0.9 - k * 0.03
      heartbeat(0.08 + k * 0.012)
    }
    if (this.once('crowd1', k > 6.2)) crowd(3, 0.25)
    if (this.once('crowd2', k > 8.2)) crowd(3.5, 0.5)
    // your head: rocked by the cart, and turning to whatever you glimpse
    const seat = c.localToWorld(new THREE.Vector3(0, 2.15, 0.85))
    // (what shows is under the cloth, at the bottom of your view – so you peek by tipping your head back)
    let wantYaw = 0
    let wantPitch = 0.12
    if (k > 4.1 && k < 6.9) {
      // the bull under the cork tree, low in your view where the cloth has slipped
      const d = seat.clone().sub(CAMEO)
      wantYaw = Math.atan2(d.x, d.z)
      wantPitch = Math.atan2(1.0 - seat.y, Math.hypot(d.x, d.z)) + 0.45
    } else if (k > 7.5) wantPitch = 0.42
    this.yaw = damp(this.yaw, wantYaw, 2.2, dt)
    this.pitch = damp(this.pitch, wantPitch, 2.2, dt)
    const jolt = Math.sin(k * 17) * 0.025 + Math.sin(k * 5.3) * 0.015
    this.camera.position.copy(seat).setY(seat.y + jolt)
    this.camera.rotation.set(this.pitch + jolt * 0.6, this.yaw + Math.sin(k * 2.1) * 0.03, Math.sin(k * 3.7) * 0.025, 'YXZ')
    // the blindfold: shut, slipping, and a blurry bright world under it
    const gap = this.gapAt(k) * (1 + Math.sin(k * 23) * 0.06)
    this.el.blindfold.style.setProperty('--gap', gap.toFixed(3))
    this.renderer.domElement.style.filter = `blur(${(9 + Math.sin(k * 1.7) * 2).toFixed(1)}px) brightness(1.35) saturate(0.8)`
    // the opening caption, typed
    const lines = 'PLAZA DE TOROS · MADRID\nSpanien, 1936\nKl. 12:00 · 34 °C i skuggan'
    const n = Math.floor(THREE.MathUtils.clamp((k - 0.9) * 26, 0, lines.length))
    const text = lines.slice(0, n) + (n < lines.length && Math.floor(k * 6) % 2 ? '▌' : '')
    if (this.el.stamp.textContent !== text) this.el.stamp.textContent = text
    if (k > 9.4) this.el.stamp.classList.add('out')
    if (k >= RIDE) this.startReveal()
    void t
  }

  /* ---------- the blindfold comes off: noon in the ring ---------- */

  private startReveal() {
    const w = this.world!
    this.markSeen(1)
    this.state = 'reveal'
    this.stateT = 0
    w.carriage.visible = false
    this.el.stamp.textContent = ''
    this.el.stamp.classList.remove('out')
    this.el.skip.hidden = true
    this.el.blindfold.className = 'off'
    this.pos.set(0, 0, RING_R - 3)
    this.vel.set(0, 0, 0)
    this.y = this.vy = 0
    this.yaw = 0
    this.pitch = 0.05
    this.toss.t = -1
    this.invuln = 0
    this.bullNo = 0
    this.bull = null
    w.openToril(0)
    w.setMood(2)
    crowd(4.5, 0.9)
    whoosh()
    this.onMusic(true)
  }

  private updateReveal(dt: number, t: number) {
    const k = this.stateT
    const blur = 14 * (1 - THREE.MathUtils.smoothstep(k, 0.1, 1.4))
    const bright = 1 + 1.4 * (1 - THREE.MathUtils.smoothstep(k, 0, 1.6))
    this.renderer.domElement.style.filter = blur > 0.1 || bright > 1.01 ? `blur(${blur.toFixed(1)}px) brightness(${bright.toFixed(2)})` : ''
    if (this.once('hola', k > 0.6)) this.message('¡Olé! Välkommen till Madrid 🇪🇸', 1.8)
    if (this.once('mood', k > 2.0)) this.world!.setMood(1)
    if (this.once('howto', k > 2.4)) this.message(touch ? 'Håll 🟥 för skynket – låt tjuren springa förbi!' : 'Håll musknappen för skynket – låt tjuren springa förbi!', 2.6)
    if (k > 1) this.movePlayer(dt, t)
    else this.placeCamera(dt, t)
    this.vm.matador(true, t, { raise: this.raise })
    if (k > 3.6) {
      this.el.root.className = ''
      this.state = 'fight'
      this.stateT = 0
      this.spawn(BULLS[0])
    }
  }

  /* ---------- you, on the sand ---------- */

  private jump() {
    if (!this.fighting && this.state !== 'won' && this.state !== 'reveal') return
    if (this.y > 0.01) return
    this.vy = JUMP_V
    whoosh()
  }

  /** A quick side-jump: the way you're walking, else away from the bull's line, else to the right. */
  private dodge(side = 0) {
    if (!this.fighting || this.dash.cool > 0) return
    let dir: THREE.Vector3
    const r = this.right
    if (side) dir = r.multiplyScalar(side)
    else {
      const move = this.moveInput()
      if (move.lengthSq() > 0.01) dir = move.normalize()
      else if (this.bull && this.bull.mode === 'charge') {
        const b = this.bull
        const bd = new THREE.Vector3(Math.sin(b.heading), 0, Math.cos(b.heading))
        const rel = this.pos.clone().sub(b.pos)
        const cross = rel.x * bd.z - rel.z * bd.x
        dir = new THREE.Vector3(bd.z, 0, -bd.x).multiplyScalar(cross >= 0 ? 1 : -1)
      } else dir = r
    }
    this.dash = { t: DASH.time, x: dir.x, z: dir.z, cool: DASH.cool }
    whoosh()
  }

  private moveInput() {
    const k = (c: string) => this.keys.has(c)
    const fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) - this.joy.y
    const side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + this.joy.x
    const dir = this.forward.multiplyScalar(fwd).add(this.right.multiplyScalar(side))
    if (dir.lengthSq() > 1) dir.normalize()
    return dir
  }

  private movePlayer(dt: number, t: number) {
    this.dash.cool -= dt
    this.invuln -= dt
    this.raise = damp(this.raise, this.capeHeld && this.toss.t < 0 ? 1 : 0, 14, dt)
    this.whip = Math.max(0, this.whip - dt * 1.6)
    if (this.toss.t >= 0) return this.updateToss(dt, t)
    const want = this.moveInput().multiplyScalar(THREE.MathUtils.lerp(5.2, 3.2, this.raise))
    this.vel.lerp(want, 1 - Math.exp(-12 * dt))
    this.pos.addScaledVector(this.vel, dt)
    if (this.dash.t > 0) {
      const k = 1 - this.dash.t / DASH.time
      const v = (DASH.dist / DASH.time) * 2 * (1 - k)
      this.pos.x += this.dash.x * v * dt
      this.pos.z += this.dash.z * v * dt
      this.dash.t -= dt
    }
    if (this.y > 0 || this.vy > 0) {
      this.y += this.vy * dt
      this.vy -= GRAVITY * dt
      if (this.y <= 0) {
        this.y = this.vy = 0
        clop(0.3)
      }
    }
    this.keepInRing(this.pos, 0.6)
    // you can't walk through a bull
    const b = this.bull
    if (b && b.model.group.visible) {
      const s = b.spec.scale ?? 1
      const dx = this.pos.x - b.pos.x
      const dz = this.pos.z - b.pos.z
      const d = Math.hypot(dx, dz)
      const min = 0.95 * s
      if (d < min && d > 1e-4 && this.y < CLEAR) {
        this.pos.x = b.pos.x + (dx / d) * min
        this.pos.z = b.pos.z + (dz / d) * min
      }
    }
    this.placeCamera(dt, t)
  }

  private keepInRing(p: THREE.Vector3, pad: number) {
    const r = Math.hypot(p.x, p.z)
    const max = RING_R - pad
    if (r > max) {
      p.x *= max / r
      p.z *= max / r
      return true
    }
    return false
  }

  /** The field of view the camera eases to (narrower to close in on Ferdinand). */
  private zoom = 70
  private get walk() {
    return walkFov(this.camera.aspect)
  }

  private placeCamera(dt: number, t: number) {
    if (Math.abs(this.camera.fov - this.zoom) > 0.05) {
      this.camera.fov = damp(this.camera.fov, this.zoom, 2.5, dt)
      this.camera.updateProjectionMatrix()
    }
    const speed = Math.hypot(this.vel.x, this.vel.z)
    this.bob += dt * speed * 2.2
    const bob = this.y > 0 ? 0 : Math.sin(this.bob) * 0.04 * Math.min(1, speed / 4)
    this.roll = damp(this.roll, this.dash.t > 0 ? -(this.dash.x * this.right.x + this.dash.z * this.right.z) * 0.14 : 0, 10, dt)
    const sh = this.shake
    this.camera.position.set(this.pos.x, EYE + this.y + bob, this.pos.z)
    this.camera.rotation.set(this.pitch + Math.sin(t * 37) * 0.006 * sh, this.yaw + Math.sin(t * 29) * 0.006 * sh, this.roll, 'YXZ')
  }

  /** Gored: up in the air, round you go, down in the sand. */
  private gore(b: Ai) {
    const dir = new THREE.Vector3(Math.sin(b.heading), 0, Math.cos(b.heading))
    this.toss = { t: 0, from: this.pos.clone(), dir, spin: Math.random() < 0.5 ? -1 : 1 }
    this.hearts--
    this.combo = 0
    b.hit = true
    b.passed = true
    b.overT = 0
    this.capeHeld = false
    thud()
    snort(0.5)
    crowd(1.6, 0.6, 0.7)
    this.el.hit.classList.remove('on')
    void this.el.hit.offsetWidth
    this.el.hit.classList.add('on')
    this.message(this.hearts > 0 ? 'AJ! 🤕 Rakt på hornen!' : 'AJ! 🤕', 1.4)
  }

  private updateToss(dt: number, t: number) {
    const T = 1.1
    this.toss.t += dt
    const k = Math.min(1, this.toss.t / T)
    const e = THREE.MathUtils.smootherstep(k, 0, 1)
    this.pos.copy(this.toss.from).addScaledVector(this.toss.dir, e * 3.5)
    this.keepInRing(this.pos, 0.6)
    this.y = Math.sin(k * Math.PI) * 2.2
    this.vel.set(0, 0, 0)
    this.camera.position.set(this.pos.x, EYE * (k < 0.85 ? 1 : 0.6) + this.y, this.pos.z)
    this.camera.rotation.set(this.pitch + Math.sin(k * Math.PI) * 0.9, this.yaw, this.toss.spin * Math.sin(k * Math.PI) * 1.4 + Math.sin(t * 40) * 0.02 * (1 - k), 'YXZ')
    if (k >= 1) {
      this.toss.t = -1
      this.y = 0
      this.invuln = 1.8
      thud()
      this.dustAt(this.pos.clone().setY(0.2), 6, 1.5)
      if (this.hearts <= 0) this.lose()
    }
  }

  /* ---------- the bulls ---------- */

  private spawn(spec: Spec) {
    for (const m of this.bulls) m.group.visible = false
    const model = spec.ferdinand ? this.ferdinand! : this.bulls[BULLS.indexOf(spec)]
    model.stand()
    model.group.visible = true
    model.setAngry(spec.ferdinand ? 1 : 0.3)
    model.setTired(false)
    this.bull = {
      spec,
      model,
      pos: new THREE.Vector3(0, 0, -RING_R - 1.5),
      heading: 0,
      speed: 0,
      mode: 'enter',
      modeT: 0,
      stamina: spec.time,
      elapsed: 0,
      phase: 0,
      tele: spec.tele,
      lured: false,
      ignoreCape: false,
      committed: false,
      hookAt: null,
      passed: false,
      hit: false,
      feinted: false,
      minLat: 99,
      maxY: 0,
      overT: 0,
      y: 0,
      stepAt: 0,
    }
    if (!spec.ferdinand) {
      fanfare()
      this.message(`🐂 Tjur ${this.bullNo + 1} av 3: ${spec.name}!`, 2)
    }
    this.el.bullName.textContent = spec.name
    snort(0.5)
  }

  private setMode(b: Ai, m: Mode) {
    b.mode = m
    b.modeT = 0
  }

  private updateFight(dt: number, t: number) {
    const w = this.world!
    this.movePlayer(dt, t)
    this.vm.matador(true, t, { raise: this.raise, whip: this.whip })
    if (this.moodT > 0 && (this.moodT -= dt) <= 0) w.setMood(1)
    const b = this.bull
    // the gate: open while a bull comes in or goes out
    const gateOpen = b && ((b.mode === 'enter' && b.modeT < 2) || b.mode === 'leave')
    this.torilK = damp(this.torilK, gateOpen ? 1 : 0, 4, dt)
    w.openToril(this.torilK)
    if (this.state === 'between') {
      if (this.stateT > 1.6) {
        this.state = 'fight'
        this.stateT = 0
        this.bullNo++
        this.spawn(BULLS[this.bullNo])
      }
      this.danger(null)
      return
    }
    if (b) this.updateBull(b, dt, t)
    if (this.state === 'boss') this.updateBee(dt, t)
  }

  private torilK = 0
  /** Bulls that have shown you their hook (you get told once). */
  private hookSaid = new Set<string>()

  private updateBull(b: Ai, dt: number, t: number) {
    const s = b.spec
    const sc = s.scale ?? 1
    const crazy = !!s.ferdinand
    b.modeT += dt
    const dir = new THREE.Vector3(Math.sin(b.heading), 0, Math.cos(b.heading))
    const toward = (p: THREE.Vector3) => Math.atan2(p.x - b.pos.x, p.z - b.pos.z)
    const steer = (want: number, rate: number) => {
      const d = wrap(want - b.heading)
      b.heading += THREE.MathUtils.clamp(d, -rate * dt, rate * dt)
      return Math.abs(d)
    }
    const fightingMode = b.mode !== 'enter' && b.mode !== 'tired' && b.mode !== 'leave' && b.mode !== 'sit' && b.mode !== 'show'
    if (fightingMode && this.state !== 'lost') {
      b.elapsed += dt
      b.stamina -= dt
      if (b.stamina <= 0 && b.elapsed >= MIN_FIGHT && b.mode !== 'charge') return this.tire(b)
      b.stamina = Math.max(b.stamina, b.elapsed < MIN_FIGHT ? 0.5 : 0)
    }
    const lure = () => (this.raise > 0.6 && !b.ignoreCape ? this.capePoint() : this.pos.clone())
    const me = this.pos

    switch (b.mode) {
      case 'enter': {
        const spot = new THREE.Vector3(0, 0, -5)
        steer(toward(spot), 3)
        b.speed = damp(b.speed, 7, 3, dt)
        b.model.gallop((b.phase += b.speed * dt * 1.5), Math.min(1, b.speed / 6), 0.3)
        if (b.modeT < 0.1) this.dustAt(b.pos.clone().setY(0.5), 8, 2)
        if (b.pos.distanceTo(spot) < 2) this.setMode(b, 'stalk')
        break
      }
      case 'stalk': {
        // trots a little closer, sizing you up
        steer(toward(me), 2.2)
        b.speed = damp(b.speed, crazy ? 3 : 1.6, 3, dt)
        b.model.gallop((b.phase += b.speed * dt * 2.2), 0.4, 0.2)
        if (b.modeT > s.stalk) this.startPaw(b)
        break
      }
      case 'paw': {
        // the telegraph: head down, a hoof scraping, dust, a snort
        b.speed = damp(b.speed, 0, 8, dt)
        steer(toward(lure()), crazy ? 4 : 2.5)
        b.model.paw(t)
        if ((this.dustT -= dt) <= 0) {
          this.dustT = 0.22
          this.dustAt(b.pos.clone().addScaledVector(dir, 0.6 * sc).setY(0.1), 1, 0.8)
          clop(this.volAt(b.pos, 0.25))
        }
        if (b.modeT >= b.tele) {
          this.setMode(b, 'charge')
          b.lured = this.raise > 0.6 && !b.ignoreCape
          b.committed = b.passed = b.hit = b.feinted = false
          b.hookAt = null
          b.minLat = 99
          b.maxY = 0
          b.overT = 0
          snort(this.volAt(b.pos, 0.6))
          this.world!.setMood(1)
        }
        break
      }
      case 'charge': {
        b.speed = Math.min(s.speed, b.speed + (crazy ? 22 : 16) * dt)
        const target = lure()
        // it turns towards the cloth (or you) – but only so fast, and not at all in the last few metres
        if (!b.passed) {
          if (!b.committed && b.pos.distanceTo(target) < s.commit) {
            b.committed = true
            // the hook: going for the cloth, he jerks his horns over towards where you stand
            if (b.lured && s.hook > 0) {
              b.hookAt = target.clone().lerp(me, s.hook)
              if (!this.hookSaid.has(s.name)) {
                this.hookSaid.add(s.name)
                this.message(`↪ ${s.name} krokar mot dig – kliv bort från skynket!`, 1.6)
              }
            }
          }
          if (b.hookAt) steer(toward(b.hookAt), s.turn * 1.5 + 0.6)
          if (!b.committed) {
            let want = toward(target)
            if (crazy && b.pos.distanceTo(target) > 5) want += Math.sin(b.modeT * 6.5) * 0.5
            steer(want, s.turn)
            b.lured = this.raise > 0.6 && !b.ignoreCape
          }
          // Ferdinand: sometimes stops dead halfway, then goes again
          const dMe = b.pos.distanceTo(me)
          if (crazy && !b.feinted && dMe < 8 && dMe > 5) {
            b.feinted = true
            if (Math.random() < 0.3) return this.setMode(b, 'feint')
          }
        }
        b.model.gallop((b.phase += b.speed * dt * 1.25), 1, 1)
        this.hoofbeats(b, dt)
        // past you?
        const rel = me.clone().sub(b.pos)
        const ahead = rel.dot(dir)
        const lat = Math.abs(rel.x * dir.z - rel.z * dir.x)
        if (!b.passed && ahead > -0.6 && ahead < 4) {
          b.minLat = Math.min(b.minLat, lat)
          if (ahead < 1.6) b.maxY = Math.max(b.maxY, this.y)
        }
        if (!b.passed && !b.hit && this.invuln <= 0 && this.dash.t <= 0 && this.y < CLEAR && this.toss.t < 0) {
          // the horns: a short segment out in front of the head
          const a = b.pos.clone().addScaledVector(dir, 0.2 * sc)
          const tip = b.pos.clone().addScaledVector(dir, 1.35 * sc)
          if (this.segDist(me, a, tip) < 0.42 * sc + 0.28) this.gore(b)
        }
        if (!b.passed && (ahead < -0.6 || b.pos.distanceTo(target) > 30)) {
          b.passed = true
          if (!b.hit) this.judgePass(b)
        }
        if (b.passed && (b.overT += dt) > (crazy ? 0.2 : 0.3)) this.setMode(b, 'skid')
        break
      }
      case 'feint': {
        b.speed = damp(b.speed, 0, 9, dt)
        b.model.paw(t * 1.5)
        if (b.modeT < 0.05) {
          this.dustAt(b.pos.clone().addScaledVector(dir, 0.8 * sc).setY(0.2), 5, 1.4)
          this.message('Ferdinand tvärnitar… 😈', 1)
        }
        if (b.modeT > 0.45) {
          b.tele = 0.3
          this.setMode(b, 'paw')
        }
        break
      }
      case 'skid': {
        b.speed = damp(b.speed, 0, 5, dt)
        b.model.gallop((b.phase += b.speed * dt * 1.25), Math.min(1, b.speed / 6), 0.4)
        if ((this.dustT -= dt) <= 0) {
          this.dustT = 0.12
          this.dustAt(b.pos.clone().setY(0.2), 1, 1.2)
        }
        if (b.speed < 3) this.setMode(b, 'turn')
        break
      }
      case 'turn': {
        b.speed = damp(b.speed, 1.5, 4, dt)
        const off = steer(toward(me), crazy ? 4.5 : 2.8 + s.turn)
        b.model.gallop((b.phase += 3 * dt * 2), 0.5, 0.3)
        if (crazy) b.y = Math.max(0, Math.sin(b.modeT * 9)) * 0.35
        if (off < 0.25 || b.modeT > 2) {
          b.y = 0
          // the mad one doesn't always stop to paw
          if (Math.random() < s.recharge) {
            b.tele = 0.2
            this.setMode(b, 'paw')
          } else this.startPaw(b, 0.85)
        }
        break
      }
      case 'tired': {
        b.speed = damp(b.speed, 0, 3, dt)
        b.model.tired(t)
        if (b.modeT > 2.0) this.setMode(b, 'leave')
        break
      }
      case 'leave': {
        const gate = new THREE.Vector3(0, 0, -RING_R - 2)
        steer(toward(gate), 2)
        b.speed = damp(b.speed, 4.5, 2, dt)
        b.model.gallop((b.phase += b.speed * dt * 1.8), 0.6, 0.6)
        b.model.setTired(true)
        if (b.pos.z < -RING_R - 0.8) this.gone(b)
        break
      }
      case 'sit': {
        b.speed = damp(b.speed, 0, 4, dt)
        b.model.sit(THREE.MathUtils.smoothstep(b.modeT, 0.2, 1.2))
        break
      }
      case 'show':
        break
    }

    // move, and the barrier
    b.pos.addScaledVector(new THREE.Vector3(Math.sin(b.heading), 0, Math.cos(b.heading)), b.speed * dt)
    if (b.mode !== 'enter' && b.mode !== 'leave' && this.keepInRing(b.pos, 1.3 * sc)) {
      if (b.mode === 'charge' && b.speed > 5) {
        thud()
        this.dustAt(b.pos.clone().setY(0.6), 6, 1.6)
        b.stamina -= 1
        b.speed *= 0.3
        if (!b.passed) {
          b.passed = true
          if (!b.hit) this.judgePass(b)
        }
        this.setMode(b, 'turn')
      }
    }
    b.model.group.position.set(b.pos.x, b.y, b.pos.z)
    b.model.group.rotation.y = b.heading
    this.danger(b)
  }

  private startPaw(b: Ai, k = 1) {
    b.tele = b.spec.tele * k * (0.85 + Math.random() * 0.3)
    b.ignoreCape = Math.random() < b.spec.ignore
    // his eyes go red when he's after you and not the cloth
    b.model.setAngry(b.ignoreCape || b.spec.ferdinand ? 1 : 0.3)
    if (b.ignoreCape && this.raise > 0.3) this.message(`😈 ${b.spec.name} struntar i skynket – han vill ha DIG!`, 1.4)
    this.setMode(b, 'paw')
    snort(this.volAt(b.pos, 0.45))
  }

  /** The bull went by: how close, over you or through the cloth? */
  private judgePass(b: Ai) {
    const lat = b.minLat
    const crazy = !!b.spec.ferdinand
    if (b.maxY > CLEAR && lat < 1.3) {
      this.combo++
      this.score += 150 * this.combo
      b.stamina -= 2 * b.spec.drain
      this.message(`🤸 ¡Salto! Rakt över ${crazy ? 'Ferdinand' : 'tjuren'}! +${150 * this.combo}`, 1.3)
      this.cheer(2)
    } else if (b.lured && this.raise > 0.4 && lat < 2.8) {
      this.combo++
      const pts = 100 * this.combo
      this.score += pts
      b.stamina -= 1.5 * b.spec.drain
      this.whip = 1
      this.message(this.combo > 1 ? `¡OLÉ! ×${this.combo}  +${pts}` : `¡Olé! +${pts}`, 1.1)
      this.cheer(this.combo > 2 ? 2 : 1.6)
    } else if (lat < 1.7) {
      this.score += 50
      this.message('Puh! Nära ögat 😅 +50', 1)
      crowd(1, 0.3)
    }
  }

  private cheer(level: number) {
    this.world!.setMood(level)
    crowd(1.4 + level * 0.5, 0.35 + level * 0.25)
    this.moodT = 2.2
  }
  private moodT = 0

  private tire(b: Ai) {
    if (b.spec.ferdinand) return this.calm(b)
    this.setMode(b, 'tired')
    b.model.setTired(true)
    b.model.setAngry(0)
    this.score += 300
    this.message(`😮‍💨 ${b.spec.name} orkar inte mer! +300`, 1.8)
    this.cheer(2)
  }

  /** A tired bull has trotted out through the gate. */
  private gone(b: Ai) {
    b.model.group.visible = false
    this.bull = null
    if (this.state === 'lost') return
    if (this.bullNo < BULLS.length - 1) {
      this.state = 'between'
      this.stateT = 0
    } else this.startFerdinand()
  }

  /** Hoofbeats, louder the closer he is. */
  private hoofbeats(b: Ai, dt: number) {
    b.stepAt -= dt * b.speed
    if (b.stepAt <= 0) {
      b.stepAt = 1.6
      const v = this.volAt(b.pos, 0.35)
      clop(v)
      setTimeout(() => clop(v * 0.8), 60)
    }
  }

  private volAt(p: THREE.Vector3, vol: number) {
    return vol * THREE.MathUtils.clamp(1.4 - p.distanceTo(this.pos) / 18, 0.15, 1)
  }

  private segDist(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
    const abx = b.x - a.x
    const abz = b.z - a.z
    const k = THREE.MathUtils.clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / (abx * abx + abz * abz), 0, 1)
    return Math.hypot(p.x - (a.x + abx * k), p.z - (a.z + abz * k))
  }

  /** Red at the edges when a charging bull is close – more so when he's out of sight – and an arrow to him. */
  private danger(b: Ai | null) {
    if (!b || !b.model.group.visible) {
      this.el.arrow.hidden = true
      this.el.danger.style.opacity = '0'
      return
    }
    const v = b.pos.clone().setY(1).applyMatrix4(this.camera.matrixWorldInverse)
    const ang = Math.atan2(v.x, -v.z)
    const off = Math.abs(ang) > 0.8
    this.el.arrow.hidden = !off
    if (off) {
      this.el.arrow.style.left = `${50 + Math.sin(ang) * 40}%`
      this.el.arrow.style.top = `${50 - Math.cos(ang) * 34}%`
      this.el.arrow.style.transform = `rotate(${ang - Math.PI / 2}rad)`
    }
    const d = b.pos.distanceTo(this.pos)
    const threat = b.mode === 'charge' && !b.passed ? THREE.MathUtils.clamp(1 - d / 14, 0, 1) * (off ? 1 : 0.45) : 0
    this.el.danger.style.opacity = threat.toFixed(2)
  }

  /* ---------- the finale: Ferdinand ---------- */

  private startFerdinand() {
    this.state = 'ferdinand'
    this.stateT = 0
    this.el.root.className = 'cut'
    this.el.skip.hidden = !(this.seen & 2)
    this.el.skip.textContent = touch ? 'Tryck för att hoppa över' : 'Enter hoppar över'
    this.capeHeld = false
    // (you're moved well clear of where he'll stop – you're looking at your hands, so it doesn't show)
    this.pos.set(0, 0, 8)
    this.vel.set(0, 0, 0)
    this.y = this.vy = 0
    this.yaw = 0
    this.world!.setMood(0)
  }

  private updateFerdinand(dt: number, t: number) {
    const w = this.world!
    const k = this.stateT
    const f = this.ferdinand!
    this.dash.cool = this.invuln = 0
    this.raise = damp(this.raise, 0, 8, dt)
    // the announcement
    if (this.once('fanfare', k > 0.2)) {
      this.band.level(0.06)
      fanfare()
      this.message('📣 Och nu… den mest fruktade tjuren i hela Spanien…', 2.2)
    }
    if (this.once('name', k > 2.2)) {
      this.band.level(0.22)
      this.message('📣 FERDINAAAND!', 1.8)
      this.cheer(2)
      crowd(4, 1)
    }
    // you look down at your hands, bite your nails and shiver
    this.bite = THREE.MathUtils.smoothstep(k, 0.9, 1.6) * (1 - THREE.MathUtils.smoothstep(k, 4.0, 4.6))
    this.shake = THREE.MathUtils.smoothstep(k, 0.6, 1.2) * (1 - THREE.MathUtils.smoothstep(k, 5, 7)) * 3 + (k > 10.6 && k < 12.1 ? 3 * (1 - (k - 10.6) / 1.5) : 0)
    if (this.once('nails', k > 2.6)) this.message('😬 *gnag gnag* …du biter på naglarna', 1.6)
    if (k < 9 && (this.heartT -= dt) <= 0) {
      this.heartT = 0.45
      heartbeat(0.12)
    }
    // he comes out of the gate, runs to the middle and stops
    const mid = new THREE.Vector3(0, 0, -2.5)
    if (this.once('out', k > 4.4)) {
      f.group.visible = true
      f.stand()
      f.setAngry(0)
      f.setTired(false)
      if (f.flower) f.flower.visible = true
      this.bull = null
      this.ferdPos.set(0, 0, -RING_R - 1.5)
      this.dustAt(new THREE.Vector3(0, 0.6, -RING_R + 1), 10, 2.5)
      snort(0.4)
    }
    this.torilK = damp(this.torilK, k > 4.1 && k < 6 ? 1 : 0, 4, dt)
    w.openToril(this.torilK)
    let fy = 0
    let heading = 0
    if (k > 4.4 && k < 6.6) {
      // a happy little gallop out to the middle
      const e = THREE.MathUtils.smoothstep(k, 4.4, 6.6)
      this.ferdPos.lerpVectors(new THREE.Vector3(0, 0, -RING_R - 1.5), mid, e)
      f.gallop(k * 11, 1 - e * 0.6, 0)
    } else if (k >= 6.6 && k < 8.2) {
      // looks round at all the people
      f.stand()
      f.head.rotation.y = Math.sin((k - 6.6) * 2.5) * 0.6
      heading = Math.sin((k - 6.6) * 1.2) * 0.5
    }
    if (this.once('hush', k > 6.8)) {
      this.band.level(0.02, 1.2)
      this.world!.setMood(0)
      this.message('…', 1)
    }
    // a lady in the front row throws him a bouquet
    if (this.once('throw', k > 7.0)) {
      this.toss2 = { t: 0, from: new THREE.Vector3(-9, 7, -RING_R - 6), to: mid.clone().add(new THREE.Vector3(0, 0, 1.6)) }
      this.bouquet.visible = true
      this.message('💐 En señora kastar en bukett…', 1.6)
    }
    this.flyBouquet(dt)
    if (k >= 8.2 && k < 9.6) {
      // and he smells it
      f.stand()
      f.neck.rotation.x = 0.7
      f.head.rotation.x = 0.4 + Math.sin(k * 6) * 0.05
      if (this.once('sniff', true)) {
        this.message('Ferdinand luktar på blommorna… 😌🌸', 1.6)
        crowd(2, 0.35, 1.3)
      }
    }
    // a bumblebee comes looking for the flowers too, and lands just behind him
    const beeSpot = this.ferdPos.clone().add(new THREE.Vector3(0, 0.08, -1.0 * FERDINAND.scale!))
    if (this.once('bee', k > 8.6)) this.bee.visible = true
    if (k > 8.6 && k < 10.0) {
      const e = THREE.MathUtils.smoothstep(k, 8.6, 9.8)
      this.bee.position.lerpVectors(new THREE.Vector3(6, 3, -6), beeSpot, e)
      this.bee.position.y += Math.sin(k * 14) * 0.15 * (1 - e)
      this.flap(t)
      if ((this.buzzT -= dt) <= 0) {
        this.buzzT = 0.1
        buzz(0.03)
      }
    }
    // he sits down. On the bee.
    if (k >= 9.6 && k < 10.6) f.sit(THREE.MathUtils.smoothstep(k, 9.6, 10.1))
    if (this.once('bzz', k > 10.6)) {
      this.message('🐝 BZZZT! Han satte sig på en humla!', 1.8)
      buzz(0.12)
      snort(0.8)
      thud()
      f.setAngry(1)
      if (f.flower) f.flower.visible = false
    }
    if (k >= 10.6 && k < 11.7) {
      // straight up in the air, spinning
      const e = (k - 10.6) / 1.1
      fy = Math.sin(e * Math.PI) * 2.6
      heading = e * Math.PI * 2
      f.gallop(k * 20, 1, 0.5)
      this.beeOrbit(t)
    }
    if (this.once('mad', k > 11.7)) {
      this.band.level(0.3, 0.3)
      this.dustAt(this.ferdPos.clone().setY(0.3), 10, 2.5)
      thud()
      this.message('FERDINAND HAR BLIVIT GALEN! 😱', 1.8)
      this.cheer(2)
    }
    if (k > 11.7) {
      f.paw(t)
      this.beeOrbit(t)
    }
    f.group.position.set(this.ferdPos.x, fy, this.ferdPos.z)
    if (k < 6.6) heading = Math.atan2(mid.x - this.ferdPos.x, mid.z - this.ferdPos.z) || 0
    f.group.rotation.y = heading
    // your eyes: down at your hands, then up at the gate, then on him
    const look = k < 4.0 ? null : k < 4.4 ? new THREE.Vector3(0, 1, -RING_R) : this.ferdPos.clone().setY(1 + fy)
    if (look) this.lookAt(look, dt, 3)
    else this.pitch = damp(this.pitch, -0.6, 2.5, dt)
    // and the camera closes in on him, like in the film
    this.zoom = k > 5 && k < 11.9 ? this.walk * 0.62 : this.walk
    this.placeCamera(dt, t)
    this.vm.matador(true, t, { raise: this.raise, bite: this.bite, shake: this.shake })
    if (k > 12.9) this.startBoss()
  }

  private ferdPos = new THREE.Vector3()

  private lookAt(p: THREE.Vector3, dt: number, rate: number) {
    const dx = p.x - this.pos.x
    const dz = p.z - this.pos.z
    const wantYaw = Math.atan2(-dx, -dz)
    const wantPitch = Math.atan2(p.y - EYE, Math.hypot(dx, dz))
    this.yaw += wrap(wantYaw - this.yaw) * (1 - Math.exp(-rate * dt))
    this.pitch = damp(this.pitch, wantPitch, rate, dt)
  }

  private flyBouquet(dt: number) {
    const b = this.toss2
    if (b.t < 0) return
    b.t += dt
    const k = Math.min(1, b.t / 1.1)
    this.bouquet.position.lerpVectors(b.from, b.to, k)
    this.bouquet.position.y += Math.sin(k * Math.PI) * 4
    this.bouquet.rotation.set(k * 9, 0, k * 4)
    if (k >= 1) {
      b.t = -1
      this.bouquet.position.copy(b.to)
      this.bouquet.rotation.set(Math.PI / 2, 0.4, 0)
      this.bouquet.position.y = 0.06
      clop(0.2)
    }
  }

  private flap(t: number) {
    for (const w of this.bee.userData.wings as THREE.Mesh[]) w.rotation.y = Math.sin(t * 90) * 0.6
  }

  /** The bee buzzing round his backside, stinging away. */
  private beeOrbit(t: number) {
    const f = this.ferdinand!.group
    const sc = FERDINAND.scale!
    const local = new THREE.Vector3(Math.sin(t * 7) * 0.7, 1.3 + Math.sin(t * 11) * 0.25, -1.15 + Math.cos(t * 7) * 0.35).multiplyScalar(sc)
    this.bee.position.copy(f.localToWorld(local))
    this.bee.lookAt(f.position.clone().setY(1.2))
    this.flap(t)
  }

  private updateBee(dt: number, t: number) {
    const b = this.bull
    if (!b || !b.spec.ferdinand) return
    if (b.mode === 'sit') {
      // off it goes, over the stands
      this.beeT += dt
      this.bee.position.add(new THREE.Vector3(1.5, 2.5, -1).multiplyScalar(dt * 3))
      this.flap(t)
      if (this.beeT > 3) this.bee.visible = false
      return
    }
    this.beeOrbit(t)
    if ((this.buzzT -= dt) <= 0) {
      this.buzzT = 0.11
      buzz(this.volAt(b.pos, 0.06))
    }
  }

  private startBoss() {
    const f = this.ferdinand!
    this.zoom = this.walk
    this.markSeen(2)
    this.state = 'boss'
    this.stateT = 0
    this.el.root.className = ''
    this.el.skip.hidden = true
    this.bite = this.shake = 0
    this.toss2.t = -1
    // (a skip lands here straight from the shivering: put everything where the scene leaves it)
    if (!f.group.visible) this.ferdPos.set(0, 0, -2.5)
    this.bouquet.visible = true
    this.bouquet.position.set(0, 0.06, -0.9)
    this.bouquet.rotation.set(Math.PI / 2, 0.4, 0)
    this.bee.visible = true
    if (f.flower) f.flower.visible = false
    this.spawn(FERDINAND)
    const b = this.bull!
    b.pos.copy(this.ferdPos)
    b.heading = Math.atan2(this.pos.x - b.pos.x, this.pos.z - b.pos.z)
    this.setMode(b, 'turn')
    this.el.bullName.textContent = '🐝 Ferdinand'
    this.message('Undvik Ferdinand tills han lugnar ner sig!', 2)
    this.cheer(2)
  }

  /** Ferdinand worn out: the bee gives up, and he sits down with his flowers. */
  private calm(b: Ai) {
    this.setMode(b, 'sit')
    b.model.setAngry(0)
    if (b.model.flower) b.model.flower.visible = true
    this.beeT = 0
    this.score += 1000 + this.hearts * 200
    this.message('😌 Humlan flög iväg… Ferdinand sätter sig och luktar på blommorna.', 2.6)
    this.cheer(2)
    crowd(5, 1)
    this.result = 'won'
    this.state = 'won'
    this.stateT = 0
    this.band.level(0.32)
    // and all Madrid throws flowers
    this.flowers!.start(110, this.pos.clone())
  }

  private lose() {
    this.result = 'lost'
    this.state = 'lost'
    this.stateT = 0
    boo()
    crowd(2.5, 0.5, 0.6)
    this.band.level(0.06)
    // the bull loses interest: off through the gate (Ferdinand just sits down)
    const b = this.bull
    this.winner = b?.spec.name ?? 'Tjuren'
    if (b) {
      this.setMode(b, b.spec.ferdinand ? 'sit' : 'leave')
      b.model.setAngry(0)
    }
  }

  private updateOver(dt: number, t: number) {
    const k = this.stateT
    this.movePlayer(dt, t)
    this.vm.matador(true, t, { raise: this.raise })
    if (this.bull) this.updateBull(this.bull, dt, t)
    const b = this.bull
    this.updateBee(dt, t)
    this.danger(null)
    this.flowers!.update(dt)
    if (this.state === 'won' && k > 7) this.flowers!.stop()
    this.torilK = damp(this.torilK, b?.mode === 'leave' ? 1 : 0, 4, dt)
    this.world!.openToril(this.torilK)
    if (this.once('card', k > (this.state === 'won' ? 2.8 : 1.6))) this.scorecard()
    if (this.state === 'won' && Math.floor(k * 2) !== Math.floor((k - dt) * 2) && k < 6) this.world!.setMood(2)
    if (k > (this.state === 'won' ? 15 : 10)) this.toFade()
  }

  private scorecard() {
    const record = this.score > this.best
    if (record) {
      this.best = this.score
      try {
        localStorage.setItem(BEST_KEY, String(this.score))
      } catch {
        /* no storage – the record lasts until reload */
      }
    }
    this.el.root.classList.add('over')
    const head = this.state === 'won' ? '🌸 ¡OLÉ! Du klarade Tjuren Ferdinand!' : `🤕 Utslagen! ${this.winner} vann den här gången.`
    this.message(`${head}\n${this.score} poäng${record ? ' – nytt rekord! 🎉' : ''}`, 999)
    if (this.state === 'won') whoosh()
  }

  /* ---------- puffs of dust ---------- */

  private dustAt(at: THREE.Vector3, n: number, size: number) {
    for (let i = 0; i < n; i++) {
      const p = this.puffs.find((x) => x.life <= 0)
      if (!p) return
      p.life = 1
      p.size = size * (0.6 + Math.random() * 0.8)
      p.s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * size, Math.random() * size * 0.3, (Math.random() - 0.5) * size))
      p.v.set((Math.random() - 0.5) * size * 1.5, 0.4 + Math.random() * size * 0.4, (Math.random() - 0.5) * size * 1.5)
      p.s.visible = true
    }
  }

  private updatePuffs(dt: number) {
    for (const p of this.puffs) {
      if (p.life <= 0) continue
      p.life -= dt * 0.9
      p.s.position.addScaledVector(p.v, dt)
      p.v.multiplyScalar(Math.exp(-2 * dt))
      p.s.scale.setScalar(p.size * (1.6 - p.life * 0.6))
      ;(p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, p.life) * 0.7
      if (p.life <= 0) p.s.visible = false
    }
  }

  /* ---------- HUD ---------- */

  private msgTimer = 0
  private message(text: string, secs: number) {
    const m = this.el.msg
    m.textContent = text
    m.hidden = !text
    m.classList.remove('pop')
    void m.offsetWidth
    m.classList.add('pop')
    this.msgTimer = secs
  }

  private lastHud = ''
  private syncHud() {
    const b = this.bull
    const stam = b ? Math.max(0, Math.round((b.stamina / b.spec.time) * 100)) : 0
    const hud = `${this.hearts}|${stam}|${this.score}|${this.best}`
    if (hud === this.lastHud) return
    this.lastHud = hud
    this.el.hearts.textContent = '❤️'.repeat(Math.max(0, this.hearts)) + '🖤'.repeat(Math.max(0, HEARTS - this.hearts))
    this.el.bullBar.style.width = `${stam}%`
    this.el.bullBox.classList.toggle('low', stam < 25)
    this.el.score.textContent = String(this.score)
    this.el.best.textContent = `🏆 ${this.best}`
  }

  /* ---------- home again ---------- */

  /** Back in the village by the matadors, under cover of the fade (or the blindfold, if you bail early). */
  private land() {
    const was = this.inWorld
    this.active = false
    this.inWorld = false
    this.onceSet.clear()
    this.el.root.hidden = true
    this.el.msg.hidden = true
    this.el.arrow.hidden = true
    this.el.blindfold.className = ''
    this.el.blindfold.style.removeProperty('--gap')
    this.el.stick.classList.remove('on')
    this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }
    this.renderer.domElement.style.filter = ''
    this.vm.matador(false)
    if (was) this.onMusic(false)
    const w = this.world
    if (w) {
      w.carriage.visible = false
      w.openToril(0)
      for (const b of this.bulls) b.group.visible = false
    }
    this.bull = null
    this.ferdinand!.group.visible = false
    this.bee.visible = this.bouquet.visible = false
    this.flowers!.reset()
    this.toss.t = this.toss2.t = -1
    for (const p of this.puffs) {
      p.life = 0
      p.s.visible = false
    }
    this.camera.fov = this.zoom = this.walk
    this.camera.updateProjectionMatrix()
    this.matadors.reset()
    // in front of the three of them
    const spot = this.matadors.front()
    this.player.pos.copy(spot.pos)
    this.player.yaw = spot.yaw
    this.player.pitch = -0.05
    this.player.vel.set(0, 0, 0)
    setTimeout(() => this.el.fade.classList.remove('on'), 80)
    if (was)
      this.say(
        this.result === 'won'
          ? `🪙 ¡Increíble! Du klarade Ferdinand – ${this.score} poäng! Igen?`
          : this.result === 'lost'
            ? `🪙 Ingen fara, amigo. ${this.score} poäng – tjurar är svåra.`
            : '🪙 Fegis… 🐔',
      )
    this.onDone()
  }
}
