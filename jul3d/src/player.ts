// First-person walking: WASD + mouse, arrow keys, and a touch joystick. Hold forward a while and you start running.
// The mouse looks around straight away: grabbed (pointer lock) when the browser allows it,
// otherwise plain mouse movement turns the view, with the screen edges turning you further.
import * as THREE from 'three'
import { TOUCH } from './device'

export class Player {
  readonly pos = new THREE.Vector3(0, 0, 25)
  yaw = 0
  pitch = -0.06
  enabled = false
  /** Mouse sensitivity multiplier (Esc menu). */
  sens = 1
  /** Throw wind-up: >0 leans back, <0 lurches forward. */
  lean = 0
  readonly vel = new THREE.Vector3()
  private runFor = 0
  private keys = new Set<string>()
  private pending = false
  private mouse: { x: number; y: number } | null = null
  private joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }
  private look = { id: -1, x: 0, y: 0 }
  private bob = 0
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
  stop() {
    this.keys.clear()
    this.joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }
    this.look.id = -1
    this.stick.classList.remove('on')
  }

  private turn(dx: number, dy: number, k: number) {
    this.yaw -= dx * k
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.3, 1.2)
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
  }

  update(dt: number, collide: (p: THREE.Vector3) => void) {
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
    const run = THREE.MathUtils.smoothstep(this.runFor, 1.1, 1.8)
    const f = this.forward
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const dir = f.multiplyScalar(fwd).add(r.multiplyScalar(side))
    if (dir.lengthSq() > 1) dir.normalize()
    const target = dir.multiplyScalar(this.enabled ? 4.2 + run * 2.6 : 0)
    this.vel.lerp(target, 1 - Math.exp(-10 * dt))
    this.pos.addScaledVector(this.vel, dt)
    collide(this.pos)

    const speed = this.vel.length()
    this.bob += dt * speed * 2.2
    const bobY = Math.sin(this.bob) * 0.045 * Math.min(1, speed / 4)
    // lean back while winding up a throw (head goes back and up a little)
    const back = this.lean * 0.16
    this.camera.position.set(this.pos.x + Math.sin(this.yaw) * back, 1.62 + bobY - Math.abs(this.lean) * 0.04, this.pos.z + Math.cos(this.yaw) * back)
    this.camera.rotation.set(this.pitch + this.lean * 0.13, this.yaw, -this.lean * 0.05, 'YXZ')
  }
}
