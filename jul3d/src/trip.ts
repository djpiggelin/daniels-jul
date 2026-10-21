// Husvagnen – the camper trip. Musse and Kalle hop in, the village freezes into a painted backdrop that
// folds up like a fan into the camper (fan.ts), and behind it is the dump and the mountain (mountain.ts).
// Then you drive: car and trailer up the spiral road to the top, without spilling the breakfast they're
// cooking in the back. At the top you leave the wheel for breakfast, the hitch snaps, and the trailer rolls
// backwards all the way down with Musse and Kalle inside – the part SVT always cut – and you steer it.
// The road holds things: s is how far along it you are, d how far left of the middle (left = the drop).
import * as THREE from 'three'
import { AXLE, CAR_AHEAD, HITCH, TRAILER_ARM, WHEELBASE, type Camper } from './camper'
import { FilmFrame, outline } from './cartoon'
import { Fan } from './fan'
import { ROAD_W, buildMountain, type Mountain } from './mountain'
import type { Player } from './player'
import { TOUCH, walkFov } from './device'
import { bell, clunk, horn, puff, putter, ratchet, rattle, thud, whoosh } from './sfx'

const BEST_KEY = 'jul3d.best.husvagn'
const touch = TOUCH
/** Where the camera stands for the freeze (trailer space): low and level, side on to the camper's door. */
const FRAME_POS = new THREE.Vector3(-8.8, 1.3, 0.3)
const FRAME_LOOK = new THREE.Vector3(0, 1.75, 0.3)
/** What the backdrop folds into: the middle of the camper (trailer space). */
const FOLD_AT = new THREE.Vector3(0, 1.5, 0.3)
/** Seconds of walking in before the freeze, and of the cartoon intro after it (10 s in all). */
const BOARD = 1.5
const INTRO = 8.8
/** Car half-width, and how close to the edges its middle may get. */
const EDGE = ROAD_W / 2 - 0.85
const TRAILER_EDGE = ROAD_W / 2 - 1.05
/** The village at night, which the cartoon's light starts out as (see world.ts). */
const NIGHT = { sky: 0x9fb2ff, ground: 0x2a3260, hemi: 0.9, moon: 0xbfd0ff, moonI: 1.1, moonDir: new THREE.Vector3(-30, 45, -40).normalize(), fog: 0x1f2b5e, fogD: 0.021 }
const DAY = { sky: 0xd6e6ff, ground: 0x8a7650, hemi: 1.2, sun: 0xfff0d0, sunI: 2.4, fog: 0xd8ccaa, fogD: 0.0032 }

type State = 'board' | 'intro' | 'drive' | 'fall' | 'summit' | 'down' | 'tumble' | 'end' | 'fade'

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt))
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

export class Trip {
  active = false
  /** True once the village has frozen and we're in the cartoon (main draws `scene` then). */
  inWorld = false
  world: Mountain | null = null
  private fan = new Fan()
  private film = new FilmFrame()
  private hulls: THREE.Mesh[] = []
  private state: State = 'board'
  private stateT = 0
  private from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  private frame = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  private walks: THREE.Vector3[][] = []
  private moonDir = new THREE.Vector3()
  // driving
  private s = 0
  private d = 0
  private psi = 0
  private v = 0
  private steer = 0
  private pitch = 0
  private roll = 0
  private hop = 9
  /** 0 until the engine starts (an idling old car shakes). */
  private engine = 0
  private axle = new THREE.Vector3()
  private sT = 0
  private yaw = 0
  private checkpoint = 0
  private food = 100
  private time = 0
  private best = readBest()
  private bumpCool = 0
  private bellT = 0
  private putT = 0
  private nearMiss = false
  private said = new Set<string>()
  private fall = { from: new THREE.Vector3(), out: new THREE.Vector3(), yaw: 0 }
  // rolling back down: the trailer's own d, heading and speed (its s is sT)
  private d2 = 0
  private psi2 = 0
  private u = 0
  private roll2 = 0
  private teeterT = 0
  private gulpT = 9
  private whooshT = 0
  private truck = { on: false, done: false, passed: false, s: 0, d: 0 }
  private tumble = { from: new THREE.Vector3(), to: new THREE.Vector3(), yaw0: 0, yaw1: 0, shot: new THREE.Vector3() }
  // input
  private keys = new Set<string>()
  private mstick = 0
  private touchId = -1
  private touchX = 0
  private touchSteer = 0
  private braking = false
  private paused = false
  private armedAt = 0
  // little clouds of dust and exhaust
  private puffs: { s: THREE.Sprite; v: THREE.Vector3; life: number; size: number }[] = []
  private el = {
    root: document.getElementById('trip')!,
    food: document.querySelector<HTMLElement>('#trip .tr-food b')!,
    foodBar: document.querySelector<HTMLElement>('#trip .tr-food u')!,
    foodBox: document.querySelector<HTMLElement>('#trip .tr-food')!,
    time: document.querySelector<HTMLElement>('#trip .tr-time b')!,
    best: document.querySelector<HTMLElement>('#trip .fl-best')!,
    msg: document.querySelector<HTMLElement>('#trip .fl-msg')!,
    hintDesk: document.querySelector<HTMLElement>('#trip .fl-bar .hint.desk')!,
    hintTouch: document.querySelector<HTMLElement>('#trip .fl-bar .hint.touch')!,
    fade: document.getElementById('fade')!,
  }
  private hints = { desk: this.el.hintDesk.innerHTML, touch: this.el.hintTouch.innerHTML }
  /** Called once you're back on your feet beside the camper. */
  onDone: () => void = () => {}
  /** A line for the village toast when you're back. */
  say: (text: string) => void = () => {}

  constructor(
    private village: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    private camera: THREE.PerspectiveCamera,
    private player: Player,
    private camper: Camper,
  ) {
    addEventListener('keydown', (e) => {
      if (!this.active || e.metaKey || e.ctrlKey || e.code === 'Escape') return
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      if (e.timeStamp < this.armedAt) return
      if (this.paused) return this.unpause()
      if (e.code === 'KeyQ') return this.leave()
      this.keys.add(e.code)
    })
    addEventListener('keyup', (e) => this.keys.delete(e.code))
    addEventListener('blur', () => {
      this.keys.clear()
      if (this.active && (this.state === 'drive' || this.state === 'down')) this.pause()
    })
    document.addEventListener('mousemove', (e) => {
      if (!this.active || touch || !this.player.locked) return
      this.mstick = THREE.MathUtils.clamp(this.mstick + e.movementX * 0.004 * this.player.sens, -1, 1)
    })
    document.addEventListener('pointerdown', (e) => {
      if (!this.active || (e.target as HTMLElement).closest('button')) return
      if (this.paused) this.unpause()
      else this.player.lock()
      if (e.pointerType !== 'mouse' && this.touchId < 0) {
        this.touchId = e.pointerId
        this.touchX = e.clientX
      }
    })
    document.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.touchId) this.touchSteer = THREE.MathUtils.clamp((e.clientX - this.touchX) / 80, -1, 1)
    })
    const lift = (e: PointerEvent) => {
      if (e.pointerId !== this.touchId) return
      this.touchId = -1
      this.touchSteer = 0
    }
    document.addEventListener('pointerup', lift)
    document.addEventListener('pointercancel', lift)
    const brake = document.getElementById('trip-brake')!
    brake.addEventListener('pointerdown', () => (this.braking = true))
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) brake.addEventListener(ev, () => (this.braking = false))
    document.getElementById('trip-exit')!.addEventListener('click', () => this.leave())
  }

  /** Build the mountain ahead of time (it takes a moment), and compile its shaders. */
  prepare() {
    if (this.world) return
    this.world = buildMountain()
    this.world.scene.add(this.fan.group)
    this.hulls = [...outline(this.camper.car, 0.035), ...outline(this.camper.trailer, 0.035), ...outline(this.camper.musse.group, 0.025), ...outline(this.camper.kalle.group, 0.025)]
    for (const h of this.hulls) h.visible = false
    const dust = this.world.dustTex
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dust, transparent: true, depthWrite: false }))
      s.visible = false
      this.world.scene.add(s)
      this.puffs.push({ s, v: new THREE.Vector3(), life: 0, size: 1 })
    }
    this.renderer.compile(this.world.scene, this.camera)
  }

  shadows(on: boolean) {
    if (this.world) this.world.sun.castShadow = on && !touch
  }

  /** Walk up, press E: Musse and Kalle hop in and the camera steps back to frame the camper. */
  start() {
    if (this.active) return
    this.prepare()
    this.active = true
    this.state = 'board'
    this.stateT = 0
    this.paused = false
    this.armedAt = performance.now() + 200
    this.keys.clear()
    this.mstick = this.touchSteer = 0
    this.said.clear()
    this.from.pos.copy(this.camera.position)
    this.from.quat.copy(this.camera.quaternion)
    const tr = this.camper.trailer
    tr.updateMatrixWorld(true)
    this.frame.pos.copy(tr.localToWorld(FRAME_POS.clone()))
    const look = tr.localToWorld(FRAME_LOOK.clone())
    this.frame.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.frame.pos, look, new THREE.Vector3(0, 1, 0)))
    const { musse, kalle } = this.camper
    this.walks = [this.camper.walkPath(0), this.camper.walkPath(1)]
    this.walks.forEach((w, i) => (w[0] = (i ? kalle : musse).group.position.clone()))
    musse.out = kalle.out = false
    this.el.root.hidden = true
    this.el.root.classList.remove('over')
    this.el.msg.hidden = true
    this.el.hintDesk.innerHTML = this.hints.desk
    this.el.hintTouch.innerHTML = this.hints.touch
    this.truck = { on: false, done: false, passed: false, s: 0, d: 0 }
    this.teeterT = 0
    this.gulpT = 9
  }

  /** Bail out (Q / Esc / the button): fade back to the village. */
  leave() {
    if (!this.active || this.state === 'fade') return
    if (this.state === 'board') return this.land()
    this.toFade()
  }

  private pause() {
    this.paused = true
    this.message(touch ? 'Pausat – tryck för att köra vidare' : 'Pausat – klicka för att köra vidare', 999)
  }

  private unpause() {
    this.paused = false
    this.player.lock()
    this.message('', 0)
  }

  private toFade() {
    this.state = 'fade'
    this.stateT = 0
    this.el.fade.classList.add('on')
  }

  /* ---------- the freeze: village → painted backdrop, with the camper moved into the cartoon ---------- */

  private freeze() {
    const w = this.world!
    const { car, trailer, musse, kalle, bubble } = this.camper
    // the village as it looks right now, without the camper in it
    this.fan.snapshot(this.renderer, this.village, this.camera, [car, trailer, musse.group, kalle.group, bubble], trailer.localToWorld(FOLD_AT.clone()))
    const before = trailer.matrixWorld.clone()
    // the camper, parked at the start of the run across the dump, lined up exactly as it stood
    w.scene.add(car, trailer)
    this.s = 7.5
    this.d = this.psi = this.v = this.steer = this.roll = 0
    this.pitch = 0
    this.resetTrailer()
    this.placeRig(0)
    trailer.updateMatrixWorld(true)
    // move the camera (and the picture) the same way, so nothing on screen changes
    const T = trailer.matrixWorld.clone().multiply(before.invert())
    const m = new THREE.Matrix4().compose(this.camera.position, this.camera.quaternion, new THREE.Vector3(1, 1, 1)).premultiply(T)
    m.decompose(this.camera.position, this.camera.quaternion, new THREE.Vector3())
    this.frame.pos.copy(this.camera.position)
    this.frame.quat.copy(this.camera.quaternion)
    this.fan.group.position.copy(this.camera.position)
    this.fan.group.quaternion.copy(this.camera.quaternion)
    this.moonDir.copy(NIGHT.moonDir).transformDirection(T)
    this.light(0)
    this.engine = 0
    // the camper is drawn over the picture
    for (const g of [car, trailer]) g.traverse((o) => (o.renderOrder = 2))
    this.camper.foldAwnings(0)
    this.film.show(true)
    // only messages for now; the meters come up when you get to drive
    this.el.root.hidden = false
    this.el.root.classList.add('intro')
    w.resetTrain()
    this.inWorld = true
    this.state = 'intro'
    this.stateT = 0
  }

  /** 0 = the village's moonlight … 1 = the cartoon's sunny day. */
  private light(k: number) {
    const w = this.world!
    const c = new THREE.Color()
    w.hemi.color.lerpColors(c.setHex(NIGHT.sky), new THREE.Color(DAY.sky), k)
    w.hemi.groundColor.lerpColors(c.setHex(NIGHT.ground), new THREE.Color(DAY.ground), k)
    w.hemi.intensity = THREE.MathUtils.lerp(NIGHT.hemi, DAY.hemi, k)
    w.sun.color.lerpColors(c.setHex(NIGHT.moon), new THREE.Color(DAY.sun), k)
    w.sun.intensity = THREE.MathUtils.lerp(NIGHT.moonI, DAY.sunI, k)
    w.sunDir.lerpVectors(this.moonDir, w.SUN_DAY, k).normalize()
    const fog = w.scene.fog as THREE.FogExp2
    fog.color.lerpColors(c.setHex(NIGHT.fog), new THREE.Color(DAY.fog), k)
    fog.density = Math.exp(THREE.MathUtils.lerp(Math.log(NIGHT.fogD), Math.log(DAY.fogD), k))
  }

  /* ---------- the car and the trailer on the road ---------- */

  /** Trailer straight behind the car. */
  private resetTrailer() {
    const r = this.world!.road
    const yaw = r.yawAt(this.s) + this.psi
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    this.axle.copy(r.at(this.s, this.d)).addScaledVector(back, HITCH + TRAILER_ARM)
    this.sT = this.s - CAR_AHEAD
  }

  /** Put the car where (s, d, psi) say, drag the trailer after it by the hitch. Returns how far the trailer scraped an edge. */
  private placeRig(dt: number) {
    const r = this.world!.road
    const { car, trailer } = this.camper
    const p = r.at(this.s, this.d)
    this.yaw = r.yawAt(this.s) + this.psi
    this.pitch = dt ? damp(this.pitch, Math.atan(r.gradeAt(this.s)), 6, dt) : Math.atan(r.gradeAt(this.s))
    this.hop += dt
    const hop = this.hop < 0.45 ? Math.sin((this.hop / 0.45) * Math.PI) * 0.3 : 0
    // an old car never sits still: a little shake that grows with speed
    const shake = Math.sin(this.time * 31) * 0.012 * this.engine + Math.abs(Math.sin(this.s * 1.9)) * 0.03 * Math.min(1, Math.abs(this.v) / 6)
    car.position.set(p.x, p.y + hop + shake, p.z)
    car.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ')
    // the trailer: its axle follows the hitch at a fixed distance
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    const hitch = p.clone().addScaledVector(back, HITCH)
    const dir = new THREE.Vector3()
    const centre = new THREE.Vector3()
    const solve = () => {
      dir.copy(hitch).sub(this.axle).setY(0)
      const len = dir.length()
      dir.divideScalar(len > 1e-4 ? len : 1)
      this.axle.copy(hitch).addScaledVector(dir, -TRAILER_ARM)
      centre.copy(this.axle).addScaledVector(dir, AXLE)
    }
    solve()
    this.sT = r.nearest(centre, this.sT, 4)
    const left = r.leftAt(this.sT)
    const dT = centre.clone().sub(r.at(this.sT)).dot(left)
    const lo = this.sT > r.climbFrom ? -TRAILER_EDGE : -TRAILER_EDGE - 1.5
    const hi = TRAILER_EDGE
    let scrape = 0
    if (dT < lo || dT > hi) {
      scrape = THREE.MathUtils.clamp(dT, lo, hi) - dT
      this.axle.addScaledVector(left, scrape)
      solve()
    }
    const ty = r.at(this.sT).y
    trailer.position.set(centre.x, ty + hop * 0.5, centre.z)
    trailer.rotation.set(Math.atan(r.gradeAt(this.sT)), Math.atan2(-dir.x, -dir.z), this.roll * 0.4, 'YXZ')
    return Math.abs(scrape)
  }

  /* ---------- breakfast ---------- */

  private spill(amount: number) {
    const before = this.food
    this.food = Math.max(0, this.food - amount)
    const lines: [number, string][] = [
      [80, '☕ Kaffet skvimpar över!'],
      [55, '🌽 Majskolvarna rullar på golvet!'],
      [30, '🍉 Vattenmelonen for ut genom fönstret!'],
      [5, '🥔 Bara en kall potatis kvar…'],
    ]
    for (const [at, line] of lines)
      if (before > at && this.food <= at && !this.said.has(line)) {
        this.said.add(line)
        this.message(line, 1.8)
      }
    if (amount >= 4) {
      this.el.foodBox.classList.remove('hit')
      void this.el.foodBox.offsetWidth
      this.el.foodBox.classList.add('hit')
    }
  }

  private bump(text: string, spill: number) {
    if (this.bumpCool > 0) return
    this.bumpCool = 0.6
    this.spill(spill)
    rattle()
    this.hop = 0
    if (text) this.message(text, 1.0)
  }

  /* ---------- the frame ---------- */

  update(dt: number, t: number) {
    if (!this.active) return
    if (this.paused) dt = 0
    this.stateT += dt
    const s = this.state
    this.film.update(dt)
    if (s === 'board') return this.updateBoard()
    const w = this.world!
    if (s === 'intro') this.updateIntro(dt, t)
    else if (s === 'drive') this.updateDrive(dt, t)
    else if (s === 'fall') this.updateFall(dt)
    else if (s === 'summit') this.updateSummit(dt, t)
    else if (s === 'down') this.updateDown(dt)
    else if (s === 'tumble') this.updateTumble(dt)
    else if (s === 'end') this.updateEnd(dt, t)
    else if (s === 'fade' && this.stateT > 0.55) return this.land()
    const downhill = s === 'down' || s === 'tumble' || s === 'end'
    w.update(t, dt, downhill ? this.camper.trailer.position : this.camper.car.position)
    this.updatePuffs(dt)
    if (this.msgTimer > 0 && (this.msgTimer -= dt) <= 0) this.el.msg.hidden = true
    this.syncHud()
  }

  /** In the village: the camera swings round the back of the camper to the door side, low and level, while
   * Musse and Kalle dash round the back and in through the door. */
  private updateBoard() {
    const k = THREE.MathUtils.smootherstep(this.stateT / BOARD, 0, 1)
    const tr = this.camper.trailer
    // orbit round the trailer (via its back end, never through it)
    const a = tr.worldToLocal(this.from.pos.clone())
    const b = tr.worldToLocal(this.frame.pos.clone())
    const a0 = Math.atan2(a.x, a.z)
    let a1 = Math.atan2(b.x, b.z)
    if (a0 > 0 && a1 > a0) a1 -= Math.PI * 2
    if (a0 < 0 && a1 < a0) a1 += Math.PI * 2
    const ang = THREE.MathUtils.lerp(a0, a1, k)
    const rad = THREE.MathUtils.lerp(Math.hypot(a.x, a.z), Math.hypot(b.x, b.z), k) + Math.sin(k * Math.PI) * 2.5
    const y = THREE.MathUtils.lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 0.8
    this.camera.position.copy(tr.localToWorld(new THREE.Vector3(Math.sin(ang) * rad, y, Math.cos(ang) * rad)))
    this.camera.quaternion.slerpQuaternions(this.from.quat, this.frame.quat, k)
    ;[this.camper.musse, this.camper.kalle].forEach((toon, i) => {
      const path = this.walks[i]
      const kk = THREE.MathUtils.smoothstep(this.stateT, 0.05 + i * 0.2, 1.2 + i * 0.2)
      // along the path, in equal steps per leg
      const f = kk * (path.length - 1)
      const leg = Math.min(path.length - 2, Math.floor(f))
      const p0 = path[leg]
      const p1 = path[leg + 1]
      toon.group.position.lerpVectors(p0, p1, f - leg)
      toon.group.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z)
      toon.walkPose(this.stateT * 22, kk > 0 && kk < 1 ? 1 : 0)
      toon.armR.rotation.set(0, 0, 0.25)
      // in through the door
      toon.group.visible = kk < 0.98
      toon.group.scale.setScalar((i ? 1.3 : 1.25) * (kk > 0.85 ? 1 - (kk - 0.85) * 4 : 1))
    })
    if (this.stateT >= BOARD) this.freeze()
  }

  /** The ten seconds: paint, lever, fold, drop, a beat of silence, engine, go. */
  private updateIntro(dt: number, t: number) {
    const k = this.stateT
    this.fan.setPaint(THREE.MathUtils.smoothstep(k, 0.15, 1.4))
    this.light(THREE.MathUtils.smoothstep(k, 0.4, 2.2))
    // the camper gets inked along with the painting
    if (this.once('ink', k > 0.7)) for (const h of this.hulls) h.visible = true
    if (this.once('lever', k > 1.45)) clunk()
    this.camper.foldAwnings(THREE.MathUtils.smoothstep(k, 1.5, 2.2))
    // the fan folds up round the camper, a click per pleat…
    const fold = THREE.MathUtils.smootherstep((k - 2.2) / 2.4, 0, 1)
    if (fold > 0 && fold < 1 && Math.floor(fold * 24) !== Math.floor(this.lastFold * 24)) ratchet()
    this.lastFold = fold
    this.fan.setFold(fold)
    // …and the folded stick is sucked down into it: gulp
    const into = THREE.MathUtils.clamp((k - 4.75) / 0.8, 0, 1)
    if (into > 0) this.fan.setRetract(into * into)
    if (this.once('gulp', into >= 1)) {
      this.fan.group.visible = false
      this.gulpT = 0
      thud()
      puff(0.4)
      this.dust(this.camper.trailer.localToWorld(new THREE.Vector3(0.5, 3.2, 1.2)), 6, 1.6)
    }
    // the camper swallows it with a wobble
    this.gulpT += dt
    const g = this.gulpT < 0.7 ? Math.sin((this.gulpT / 0.7) * Math.PI * 2) * (1 - this.gulpT / 0.7) : 0
    this.camper.trailer.scale.set(1 + g * 0.08, 1 - g * 0.12, 1 + g * 0.05)
    if (this.once('kalle', k > 6.0)) this.message('🦆 Öh… det såg finare ut nyss.', 2.2)
    // you hop into the driver's seat and the engine coughs into life
    if (this.once('driver', k > 7.0)) {
      this.camper.driver.group.visible = true
      puff(0.3)
      this.dust(this.camper.car.localToWorld(new THREE.Vector3(-0.3, 1.4, 0.7)), 5, 1.5)
    }
    if (k > 7.3) {
      this.engine = 1
      this.time += dt
      this.placeRig(dt)
    }
    if (k > 7.3 && (this.putT -= dt) <= 0) {
      this.putT = 0.13 + Math.random() * 0.1
      putter(0.3)
      if (Math.random() < 0.5) this.exhaust()
    }
    // swing round behind the car
    const swing = THREE.MathUtils.smootherstep((k - 7.3) / 1.5, 0, 1)
    if (swing > 0) {
      const chase = this.chasePose()
      this.camera.position.lerpVectors(this.frame.pos, chase.pos, swing)
      this.camera.quaternion.slerpQuaternions(this.frame.quat, chase.quat, swing)
    }
    if (k >= INTRO) {
      this.state = 'drive'
      this.stateT = 0
      this.time = 0
      this.food = 100
      this.checkpoint = this.s
      this.el.root.classList.remove('intro')
      this.message('Kör! 🚗 Upp till toppen – spill inte frukosten!', 2.4)
      whoosh()
    }
    void t
  }

  private lastFold = 0
  private onceSet = new Set<string>()
  /** True the first time `cond` holds (per trip). */
  private once(key: string, cond: boolean) {
    if (!cond || this.onceSet.has(key)) return false
    this.onceSet.add(key)
    return true
  }

  private updateDrive(dt: number, t: number) {
    const w = this.world!
    const r = w.road
    const k = (c: string) => this.keys.has(c)
    this.time += dt
    this.bumpCool -= dt
    // input
    if (!touch) this.mstick *= Math.exp(-1.6 * dt)
    const want = THREE.MathUtils.clamp((k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + this.mstick + this.touchSteer, -1, 1)
    this.steer = damp(this.steer, want, 8, dt)
    const brake = k('KeyS') || k('ArrowDown') || k('Space') || this.braking
    const gas = brake ? 0 : touch ? 1 : k('KeyW') || k('ArrowUp') ? 1 : 0

    // speed: engine, brakes, air, and the hill pulling you back
    const grade = r.gradeAt(this.s)
    let acc = gas * 5.2 - 0.035 * this.v * Math.abs(this.v) - 9.8 * grade * 0.55 - 0.3 * Math.sign(this.v)
    if (brake) acc -= 9 * Math.sign(this.v)
    this.v += acc * dt
    if ((brake || !gas) && Math.abs(this.v) < 0.25) this.v = 0
    this.v = THREE.MathUtils.clamp(this.v, -3, 16)

    // steering: the road holds the car a little, and pushes it out on the bends
    const curv = r.curvAt(this.s)
    const delta = (this.steer * 0.35) / (1 + Math.abs(this.v) * 0.05)
    const yawRate = (-this.v / WHEELBASE) * Math.tan(delta)
    this.psi += (yawRate + curv * this.v) * dt
    this.psi -= this.psi * 2.5 * dt
    this.psi = THREE.MathUtils.clamp(this.psi, -0.7, 0.7)
    const prevS = this.s
    this.s += this.v * Math.cos(this.psi) * dt
    this.d += this.v * Math.sin(this.psi) * dt
    this.s = THREE.MathUtils.clamp(this.s, 4, r.length)
    // swaying round the bends spills things
    // taking the bend fast is what throws things about; a quick correction much less so
    const lat = Math.abs(curv * this.v * this.v) + Math.abs(yawRate * this.v) * 0.3
    this.roll = damp(this.roll, THREE.MathUtils.clamp((yawRate + curv * this.v) * this.v * 0.012, -0.12, 0.12), 5, dt)
    // (only the tight bends near the top, taken too fast)
    if (lat > 6) this.spill((lat - 6) * dt)

    // the edges: rock on the right, fence (or nothing!) on the left
    // a real knock costs breakfast; leaning on it just grinds and slows you down
    const climbing = this.s > r.climbFrom
    const sideways = this.v * Math.sin(this.psi)
    const hitEdge = (into: number, text: string) => {
      if (into > 1.2 && climbing) {
        this.v *= 0.8
        this.bump(text, Math.min(6, 1 + into * 1.5))
      } else {
        this.v *= Math.exp(-0.9 * dt)
        if (climbing) this.spill(0.6 * dt)
      }
    }
    if (this.d < -EDGE) {
      this.d = -EDGE
      this.psi = Math.abs(this.psi) * 0.3
      hitEdge(-sideways, 'Bonk! Rakt i berget.')
    } else if (this.d > EDGE) {
      if (r.drop(this.s) && !r.fence(this.s)) {
        if (this.d > EDGE + 0.45) return this.startFall()
      } else {
        this.d = EDGE
        this.psi = -Math.abs(this.psi) * 0.3
        hitEdge(sideways, 'Krasch i staketet!')
      }
    }

    // rocks on the road
    for (const rock of w.rocks) {
      if (rock.d > 50 || Math.abs(this.s - rock.s) > 2.1 || Math.abs(this.d - rock.d) > 1.2) continue
      this.bump('Aj! En sten på vägen!', 7)
      this.v *= 0.55
      this.knockRock(rock)
    }

    // the trailer, and its swing
    const scrape = this.placeRig(dt)
    if (scrape > 0.05) this.spill(3 * dt + scrape * 2)
    const bend = Math.abs(wrap(this.yaw - this.camper.trailer.rotation.y))
    if (bend > 0.6) this.spill((bend - 0.6) * 10 * dt)
    this.camper.roll(this.v * dt, this.v * dt)

    // the waterfall
    if (prevS < w.waterS && this.s >= w.waterS) this.message('💦 Plask! Musse fyller vattenhinken.', 1.6)

    // the railway crossing
    this.updateTrain(dt)

    // a checkpoint every 40 m of climbing (never in a gap)
    if (this.s - this.checkpoint > 40 && r.fence(this.s)) this.checkpoint = this.s

    // engine
    if ((this.putT -= dt) <= 0) {
      const revs = Math.min(1, Math.abs(this.v) / 12)
      this.putT = 0.16 - revs * 0.1
      putter(gas ? 0.3 + revs : 0.15)
      if (gas && Math.random() < 0.25) this.exhaust()
    }

    // the top!
    if (this.s >= w.endS - 4) this.finish()

    this.followCamera(dt)
    void t
  }

  private updateTrain(dt: number) {
    const w = this.world!
    const near = Math.abs(this.s - w.crossS) < 70
    if (w.trainWarn && near && (this.bellT -= dt) <= 0) {
      this.bellT = 0.42
      bell()
    }
    const span = w.trainSpan()
    if (!span) {
      this.nearMiss = false
      return
    }
    const onTrack = (s0: number, s1: number) => s1 > w.crossS - 1.6 && s0 < w.crossS + 1.6
    const across = (d: number, half: number) => span[1] > d - half && span[0] < d + half
    const carOn = onTrack(this.s - 1.7, this.s + 1.8) && across(this.d, 0.8)
    const trailerOn = onTrack(this.sT - 2.2, this.sT + 2.2) && across(0, 1.1)
    if (carOn || trailerOn) {
      horn()
      this.spill(25)
      this.message('TUUUT! 🚂 Tåget hann först!', 2.0)
      this.s = Math.max(this.world!.road.climbFrom + 2, this.s - 14)
      this.d = this.psi = this.v = 0
      this.resetTrailer()
      this.placeRig(0)
      this.snapCamera()
      this.hop = 0
      return
    }
    // close shave
    const closeBy = onTrack(this.s - 6, this.s + 6) || onTrack(this.sT - 6, this.sT + 6)
    if (closeBy && !this.nearMiss && across(this.d, 5)) {
      this.nearMiss = true
      horn()
      this.message('Puh! 😅 Det var nära!', 1.4)
    }
  }

  private startFall() {
    this.state = 'fall'
    this.stateT = 0
    this.fall.from.copy(this.camper.car.position)
    this.fall.out.copy(this.world!.road.leftAt(this.s))
    this.fall.yaw = this.yaw
    whoosh()
    this.message('Hoppsan! 🙈', 1.2)
  }

  private updateFall(dt: number) {
    const k = this.stateT
    const car = this.camper.car
    car.position.copy(this.fall.from).addScaledVector(this.fall.out, k * 4).setY(this.fall.from.y - 4.9 * k * k)
    car.rotation.set(this.pitch, this.fall.yaw, -k * 3, 'YXZ')
    this.camper.trailer.position.addScaledVector(this.fall.out, dt * 3)
    this.camper.trailer.position.y -= dt * k * 6
    this.camera.lookAt(car.position)
    if (k > 0.9 && !this.el.fade.classList.contains('on')) this.el.fade.classList.add('on')
    if (k > 1.5) {
      // back on the road at the last checkpoint, with a bit less breakfast
      this.s = this.checkpoint
      this.d = this.psi = this.v = this.roll = 0
      this.resetTrailer()
      this.placeRig(0)
      this.spill(12)
      this.snapCamera()
      this.state = 'drive'
      this.stateT = 0
      setTimeout(() => this.el.fade.classList.remove('on'), 80)
      this.message('Tillbaka på vägen. Försiktigt nu!', 1.6)
    }
  }

  private score = 0
  private upTime = 0

  /** At the top: breakfast is ready, you leave the wheel… */
  private finish() {
    this.state = 'summit'
    this.stateT = 0
    this.v = 0
    this.upTime = this.time
    this.message('🦆 Frukost! Kom in och ät!', 1.4)
    whoosh()
    // out of the car, over to the trailer door
    const d = this.camper.driver
    this.world!.scene.attach(d.group)
    d.sit(false)
  }

  private updateSummit(dt: number, t: number) {
    const k = this.stateT
    const d = this.camper.driver
    const tr = this.camper.trailer
    if (k < 1.0) {
      const seat = this.camper.car.localToWorld(new THREE.Vector3(-1.1, 0, 0.7))
      const door = tr.localToWorld(new THREE.Vector3(-1.3, 0.45, 0.95))
      seat.y = door.y = this.world!.road.at(this.s).y
      d.group.position.lerpVectors(seat, door, THREE.MathUtils.smoothstep(k, 0.1, 0.9))
      d.group.rotation.set(0, Math.atan2(door.x - seat.x, door.z - seat.z), 0)
      d.walkPose(t * 14, 1)
    } else d.group.visible = false
    if (this.once('who', k > 1.4)) this.message('🐭 Vänta lite… vem håller i bilen?!', 1.5)
    // you dash back to the wheel – and the hitch comes undone
    if (k > 2.4) {
      this.camper.seatDriver(true)
      puff(0.3)
      clunk()
      this.startDown()
    }
    this.followCamera(dt)
  }

  /** …and the trailer rolls off backwards, down the mountain. You steer it now. */
  private startDown() {
    const r = this.world!.road
    const tr = this.camper.trailer
    this.state = 'down'
    this.stateT = 0
    this.d2 = tr.position.clone().sub(r.at(this.sT)).dot(r.leftAt(this.sT))
    this.psi2 = wrap(tr.rotation.y - r.yawAt(this.sT))
    this.u = 0.5
    this.roll2 = 0
    this.steer = 0
    this.message('KLONK! 😱 Husvagnen rullar baklänges nerför berget!', 2.4)
    this.el.hintDesk.innerHTML = '<kbd>A</kbd><kbd>D</kbd> / mus luta · <kbd>S</kbd> handbroms'
    this.el.hintTouch.textContent = 'Dra för att luta · håll Broms'
    // the car (and you) are already waiting at the bottom, the way cartoons work
    const sCar = r.climbFrom - 30
    const car = this.camper.car
    car.position.copy(r.at(sCar))
    car.rotation.set(0, r.yawAt(sCar) + Math.PI, 0, 'YXZ')
    car.updateMatrixWorld(true)
  }

  private updateDown(dt: number) {
    const w = this.world!
    const r = w.road
    const k = (c: string) => this.keys.has(c)
    this.time += dt
    this.bumpCool -= dt
    if (!touch) this.mstick *= Math.exp(-1.6 * dt)
    // A / left on screen leans towards the rock, D / right towards the drop
    const want = THREE.MathUtils.clamp((k('KeyA') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0) - this.mstick - this.touchSteer, -1, 1)
    this.steer = damp(this.steer, want, 8, dt)
    const brake = k('KeyS') || k('ArrowDown') || k('Space') || this.braking

    if (this.teeterT > 0) return this.updateTeeter(dt)

    // gravity does the driving now; the handbrake and the air hold you back
    const grade = r.gradeAt(this.sT)
    this.u += (9.8 * grade * 0.75 - 0.012 * this.u * this.u - (brake ? 6.5 : 0)) * dt
    if (brake && this.u < 0.4) this.u = 0
    this.u = THREE.MathUtils.clamp(this.u, 0, 22)
    const curv = r.curvAt(this.sT)
    const yawRate = this.steer * (this.u / 2.2) * Math.tan(0.45 / (1 + this.u * 0.04))
    this.psi2 += (yawRate - curv * this.u) * dt
    this.psi2 -= this.psi2 * 2.5 * dt
    this.psi2 = THREE.MathUtils.clamp(this.psi2, -0.7, 0.7)
    const prevS = this.sT
    this.sT -= this.u * Math.cos(this.psi2) * dt
    this.d2 -= this.u * Math.sin(this.psi2) * dt
    const lat = Math.abs(curv * this.u * this.u) + Math.abs(yawRate * this.u) * 0.3
    if (lat > 6) this.spill((lat - 6) * dt)
    this.roll2 = damp(this.roll2, THREE.MathUtils.clamp((yawRate - curv * this.u) * this.u * -0.012, -0.14, 0.14), 5, dt)

    // the rock and the fence – or, in a gap, nothing at all
    const sideways = -this.u * Math.sin(this.psi2)
    const hitEdge = (into: number, text: string) => {
      if (into > 1.2) {
        this.u *= 0.8
        this.bump(text, Math.min(6, 1 + into * 1.5))
      } else {
        this.u *= Math.exp(-0.9 * dt)
        this.spill(0.6 * dt)
      }
    }
    if (this.d2 < -TRAILER_EDGE) {
      this.d2 = -TRAILER_EDGE
      this.psi2 = -Math.abs(this.psi2) * 0.3
      hitEdge(-sideways, 'Bonk! Rakt i berget.')
    } else if (this.d2 > TRAILER_EDGE) {
      if (r.drop(this.sT) && !r.fence(this.sT)) {
        if (this.d2 > TRAILER_EDGE + 0.35) return this.startTeeter()
      } else {
        this.d2 = TRAILER_EDGE
        this.psi2 = Math.abs(this.psi2) * 0.3
        hitEdge(sideways, 'Krasch i staketet!')
      }
    }

    for (const rock of w.rocks) {
      if (rock.d > 50 || Math.abs(this.sT - rock.s) > 2.4 || Math.abs(this.d2 - rock.d) > 1.3) continue
      this.bump('Aj! En sten!', 7)
      this.u *= 0.6
      this.knockRock(rock)
    }

    if (prevS > w.waterS && this.sT <= w.waterS) this.message('💦 Plask! Kalle fick en dusch.', 1.6)
    this.updateTruck(dt)
    this.updateTrainDown(dt)
    if (this.u > 10 && (this.whooshT -= dt) <= 0) {
      this.whooshT = 1.1
      whoosh()
    }

    this.placeTrailer(dt)
    if (this.sT <= r.climbFrom + 4) return this.startTumble()
    this.followDown(dt)
  }

  private placeTrailer(dt: number) {
    const r = this.world!.road
    const tr = this.camper.trailer
    const p = r.at(this.sT, this.d2)
    this.hop += dt
    const hop = this.hop < 0.45 ? Math.sin((this.hop / 0.45) * Math.PI) * 0.3 : 0
    const tilt = this.teeterT > 0 ? Math.sin(Math.min(1, this.teeterT / 0.5) * Math.PI * 0.5) * 0.45 * (this.teeterT < 1.0 ? 1 : (1.4 - this.teeterT) / 0.4) : 0
    tr.position.set(p.x, p.y + hop * 0.5, p.z)
    tr.rotation.set(Math.atan(r.gradeAt(this.sT)), r.yawAt(this.sT) + this.psi2, this.roll2 + tilt, 'YXZ')
    this.camper.roll(0, -this.u * dt)
  }

  /** Off the edge in a gap: the trailer teeters over the drop and Musse paddles it back with his feet. */
  private startTeeter() {
    this.teeterT = 0.001
    this.u = 0
    this.d2 = TRAILER_EDGE + 0.35
    whoosh()
    this.message('🐭 Musse paddlar oss tillbaka upp på vägen!', 1.8)
    const m = this.camper.musse
    this.world!.scene.add(m.group)
    m.group.visible = true
    m.group.scale.setScalar(1.25)
  }

  private updateTeeter(dt: number) {
    this.teeterT += dt
    const k = this.teeterT
    const tr = this.camper.trailer
    const m = this.camper.musse
    // hanging out of the door over the drop, legs going like mad
    m.group.position.copy(tr.localToWorld(new THREE.Vector3(-1.9, 0.2, 0.95)))
    m.group.rotation.set(0, tr.rotation.y + Math.PI / 2, 0.5)
    m.walkPose(k * 40, 1)
    m.armR.rotation.set(0, 0, 2.6 + Math.sin(k * 30) * 0.3)
    if (k > 1.0) this.d2 = THREE.MathUtils.lerp(TRAILER_EDGE + 0.35, TRAILER_EDGE - 0.4, THREE.MathUtils.smoothstep(k, 1.0, 1.4))
    this.placeTrailer(dt)
    this.followDown(dt)
    if (k > 1.4) {
      this.teeterT = 0
      m.group.visible = false
      this.psi2 = 0.15
      this.u = 2
      this.spill(10)
    }
  }

  private knockRock(rock: { d: number; s: number; mesh: THREE.Mesh }) {
    const r = this.world!.road
    rock.d = 99
    const p = rock.mesh.position
    const out = r.leftAt(rock.s)
    const from = p.clone()
    let k = 0
    const fly = () => {
      k += 1 / 40
      p.copy(from).addScaledVector(out, k * 8).setY(from.y + Math.sin(Math.min(k, 0.5) * Math.PI) * 2 - Math.max(0, k - 0.5) * 30)
      rock.mesh.rotation.x += 0.3
      if (k < 1.5) requestAnimationFrame(fly)
      else rock.mesh.visible = false
    }
    fly()
  }

  /** A lorry coming up the other way, in one lane or the other: lean over to the free side. */
  private updateTruck(dt: number) {
    const w = this.world!
    const r = w.road
    const tk = this.truck
    const mesh = w.truck
    if (!tk.on && !tk.done && this.sT < w.endS - 70) {
      tk.on = true
      tk.s = this.sT - 70
      tk.d = Math.random() < 0.5 ? 1.25 : -1.25
      mesh.visible = true
      horn()
      this.message(`🚚 TUT TUT! En lastbil kommer – luta åt ${tk.d > 0 ? 'berget' : 'stupet'}!`, 2.0)
    }
    if (!tk.on) return
    tk.s += 7 * dt
    mesh.position.copy(r.at(tk.s, tk.d))
    mesh.rotation.set(-Math.atan(r.gradeAt(tk.s)), r.yawAt(tk.s), 0, 'YXZ')
    const ds = Math.abs(this.sT - tk.s)
    if (ds < 4.9 && Math.abs(this.d2 - tk.d) < 2.1) {
      horn()
      this.spill(20)
      this.u = 0
      this.hop = 0
      this.message('KRASCH! 🚚 Rakt i lastbilen!', 1.8)
      this.dust(mesh.position.clone().setY(mesh.position.y + 1), 10, 3)
      tk.on = false
      tk.done = true
      mesh.visible = false
      return
    }
    if (ds < 6 && !tk.passed) {
      tk.passed = true
      this.message('Puh! 😅 Precis förbi!', 1.3)
    }
    if (tk.s > this.sT + 70 || tk.s > r.length - 5) {
      tk.on = false
      tk.done = true
      mesh.visible = false
    }
  }

  /** The crossing on the way down: the train is set off just as you come rolling towards it. */
  private updateTrainDown(dt: number) {
    const w = this.world!
    if (this.once('train-down', this.sT < w.crossS + 70)) w.resetTrain(1.0)
    if (w.trainWarn && Math.abs(this.sT - w.crossS) < 70 && (this.bellT -= dt) <= 0) {
      this.bellT = 0.42
      bell()
    }
    const span = w.trainSpan()
    if (!span) {
      this.nearMiss = false
      return
    }
    const onTrack = this.sT + 2.2 > w.crossS - 1.6 && this.sT - 2.2 < w.crossS + 1.6
    const across = (half: number) => span[1] > this.d2 - half && span[0] < this.d2 + half
    if (onTrack && across(1.1)) {
      horn()
      this.spill(25)
      this.message('TUUUT! 🚂 Tåget hann först!', 2.0)
      this.sT = w.crossS + 6
      this.d2 = this.psi2 = this.u = 0
      this.hop = 0
      this.placeTrailer(0)
      this.snapDown()
      return
    }
    if (!this.nearMiss && Math.abs(this.sT - w.crossS) < 8 && across(6)) {
      this.nearMiss = true
      horn()
      this.message('Puh! 😅 Det var nära!', 1.4)
    }
  }

  /** Uphill of the trailer, out over the drop a little, looking down the road it's rolling down. */
  private downPose() {
    const r = this.world!.road
    const tr = this.camper.trailer
    const fwd = new THREE.Vector3(-Math.sin(tr.rotation.y), 0, -Math.cos(tr.rotation.y))
    const pos = tr.position.clone().addScaledVector(fwd, 8).addScaledVector(r.leftAt(this.sT), 2.2)
    pos.y += 5.2
    const look = tr.position.clone().addScaledVector(fwd, -10)
    look.y += 0.3
    return { pos, quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0))) }
  }

  private snapDown() {
    const c = this.downPose()
    this.camera.position.copy(c.pos)
    this.camera.quaternion.copy(c.quat)
  }

  private followDown(dt: number) {
    const c = this.downPose()
    this.camera.position.lerp(c.pos, 1 - Math.exp(-3 * dt))
    this.camera.quaternion.slerp(c.quat, 1 - Math.exp(-4 * dt))
  }

  /** At the foot of the climb the trailer tumbles head over heels the last bit – and lands right on the hitch. */
  private startTumble() {
    const r = this.world!.road
    const tr = this.camper.trailer
    const car = this.camper.car
    this.state = 'tumble'
    this.stateT = 0
    this.u = 0
    this.tumble.from.copy(tr.position)
    this.tumble.yaw0 = tr.rotation.y
    this.tumble.to.copy(car.localToWorld(new THREE.Vector3(0, 0, CAR_AHEAD)))
    this.tumble.yaw1 = car.rotation.y
    const mid = this.tumble.from.clone().lerp(this.tumble.to, 0.5)
    const side = r.leftAt(r.climbFrom - 20)
    this.tumble.shot.copy(mid).addScaledVector(side, 20).setY(mid.y + 6)
    whoosh()
    this.message('Oj oj oj oj…', 1.2)
  }

  private updateTumble(dt: number) {
    const k = Math.min(1, this.stateT / 1.8)
    const tr = this.camper.trailer
    const e = THREE.MathUtils.smootherstep(k, 0, 1)
    tr.position.lerpVectors(this.tumble.from, this.tumble.to, e)
    tr.position.y += Math.sin(k * Math.PI) * 7
    const yaw = this.tumble.yaw0 + wrap(this.tumble.yaw1 - this.tumble.yaw0) * e
    tr.rotation.set(e * Math.PI * 4, yaw, 0, 'YXZ')
    this.camper.roll(0, dt * 12)
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.tumble.shot, tr.position, new THREE.Vector3(0, 1, 0)))
    this.camera.position.lerp(this.tumble.shot, 1 - Math.exp(-3 * dt))
    this.camera.quaternion.slerp(q, 1 - Math.exp(-6 * dt))
    if (k >= 1) {
      tr.rotation.set(0, this.tumble.yaw1, 0, 'YXZ')
      thud()
      ;[0, 90].forEach((ms) => setTimeout(() => clunk(), ms))
      this.dust(this.camper.car.localToWorld(new THREE.Vector3(0, 0.4, HITCH)), 10, 2.5)
      this.state = 'end'
      this.stateT = 0
      this.message('KLICK! 🔗', 1.0)
    }
  }

  /** Hitched up again as if nothing happened. "Jag körde ner er sakta och säkert, va?" */
  private updateEnd(dt: number, t: number) {
    const k = this.stateT
    if (this.once('safe', k > 1.0)) this.message('🧝 "Jag körde ner er sakta och säkert, va?"', 2.2)
    if (this.once('out', k > 3.0)) this.scorecard()
    if (k > 3.0) for (const toon of [this.camper.musse, this.camper.kalle]) toon.update(t, dt, this.camera.position)
    this.updateOver(dt)
    if (k > 9) this.toFade()
  }

  /** Musse and Kalle stagger out with what's left of breakfast; the score. */
  private scorecard() {
    this.score = Math.round(this.food) + Math.max(0, Math.round(200 - this.time))
    const record = this.score > this.best
    if (record) {
      this.best = this.score
      try {
        localStorage.setItem(BEST_KEY, String(this.score))
      } catch {
        /* no storage – the record lasts until reload */
      }
    }
    // out they come, waving, with what's left of breakfast
    const { trailer, musse, kalle } = this.camper
    for (const [toon, x, z] of [
      [musse, -1.85, 1.6],
      [kalle, -1.95, 0.2],
    ] as const) {
      this.world!.scene.add(toon.group)
      toon.group.position.copy(trailer.localToWorld(new THREE.Vector3(x, 0, z)))
      toon.group.scale.setScalar(toon === musse ? 1.25 : 1.3)
      toon.setYaw(trailer.rotation.y - Math.PI / 2)
      toon.group.visible = toon.out = true
    }
    this.el.root.classList.add('over')
    const food = Math.round(this.food)
    this.message(
      `🦆 Sakta och säkert?! Grrr…\n🍳 ${food} % av frukosten kvar · upp ${Math.round(this.upTime)} s, ner ${Math.round(this.time - this.upTime)} s\n${this.score} poäng${record ? ' – nytt rekord! 🎉' : ''}`,
      999,
    )
    whoosh()
  }

  /** Side on to the door, the car hitched up in front. */
  private updateOver(dt: number) {
    const tr = this.camper.trailer
    const pos = tr.localToWorld(new THREE.Vector3(-10.5, 3.0, -1.0))
    const look = tr.localToWorld(new THREE.Vector3(0, 1.2, -2.6))
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)))
    this.camera.position.lerp(pos, 1 - Math.exp(-2 * dt))
    this.camera.quaternion.slerp(q, 1 - Math.exp(-2 * dt))
  }

  /** Behind and above the trailer, a little out over the drop, looking past it up the road. */
  private chasePose() {
    const r = this.world!.road
    const car = this.camper.car.position
    const tr = this.camper.trailer
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const tfwd = new THREE.Vector3(-Math.sin(tr.rotation.y), 0, -Math.cos(tr.rotation.y))
    const pos = tr.position.clone().addScaledVector(tfwd, -7.5).addScaledVector(r.leftAt(this.sT), 2.2)
    pos.y += 5.6
    const look = car.clone().addScaledVector(fwd, 9)
    look.y += 0.6
    return { pos, quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0))) }
  }

  private snapCamera() {
    const c = this.chasePose()
    this.camera.position.copy(c.pos)
    this.camera.quaternion.copy(c.quat)
  }

  private followCamera(dt: number) {
    const c = this.chasePose()
    this.camera.position.lerp(c.pos, 1 - Math.exp(-4 * dt))
    this.camera.quaternion.slerp(c.quat, 1 - Math.exp(-5 * dt))
  }

  /* ---------- puffs of dust and exhaust ---------- */

  private dust(at: THREE.Vector3, n: number, size: number) {
    for (let i = 0; i < n; i++) {
      const p = this.puffs.find((x) => x.life <= 0)
      if (!p) return
      p.life = 1
      p.size = size * (0.6 + Math.random() * 0.8)
      p.s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * size, Math.random() * size * 0.3, (Math.random() - 0.5) * size))
      p.v.set((Math.random() - 0.5) * size * 1.5, 0.5 + Math.random() * size * 0.4, (Math.random() - 0.5) * size * 1.5)
      p.s.visible = true
      p.s.renderOrder = 3
    }
  }

  private exhaust() {
    const car = this.camper.car
    this.dust(car.localToWorld(new THREE.Vector3(0.4, 0.45, 1.8)), 1, 0.7)
  }

  private updatePuffs(dt: number) {
    for (const p of this.puffs) {
      if (p.life <= 0) continue
      p.life -= dt * 0.9
      p.s.position.addScaledVector(p.v, dt)
      p.v.multiplyScalar(Math.exp(-2 * dt))
      p.s.scale.setScalar(p.size * (1.6 - p.life * 0.6))
      ;(p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, p.life) * 0.8
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
    const food = Math.round(this.food)
    const hud = `${food}|${Math.floor(this.time)}|${this.best}`
    if (hud === this.lastHud) return
    this.lastHud = hud
    this.el.food.textContent = `${food} %`
    this.el.foodBar.style.width = `${food}%`
    this.el.foodBox.classList.toggle('low', food < 30)
    this.el.time.textContent = String(Math.floor(this.time))
    this.el.best.textContent = `🏆 ${this.best}`
  }

  /* ---------- home again ---------- */

  /** Back in the village beside the camper, under cover of the fade. */
  private land() {
    const wasDriving = this.inWorld
    this.active = false
    this.inWorld = false
    this.onceSet.clear()
    this.lastFold = 0
    this.fan.hide()
    this.film.show(false)
    this.el.root.hidden = true
    this.el.msg.hidden = true
    for (const h of this.hulls) h.visible = false
    if (this.world) this.world.truck.visible = false
    for (const p of this.puffs) {
      p.life = 0
      p.s.visible = false
    }
    const { car, trailer } = this.camper
    for (const g of [car, trailer]) g.traverse((o) => (o.renderOrder = 0))
    this.camper.park()
    this.camera.fov = walkFov(this.camera.aspect)
    this.camera.updateProjectionMatrix()
    // stand by Musse and Kalle on the square side, facing them
    const p = trailer.localToWorld(new THREE.Vector3(5.2, 0, 0.6))
    const c = trailer.localToWorld(new THREE.Vector3(2.0, 0, 0.6))
    this.player.pos.set(p.x, 0, p.z)
    this.player.yaw = Math.atan2(-(c.x - p.x), -(c.z - p.z))
    this.player.pitch = -0.08
    this.player.vel.set(0, 0, 0)
    setTimeout(() => this.el.fade.classList.remove('on'), 80)
    if (wasDriving)
      this.say(
        this.score
          ? `🐭 Tack för skjutsen! ${this.score} poäng – vill du åka igen?`
          : '🦆 Va?! Ska vi inte åka upp på berget?',
      )
    this.score = 0
    this.onDone()
  }
}
