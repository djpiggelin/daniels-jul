// First-person walking: WASD + mouse, arrow keys, and a touch joystick. Hold forward a while and you start running.
// The mouse looks around straight away: grabbed (pointer lock) when the browser allows it,
// otherwise plain mouse movement turns the view, with the screen edges turning you further.
import * as THREE from 'three'
import { TOUCH } from './device'

export class Player {
  readonly pos = new THREE.Vector3(0, 0, 32)
  yaw = 0
  pitch = -0.06
  enabled = false
  /** Mouse sensitivity multiplier (Esc menu). */
  sens = 1
  /** How far zoomed in (1 = not at all): looking around slows down to match, so you can aim. */
  zoom = 1
  /** Throw wind-up: >0 leans back, <0 lurches forward. */
  lean = 0
  readonly vel = new THREE.Vector3()
  /** Out on the ice (Skridskosjön): you glide – faster, and slow to start, stop and turn. */
  ice = false
  private runFor = 0
  private keys = new Set<string>()
  private pending = false
  private mouse: { x: number; y: number } | null = null
  private joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }
  private look = { id: -1, x: 0, y: 0 }
  /** Where and when a finger came down – a short touch that hardly moved is a tap. */
  private press = new Map<number, { x: number; y: number; t: number; moved: number }>()
  /** A tap on the scene (touch): talk to / look at whatever is under the finger. */
  onTap: (x: number, y: number) => void = () => {}
  private bob = 0
  /** What you stand on, metres up (the floor, a stair, a gallery)… */
  floor = 0
  /** …feet above it (jumping, falling), and how fast that is changing. */
  height = 0
  /** The floor as the eye follows it: up a stair in a quick glide rather than a jolt. */
  private eye = 0
  private vy = 0
  readonly touch = TOUCH

  constructor(
    private camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
    private stick: HTMLElement,
    private knob: HTMLElement,
  ) {
    addEventListener('keydown', (e) => {
      if (!this.enabled || e.metaKey || e.ctrlKey) return
      this.keys.add(e.code)
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault() // no page scroll
        this.jump()
      }
      // a key press counts as a user gesture, so it can grab the mouse again (not Esc – the browser keeps that one)
      if (e.code !== 'Escape') this.lock()
    })
    addEventListener('keyup', (e) => this.keys.delete(e.code))
    addEventListener('blur', () => this.keys.clear())

    document.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY }
      if (!this.enabled || this.touch) return
      if (this.locked) this.turn(e.movementX, e.movementY, 0.0022 * this.sens)
      else this.turn(e.movementX, e.movementY, 0.0035 * this.sens)
    })
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) this.mouse = null
    })

    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return
      if (e.pointerType === 'mouse') return
      this.press.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 })
      try {
        dom.setPointerCapture(e.pointerId)
      } catch {
        /* not a real pointer – fine */
      }
      if (e.clientX < innerWidth * 0.45 && this.joy.id < 0) {
        this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 }
        this.stick.style.left = `${e.clientX}px`
        this.stick.style.top = `${e.clientY}px`
        this.stick.classList.add('on')
        this.knob.style.transform = ''
      } else if (this.look.id < 0) {
        this.look = { id: e.pointerId, x: e.clientX, y: e.clientY }
      }
    })
    dom.addEventListener('pointermove', (e) => {
      const p = this.press.get(e.pointerId)
      if (p) p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x, e.clientY - p.y))
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.ox
        let dy = e.clientY - this.joy.oy
        const len = Math.hypot(dx, dy)
        const max = 50
        if (len > max) {
          dx = (dx / len) * max
          dy = (dy / len) * max
        }
        this.joy.x = dx / max
        this.joy.y = dy / max
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`
      } else if (e.pointerId === this.look.id) {
        this.turn(e.clientX - this.look.x, e.clientY - this.look.y, 0.0055)
        this.look.x = e.clientX
        this.look.y = e.clientY
      }
    })
    const end = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      const p = this.press.get(e.pointerId)
      this.press.delete(e.pointerId)
      if (p && e.type === 'pointerup' && this.enabled && p.moved < 12 && performance.now() - p.t < 350) this.onTap(e.clientX, e.clientY)
      if (e.pointerId === this.joy.id) {
        this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }
        this.stick.classList.remove('on')
      }
      if (e.pointerId === this.look.id) this.look.id = -1
    }
    dom.addEventListener('pointerup', end)
    dom.addEventListener('pointercancel', end)
  }

  get locked() {
    return document.pointerLockElement === this.dom
  }

  /** Grab the mouse. Only works inside a user gesture (click or key press); harmless otherwise. */
  lock(onFail?: () => void) {
    if (this.touch || this.locked || this.pending) return
    this.pending = true
    try {
      Promise.resolve(this.dom.requestPointerLock() as unknown)
        .catch(() => onFail?.())
        .finally(() => (this.pending = false))
    } catch {
      this.pending = false
      onFail?.()
    }
  }

  /** Stop all movement input (keeps the mouse grabbed). */
  /** Jump – if your feet are on the ground. (Same pull of gravity as the snowballs.) */
  jump() {
    if (!this.enabled || this.height > 0.001 || this.vy !== 0) return
    this.vy = 4.6
  }

  stop() {
    this.keys.clear()
    this.press.clear()
    this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }
    this.look.id = -1
    this.stick.classList.remove('on')
  }

  private turn(dx: number, dy: number, k: number) {
    k /= this.zoom
    this.yaw -= dx * k
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.3, 1.2)
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
  }

  /**
   * `collide` pushes you out of walls (at the height your feet are at); `ground` says what there is to
   * stand on under a spot – the top of it, or null if something there is too high to step onto.
   */
  update(dt: number, collide: (p: THREE.Vector3, feet: number) => void, ground: (p: THREE.Vector3, feet: number) => number | null = () => 0) {
    const k = (c: string) => this.keys.has(c)
    if (this.enabled) {
      if (k('ArrowLeft')) this.yaw += dt * 1.9
      if (k('ArrowRight')) this.yaw -= dt * 1.9
      // mouse not grabbed: keep turning while the cursor rests near the left/right edge
      if (!this.locked && !this.touch && this.mouse) {
        const nx = (this.mouse.x / innerWidth) * 2 - 1
        const edge = 0.8
        if (Math.abs(nx) > edge) this.yaw -= Math.sign(nx) * ((Math.abs(nx) - edge) / (1 - edge)) * 2.2 * dt
      }
    }
    const fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) - this.joy.y
    const side = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0) + this.joy.x
    // running kicks in after walking forward for a moment
    this.runFor = this.enabled && fwd > 0.5 ? this.runFor + dt : 0
    // the stick pushed all the way: run straight away
    if (this.enabled && Math.hypot(this.joy.x, this.joy.y) > 0.92 && fwd > 0.5) this.runFor = Math.max(this.runFor, 1.8)
    const run = THREE.MathUtils.smoothstep(this.runFor, 1.1, 1.8)
    const f = this.forward
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const dir = f.multiplyScalar(fwd).add(r.multiplyScalar(side))
    if (dir.lengthSq() > 1) dir.normalize()
    const target = dir.multiplyScalar(this.enabled ? (this.ice ? 5 + run * 3 : 4.2 + run * 2.6) : 0)
    this.vel.lerp(target, 1 - Math.exp(-(this.ice ? 1.4 : 10) * dt))
    const was = this.pos.clone()
    this.pos.addScaledVector(this.vel, dt)
    const feet = this.floor + this.height
    collide(this.pos, feet)
    // (moved far in one go – taken somewhere: start again from whatever is there)
    if (was.distanceToSquared(this.pos) > 9) this.floor = this.eye = this.height = this.vy = 0
    // up a step, down off an edge, or stopped by something too high (sliding along it if you can)
    let top = ground(this.pos, this.floor + this.height)
    // (already inside something – put down there by a teleport: up on top of it)
    if (top === null && ground(was, feet) === null) top = ground(this.pos, Infinity) ?? 0
    if (top === null) {
      const along = [new THREE.Vector3(this.pos.x, 0, was.z), new THREE.Vector3(was.x, 0, this.pos.z)]
      const free = along.find((p) => ground(p, feet) !== null)
      this.pos.set(free ? free.x : was.x, this.pos.y, free ? free.z : was.z)
      top = ground(this.pos, feet) ?? this.floor
    }
    if (top > this.floor) {
      this.height = Math.max(0, this.height - (top - this.floor))
      this.floor = top
    } else if (top < this.floor) {
      this.height += this.floor - top
      this.floor = top
    }
    this.eye += (this.floor - this.eye) * Math.min(1, dt * 14)
    if (Math.abs(this.floor - this.eye) > 1.5) this.eye = this.floor

    const speed = this.vel.length()
    this.bob += dt * speed * 2.2
    // up and down: about 80 cm at the top of a jump
    if (this.vy !== 0 || this.height > 0) {
      this.vy -= 13 * dt
      this.height += this.vy * dt
      if (this.height <= 0) {
        this.height = 0
        this.vy = 0
      }
    }
    const airborne = this.height > 0
    // (on skates you glide along: hardly a bob, a sway from side to side instead)
    const bobY = airborne ? 0 : Math.sin(this.bob) * (this.ice ? 0.012 : 0.045) * Math.min(1, speed / 4)
    // lean back while winding up a throw (head goes back and up a little)
    const back = this.lean * 0.16
    this.camera.position.set(this.pos.x + Math.sin(this.yaw) * back, 1.62 + this.eye + this.height + bobY - Math.abs(this.lean) * 0.04, this.pos.z + Math.cos(this.yaw) * back)
    this.camera.rotation.set(this.pitch + this.lean * 0.13, this.yaw, -this.lean * 0.05 + (this.ice ? Math.sin(this.bob * 0.5) * 0.035 * Math.min(1, speed / 4) : 0), 'YXZ')
  }
}
