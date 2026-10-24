// Pulkabacken: the long hill south of the village (world.ts makes the ground), a run down it through
// seven slalom gates, against the clock. At its foot a stack of red pulkor and the board of the season's
// fastest (the shared leaderboard, netlify/functions/leaderboard.mts, lowest time first). Take a pulka,
// and you're at the top: three, two, one – go! Steer with A/D or the arrows (on a phone, the buttons);
// every gate missed costs two seconds; at the bottom, your time.
import * as THREE from 'three'
import type { Player } from './player'
import { blip, noise } from './sfx'
import { FONT, makeCanvas, toTexture } from './tex'
import { HILL, groundHeight, runX, type Circle } from './world'

const G = 9.8
const START_Z = 106
const FINISH_Z = 49.5
/** The gates: where across the run each stands (alternately left and right of its middle), red and blue in turn. */
const GATES = [98, 90, 82, 74, 66, 58].map((z, i) => ({ z, x: runX(z) + (i % 2 ? 1.6 : -1.6), half: 1.55, red: i % 2 === 0 }))
/** Where the pulkor are stacked, and the board. */
const STACK = { x: 7, z: 44.5 }
const BOARD = { x: -7, z: 46.5 }

const std = (color: number, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness })
const fmt = (cs: number) => `${Math.floor(cs / 100)},${String(cs % 100).padStart(2, '0')} s`

type Entry = { name: string; score: number }

/** A red plastic pulka, its front curled up. */
function pulka(color = 0xd0202a) {
  const g = new THREE.Group()
  const plastic = new THREE.MeshStandardMaterial({ color, roughness: 0.35, side: THREE.DoubleSide })
  // the tray: a U across, drawn out along its length, a flat back end
  const s = new THREE.Shape()
  for (const [x, y] of [[-0.34, 0.16], [-0.32, 0], [0.32, 0], [0.34, 0.16], [0.31, 0.16], [0.29, 0.03], [-0.29, 0.03], [-0.31, 0.16]]) {
    if (x === -0.34) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: false }), plastic)
  body.position.z = -0.45
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.03), plastic)
  back.position.set(0, 0.08, -0.45)
  // the front curls up from the bottom, forward and over
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.64, 16, 1, true, (3 * Math.PI) / 2, (3 * Math.PI) / 4), plastic)
  lip.rotation.z = Math.PI / 2
  lip.position.set(0, 0.13, 0.45)
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), std(0xf6c453, 0.6))
  rope.position.set(0, 0.26, 0.6)
  g.add(body, back, lip, rope)
  g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  return g
}

function flag(red: boolean) {
  const g = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), std(0xf2f2f2, 0.5))
  pole.position.y = 0.75
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshStandardMaterial({ color: red ? 0xd0202a : 0x1f5fc8, side: THREE.DoubleSide, roughness: 0.8 }))
  cloth.position.set(0.25, 1.3, 0)
  g.add(pole, cloth)
  g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  return { g, cloth }
}

/** A banner between two posts across the run (START at the top, MÅL at the bottom). */
function banner(text: string, z: number, color: string) {
  const g = new THREE.Group()
  const x = runX(Math.min(z, HILL.z1))
  const y = groundHeight(x, z)
  g.position.set(x, y, z)
  const [c, ctx] = makeCanvas(1024, 128)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1024, 128)
  ctx.fillStyle = '#fff'
  ctx.font = `700 80px ${FONT.sans}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 512, 68)
  // (printed on both sides, so it reads from the village too)
  const tex = toTexture(c)
  for (const ry of [0, Math.PI]) {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 }))
    cloth.position.y = 3.2
    cloth.rotation.y = ry
    g.add(cloth)
  }
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.8, 8), std(0x5a3a22))
    post.position.set(s * 4.1, 1.9 + (groundHeight(x + s * 4.1, z) - y), 0)
    g.add(post)
  }
  g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  return g
}

/** The board at the foot of the hill: the season's fastest. */
function boardCanvas() {
  const [c, ctx] = makeCanvas(512, 640)
  const tex = toTexture(c, { live: true })
  const draw = (list: Entry[], mine: number | null) => {
    ctx.fillStyle = '#123524'
    ctx.fillRect(0, 0, 512, 640)
    ctx.strokeStyle = '#f6c453'
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, 492, 620)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff3dc'
    ctx.font = `600 50px ${FONT.serif}`
    ctx.fillText('🛷 Pulkabacken', 256, 78)
    ctx.font = `400 26px ${FONT.sans}`
    ctx.fillStyle = '#cfe9d9'
    ctx.fillText('Säsongens snabbaste', 256, 118)
    ctx.textAlign = 'left'
    ctx.font = `600 32px ${FONT.sans}`
    if (!list.length) {
      ctx.fillStyle = '#fff3dc'
      ctx.textAlign = 'center'
      ctx.fillText('Ingen har åkt än –', 256, 260)
      ctx.fillText('bli först!', 256, 304)
    }
    list.slice(0, 8).forEach((e, i) => {
      const y = 180 + i * 54
      ctx.fillStyle = mine === e.score ? '#f6c453' : '#fff3dc'
      ctx.fillText(`${i + 1}. ${e.name.slice(0, 14)}`, 40, y)
      ctx.textAlign = 'right'
      ctx.fillText(fmt(e.score), 472, y)
      ctx.textAlign = 'left'
    })
    ctx.textAlign = 'center'
    ctx.font = `italic 400 24px ${FONT.serif}`
    ctx.fillStyle = '#cfe9d9'
    ctx.fillText('Ta en pulka vid stapeln och åk!', 256, 612)
    tex.needsUpdate = true
  }
  draw([], null)
  return { tex, draw }
}

/** The season's list (in local development: kept in this browser). */
const scores = {
  async get(): Promise<Entry[]> {
    try {
      const r = await fetch('/api/leaderboard?game=pulka')
      if (!r.ok) throw r.status
      return await r.json()
    } catch {
      return JSON.parse(localStorage.getItem('dev-lb-pulka') ?? '[]')
    }
  },
  async post(name: string, score: number): Promise<Entry[]> {
    try {
      const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game: 'pulka', name, score }) })
      if (!r.ok) throw r.status
      return await r.json()
    } catch {
      let list: Entry[] = []
      try {
        list = JSON.parse(localStorage.getItem('dev-lb-pulka') ?? '[]')
        list = [...list, { name, score }].sort((a, b) => a.score - b.score).slice(0, 50)
        localStorage.setItem('dev-lb-pulka', JSON.stringify(list))
      } catch {
        /* fine */
      }
      return list.slice(0, 10)
    }
  },
}

export class Sledding {
  readonly group = new THREE.Group()
  readonly colliders: Circle[] = []
  readonly solids: THREE.Object3D[] = []
  active = false
  onDone: () => void = () => {}
  say: (text: string) => void = () => {}
  /** Your name on the board. */
  name = () => ''

  private sled = pulka()
  private board = boardCanvas()
  private hud: HTMLDivElement
  private x = 0
  private z = 0
  private heading = Math.PI
  private v = 0
  private time = 0
  private penalty = 0
  private count = 0
  private gate = 0
  private finished = 0
  private steer = 0
  private keys = new Set<string>()
  private touchSteer = 0
  private roll = 0
  private flags: { cloth: THREE.Mesh; gate: number }[] = []

  constructor(
    scene: THREE.Scene,
    private player: Player,
    private camera: THREE.PerspectiveCamera,
  ) {
    scene.add(this.group)
    // the gates down the run
    for (const [i, gt] of GATES.entries()) {
      for (const s of [-1, 1]) {
        const f = flag(gt.red)
        const x = gt.x + s * gt.half
        f.g.position.set(x, groundHeight(x, gt.z), gt.z)
        this.group.add(f.g)
        this.flags.push({ cloth: f.cloth, gate: i })
      }
    }
    this.group.add(banner('START', START_Z - 1.5, '#1f5fc8'), banner('MÅL', FINISH_Z, '#d0202a'))
    // the pulkor stacked at the foot of the hill, and the board of the fastest
    const stack = new THREE.Group()
    stack.position.set(STACK.x, 0, STACK.z)
    for (let i = 0; i < 4; i++) {
      const p = pulka([0xd0202a, 0x1f5fc8, 0x2a9d48, 0xf2a71b][i])
      p.position.set(0, 0.05 + i * 0.2, 0)
      p.rotation.y = 0.3 + i * 0.25
      stack.add(p)
    }
    const sign = new THREE.Group()
    const [c, ctx] = makeCanvas(512, 160)
    ctx.fillStyle = '#6b4226'
    ctx.fillRect(0, 0, 512, 160)
    ctx.fillStyle = '#fff3dc'
    ctx.font = `600 64px ${FONT.serif}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🛷 Pulkabacken', 256, 84)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshStandardMaterial({ map: toTexture(c), emissive: 0xffffff, emissiveMap: toTexture(c), emissiveIntensity: 0.3, side: THREE.DoubleSide }))
    plate.position.set(0, 1.9, 0)
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), std(0x5a3a22))
    post.position.set(0, 1.1, -0.05)
    sign.add(plate, post)
    sign.position.set(-1.3, 0, 0.6)
    sign.rotation.y = Math.PI
    stack.add(sign)
    this.group.add(stack)
    this.colliders.push({ x: STACK.x, z: STACK.z, r: 0.7 })
    this.solids.push(stack)
    const bd = new THREE.Group()
    bd.position.set(BOARD.x, 0, BOARD.z)
    bd.rotation.y = Math.PI
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), new THREE.MeshStandardMaterial({ map: this.board.tex, emissive: 0xffffff, emissiveMap: this.board.tex, emissiveIntensity: 0.45 }))
    face.position.set(0, 1.9, 0.06)
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.15, 0.1), std(0x5a3a22))
    back.position.set(0, 1.9, 0)
    bd.add(face, back)
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.0, 0.1), std(0x5a3a22))
      p.position.set(s * 0.8, 1.5, -0.05)
      bd.add(p)
    }
    bd.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
    this.group.add(bd)
    this.colliders.push({ x: BOARD.x - 0.8, z: BOARD.z, r: 0.15 }, { x: BOARD.x + 0.8, z: BOARD.z, r: 0.15 })
    this.solids.push(bd)
    scores.get().then((l) => this.board.draw(l, null))

    // your pulka, hidden until you ride
    this.sled.visible = false
    this.group.add(this.sled)

    // the time, the gates and (on a phone) left/right buttons
    this.hud = document.createElement('div')
    this.hud.id = 'pulka'
    this.hud.hidden = true
    this.hud.innerHTML = '<div class="pk-time">0,00 s</div><div class="pk-gates"></div><div class="pk-msg"></div><button class="pk-l" type="button" aria-label="Styr vänster">◀</button><button class="pk-r" type="button" aria-label="Styr höger">▶</button>'
    document.getElementById('hud')!.appendChild(this.hud)
    for (const [cls, dir] of [['.pk-l', -1], ['.pk-r', 1]] as const) {
      const b = this.hud.querySelector<HTMLButtonElement>(cls)!
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        this.touchSteer = dir
      })
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => this.touchSteer === dir && (this.touchSteer = 0))
    }
    addEventListener('keydown', (e) => this.active && this.keys.add(e.code))
    addEventListener('keyup', (e) => this.keys.delete(e.code))
  }

  /** At the stack of pulkor, facing it? */
  near(pos: THREE.Vector3, fwd: THREE.Vector3) {
    const dx = STACK.x - pos.x
    const dz = STACK.z - pos.z
    const d = Math.hypot(dx, dz)
    return d < 2.6 && (dx * fwd.x + dz * fwd.z) / d > 0.4
  }

  start() {
    this.x = runX(START_Z)
    this.z = START_Z
    this.heading = Math.PI
    this.v = 0
    this.time = 0
    this.penalty = 0
    this.gate = 0
    this.count = 3.2
    this.finished = 0
    this.roll = 0
    this.keys.clear()
    this.touchSteer = 0
    this.active = true
    this.sled.visible = true
    for (const f of this.flags) f.cloth.scale.setScalar(1)
    this.hud.hidden = false
    this.hud.classList.remove('done')
    this.msg('3')
    this.place(0)
  }

  private msg(text: string) {
    this.hud.querySelector('.pk-msg')!.textContent = text
  }

  update(dt: number) {
    if (!this.active) return
    dt = Math.min(dt, 0.05)
    // three, two, one…
    if (this.count > 0) {
      const was = Math.ceil(this.count - 0.2)
      this.count -= dt
      const now = Math.ceil(this.count - 0.2)
      if (now !== was) {
        this.msg(now > 0 ? String(now) : 'Kör!')
        blip(now > 0 ? 660 : 1320, 0.15, 'triangle', 0.06)
        if (now <= 0) noise(6, 300, 900, 0.05, 0.6)
      }
      this.place(dt)
      return
    }
    if (this.finished > 0) {
      // run out on the flat, then up and off
      this.v = Math.max(0, this.v - dt * 7)
      this.move(dt)
      this.place(dt)
      this.finished -= dt
      if (this.finished <= 0 || (this.v <= 0 && this.finished < 2.2)) this.end()
      return
    }
    if (this.time > 0.4) this.msg('')
    const k = this.keys
    const want = (k.has('KeyA') || k.has('ArrowLeft') ? -1 : 0) + (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) + this.touchSteer
    this.steer += (THREE.MathUtils.clamp(want, -1, 1) - this.steer) * Math.min(1, dt * 8)
    // (left is to the west when you face north, downhill: heading turns the other way round)
    this.heading -= this.steer * 1.5 * THREE.MathUtils.clamp(this.v / 5, 0.35, 1) * dt
    // downhill pulls, the snow and the air hold back; off the packed run the powder is deep
    const e = 0.5
    const hx = (groundHeight(this.x + e, this.z) - groundHeight(this.x - e, this.z)) / (2 * e)
    const hz = (groundHeight(this.x, this.z + e) - groundHeight(this.x, this.z - e)) / (2 * e)
    const dx = Math.sin(this.heading)
    const dz = Math.cos(this.heading)
    const slope = hx * dx + hz * dz
    const off = Math.abs(this.x - runX(Math.min(this.z, HILL.z1)))
    const mu = 0.05 + (off > 4.5 ? 0.35 : 0)
    this.v += (-G * slope - mu * G - 0.012 * this.v * this.v) / Math.sqrt(1 + slope * slope) * dt
    this.v = Math.max(0.6, this.v)
    const z0 = this.z
    this.move(dt)
    // into the trees: a bump, and slower
    const side = this.x - runX(Math.min(this.z, HILL.z1))
    if (Math.abs(side) > 8.5) {
      this.x = runX(Math.min(this.z, HILL.z1)) + Math.sign(side) * 8.5
      this.v *= 0.55
      this.heading = Math.PI - (this.heading - Math.PI) * 0.3
      noise(0.25, 200, 80, 0.12, 2)
    }
    this.time += dt
    // through the gates (or past them)
    const gt = GATES[this.gate]
    if (gt && z0 > gt.z && this.z <= gt.z) {
      const ok = Math.abs(this.x - gt.x) < gt.half
      if (ok) blip(gt.red ? 990 : 1180, 0.1, 'sine', 0.05)
      else {
        this.penalty += 2
        this.msg('Missad port +2 s')
        this.time = Math.max(this.time, 0.41)
        setTimeout(() => this.msg(''), 900)
        noise(0.2, 400, 150, 0.06, 1)
      }
      for (const f of this.flags) if (f.gate === this.gate) f.cloth.scale.setScalar(ok ? 1.35 : 0.6)
      this.gate++
    }
    if (this.z <= FINISH_Z) this.finish()
    this.place(dt)
  }

  private move(dt: number) {
    this.x += Math.sin(this.heading) * this.v * dt
    this.z += Math.cos(this.heading) * this.v * dt
  }

  /** You, the pulka and the camera, where you are on the hill. */
  private place(dt: number) {
    const y = groundHeight(this.x, this.z)
    const dx = Math.sin(this.heading)
    const dz = Math.cos(this.heading)
    const ahead = groundHeight(this.x + dx * 1.2, this.z + dz * 1.2)
    const pitch = Math.atan2(ahead - y, 1.2)
    this.sled.position.set(this.x, y, this.z)
    this.sled.rotation.set(-pitch, this.heading, 0, 'YXZ')
    this.roll += (this.steer * 0.12 - this.roll) * Math.min(1, dt * 5)
    const p = this.player
    p.pos.set(this.x, 0, this.z)
    p.floor = y
    p.height = 0
    p.vel.set(dx * this.v, 0, dz * this.v)
    p.yaw = Math.atan2(-dx, -dz)
    const c = this.camera
    c.position.set(this.x - dx * 0.55, y + 1.0, this.z - dz * 0.55)
    c.rotation.set(pitch - 0.22, p.yaw, this.roll, 'YXZ')
    const cs = Math.round((this.time + this.penalty) * 100)
    this.hud.querySelector('.pk-time')!.textContent = fmt(cs)
    this.hud.querySelector('.pk-gates')!.textContent = this.finished > 0 ? '' : `Port ${Math.min(this.gate + 1, GATES.length)} av ${GATES.length}`
  }

  private finish() {
    const cs = Math.round((this.time + this.penalty) * 100)
    this.finished = 3
    this.hud.classList.add('done')
    this.msg(`Mål! ${fmt(cs)}`)
    blip(1568, 0.3, 'triangle', 0.07)
    const name = this.name() || 'En nisse'
    scores.post(name, cs).then((list) => {
      this.board.draw(list, cs)
      const place = list.findIndex((e) => e.score === cs && e.name === name)
      this.say(place >= 0 ? `🛷 ${fmt(cs)} – ${place === 0 ? 'säsongens snabbaste åk!' : `plats ${place + 1} på listan vid backen.`}` : `🛷 ${fmt(cs)}. Snabbt – men inte bland de tio bästa än.`)
    })
  }

  private end() {
    this.active = false
    this.sled.visible = false
    this.hud.hidden = true
    // up off the pulka, at the foot of the hill, looking back up it
    const p = this.player
    p.pos.set(THREE.MathUtils.clamp(this.x, HILL.base.x0 + 1, HILL.base.x1 - 1), 0, THREE.MathUtils.clamp(this.z, HILL.base.z0 + 0.5, HILL.base.z1 - 0.5))
    p.floor = 0
    p.vel.set(0, 0, 0)
    p.yaw = Math.PI
    p.pitch = 0.05
    this.onDone()
  }
}
