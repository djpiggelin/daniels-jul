// Hold Shift (or the ❄️ button) to wind up – the player leans back and the arm pulls over the shoulder –
// let go to throw. The longer you hold, the further it flies.
import * as THREE from 'three'
import type { Player } from './player'
import { whoosh } from './sfx'
import type { Snowballs } from './snowballs'
import type { Viewmodel } from './viewmodel'

const WIND_UP = 0.9

export class Thrower {
  private charging = false
  private charge = 0
  private cooldown = 0
  private leanVel = 0
  private bar = document.querySelector<HTMLElement>('#charge')!
  private fill = this.bar.querySelector<HTMLElement>('i')!

  constructor(
    private player: Player,
    private camera: THREE.Camera,
    private vm: Viewmodel,
    private balls: Snowballs,
    private allowed: () => boolean,
  ) {
    addEventListener('keydown', (e) => {
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) this.start()
    })
    addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.release()
    })
    addEventListener('blur', () => this.cancel())
    const btn = document.getElementById('throw')!
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      btn.classList.add('on')
      this.start()
    })
    const up = () => {
      btn.classList.remove('on')
      this.release()
    }
    btn.addEventListener('pointerup', up)
    btn.addEventListener('pointercancel', up)
    btn.addEventListener('pointerleave', up)
  }

  start() {
    if (!this.allowed() || this.charging || this.cooldown > 0) return
    this.charging = true
    this.charge = 0
  }

  /** Drop the snowball without throwing (a popup opened, the window lost focus…). */
  cancel() {
    this.charging = false
    this.charge = 0
  }

  /** A snowball left your hand (for the other players to see). */
  onThrow: (from: THREE.Vector3, vel: THREE.Vector3) => void = () => {}

  release() {
    if (!this.charging) return
    this.charging = false
    if (!this.allowed()) return
    const c = Math.max(0.15, this.charge)
    const { yaw, pitch } = this.player
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch) + 0.1, -Math.cos(yaw) * Math.cos(pitch)).normalize()
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    const from = this.camera.position.clone().addScaledVector(right, 0.22).addScaledVector(dir, 0.35)
    from.y -= 0.05
    const vel = dir.multiplyScalar(9 + c * 15).add(this.player.vel)
    this.balls.throw(from, vel)
    this.onThrow(from, vel)
    this.vm.release()
    whoosh()
    // lurch forward with the throw
    this.leanVel = -7 - c * 5
    this.cooldown = 0.32
  }

  /** Rocked back by an incoming snowball. */
  knock() {
    this.leanVel += 9
  }

  update(dt: number, t: number) {
    this.cooldown -= dt
    if (this.charging && !this.allowed()) this.cancel()
    if (this.charging) this.charge = Math.min(1, this.charge + dt / WIND_UP)
    // springy lean: back while holding, a quick lunge forward after letting go
    const target = this.charging ? THREE.MathUtils.smoothstep(this.charge, 0, 1) : 0
    this.leanVel += ((target - this.player.lean) * 90 - this.leanVel * 13) * dt
    this.player.lean += this.leanVel * dt
    this.vm.pose(dt, t, this.charging ? this.charge : null)
    this.bar.classList.toggle('on', this.charging)
    this.fill.style.width = `${Math.round(this.charge * 100)}%`
  }
}
