// Tomtens släde – the flying game. Push Tomten out, jump in and fly the sleigh through the polkagris
// rings in the sky round the village. Every ring buys a few more seconds; when the clock runs out you
// glide back to where the sleigh was parked (and Tomten climbs back in).
import * as THREE from 'three'
import { TOUCH, walkFov } from './device'
import { keepApart } from './batch'
import type { Player } from './player'
import { blip, whoosh } from './sfx'
import { EYE, type Sleigh } from './sleigh'
import { glowTexture, makeCanvas, rng, toTexture } from './tex'
import { groundHeight } from './world'

const R = 4.6
const TUBE = 0.5
const SPEED = 24
const BOOST = 38
const START_TIME = 20
const AHEAD = 5
/** The point that has to go through the rings: the middle of the team, just in front of the sleigh. */
const REF = new THREE.Vector3(0, 1.6, -2)
const FOG = { walk: 0.021, fly: 0.0065 }
const BEST_KEY = 'jul3d.best.slade'
/** Points until it's as hard as it gets: faster, tighter turns, smaller rings. */
const HARDEST = 40
const touch = TOUCH

type State = 'board' | 'takeoff' | 'fly' | 'over' | 'fade'
type Ring = {
  group: THREE.Group
  spin: THREE.Mesh
  halo: THREE.Mesh
  mat: THREE.MeshStandardMaterial
  n: THREE.Vector3
  size: number
  state: 'free' | 'ahead' | 'passed' | 'missed'
  t: number
}

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt))

/** Red and white stripes that wind round the tube like a polkagris. */
function candyTexture() {
  const [c, ctx] = makeCanvas(256, 64)
  ctx.fillStyle = '#fff6ee'
  ctx.fillRect(0, 0, 256, 64)
  const stripe = (x: number, w: number, col: string) => {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(x, 64)
    ctx.lineTo(x + w, 64)
    ctx.lineTo(x + w + 64, 0)
    ctx.lineTo(x + 64, 0)
    ctx.fill()
  }
  for (let x = -128; x < 256; x += 64) {
    stripe(x, 26, '#e3203a')
    stripe(x + 34, 5, '#e3203a')
  }
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(7, 1)
  return t
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

export class Flight {
  active = false
  /** Where the sleigh is (the village's sky and snow follow it). */
  readonly pos = new THREE.Vector3()
  private state: State = 'board'
  private stateT = 0
  private yaw = 0
  private pitch = 0
  private roll = 0
  private speed = 0
  private keys = new Set<string>()
  private mstick = new THREE.Vector2()
  private stick = new THREE.Vector2()
  private touchId = -1
  private touchFrom = { x: 0, y: 0 }
  private paused = false
  private armedAt = 0
  private from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  private score = 0
  private time = START_TIME
  private best = readBest()
  private rings: Ring[] = []
  private cursor = { pos: new THREE.Vector3(), yaw: 0 }
  private prevRef = new THREE.Vector3()
  private jingleT = 0
  private rand = rng(Date.now() % 100000)
  private sparks: { pts: THREE.Points; pos: Float32Array; col: Float32Array; vel: Float32Array; life: Float32Array; next: number }
  private flakes: { pts: THREE.Points; pos: Float32Array }
  private el = {
    root: document.getElementById('flight')!,
    score: document.querySelector<HTMLElement>('#flight .fl-score b')!,
    time: document.querySelector<HTMLElement>('#flight .fl-time b')!,
    timeBox: document.querySelector<HTMLElement>('#flight .fl-time')!,
    best: document.querySelector<HTMLElement>('#flight .fl-best')!,
    msg: document.querySelector<HTMLElement>('#flight .fl-msg')!,
    arrow: document.querySelector<HTMLElement>('#flight .fl-arrow')!,
    dot: document.querySelector<HTMLElement>('#flight .fl-dot')!,
    aim: document.querySelector<HTMLElement>('#flight .fl-aim')!,
    fade: document.getElementById('fade')!,
  }
  /** Called once you're back on your feet beside the sleigh. */
  onDone: () => void = () => {}

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private player: Player,
    private sleigh: Sleigh,
  ) {
    // the rings, made up front and reused
    const candy = candyTexture()
    const tube = new THREE.TorusGeometry(R, TUBE, 14, 72)
    const haloGeo = new THREE.TorusGeometry(R, TUBE * 2.6, 10, 72)
    for (let i = 0; i < AHEAD + 4; i++) {
      const mat = new THREE.MeshStandardMaterial({ map: candy, emissive: 0xffffff, emissiveMap: candy, emissiveIntensity: 0.55, roughness: 0.35, transparent: true })
      const spin = new THREE.Mesh(tube, mat)
      const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }))
      const group = keepApart(new THREE.Group())
      group.add(spin, halo)
      group.visible = false
      scene.add(group)
      this.rings.push({ group, spin, halo, mat, n: new THREE.Vector3(), size: 1, state: 'free', t: 0 })
    }

    // gold sparkles trailing off the runners
    const N = 420
    const sp = new THREE.BufferGeometry()
    const pos = new Float32Array(N * 3).fill(-999)
    const col = new Float32Array(N * 3)
    sp.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    sp.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const sparkTex = glowTexture('rgba(255,240,190,1)', 'rgba(255,190,80,0)')
    const pts = new THREE.Points(sp, new THREE.PointsMaterial({ size: 0.5, map: sparkTex, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }))
    pts.frustumCulled = false
    scene.add(pts)
    this.sparks = { pts, pos, col, vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0 }

    // snow rushing past (it lives in the world; the box follows the sleigh)
    const F = touch ? 500 : 900
    const fpos = new Float32Array(F * 3)
    for (let i = 0; i < F * 3; i++) fpos[i] = (Math.random() - 0.5) * 90
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3))
    const fl = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.4, map: sparkTex, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }))
    fl.frustumCulled = false
    fl.visible = false
    scene.add(fl)
    this.flakes = { pts: fl, pos: fpos }

    // steering
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
      if (this.active && this.state === 'fly') this.pause()
    })
    document.addEventListener('mousemove', (e) => {
      if (!this.active || touch) return
      const k = 0.0032 * this.player.sens
      this.mstick.x += e.movementX * k
      this.mstick.y -= e.movementY * k
      if (this.mstick.lengthSq() > 1) this.mstick.normalize()
    })
    document.addEventListener('pointerdown', (e) => {
      if (!this.active || (e.target as HTMLElement).closest('button')) return
      if (this.paused) this.unpause()
      else this.player.lock()
      if (e.pointerType !== 'mouse' && this.touchId < 0) {
        this.touchId = e.pointerId
        this.touchFrom = { x: e.clientX, y: e.clientY }
      }
    })
    document.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.touchId) return
      this.mstick.set((e.clientX - this.touchFrom.x) / 70, -(e.clientY - this.touchFrom.y) / 70)
      if (this.mstick.lengthSq() > 1) this.mstick.normalize()
    })
    const lift = (e: PointerEvent) => {
      if (e.pointerId !== this.touchId) return
      this.touchId = -1
      this.mstick.set(0, 0)
    }
    document.addEventListener('pointerup', lift)
    document.addEventListener('pointercancel', lift)
    document.getElementById('flight-exit')!.addEventListener('click', () => this.leave())
  }

  /** Climb in (Tomten has just been shoved out). */
  start() {
    if (this.active) return
    this.active = true
    this.state = 'board'
    this.stateT = 0
    this.paused = false
    this.armedAt = performance.now() + 200
    this.from.pos.copy(this.camera.position)
    this.from.quat.copy(this.camera.quaternion)
    this.yaw = this.sleigh.home.yaw
    this.pitch = this.roll = this.speed = 0
    this.pos.copy(this.sleigh.group.position)
    this.mstick.set(0, 0)
    this.keys.clear()
    this.score = 0
    this.time = START_TIME
    for (const r of this.rings) this.freeRing(r)
    // the course starts out over the fields, the way the sleigh is facing
    const out = new THREE.Vector3(-Math.sin(this.sleigh.home.yaw - 0.35), 0, -Math.cos(this.sleigh.home.yaw - 0.35))
    this.cursor.pos.copy(this.pos).addScaledVector(out, 18).setY(12)
    this.cursor.yaw = this.sleigh.home.yaw - 0.35
    for (let i = 0; i < AHEAD; i++) this.addRing(i === 0 ? 0.15 : 1)
    this.target()!.halo.visible = true
    this.el.root.hidden = false
    this.el.root.classList.remove('over')
    this.message('Flyg genom polkagrisarna! 🍬', 2.4)
    this.syncHud()
    blip(660, 0.08, 'triangle', 0.05)
  }

  /** Land now (Q / Esc / the button). */
  leave() {
    if (!this.active || this.state === 'fade') return
    this.saveBest()
    this.toFade()
  }

  private pause() {
    this.paused = true
    this.message(touch ? 'Pausat – tryck för att flyga vidare' : 'Pausat – klicka för att flyga vidare', 999)
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

  private saveBest() {
    if (this.score <= this.best) return false
    this.best = this.score
    try {
      localStorage.setItem(BEST_KEY, String(this.score))
    } catch {
      /* no storage – the record lasts until reload */
    }
    return true
  }

  /* ---------- rings ---------- */

  private target() {
    return this.rings.find((r) => r.state === 'ahead') ?? null
  }

  private freeRing(r: Ring) {
    r.state = 'free'
    r.group.visible = false
  }

  /** 0 at the start … 1 once you've scored HARDEST points. */
  private get level() {
    return Math.min(1, this.score / HARDEST)
  }

  private addRing(wiggle: number) {
    const r = this.rings.find((x) => x.state === 'free')
    if (!r) return
    const c = this.cursor
    const lv = this.level
    // later rings swing further left/right and up/down
    wiggle *= 1 + lv * 0.7
    let yaw = c.yaw + (this.rand() - 0.5) * 1.1 * wiggle
    // drift back towards the village when straying too far
    const away = Math.hypot(c.pos.x, c.pos.z)
    const home = Math.atan2(c.pos.x, c.pos.z)
    const pull = THREE.MathUtils.smoothstep(away, 70, 130) * 0.85
    yaw += Math.atan2(Math.sin(home - yaw), Math.cos(home - yaw)) * pull
    const dist = 50 + this.rand() * 14
    const y = THREE.MathUtils.clamp(c.pos.y + (this.rand() - 0.45) * 22 * wiggle, 16, 58)
    const p = new THREE.Vector3(c.pos.x - Math.sin(yaw) * dist, y, c.pos.z - Math.cos(yaw) * dist)
    r.n.copy(p).sub(c.pos).normalize()
    r.group.position.copy(p)
    r.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.n)
    r.size = 1 - lv * 0.35
    r.group.scale.setScalar(r.size)
    r.group.visible = true
    r.halo.visible = false
    r.mat.opacity = 1
    r.mat.color.set(0xffffff)
    r.mat.emissiveIntensity = 0.55
    r.state = 'ahead'
    r.t = 0
    // keep it in the ring order: move to the end of the list
    this.rings.splice(this.rings.indexOf(r), 1)
    this.rings.push(r)
    c.pos.copy(p)
    c.yaw = yaw
  }

  /** Did the line from a to b go through the target ring? */
  private checkRing(a: THREE.Vector3, b: THREE.Vector3) {
    const r = this.target()
    if (!r) return
    const c = r.group.position
    const s0 = a.clone().sub(c).dot(r.n)
    const s1 = b.clone().sub(c).dot(r.n)
    // flew past it without going through: missed
    const rad = R * r.size
    if (s1 > 30 || (s0 < 0 && s1 >= 0 && this.crossAt(a, b, s0, s1).distanceTo(c) > rad + TUBE * 0.4)) return this.miss(r)
    if (!(s0 < 0 && s1 >= 0)) return
    const d = this.crossAt(a, b, s0, s1).distanceTo(c)
    const perfect = d < rad * 0.4
    const before = Math.floor(this.score / 10)
    // each ring buys a little less time the better you do
    const bonus = Math.round((Math.max(0.5, 3.5 - this.score * 0.05) + (perfect ? 0.5 : 0)) * 2) / 2
    this.score += perfect ? 2 : 1
    this.time += bonus
    r.state = 'passed'
    r.t = 0
    // every ten points the team picks up the pace
    if (Math.floor(this.score / 10) > before && this.score < HARDEST + 10) this.message(`🦌💨 Snabbare! ${this.score} poäng`, 1.6)
    else this.message(perfect ? `Perfekt! +2  ⏱ +${bonus} s` : `+1  ⏱ +${bonus} s`, 1.1)
    whoosh()
    blip(perfect ? 1320 : 990, 0.12, 'triangle', 0.07)
    setTimeout(() => blip(perfect ? 1760 : 1320, 0.12, 'triangle', 0.06), 90)
    this.nextRing()
  }

  private crossAt(a: THREE.Vector3, b: THREE.Vector3, s0: number, s1: number) {
    return a.clone().lerp(b, s0 / (s0 - s1))
  }

  private miss(r: Ring) {
    r.state = 'missed'
    r.t = 0
    this.message('Miss!', 0.9)
    blip(220, 0.25, 'sawtooth', 0.05)
    this.nextRing()
  }

  private nextRing() {
    this.addRing(1)
    const t = this.target()
    if (t) t.halo.visible = true
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
    const hud = `${this.score}|${this.time.toFixed(1)}|${this.best}`
    if (hud === this.lastHud) return
    this.lastHud = hud
    this.el.score.textContent = String(this.score)
    this.el.time.textContent = Math.max(0, this.time).toFixed(1)
    this.el.timeBox.classList.toggle('low', this.time < 5)
    this.el.best.textContent = `🏆 ${Math.max(this.best, this.score)}`
  }

  /** Point at the next ring when it's off screen. */
  private pointAtRing() {
    const r = this.target()
    const v = r && this.state === 'fly' ? r.group.position.clone().project(this.camera) : null
    const behind = !!v && v.z > 1
    if (!v || (!behind && Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.8)) {
      this.el.arrow.hidden = true
      return
    }
    let x = behind ? -v.x : v.x
    let y = behind ? -v.y : v.y
    if (behind && Math.hypot(x, y) < 0.01) y = -1
    const a = Math.atan2(y, x)
    x = Math.cos(a) * 0.42 * innerWidth
    y = Math.sin(a) * 0.38 * innerHeight
    this.el.arrow.hidden = false
    this.el.arrow.style.transform = `translate(${x}px, ${-y}px) rotate(${-a}rad)`
  }

  /* ---------- the frame ---------- */

  private seatPose() {
    const g = this.sleigh.group
    g.updateMatrixWorld()
    const pos = g.localToWorld(EYE.clone())
    // the camera banks a little less than the sleigh, and looks a touch down at the team
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch - 0.1, this.yaw, this.roll * 0.6, 'YXZ'))
    return { pos, quat }
  }

  update(dt: number, t: number) {
    if (!this.active) return
    if (this.paused) dt = 0
    this.stateT += dt
    const s = this.state

    // input → stick, keys on top of the mouse
    const k = (c: string) => this.keys.has(c)
    if (!touch && this.touchId < 0) this.mstick.multiplyScalar(Math.exp(-0.7 * dt))
    const kx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0)
    const ky = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0)
    this.stick.set(THREE.MathUtils.clamp(kx + this.mstick.x, -1, 1), THREE.MathUtils.clamp(ky + this.mstick.y, -1, 1))
    const boost = s === 'fly' && (k('Space') || k('ShiftLeft') || k('ShiftRight'))

    if (s === 'board') {
      // nothing moves until you're in the seat
      if (this.stateT > 0.85) {
        this.state = 'takeoff'
        this.stateT = 0
        this.jingle(1)
      }
    } else if (s === 'takeoff') {
      // off across the snow, then up and away with a turn out over the fields
      const k = this.stateT
      this.speed = Math.min(SPEED, 3 + k * 14)
      this.pitch = damp(this.pitch, k > 0.35 ? 0.42 : 0.05, 3, dt)
      this.yaw = damp(this.yaw, this.sleigh.home.yaw - 0.35, 1.2, dt)
      this.roll = damp(this.roll, k < 1.2 ? 0.25 : 0, 3, dt)
      if (k > 2.2) {
        this.state = 'fly'
        this.stateT = 0
      }
    } else if (s === 'fly') {
      // faster as you score, with a little more steering to match
      const cruise = SPEED + this.level * 18
      this.yaw -= this.stick.x * (1.3 + this.level * 0.5) * dt
      this.pitch = damp(this.pitch, this.stick.y * 0.6, 3, dt)
      this.roll = damp(this.roll, -this.stick.x * 0.65, 4, dt)
      this.speed = damp(this.speed, boost ? cruise * (BOOST / SPEED) : cruise, 2.2, dt)
      this.time -= dt
      if (this.time <= 0) {
        this.time = 0
        const record = this.saveBest()
        this.state = 'over'
        this.stateT = 0
        this.el.root.classList.add('over')
        this.message(record ? `Tiden är ute! ${this.score} poäng – nytt rekord! 🎉` : `Tiden är ute! ${this.score} poäng`, 999)
        blip(record ? 1320 : 330, 0.3, 'triangle', 0.07)
      }
    } else if (s === 'over') {
      // level out and glide while the score shows
      this.pitch = damp(this.pitch, 0, 2, dt)
      this.roll = damp(this.roll, 0, 2, dt)
      if (this.stateT > 2.6) this.toFade()
    } else if (s === 'fade' && this.stateT > 0.55) {
      this.land()
      return
    }

    // move the sleigh
    if (s !== 'board') {
      const cp = Math.cos(this.pitch)
      this.pos.x -= Math.sin(this.yaw) * cp * this.speed * dt
      this.pos.z -= Math.cos(this.yaw) * cp * this.speed * dt
      this.pos.y += Math.sin(this.pitch) * this.speed * dt
      // keep clear of the ground, the julgran and the roofs; and not up among the stars
      let floor = groundHeight(this.pos.x, this.pos.z) + (Math.hypot(this.pos.x, this.pos.z) < 34 ? 10 : 3)
      // and well over Leksaksfabriken's tower up north
      if (Math.abs(this.pos.x) < 26 && this.pos.z < -62 && this.pos.z > -106) floor = Math.max(floor, 46)
      if (s !== 'takeoff' && this.pos.y < floor) {
        this.pos.y = damp(this.pos.y, floor, 8, dt)
        this.pitch = Math.max(this.pitch, 0.12)
      }
      if (this.pos.y > 80) {
        this.pos.y = 80
        this.pitch = Math.min(this.pitch, 0)
      }
      const g = this.sleigh.group
      g.position.copy(this.pos)
      g.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ')
      this.sleigh.gallop = damp(this.sleigh.gallop, 1, 2.5, dt)
    }

    // the camera: glide into the seat, then ride along
    const seat = this.seatPose()
    if (s === 'board') {
      const k = THREE.MathUtils.smootherstep(this.stateT / 0.85, 0, 1)
      this.camera.position.lerpVectors(this.from.pos, seat.pos, k)
      this.camera.position.y += Math.sin(k * Math.PI) * 0.7
      this.camera.quaternion.slerpQuaternions(this.from.quat, seat.quat, k)
    } else {
      const shake = boost ? 0.025 : 0.006
      this.camera.position.copy(seat.pos).add(new THREE.Vector3(Math.sin(t * 31) * shake, Math.sin(t * 27) * shake, 0))
      this.camera.quaternion.copy(seat.quat)
    }
    // clear the haze so you can see far out over the forest
    const fog = this.scene.fog as THREE.FogExp2
    if (s !== 'board') fog.density = damp(fog.density, FOG.fly, 1.5, dt)
    // as when walking, a phone held upright gets a wider view
    const base = walkFov(this.camera.aspect)
    const fov = s === 'board' ? base : Math.min(base + 22, base + 2 + (this.speed - SPEED) * 0.6)
    this.camera.fov = damp(this.camera.fov, fov, 4, dt)
    this.camera.updateProjectionMatrix()

    // rings: go through the next one
    const ref = this.sleigh.group.localToWorld(REF.clone())
    if (s === 'fly') this.checkRing(this.prevRef, ref)
    this.prevRef.copy(ref)
    for (const r of this.rings) {
      if (r.state === 'free') continue
      r.t += dt
      r.spin.rotation.z += dt * 0.5
      if (r.state === 'ahead') {
        const target = r === this.target()
        r.mat.emissiveIntensity = target ? 0.75 + Math.sin(t * 6) * 0.15 : 0.45
        ;(r.halo.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 6) * 0.08
      } else {
        // passed: burst outwards and fade; missed: go grey and sink away
        const k = Math.min(1, r.t / 0.7)
        if (r.state === 'passed') r.group.scale.setScalar(r.size * (1 + k * 0.8))
        else {
          r.mat.color.setScalar(0.4)
          r.mat.emissiveIntensity = 0.1
          r.group.position.y -= dt * 4
        }
        r.mat.opacity = 1 - k
        r.halo.visible = false
        if (k >= 1) this.freeRing(r)
      }
    }

    this.updateSparks(dt, s !== 'board' && s !== 'fade')
    this.updateFlakes()
    if (s === 'fly' && (this.jingleT -= dt) <= 0) this.jingle(0.25)

    // HUD
    if (this.msgTimer > 0 && (this.msgTimer -= dt) <= 0) this.el.msg.hidden = true
    this.el.dot.style.transform = `translate(${this.stick.x * 34}px, ${-this.stick.y * 34}px)`
    // the sight sits where you're heading, a little way out
    const aim = ref.addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(this.sleigh.group.quaternion), 45).project(this.camera)
    this.el.aim.style.transform = `translate(${(aim.x * innerWidth) / 2}px, ${(-aim.y * innerHeight) / 2}px)`
    this.syncHud()
    this.pointAtRing()
  }

  /** Back on the ground beside the parked sleigh, under cover of the fade. */
  private land() {
    this.active = false
    for (const r of this.rings) this.freeRing(r)
    this.el.root.hidden = true
    this.el.arrow.hidden = true
    this.el.msg.hidden = true
    this.flakes.pts.visible = false
    this.sparks.life.fill(0)
    this.sparks.pos.fill(-999)
    this.sparks.pts.geometry.attributes.position.needsUpdate = true
    ;(this.scene.fog as THREE.FogExp2).density = FOG.walk
    this.camera.fov = walkFov(this.camera.aspect)
    this.camera.updateProjectionMatrix()
    this.sleigh.park()
    this.sleigh.reseat()
    this.sleigh.say(
      // (taken from the slädverkstad, Tomten at home: no one to tell you off – this time)
      !this.sleigh.driver
        ? '🦌 Renarna travar tillbaka till stallet. Ingen märkte något … tror du.'
        : this.score >= 10
          ? '🎅 Hmpf… inte illa flugit, faktiskt. Men nästa gång frågar du först!'
          : '🎅 Nästa gång frågar du först! Och Rudolf behöver vila nu.',
    )
    // stand on the village side of the sleigh, facing it
    const g = this.sleigh.group
    const p = g.localToWorld(new THREE.Vector3(2.4, 0, -1.8))
    this.player.pos.set(p.x, 0, p.z)
    const c = g.localToWorld(new THREE.Vector3(0, 0, -2.6))
    this.player.yaw = Math.atan2(-(c.x - p.x), -(c.z - p.z))
    this.player.pitch = -0.12
    this.player.vel.set(0, 0, 0)
    setTimeout(() => this.el.fade.classList.remove('on'), 80)
    this.onDone()
  }

  private jingle(vol: number) {
    this.jingleT = 0.9 + Math.random() * 0.5
    for (let i = 0; i < 5; i++) setTimeout(() => blip(2300 + Math.random() * 900, 0.06, 'triangle', 0.025 * vol), i * 45 + Math.random() * 20)
  }

  private updateSparks(dt: number, emit: boolean) {
    const { pos, col, vel, life } = this.sparks
    const N = life.length
    if (emit) {
      const g = this.sleigh.group
      const n = Math.ceil(dt * 160)
      for (let j = 0; j < n; j++) {
        const i = this.sparks.next
        this.sparks.next = (i + 1) % N
        const p = g.localToWorld(new THREE.Vector3(j % 2 ? 0.6 : -0.6, 0.1, 1.2 + Math.random() * 0.4))
        pos.set([p.x, p.y, p.z], i * 3)
        vel.set([(Math.random() - 0.5) * 1.2, -0.6 - Math.random(), (Math.random() - 0.5) * 1.2], i * 3)
        life[i] = 1
      }
    }
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue
      life[i] -= dt * 0.8
      const j = i * 3
      pos[j] += vel[j] * dt
      pos[j + 1] += vel[j + 1] * dt
      pos[j + 2] += vel[j + 2] * dt
      const l = Math.max(0, life[i])
      // gold fading to nothing, with a twinkle
      const tw = 0.6 + 0.4 * Math.sin(i * 12.9 + l * 40)
      col[j] = l * tw
      col[j + 1] = l * 0.8 * tw
      col[j + 2] = l * 0.45 * tw
      if (life[i] <= 0) pos[j + 1] = -999
    }
    this.sparks.pts.geometry.attributes.position.needsUpdate = true
    this.sparks.pts.geometry.attributes.color.needsUpdate = true
  }

  private updateFlakes() {
    const { pts, pos } = this.flakes
    pts.visible = this.state !== 'board'
    const c = this.camera.position
    const B = 90
    for (let i = 0; i < pos.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        const d = pos[i + a] - c.getComponent(a)
        if (d > B / 2) pos[i + a] -= B
        else if (d < -B / 2) pos[i + a] += B
      }
    }
    pts.geometry.attributes.position.needsUpdate = true
  }
}
