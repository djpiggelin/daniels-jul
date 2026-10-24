// Gruvexpressen – the mine cart ride under the village, Subway Surfers style. You sit in a cart that
// rushes on down an endless tunnel, faster and faster, on three tracks side by side: change track to
// get round stopped carts, jump rock falls and broken rails, duck under fallen beams, and pick up the
// coal (and now and then a gem) along the way – until you crash. "I Bergakungens sal" speeds up with you.
// Everything is a scene of its own: the cart runs down −z, the tracks at x = −LANE, 0 and +LANE.
import * as THREE from 'three'
import { TOUCH } from './device'
import { Nisse } from './npc'
import { MountainKing, blip, clunk, noise, thud, whoosh } from './sfx'
import { glowTexture, makeCanvas, toTexture } from './tex'

const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const BEST_KEY = 'jul3d.best.gruvvagn'
/** The furthest you've gone, in metres (for the calendar's door 19). */
export const BEST_M_KEY = 'jul3d.best.gruvvagn.m'
const LANE = 1.35
const SEG = 24
const SEGS = 7
/** How fast (m/s): from a brisk start up to a rush. */
const V0 = 10
const VMAX = 27
type Kind = 'rock' | 'cart' | 'beam' | 'gap' | 'coal' | 'gem'
type Thing = { kind: Kind; lane: number; z: number; y: number; mesh: THREE.Object3D; taken?: boolean }

let seed = 1
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

/** Bumpy rock: the same bump for the same point. */
const bump = (x: number, y: number, z: number) => Math.sin(x * 1.3 + z * 0.7) * Math.cos(y * 1.7 - x * 0.4) * 0.35 + Math.sin(z * 2.9 + y * 2.1) * 0.12

function rockTexture() {
  const [c, ctx] = makeCanvas(256, 256)
  ctx.fillStyle = '#2b2420'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 700; i++) {
    const v = 25 + rnd() * 40
    ctx.fillStyle = `rgba(${v + 10},${v},${v - 6},${0.25 + rnd() * 0.3})`
    ctx.beginPath()
    ctx.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 10, 1 + rnd() * 6, rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = 'rgba(8,8,10,0.85)'
    ctx.lineWidth = 6 + rnd() * 8
    ctx.beginPath()
    let y = rnd() * 256
    ctx.moveTo(-10, y)
    for (let x = 0; x <= 266; x += 24) ctx.lineTo(x, (y += (rnd() - 0.5) * 18))
    ctx.stroke()
  }
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 2)
  return t
}

export class CartRun {
  readonly scene = new THREE.Scene()
  active = false
  /** Back to the mine. */
  onDone: () => void = () => {}

  private segments: THREE.Group[] = []
  private things: Thing[] = []
  private pools = new Map<Kind, THREE.Object3D[]>()
  private cart = new THREE.Group()
  private rider: Nisse
  private headlamp: THREE.PointLight
  private music = new MountainKing()
  private hud: HTMLElement
  private panel: HTMLElement

  private z = 0
  private x = 0
  private lane = 0
  private y = 0
  private vy = 0
  private duck = 0
  private v = V0
  private coal = 0
  private nextRow = 0
  private state: 'count' | 'run' | 'crash' = 'count'
  private clock = 0
  private shake = 0
  private clack = 0
  private best = 0

  constructor(private camera: THREE.PerspectiveCamera) {
    const s = this.scene
    s.background = new THREE.Color(0x040302)
    s.fog = new THREE.FogExp2(0x060403, 0.035)
    s.add(new THREE.HemisphereLight(0x6a5644, 0x1a140e, 0.55))

    /* the tunnel, in segments that leapfrog ahead as you go */
    const rockMat = new THREE.MeshStandardMaterial({ map: rockTexture(), roughness: 0.95, side: THREE.BackSide })
    const shellGeo = new THREE.CylinderGeometry(3.6, 3.6, SEG + 0.4, 18, 8, true, Math.PI / 2 - 1.25, Math.PI + 2.5)
    const p = shellGeo.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      // (the same bumps at both ends, so the segments join up)
      const r = new THREE.Vector3(v.x, 0, v.z).normalize()
      v.addScaledVector(r, bump(v.x, Math.cos((v.y / SEG) * Math.PI * 2) * 3, v.z) * 0.6)
      p.setXYZ(i, v.x, v.y, v.z)
    }
    shellGeo.computeVertexNormals()
    const floorMat = std(0x2a221c, 1)
    const wood = std(0x4a3220, 0.95)
    const railMat = std(0x6a6e78, 0.35, 0.8)
    const glowTex = glowTexture('rgba(255,190,110,0.8)', 'rgba(255,140,50,0)')
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false })
    const sleeperGeo = new THREE.BoxGeometry(1.15, 0.08, 0.2)
    const m4 = new THREE.Matrix4()
    for (let i = 0; i < SEGS; i++) {
      const g = new THREE.Group()
      const shell = new THREE.Mesh(shellGeo, rockMat)
      shell.rotation.x = Math.PI / 2
      shell.position.y = 0.3
      g.add(shell)
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(7.4, SEG + 0.4), floorMat)
      floor.rotation.x = -Math.PI / 2
      g.add(floor)
      const per = Math.round(SEG / 0.8)
      const sleepers = new THREE.InstancedMesh(sleeperGeo, wood, per * 3)
      for (let l = 0; l < 3; l++)
        for (let k = 0; k < per; k++) sleepers.setMatrixAt(l * per + k, m4.makeTranslation((l - 1) * LANE, 0.04, -SEG / 2 + (k + 0.5) * 0.8))
      g.add(sleepers)
      for (let l = 0; l < 3; l++)
        for (const side of [-0.42, 0.42]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, SEG), railMat).translateX((l - 1) * LANE + side).translateY(0.12))
      // timbers, and a lantern on every other one
      for (let k = 0; k < 4; k++) {
        const z = -SEG / 2 + 3 + k * 6
        for (const x of [-2.75, 2.75]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.4, 0.26), wood).translateX(x).translateY(1.7).translateZ(z))
        g.add(new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.28, 0.3), wood).translateY(3.45).translateZ(z))
        if (k % 2 === 0) {
          const x = (k / 2) % 2 ? 2.45 : -2.45
          g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), lampMat).translateX(x).translateY(2.6).translateZ(z + 0.25))
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false }))
          glow.position.set(x, 2.6, z + 0.25)
          glow.scale.setScalar(1.6)
          g.add(glow)
        }
      }
      s.add(g)
      this.segments.push(g)
    }

    /* you, in your cart */
    const body = std(0x5a4232, 0.55, 0.45)
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.35), body)
    box.position.y = 0.58
    this.cart.add(box)
    const rim = std(0x8a6a3a, 0.4, 0.7)
    this.cart.add(new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.06, 1.41), rim).translateY(0.89))
    for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 14), railMat)
      w.rotation.z = Math.PI / 2
      w.position.set(x, 0.2, z)
      this.cart.add(w)
    }
    this.rider = new Nisse({ coat: 0xc8102e, hat: 0xc8102e, trim: true, beard: false, ears: true, scale: 0.72 })
    this.rider.sit(true)
    this.rider.group.position.set(0, 0.32, 0.15)
    this.rider.setYaw(Math.PI)
    this.rider.armL.rotation.set(-1.3, 0, 0.4)
    this.rider.armR.rotation.set(-1.3, 0, -0.4)
    this.cart.add(this.rider.group)
    s.add(this.cart)
    this.headlamp = new THREE.PointLight(0xffd8a0, 30, 24, 1.4)
    s.add(this.headlamp)
    const back = new THREE.PointLight(0xffa860, 6, 10, 1.5)
    back.position.set(0, 2.5, 2)
    this.cart.add(back)

    /* what's on the tracks */
    const rockMat2 = std(0x4a4038, 0.9)
    const coalMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.25, metalness: 0.4, emissive: 0x201810, emissiveIntensity: 0.6 })
    const make: Record<Kind, () => THREE.Object3D> = {
      rock: () => {
        const g = new THREE.Group()
        for (const [x, y, r] of [[-0.25, 0.25, 0.32], [0.25, 0.22, 0.28], [0, 0.45, 0.25]]) g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat2).translateX(x).translateY(y))
        return g
      },
      cart: () => {
        const g = new THREE.Group()
        g.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.6), std(0x3a2e26, 0.6, 0.4)).translateY(0.65))
        for (let i = 0; i < 10; i++) g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), coalMat).translateX((rnd() - 0.5) * 0.7).translateY(1.15 + rnd() * 0.12).translateZ((rnd() - 0.5) * 1.2))
        return g
      },
      beam: () => {
        // a timber come down across the track, hanging at head height from the one above
        const g = new THREE.Group()
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.26, 0.28), wood)
        b.position.y = 1.25
        b.rotation.z = 0.08
        g.add(b)
        for (const x of [-0.5, 0.5]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.1, 4), std(0xb09a70, 0.9)).translateX(x).translateY(2.4))
        return g
      },
      gap: () => {
        // the rails broken off over a black hole
        const g = new THREE.Group()
        g.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 1.8), new THREE.MeshBasicMaterial({ color: 0x000000 })).translateY(0.17))
        for (const z of [-0.95, 0.95]) g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.14), wood).translateY(0.2).translateZ(z).rotateY(z * 0.1))
        return g
      },
      coal: () => new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), coalMat),
      gem: () => {
        const c = [0xff3a5a, 0x3ab0ff, 0x3aff8a][Math.floor(rnd() * 3)]
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8, roughness: 0.15, metalness: 0.3 }))
        m.scale.y = 1.4
        return m
      },
    }
    this.make = make

    /* the score along the top, and the panel when you crash */
    this.hud = document.createElement('div')
    this.hud.id = 'gruv-hud'
    this.hud.hidden = true
    this.panel = document.createElement('div')
    this.panel.id = 'gruv-panel'
    this.panel.hidden = true
    document.body.append(this.hud, this.panel)
    const css = document.createElement('style')
    css.textContent = `
#gruv-hud { position: fixed; top: max(14px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 5; color: #fbf3e0; font: 600 18px/1.3 system-ui, sans-serif; text-align: center; text-shadow: 0 2px 6px #000; pointer-events: none; }
#gruv-hud b { font-size: 26px; }
#gruv-hud .hint { display: block; margin-top: 8px; font-weight: 500; font-size: 14px; opacity: 0.85; }
#gruv-hud .count { display: block; font-size: 64px; margin-top: 18vh; }
#gruv-panel { position: fixed; inset: 0; z-index: 6; display: grid; place-items: center; background: rgba(5, 3, 2, 0.55); color: #fbf3e0; font: 500 17px/1.4 system-ui, sans-serif; text-align: center; }
#gruv-panel[hidden] { display: none; }
#gruv-panel .card { background: rgba(30, 20, 14, 0.92); border: 1px solid #8a6a3a; border-radius: 16px; padding: 22px 26px; max-width: min(360px, calc(100vw - 32px)); }
#gruv-panel h2 { margin: 0 0 8px; font-size: 30px; }
#gruv-panel button { margin: 14px 6px 0; padding: 10px 18px; border-radius: 999px; border: 1px solid #d8a84a; background: #b3202a; color: #fff; font: 600 16px system-ui, sans-serif; cursor: pointer; }
#gruv-panel button.off { background: transparent; }
`
    document.head.append(css)
    this.panel.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button')
      if (b?.dataset.go === 'again') this.restart()
      else if (b?.dataset.go === 'leave') this.leave()
    })
    addEventListener('keydown', (e) => this.key(e))
    // touch: swipe left/right to change track, up to jump, down to duck
    let sx = 0
    let sy = 0
    let swiped = false
    addEventListener('pointerdown', (e) => {
      if (!this.active || e.pointerType === 'mouse') return
      sx = e.clientX
      sy = e.clientY
      swiped = false
    })
    addEventListener('pointermove', (e) => {
      if (!this.active || e.pointerType === 'mouse' || swiped) return
      const dx = e.clientX - sx
      const dy = e.clientY - sy
      if (Math.hypot(dx, dy) < 28) return
      swiped = true
      if (Math.abs(dx) > Math.abs(dy)) this.steer(dx > 0 ? 1 : -1)
      else if (dy < 0) this.jump()
      else this.crouch()
    })
  }
  private make: Record<Kind, () => THREE.Object3D>

  private key(e: KeyboardEvent) {
    if (!this.active) return
    const c = e.code
    if (this.state === 'crash') {
      if (c === 'Space' || c === 'Enter') {
        e.preventDefault()
        this.restart()
      }
      return
    }
    if (c === 'ArrowLeft' || c === 'KeyA') this.steer(-1)
    else if (c === 'ArrowRight' || c === 'KeyD') this.steer(1)
    else if (c === 'ArrowUp' || c === 'KeyW' || c === 'Space') this.jump()
    else if (c === 'ArrowDown' || c === 'KeyS') this.crouch()
    else return
    e.preventDefault()
  }
  private steer(d: number) {
    if (this.state === 'crash') return
    const to = THREE.MathUtils.clamp(this.lane + d, -1, 1)
    if (to !== this.lane) {
      this.lane = to
      noise(0.12, 900, 2600, 0.06, 1.2)
    }
  }
  private jump() {
    if (this.state !== 'run' || this.y > 0.01) return
    this.vy = 7.2
    this.duck = 0
    whoosh()
  }
  private crouch() {
    if (this.state !== 'run') return
    // (in the air: straight back down)
    if (this.y > 0.01) this.vy = -12
    this.duck = 0.75
  }

  private take(kind: Kind) {
    const pool = this.pools.get(kind) ?? []
    this.pools.set(kind, pool)
    const m = pool.pop() ?? this.make[kind]()
    m.visible = true
    if (!m.parent) this.scene.add(m)
    return m
  }
  private put(t: Thing) {
    t.mesh.visible = false
    this.pools.get(t.kind)!.push(t.mesh)
  }
  private add(kind: Kind, lane: number, z: number, y = 0) {
    const mesh = this.take(kind)
    mesh.position.set(lane * LANE, y, z)
    this.things.push({ kind, lane, z, y, mesh })
  }

  /** One row of things on the tracks at z: always with a way through. */
  private row(z: number) {
    const k = Math.min(1, (this.v - V0) / (VMAX - V0))
    const lanes = [-1, 0, 1]
    const free = lanes[Math.floor(rnd() * 3)]
    const roll = rnd()
    if (roll < 0.22 + k * 0.2) {
      // carts across two tracks, one way through
      for (const l of lanes) if (l !== free) this.add(rnd() < 0.75 ? 'cart' : 'rock', l, z - (rnd() < 0.5 ? 0 : 1.5))
    } else {
      // one thing in the way, and maybe a second
      const kinds: Kind[] = ['rock', 'beam', 'gap', 'cart']
      const a = lanes.filter((l) => l !== free)[Math.floor(rnd() * 2)]
      this.add(kinds[Math.floor(rnd() * kinds.length)], a, z)
      if (rnd() < 0.3 + k * 0.4) {
        const b = lanes.find((l) => l !== free && l !== a)!
        this.add(kinds[Math.floor(rnd() * 3)], b, z - 2)
      }
    }
    // coal along the free track, and the odd gem
    if (rnd() < 0.75) for (let i = 0; i < 6; i++) this.add('coal', free, z + 6 - i * 1.6, 0.75)
    if (rnd() < 0.08) this.add('gem', [-1, 0, 1][Math.floor(rnd() * 3)], z + 4, 1.5)
  }

  start() {
    this.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
    this.active = true
    this.restart()
  }

  private restart() {
    for (const t of this.things) this.put(t)
    this.things = []
    seed = (Date.now() % 100000) + 1
    this.z = 0
    this.x = 0
    this.lane = 0
    this.y = this.vy = this.duck = 0
    this.v = V0
    this.coal = 0
    this.clock = 0
    this.shake = 0
    this.state = 'count'
    this.nextRow = -40
    for (let i = 0; i < SEGS; i++) this.segments[i].position.z = -i * SEG + SEG / 2
    this.panel.hidden = true
    this.hud.hidden = false
    this.music.rate = 1
    this.music.start()
    this.drawHud()
  }

  leave() {
    this.active = false
    this.music.stop()
    this.hud.hidden = true
    this.panel.hidden = true
    this.onDone()
  }

  private crash() {
    this.state = 'crash'
    this.shake = 0.6
    thud()
    clunk()
    this.music.stop()
    const score = this.score()
    const record = score > this.best
    try {
      const m = Math.floor(-this.z)
      if (m > (Number(localStorage.getItem(BEST_M_KEY)) || 0)) localStorage.setItem(BEST_M_KEY, String(m))
    } catch {
      /* fine */
    }
    if (record) {
      this.best = score
      try {
        localStorage.setItem(BEST_KEY, String(score))
      } catch {
        /* fine */
      }
    }
    const touch = TOUCH
    this.panel.innerHTML = `<div class="card"><h2>💥 Krasch!</h2>
      <div><b>${score}</b> poäng · ${Math.floor(-this.z)} m · ${this.coal} kol</div>
      <div>${record ? '🏆 Nytt rekord!' : `Ditt rekord: ${this.best}`}</div>
      <button data-go="again">Åk igen${touch ? '' : ' (Space)'}</button><button class="off" data-go="leave">Kliv av${touch ? '' : ' (Esc)'}</button></div>`
    this.panel.hidden = false
  }

  private score() {
    return Math.floor(-this.z / 2) + this.coal * 5
  }

  private drawHud() {
    const s = this.score()
    let html = `⛏ <b>${s}</b> · ${this.coal} kol`
    if (this.state === 'count') {
      const n = 3 - Math.floor(this.clock / 0.8)
      html += `<span class="count">${n > 0 ? n : 'Kör!'}</span>`
      html += `<span class="hint">${TOUCH ? 'Svep åt sidan för att byta spår · upp för att hoppa · ner för att ducka' : '← → byt spår · ↑ hoppa · ↓ ducka'}</span>`
    }
    this.hud.innerHTML = html
  }

  update(dt: number) {
    if (!this.active) return
    this.clock += dt
    if (this.state === 'count') {
      if (this.clock > 2.4) this.state = 'run'
      this.drawHud()
    }
    const running = this.state !== 'crash'
    if (running) {
      if (this.state === 'run') this.v = Math.min(VMAX, this.v + dt * 0.28)
      const speed = this.state === 'count' ? this.v * Math.min(1, this.clock / 2.4) : this.v
      this.z -= speed * dt
      this.music.rate = 1 + ((this.v - V0) / (VMAX - V0)) * 1.4 + (this.state === 'count' ? 0 : 0.3)
      // the clatter of the wheels over the rail joints
      if ((this.clack -= dt * speed) <= 0) {
        this.clack = 3
        if (this.y < 0.05) noise(0.05, 1400, 700, 0.05, 2)
      }
    }
    // moving over to the next track, and up and down
    this.x += (this.lane * LANE - this.x) * Math.min(1, dt * 14)
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= 22 * dt
      this.y += this.vy * dt
      if (this.y <= 0) {
        this.y = 0
        this.vy = 0
        if (running) blip(200, 0.06, 'triangle', 0.08)
      }
    }
    this.duck = Math.max(0, this.duck - dt)
    const ducking = this.duck > 0

    // the tunnel leapfrogs on ahead
    for (const g of this.segments) if (g.position.z - SEG / 2 > this.z + 8) g.position.z -= SEGS * SEG
    // things: new rows ahead, gone behind, and what you hit
    if (this.state !== 'crash') while (this.nextRow > this.z - 140) {
      this.row(this.nextRow)
      this.nextRow -= THREE.MathUtils.lerp(16, 10, (this.v - V0) / (VMAX - V0))
    }
    for (let i = this.things.length - 1; i >= 0; i--) {
      const t = this.things[i]
      if (t.z > this.z + 6) {
        this.put(t)
        this.things.splice(i, 1)
        continue
      }
      if (t.kind === 'coal' || t.kind === 'gem') t.mesh.rotation.y += dt * 3
      if (t.taken || this.state !== 'run') continue
      const dz = Math.abs(t.z - this.z)
      if (Math.abs(t.lane * LANE - this.x) > 0.7) continue
      if (t.kind === 'coal' || t.kind === 'gem') {
        if (dz < 0.8 && Math.abs(t.y - (0.75 + this.y)) < 1.1) {
          t.taken = true
          t.mesh.visible = false
          this.coal += t.kind === 'gem' ? 10 : 1
          blip(t.kind === 'gem' ? 1320 : 990 + (this.coal % 5) * 60, 0.07, 'triangle', 0.05)
          if (t.kind === 'gem') setTimeout(() => blip(1760, 0.1, 'triangle', 0.05), 80)
        }
        continue
      }
      const depth = t.kind === 'cart' ? 1.0 : t.kind === 'gap' ? 0.6 : 0.4
      // (a little forgiving: a near miss is a miss)
      if (dz > depth + 0.35) continue
      const cleared = t.kind === 'rock' ? this.y > 0.4 : t.kind === 'gap' ? this.y > 0.08 : t.kind === 'beam' ? ducking && this.y < 0.3 : false
      if (!cleared) this.crash()
    }

    // the cart and its rider
    const lean = (this.lane * LANE - this.x) * 0.25
    this.cart.position.set(this.x, this.y, this.z)
    this.cart.rotation.set(this.y > 0 ? -0.12 : 0, 0, -lean)
    this.rider.group.position.y = ducking ? 0.05 : 0.32
    this.rider.head.rotation.x = ducking ? 0.5 : -0.1
    this.headlamp.position.set(this.x, 1.6, this.z - 4)
    // the camera, behind and above, shaking a little at speed (and a lot in a crash)
    this.shake = Math.max(0, this.shake - dt)
    const jolt = (this.state === 'run' ? (this.v / VMAX) * 0.02 : 0) + this.shake * 0.25
    const c = this.camera
    c.position.set(this.x * 0.7 + (Math.random() - 0.5) * jolt, 2.35 + this.y * 0.5 + (Math.random() - 0.5) * jolt, this.z + 4.4)
    c.lookAt(this.x * 0.85, 0.9 + this.y * 0.4, this.z - 7)
    if (this.state === 'run' && Math.floor(this.clock * 10) % 2 === 0) this.drawHud()
  }
}
