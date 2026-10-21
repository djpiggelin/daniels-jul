// Arcade cabinets round the julgran, each with an elf host. Step up, press E, and the camera
// glides in until the screen fills your view – the game runs on the cabinet's own screen, with
// your mittens on the joystick and buttons below it.
import * as THREE from 'three'
import { QUALITY, TOUCH } from './device'
import { GAMES, type GameDef } from './games'
import { H, W, emoji, type Game } from './games/shared'
import { Nisse } from './npc'
import type { Player } from './player'
import { blip } from './sfx'
import { glowTexture, makeCanvas, toTexture } from './tex'
import { html, type Talk } from './ui'
import type { Viewmodel } from './viewmodel'

const RES = 1.5
// the screen fills the whole front of the cabinet, side panel to side panel (2:3 like the games)
const SCREEN_W = 0.8
const SCREEN_H = 1.2
const SCREEN_Y = 1.69
const touch = TOUCH
const std = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

type State = 'enter' | 'title' | 'play' | 'over' | 'leave'

const bestKey = (id: string) => `jul3d.best.${id}`
function readBest(id: string) {
  try {
    return Number(localStorage.getItem(bestKey(id))) || 0
  } catch {
    return 0
  }
}

function sidePanel(accent: string) {
  const [c, ctx] = makeCanvas(128, 512)
  ctx.fillStyle = '#141d45'
  ctx.fillRect(0, 0, 128, 512)
  ctx.fillStyle = accent
  for (let y = -128; y < 640; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(128, y - 60)
    ctx.lineTo(128, y - 30)
    ctx.lineTo(0, y + 30)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 14; i++) {
    ctx.beginPath()
    ctx.arc(10 + Math.random() * 108, 10 + Math.random() * 492, 2 + Math.random() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  return toTexture(c)
}

function marquee(def: GameDef) {
  const [c, ctx] = makeCanvas(512, 136)
  const g = ctx.createLinearGradient(0, 0, 0, 136)
  g.addColorStop(0, def.accent)
  g.addColorStop(1, '#141d45')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 136)
  // bulbs round the edge
  for (let x = 14; x < 512; x += 28) {
    for (const y of [10, 126]) {
      ctx.fillStyle = (x / 28) % 2 < 1 ? '#ffe7a3' : '#fff'
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = '#fff'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 8
  ctx.font = "700 54px 'Fraunces', Georgia, serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${def.emoji} ${def.name}`, 256, 70, 470)
  return toTexture(c)
}

export class Cabinet {
  readonly group = new THREE.Group()
  readonly screen: THREE.Mesh
  readonly host: Nisse
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  readonly tex: THREE.CanvasTexture
  readonly talk: Talk
  best: number
  game: Game | null = null
  idle = Math.random()
  private glow: THREE.Sprite
  /** The last frame of a finished game, shown dimmed behind the score. */
  private still = makeCanvas(W, H)

  constructor(
    readonly def: GameDef,
    play: (c: Cabinet) => void,
  ) {
    this.best = readBest(def.id)
    const [c, ctx] = makeCanvas(W * RES, H * RES)
    ctx.scale(RES, RES)
    this.canvas = c
    this.ctx = ctx
    this.tex = toTexture(c, { live: true }) as THREE.CanvasTexture
    this.tex.anisotropy = QUALITY.anisotropy * 2

    const body = std(0x141d45, 0.5)
    const trim = std(new THREE.Color(def.accent).getHex(), 0.45)
    const side = new THREE.MeshStandardMaterial({ map: sidePanel(def.accent), roughness: 0.55 })
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number, rx = 0) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.rotation.x = rx
      m.castShadow = true
      m.receiveShadow = true
      this.group.add(m)
      return m
    }
    // lower body, control panel, screen housing, top
    add(new THREE.BoxGeometry(0.84, 0.98, 0.7), body, 0, 0.49, 0.03)
    add(new THREE.BoxGeometry(0.84, 0.07, 0.4), trim, 0, 1.0, 0.28, 0.32)
    add(new THREE.BoxGeometry(0.84, 1.3, 0.5), body, 0, 1.68, -0.12)
    add(new THREE.BoxGeometry(0.84, 0.26, 0.62), body, 0, 2.46, -0.06)
    for (const x of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.06, 2.62, 0.86), [trim, trim, trim, trim, side, side], x, 1.31, -0.02)
    add(new THREE.BoxGeometry(0.98, 0.08, 0.9), std(0xf4f8ff, 0.95), 0, 2.63, -0.02)
    // the lit sign on top
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.22), new THREE.MeshBasicMaterial({ map: marquee(def), toneMapped: false }))
    sign.position.set(0, 2.46, 0.252)
    this.group.add(sign)
    // joystick + buttons
    const panelTop = new THREE.Group()
    panelTop.position.set(0, 1.04, 0.28)
    panelTop.rotation.x = 0.32
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), std(0x222222, 0.4))
    shaft.position.set(-0.17, 0.04, 0)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), std(0xe5383b, 0.35))
    ball.position.set(-0.17, 0.09, 0)
    panelTop.add(shaft, ball)
    ;[0xf6c453, 0x2fa36b, 0x4a7bd0].forEach((col, i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 14), std(col, 0.3))
      b.position.set(0.08 + i * 0.07, 0.01, i === 1 ? -0.04 : 0)
      panelTop.add(b)
    })
    this.group.add(panelTop)

    // the screen: unlit so the game keeps its colours under the village's tone mapping
    // a thin coloured rim instead of a black bezel
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W + 0.04, SCREEN_H + 0.04), trim)
    rim.position.set(0, SCREEN_Y, 0.132)
    this.group.add(rim)
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }))
    this.screen.position.set(0, SCREEN_Y, 0.136)
    this.group.add(this.screen)
    // soft light spilling onto the snow
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(def.accent, 'rgba(0,0,0,0)'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }))
    this.glow.scale.set(2.4, 1.6, 1)
    this.glow.position.set(0, 0.25, 0.9)
    this.group.add(this.glow)

    // the host stands beside the cabinet
    this.host = new Nisse({ coat: def.host.coat, hat: def.host.hat, beard: false, ears: true, trim: true, scale: 0.98 })

    this.talk = {
      name: def.host.name,
      avatar: def.host.avatar,
      avatarBg: def.accent,
      greeting: () => def.host.greeting.map(html.p),
      topics: [
        { label: `🎮 Spela ${def.name}!`, pages: () => [], go: () => play(this) },
        { label: '❓ Hur spelar man?', pages: () => [html.h(`${def.emoji} ${def.name}`) + html.list(def.howTo, 'stars')] },
        {
          label: '🏆 Mitt rekord',
          pages: () => [this.best ? html.p(`Ditt rekord är ${this.best} poäng.`) + html.note('Kan du slå det?') : html.p('Du har inget rekord än – dags att sätta ett!')],
        },
      ],
      bye: def.host.bye,
    }
  }

  place(deg: number, r: number) {
    const a = THREE.MathUtils.degToRad(deg)
    this.group.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r)
    // face away from the tree
    this.group.rotation.y = Math.atan2(this.group.position.x, this.group.position.z)
    this.group.updateMatrixWorld(true)
    const p = this.group.localToWorld(new THREE.Vector3(0.95, 0, 0.45))
    this.host.group.position.copy(p)
    this.host.setYaw(this.group.rotation.y + 0.35)
  }

  /** Where you stand when you step back from the cabinet. */
  standSpot() {
    return this.group.localToWorld(new THREE.Vector3(0, 0, 1.55))
  }

  saveBest(score: number) {
    if (score <= this.best) return false
    this.best = score
    try {
      localStorage.setItem(bestKey(this.def.id), String(score))
    } catch {
      /* no storage – the record lasts until reload */
    }
    return true
  }

  /** Title / attract screen. */
  drawTitle(now: number, playing: boolean) {
    const { ctx, def } = this
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#0b1230')
    g.addColorStop(1, '#24336b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = def.accent
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.arc(W / 2, 200, 150 + Math.sin(now / 400) * 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    emoji(ctx, def.emoji, W / 2, 200 + Math.sin(now / 300) * 6, 120)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = "700 46px 'Fraunces', Georgia, serif"
    ctx.fillText(def.name, W / 2, 368, W - 40)
    ctx.font = "400 22px 'DM Sans', sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(def.tagline, W / 2, 410, W - 40)
    ctx.font = "400 19px 'DM Sans', sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    def.howTo.forEach((l, i) => ctx.fillText(l, W / 2, 470 + i * 32, W - 40))
    ctx.font = "700 22px 'DM Sans', sans-serif"
    ctx.fillStyle = '#f6c453'
    ctx.fillText(this.best ? `🏆 Rekord: ${this.best}` : '🏆 Inget rekord än', W / 2, 590)
    if (Math.floor(now / 550) % 2 === 0) {
      ctx.font = "700 24px 'DM Sans', sans-serif"
      ctx.fillStyle = '#fff'
      ctx.fillText(playing ? (touch ? '▶ Tryck för att börja' : '▶ Klicka eller tryck E') : touch ? 'Gå fram och tryck på knappen' : 'Gå fram och tryck E', W / 2, 650)
    }
  }

  freeze() {
    this.still[1].clearRect(0, 0, W, H)
    this.still[1].drawImage(this.canvas, 0, 0, W, H)
  }

  drawOver(score: number, record: boolean, now: number) {
    const { ctx } = this
    ctx.drawImage(this.still[0], 0, 0, W, H)
    ctx.fillStyle = 'rgba(7,11,29,0.45)'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(7,11,29,0.82)'
    ctx.beginPath()
    ctx.roundRect(50, 220, W - 100, 280, 24)
    ctx.fill()
    ctx.strokeStyle = this.def.accent
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.font = "700 44px 'Fraunces', Georgia, serif"
    ctx.fillText('Slut!', W / 2, 272)
    ctx.font = "700 64px 'DM Sans', sans-serif"
    ctx.fillStyle = '#f6c453'
    ctx.fillText(String(score), W / 2, 345)
    ctx.font = "600 22px 'DM Sans', sans-serif"
    ctx.fillStyle = record ? '#7dffb0' : 'rgba(255,255,255,0.75)'
    ctx.fillText(record ? '🎉 Nytt rekord!' : `Rekord: ${this.best}`, W / 2, 405)
    if (Math.floor(now / 550) % 2 === 0) {
      ctx.fillStyle = '#fff'
      ctx.font = "700 21px 'DM Sans', sans-serif"
      ctx.fillText(touch ? 'Tryck – spela igen' : 'E / klick – spela igen', W / 2, 460)
    }
  }

  drawCursor(x: number, y: number) {
    const { ctx } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = '#fff3dc'
    ctx.strokeStyle = '#7a4c2a'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, 26)
    ctx.lineTo(7, 20)
    ctx.lineTo(12, 30)
    ctx.lineTo(17, 28)
    ctx.lineTo(12, 18)
    ctx.lineTo(21, 18)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  pulse(t: number) {
    ;(this.glow.material as THREE.SpriteMaterial).opacity = 0.45 + Math.sin(t * 2 + this.idle * 6) * 0.08
  }
}

export class Arcade {
  readonly cabinets: Cabinet[]
  active: Cabinet | null = null
  private state: State = 'enter'
  private blend = 0
  private from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }
  private pointer = { x: W / 2, y: H / 2 }
  private press = 0
  private record = false
  private lastScore = 0
  private armedAt = 0
  private ray = new THREE.Raycaster()
  private bar = document.getElementById('arcade-bar')!
  /** Called once the camera is back with the player. */
  onLeft: () => void = () => {}

  constructor(
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private player: Player,
    private vm: Viewmodel,
    play: (c: Cabinet) => void,
  ) {
    this.cabinets = GAMES.map((g) => new Cabinet(g, play))
    // south of the tree, facing you as you walk in
    ;[146, 180, 214].forEach((deg, i) => {
      const c = this.cabinets[i]
      c.place(deg, 6.7)
      scene.add(c.group, c.host.group)
    })
    document.getElementById('arcade-exit')!.addEventListener('click', () => this.leave())

    addEventListener('keydown', (e) => {
      if (!this.live || e.code === 'Escape' || e.metaKey || e.ctrlKey) return
      e.preventDefault()
      if (e.code === 'KeyQ') return this.leave()
      if (e.repeat) return
      this.press = 1
      if (this.state === 'play') this.active!.game!.key?.(e.code, true)
      else if (['KeyE', 'Enter', 'Space'].includes(e.code) && e.timeStamp > this.armedAt) this.begin()
    })
    addEventListener('keyup', (e) => {
      if (this.live && this.state === 'play') this.active!.game!.key?.(e.code, false)
    })
    document.addEventListener('pointermove', (e) => {
      if (!this.live) return
      if (this.player.locked) {
        // the real cursor is hidden: steer one drawn on the game screen instead
        const k = H / (innerHeight * 0.8)
        this.pointer.x = THREE.MathUtils.clamp(this.pointer.x + e.movementX * k, 0, W)
        this.pointer.y = THREE.MathUtils.clamp(this.pointer.y + e.movementY * k, 0, H)
      } else if (!this.toScreen(e.clientX, e.clientY)) return
      if (this.state === 'play') this.active!.game!.pointer?.(this.pointer.x, this.pointer.y, 'move')
    })
    document.addEventListener('pointerdown', (e) => {
      if (!this.live || (e.target as HTMLElement).closest('button') || e.button !== 0) return
      if (!this.player.locked && !this.toScreen(e.clientX, e.clientY) && e.pointerType !== 'mouse') return
      this.press = 1
      if (e.timeStamp <= this.armedAt) return
      if (this.state === 'play') this.active!.game!.pointer?.(this.pointer.x, this.pointer.y, 'down')
      else this.begin()
    })
  }

  /** Accepting input (not mid camera move). */
  private get live() {
    return !!this.active && (this.state === 'title' || this.state === 'play' || this.state === 'over')
  }

  /** Real mouse → point on the cabinet screen. */
  private toScreen(cx: number, cy: number) {
    this.ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), this.camera)
    const hit = this.ray.intersectObject(this.active!.screen)[0]
    if (!hit?.uv) return false
    this.pointer.x = hit.uv.x * W
    this.pointer.y = (1 - hit.uv.y) * H
    return true
  }

  start(cab: Cabinet) {
    if (this.active) return
    this.active = cab
    this.state = 'enter'
    this.blend = 0
    this.from.pos.copy(this.camera.position)
    this.from.quat.copy(this.camera.quaternion)
    this.pointer = { x: W / 2, y: H * 0.6 }
    this.bar.hidden = false
    this.bar.querySelector('.hint')!.textContent = `${cab.def.keys} · Q / Esc lämna`
    blip(660, 0.08, 'triangle', 0.05)
  }

  private begin() {
    const cab = this.active!
    cab.game = cab.def.make(cab.ctx)
    this.state = 'play'
    this.record = false
    blip(880, 0.1, 'triangle', 0.06)
  }

  leave() {
    const cab = this.active
    if (!cab || this.state === 'leave') return
    this.state = 'leave'
    this.bar.hidden = true
    cab.game = null
    // step back from the cabinet, facing it
    const spot = cab.standSpot()
    this.player.pos.set(spot.x, 0, spot.z)
    this.player.yaw = cab.group.rotation.y
    this.player.pitch = -0.12
    this.player.vel.set(0, 0, 0)
    this.from.pos.set(spot.x, 1.62, spot.z)
    this.from.quat.setFromEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'))
  }

  /** Camera pose that fills the view with the screen (leaving a strip at the bottom for your hands). */
  private screenPose() {
    const s = this.active!.screen
    s.updateMatrixWorld()
    const quat = s.getWorldQuaternion(new THREE.Quaternion())
    const center = s.getWorldPosition(new THREE.Vector3())
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat)
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const tanH = tanV * this.camera.aspect
    // fill (almost) the whole height of the view; on a narrow phone, the whole width instead
    const fill = 0.94
    const d = Math.max(SCREEN_H / 2 / (tanV * fill), SCREEN_W / 2 / (tanH * 0.98))
    const pos = center.addScaledVector(normal, d).addScaledVector(up, -0.04 * d * tanV)
    return { pos, quat }
  }

  update(dt: number, t: number) {
    const now = performance.now()
    for (const c of this.cabinets) {
      c.pulse(t)
      if (c === this.active) continue
      // idle attract screens only need a refresh now and then
      if ((c.idle -= dt) <= 0) {
        c.idle = 0.275
        c.drawTitle(now, false)
        c.tex.needsUpdate = true
      }
    }
    const cab = this.active
    if (!cab) {
      this.vm.arcade(false)
      return
    }

    if (this.state === 'enter') {
      this.blend = Math.min(1, this.blend + dt / 0.8)
      if (this.blend >= 1) {
        this.state = 'title'
        this.armedAt = performance.now() + 120
      }
    } else if (this.state === 'leave') {
      this.blend = Math.max(0, this.blend - dt / 0.65)
      if (this.blend <= 0) {
        this.active = null
        this.vm.arcade(false)
        this.onLeft()
        return
      }
    }

    // draw the screen
    const game = cab.game
    if (this.state === 'play' && game) {
      game.frame(dt, now)
      if (game.over) {
        this.lastScore = game.score
        this.record = cab.saveBest(game.score)
        cab.freeze()
        this.state = 'over'
        this.armedAt = performance.now() + 700
        blip(this.record ? 1320 : 330, 0.25, 'triangle', 0.07)
      }
    } else if (this.state === 'over') {
      cab.drawOver(this.lastScore, this.record, now)
    } else if (this.state !== 'play') {
      cab.drawTitle(now, true)
    }
    if (this.player.locked && (this.state !== 'play' || game?.cursor)) cab.drawCursor(this.pointer.x, this.pointer.y)
    cab.tex.needsUpdate = true

    // glide the camera between the player's eyes and the screen
    const k = THREE.MathUtils.smootherstep(this.blend, 0, 1)
    const target = this.screenPose()
    // a touch of breathing so it feels like you're standing there
    target.pos.y += Math.sin(t * 1.6) * 0.004
    this.camera.position.lerpVectors(this.from.pos, target.pos, k)
    this.camera.quaternion.slerpQuaternions(this.from.quat, target.quat, k)

    this.press = Math.max(0, this.press - dt * 6)
    this.vm.arcade(k > 0.6, game?.stick ?? 0, this.press, t)
  }
}
