// Kolhackning – your own turn at the coal face in Stora orten. A free seam, a pick left leaning on a
// rock: take it, and glints show in the coal here and there – hack them before they fade. Hits in a
// row build a combo, and a hit right as the miners' picks come down on the heave of their song
// counts double ("Ej uchnem!"). Forty seconds a round; your best is kept.
import * as THREE from 'three'
import { TOUCH } from './device'
import { blip, clunk, noise } from './sfx'
import { glowTexture, makeCanvas, toTexture } from './tex'

const BEST_KEY = 'jul3d.best.kolhackning'
const ROUND = 40
const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

/** Where you stand to hack: on the floor facing the seam; the seam's middle and which way is "across" it. */
export type HackSpot = { x: number; z: number; yaw: number; seam: THREE.Vector3 }

function ringTexture() {
  const [c, ctx] = makeCanvas(128, 128)
  ctx.strokeStyle = 'rgba(255,230,160,0.95)'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.arc(64, 64, 56, 0, Math.PI * 2)
  ctx.stroke()
  return toTexture(c)
}

type Glint = { spark: THREE.Sprite; ring: THREE.Sprite; age: number; life: number; on: boolean }

export class Hacking {
  active = false
  onLeft: () => void = () => {}
  private spot: HackSpot | null = null
  private heave: () => number = () => 99
  private glints: Glint[] = []
  private chunks: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = []
  private pick = new THREE.Group()
  private swing = 0
  /** Where the pick will strike, on the screen (px): it follows the mouse; a tap goes straight there. */
  private ax = 0
  private ay = 0
  private reticle: HTMLElement
  private left = ROUND
  private spawn = 0
  private score = 0
  private combo = 0
  private best = 0
  private over = false
  private hud: HTMLElement
  private panel: HTMLElement
  private flash = ''
  private flashT = 0
  private across = new THREE.Vector3()
  /** From where you stand, into the rock. */
  private out = new THREE.Vector3()

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    const sparkTex = glowTexture('rgba(255,250,220,1)', 'rgba(255,200,90,0)')
    const ringTex = ringTexture()
    for (let i = 0; i < 4; i++) {
      const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
      const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthWrite: false, toneMapped: false }))
      spark.visible = ring.visible = false
      scene.add(spark, ring)
      this.glints.push({ spark, ring, age: 0, life: 1, on: false })
    }
    // the pick in your hands, bottom right
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 8), std(0x7a5a3a, 0.9))
    handle.position.y = 0.3
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.5, 8), std(0x7a7e88, 0.35, 0.8))
    head.rotation.z = Math.PI / 2
    head.position.set(-0.1, 0.68, 0)
    this.pick.add(handle, head)
    this.pick.scale.setScalar(0.7)
    this.pick.visible = false
    scene.add(this.pick)

    this.hud = document.createElement('div')
    this.hud.id = 'hack-hud'
    this.hud.hidden = true
    this.panel = document.createElement('div')
    this.panel.id = 'hack-panel'
    this.panel.hidden = true
    this.reticle = document.createElement('div')
    this.reticle.id = 'hack-aim'
    this.reticle.hidden = true
    document.body.append(this.hud, this.panel, this.reticle)
    const css = document.createElement('style')
    css.textContent = `
#hack-hud { position: fixed; top: max(14px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 5; color: #fbf3e0; font: 600 18px/1.3 system-ui, sans-serif; text-align: center; text-shadow: 0 2px 6px #000; pointer-events: none; }
#hack-hud b { font-size: 26px; }
#hack-hud .hint { display: block; margin-top: 6px; font-weight: 500; font-size: 14px; opacity: 0.85; }
#hack-hud .flash { display: block; margin-top: 16vh; font-size: 34px; color: #ffd27a; }
#hack-aim { position: fixed; left: 0; top: 0; z-index: 5; width: 46px; height: 46px; margin: -23px 0 0 -23px; border: 3px solid rgba(255, 220, 140, 0.9); border-radius: 50%; box-shadow: 0 0 10px rgba(255, 200, 90, 0.7); pointer-events: none; }
#hack-aim::after { content: ''; position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: #ffe0a0; }
#hack-panel { position: fixed; inset: 0; z-index: 6; display: grid; place-items: center; background: rgba(5, 3, 2, 0.55); color: #fbf3e0; font: 500 17px/1.4 system-ui, sans-serif; text-align: center; }
#hack-panel[hidden] { display: none; }
#hack-panel .card { background: rgba(30, 20, 14, 0.92); border: 1px solid #8a6a3a; border-radius: 16px; padding: 22px 26px; max-width: min(360px, calc(100vw - 32px)); }
#hack-panel h2 { margin: 0 0 8px; font-size: 28px; }
#hack-panel button { margin: 14px 6px 0; padding: 10px 18px; border-radius: 999px; border: 1px solid #d8a84a; background: #b3202a; color: #fff; font: 600 16px system-ui, sans-serif; cursor: pointer; }
#hack-panel button.off { background: transparent; }
`
    document.head.append(css)
    this.panel.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button')
      if (b?.dataset.go === 'again') this.begin()
      else if (b?.dataset.go === 'leave') this.leave()
    })
    addEventListener('keydown', (e) => {
      if (!this.active) return
      if (this.over) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          this.begin()
        }
        return
      }
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault()
        this.strike(this.ax, this.ay)
      }
    })
    // the sight follows the mouse (moved by how far it goes when the mouse is grabbed, otherwise to
    // where the pointer is); a click strikes there. On a phone, tap the glint.
    addEventListener('mousemove', (e) => {
      if (!this.active || this.over) return
      if (document.pointerLockElement) {
        this.ax = THREE.MathUtils.clamp(this.ax + e.movementX, 0, innerWidth)
        this.ay = THREE.MathUtils.clamp(this.ay + e.movementY, 0, innerHeight)
      } else {
        this.ax = e.clientX
        this.ay = e.clientY
      }
    })
    addEventListener('mousedown', (e) => {
      if (!this.active || this.over || e.button !== 0) return
      if ((e.target as HTMLElement).closest?.('button')) return
      this.strike(this.ax, this.ay)
    })
    addEventListener('pointerdown', (e) => {
      if (!this.active || this.over || e.pointerType === 'mouse') return
      if ((e.target as HTMLElement).closest('button')) return
      this.strike(e.clientX, e.clientY)
    })
  }

  start(spot: HackSpot, heave: () => number) {
    this.spot = spot
    this.heave = heave
    this.across.set(Math.cos(spot.yaw), 0, -Math.sin(spot.yaw))
    this.out.set(Math.sin(spot.yaw), 0, Math.cos(spot.yaw))
    this.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
    this.active = true
    this.pick.visible = true
    this.begin()
  }

  private begin() {
    this.over = false
    this.left = ROUND
    this.spawn = 0.6
    this.score = this.combo = 0
    this.ax = innerWidth / 2
    this.ay = innerHeight / 2
    this.reticle.hidden = TOUCH
    for (const g of this.glints) this.off(g)
    this.panel.hidden = true
    this.hud.hidden = false
    this.say('Hacka!')
  }

  leave() {
    this.active = false
    this.pick.visible = false
    for (const g of this.glints) this.off(g)
    for (const c of this.chunks) this.scene.remove(c.m)
    this.chunks = []
    this.hud.hidden = true
    this.panel.hidden = true
    this.reticle.hidden = true
    this.onLeft()
  }

  private off(g: Glint) {
    g.on = false
    g.spark.visible = g.ring.visible = false
  }

  private say(text: string) {
    this.flash = text
    this.flashT = 0.9
  }

  /** Swing the pick: at the glint under the crosshair (or under your finger). */
  private strike(x?: number, y?: number) {
    if (this.swing > 0.15) return
    this.swing = 1
    const px = x ?? innerWidth / 2
    const py = y ?? innerHeight / 2
    const reach = TOUCH ? 80 : 70
    let best: Glint | null = null
    let bestD = reach
    const p = new THREE.Vector3()
    for (const g of this.glints) {
      if (!g.on) continue
      p.copy(g.spark.position).project(this.camera)
      const d = Math.hypot(((p.x + 1) / 2) * innerWidth - px, ((1 - p.y) / 2) * innerHeight - py)
      if (d < bestD) {
        bestD = d
        best = g
      }
    }
    if (!best) {
      // (a clang on bare rock, and the combo's gone)
      this.combo = 0
      setTimeout(() => blip(2200, 0.04, 'triangle', 0.03), 120)
      return
    }
    const at = best.spark.position.clone()
    this.off(best)
    this.combo++
    const heave = this.heave() < 0.4
    // (a combo is worth up to four a hit)
    const points = Math.min(4, 1 + Math.floor(this.combo / 6)) * (heave ? 2 : 1)
    this.score += points
    if (heave) this.say('Ej uchnem! ×2')
    else if (this.combo % 6 === 0) this.say(`${this.combo} i rad!`)
    setTimeout(() => {
      clunk()
      noise(0.18, 1800, 500, 0.12, 0.9)
      blip(700 + Math.min(10, this.combo) * 60, 0.06, 'triangle', 0.04)
    }, 110)
    // a lump of coal breaks off and tumbles down
    for (let i = 0; i < 1 + Math.min(3, points); i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07 + Math.random() * 0.07, 0), std(0x141416, 0.3, 0.35))
      m.position.copy(at)
      this.scene.add(m)
      const out = new THREE.Vector3(Math.sin(this.spot!.yaw), 0, Math.cos(this.spot!.yaw)).multiplyScalar(-1.2)
      this.chunks.push({ m, v: out.add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 1 + Math.random(), (Math.random() - 0.5) * 0.6)), t: 0 })
    }
  }

  private end() {
    this.over = true
    for (const g of this.glints) this.off(g)
    const record = this.score > this.best
    if (record) {
      this.best = this.score
      try {
        localStorage.setItem(BEST_KEY, String(this.score))
      } catch {
        /* fine */
      }
    }
    const touch = TOUCH
    this.panel.innerHTML = `<div class="card"><h2>⛏ Skiftet är slut</h2>
      <div><b>${this.score}</b> kol hackat</div>
      <div>${record ? '🏆 Nytt rekord!' : `Ditt rekord: ${this.best}`}</div>
      <button data-go="again">Ett skift till${touch ? '' : ' (Space)'}</button><button class="off" data-go="leave">Lägg ner hackan${touch ? '' : ' (Esc)'}</button></div>`
    this.panel.hidden = false
    this.hud.hidden = true
    this.reticle.hidden = true
  }

  update(dt: number) {
    if (!this.active || !this.spot) return
    const s = this.spot
    // the camera: standing at the seam, looking where you aim
    const c = this.camera
    c.position.set(s.x, 1.62, s.z)
    c.rotation.set(-0.08, s.yaw + Math.PI, 0, 'YXZ')
    this.reticle.style.transform = `translate(${this.ax}px, ${this.ay}px)`
    // the pick: raised, then down
    this.swing = Math.max(0, this.swing - dt * 4)
    const k = this.swing
    const down = k > 0.6 ? (1 - k) / 0.4 : k / 0.6
    this.pick.position.copy(c.position)
    this.pick.quaternion.copy(c.quaternion)
    this.pick.translateX(0.42)
    this.pick.translateY(-0.62 + down * 0.12)
    this.pick.translateZ(-0.7)
    this.pick.rotateX(-0.3 - down * 1.2)
    this.pick.rotateZ(0.55)
    // the coal tumbling down
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const ch = this.chunks[i]
      ch.t += dt
      ch.v.y -= 9.8 * dt
      ch.m.position.addScaledVector(ch.v, dt)
      ch.m.rotation.x += dt * 6
      if (ch.m.position.y < 0.07) {
        ch.m.position.y = 0.07
        ch.v.set(0, 0, 0)
      }
      if (ch.t > 4) {
        this.scene.remove(ch.m)
        this.chunks.splice(i, 1)
      }
    }
    if (this.over) return
    this.left -= dt
    if (this.left <= 0) return this.end()
    // new glints, more and quicker as the shift goes on
    const k2 = 1 - this.left / ROUND
    if ((this.spawn -= dt) <= 0) {
      this.spawn = THREE.MathUtils.lerp(0.95, 0.45, k2) * (0.7 + Math.random() * 0.6)
      const g = this.glints.find((x) => !x.on)
      if (g) {
        g.on = true
        g.age = 0
        g.life = THREE.MathUtils.lerp(1.7, 0.95, k2)
        // (on the face of the coal, a little out from it towards you)
        // (as wide as the screen shows, on a phone held upright too)
        const half = Math.min(1.1, 0.95 * Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect)) * 0.8)
        g.spark.position.copy(s.seam).addScaledVector(this.across, (Math.random() * 2 - 1) * half).addScaledVector(this.out, -0.3).setY(0.85 + Math.random() * 1.3)
        g.ring.position.copy(g.spark.position)
        g.spark.visible = g.ring.visible = true
      }
    }
    for (const g of this.glints) {
      if (!g.on) continue
      g.age += dt
      const f = g.age / g.life
      if (f >= 1) {
        // gone before you got to it
        this.off(g)
        this.combo = 0
        continue
      }
      g.spark.scale.setScalar(0.35 + Math.sin(g.age * 18) * 0.06)
      g.ring.scale.setScalar(THREE.MathUtils.lerp(1.1, 0.25, f))
      ;(g.ring.material as THREE.SpriteMaterial).opacity = 1 - f * 0.5
    }
    this.flashT -= dt
    const time = Math.ceil(this.left)
    this.hud.innerHTML = `⛏ <b>${this.score}</b> kol · 0:${String(time).padStart(2, '0')}${this.combo >= 2 ? ` · ${this.combo} i rad` : ''}` +
      (this.flashT > 0 ? `<span class="flash">${this.flash}</span>` : '') +
      (this.left > ROUND - 4 ? `<span class="hint">${TOUCH ? 'Tryck på glimtarna i kolet innan de slocknar' : 'Flytta siktet med musen och klicka på glimtarna innan de slocknar'}</span>` : '')
  }
}
