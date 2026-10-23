// Things to do in Leksaksfabriken: help Kvalitetskontrollen stamp the toys OK as they roll past
// (but not the lumps of coal!) – and the tin soldiers, a whole little regiment parading round their
// stage to Schubert's Marche militaire whenever someone comes near (the music fades in as you walk
// up, and out again).
import * as THREE from 'three'
import { keepApart, mergeRigid } from './batch'
import { Nisse } from './npc'
import { blip, puff, ToyMarch } from './sfx'
import type { Shop } from './shop'
import { makeCanvas, toTexture } from './tex'

const mats = new Map<string, THREE.MeshStandardMaterial>()
const mat = (color: number, roughness = 0.7, metalness = 0) => {
  const k = `${color}|${roughness}|${metalness}`
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness }))
  return mats.get(k)!
}
const C = { wood: 0x8a5a32, dark: 0x4a2c1c, red: 0xc8102e, green: 0x1d6e48, blue: 0x2b5fa8, gold: 0xd4a64a, white: 0xfbf8f2, black: 0x1a1a1f, skin: 0xf1c7a5, brown: 0x7a4a24, navy: 0x1f2b5e }
function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, n = 14) => new THREE.CylinderGeometry(rt, rb, h, n)
const ball = (r: number, n = 12) => new THREE.SphereGeometry(r, n, Math.max(6, n - 4))
const moving = <T extends THREE.Object3D>(o: T): T => {
  mergeRigid(o)
  return keepApart(o)
}
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* fine */
    }
  },
}

function board(title: string, line: string, w = 1024, h = 300) {
  const [c, ctx] = makeCanvas(w, h)
  ctx.fillStyle = '#1d6e48'
  ctx.beginPath()
  ctx.roundRect(6, 6, w - 12, h - 12, 36)
  ctx.fill()
  ctx.strokeStyle = '#f6c453'
  ctx.lineWidth = 12
  ctx.stroke()
  ctx.fillStyle = '#fff3dc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 96px Fraunces, Georgia, serif'
  ctx.fillText(title, w / 2, h * 0.38)
  ctx.font = "500 46px 'DM Sans', sans-serif"
  ctx.fillStyle = '#f6c453'
  ctx.fillText(line, w / 2, h * 0.75)
  return c
}

/* ---------- Kvalitetskontrollen: stamp the toys OK ---------- */

const ROUND = 45
const BEST_KEY = 'jul3d.stampla'
const BELT = 4.4
const BELT_Y = 0.9
const REST_Y = 1.62
const PRESS_Y = 1.2

type Item = { g: THREE.Group; coal: boolean; x: number; live: boolean; stamped: boolean; ok: THREE.Sprite }

function toy(kind: number) {
  const g = new THREE.Group()
  const cols = [C.red, C.green, C.blue, C.gold]
  const col = cols[kind % cols.length]
  switch (kind % 5) {
    case 0: {
      // a present
      add(g, box(0.3, 0.26, 0.3), mat(col, 0.6), 0, 0.13, 0)
      add(g, box(0.31, 0.27, 0.06), mat(C.gold, 0.4), 0, 0.13, 0)
      add(g, box(0.06, 0.27, 0.31), mat(C.gold, 0.4), 0, 0.13, 0)
      break
    }
    case 1: {
      // a teddy
      const fur = mat(C.brown, 0.95)
      add(g, ball(0.11), fur, 0, 0.11, 0).scale.set(1, 1.15, 0.9)
      add(g, ball(0.08), fur, 0, 0.28, 0)
      for (const x of [-1, 1]) add(g, ball(0.03, 8), fur, x * 0.055, 0.35, 0)
      add(g, ball(0.03, 8), mat(0xe8c9a0, 0.9), 0, 0.27, 0.07)
      break
    }
    case 2: {
      // a drum
      add(g, cyl(0.13, 0.13, 0.17, 18), mat(col, 0.5), 0, 0.085, 0)
      for (const y of [0.005, 0.165]) add(g, cyl(0.135, 0.135, 0.02, 18), mat(C.gold, 0.3, 0.7), 0, y, 0)
      break
    }
    case 3: {
      // a wooden engine
      add(g, box(0.2, 0.14, 0.34), mat(col, 0.5), 0, 0.12, 0)
      add(g, cyl(0.06, 0.06, 0.2, 12), mat(C.black, 0.5), 0, 0.17, 0.06).rotation.x = Math.PI / 2
      add(g, cyl(0.03, 0.04, 0.12, 10), mat(C.black, 0.5), 0, 0.3, 0.12)
      for (const z of [-0.1, 0.1]) for (const x of [-0.11, 0.11]) add(g, cyl(0.045, 0.045, 0.03, 12), mat(C.black, 0.5), x, 0.05, z).rotation.z = Math.PI / 2
      break
    }
    default: {
      // a doll
      add(g, new THREE.ConeGeometry(0.09, 0.22, 14), mat(col, 0.7), 0, 0.11, 0)
      add(g, ball(0.055), mat(C.skin, 0.6), 0, 0.27, 0)
      add(g, ball(0.058), mat(0xc98a2b, 0.9), 0, 0.29, -0.015).scale.set(1, 0.8, 1)
    }
  }
  return g
}

function coal() {
  const g = new THREE.Group()
  const m = mat(0x1c1c22, 0.9, 0.2)
  add(g, new THREE.IcosahedronGeometry(0.12, 0), m, 0, 0.1, 0).rotation.set(0.4, 0.7, 0.2)
  add(g, new THREE.IcosahedronGeometry(0.08, 0), m, 0.09, 0.07, 0.04).rotation.set(1, 0.2, 0.5)
  return g
}

/** The green "OK" ink, for the stamped toys. */
function okTexture() {
  const [c, ctx] = makeCanvas(128, 128)
  ctx.strokeStyle = '#1f9a4e'
  ctx.fillStyle = '#1f9a4e'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(64, 64, 52, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = "800 54px 'DM Sans', sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('OK', 64, 68)
  return toTexture(c)
}

export class Stamping {
  active = false
  onLeft: () => void = () => {}
  private root = new THREE.Group()
  private items: Item[] = []
  private head = new THREE.Group()
  private beltTex: THREE.Texture | null = null
  private press = -1
  private time = 0
  private spawnIn = 0
  private score = 0
  private oops = 0
  private missed = 0
  private over = 0
  private msgT = 0
  private best = Number(store.get(BEST_KEY)) || 0
  private el = document.getElementById('stampla')!

  constructor() {
    addEventListener('keydown', (e) => {
      if (!this.active || e.repeat) return
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault()
        e.stopImmediatePropagation()
        this.hit()
      }
    }, true)
    addEventListener('pointerdown', (e) => {
      if (!this.active || (e.target as HTMLElement | null)?.closest?.('button')) return
      this.hit()
    })
    this.el.querySelector('.st-stop')?.addEventListener('click', () => this.leave())
  }

  /** The station: a belt with a stamp over it, at (x, z) in the shop, the player standing on +z. */
  build(shop: Shop, x: number, z: number, onOpen: () => void) {
    const g = this.root
    g.position.set(x, 0, z)
    shop.group.add(g)
    // the belt on its legs
    add(g, box(BELT + 0.4, 0.12, 0.75), mat(C.dark, 0.6), 0, BELT_Y - 0.07, 0)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.08, BELT_Y - 0.1, 0.08), mat(C.dark, 0.6), sx * (BELT / 2), (BELT_Y - 0.1) / 2, sz * 0.3)
    for (const sz of [-1, 1]) add(g, box(BELT + 0.4, 0.1, 0.05), mat(C.gold, 0.35, 0.7), 0, BELT_Y + 0.02, sz * 0.38)
    const [c, ctx] = makeCanvas(128, 32)
    ctx.fillStyle = '#2b2b30'
    ctx.fillRect(0, 0, 64, 32)
    ctx.fillStyle = '#3d3d46'
    ctx.fillRect(64, 0, 64, 32)
    this.beltTex = toTexture(c, { live: true })
    this.beltTex.wrapS = THREE.RepeatWrapping
    this.beltTex.repeat.set(BELT * 2, 1)
    const belt = add(g, new THREE.PlaneGeometry(BELT, 0.62), new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.8 }), 0, BELT_Y + 0.001, 0)
    belt.rotation.x = -Math.PI / 2
    belt.castShadow = false
    // the gantry and the big rubber stamp
    for (const sx of [-1, 1]) add(g, box(0.1, 2.1, 0.1), mat(C.red, 0.5), sx * 0.5, 1.05, -0.36)
    add(g, box(1.2, 0.14, 0.14), mat(C.red, 0.5), 0, 2.1, -0.36)
    add(g, box(0.1, 0.1, 0.4), mat(C.red, 0.5), 0, 2.05, -0.18)
    add(this.head, cyl(0.04, 0.04, 0.5, 8), mat(0x8a8f98, 0.4, 0.6), 0, 0.42, 0)
    add(this.head, box(0.42, 0.16, 0.34), mat(C.wood, 0.6), 0, 0.1, 0)
    add(this.head, box(0.38, 0.05, 0.3), mat(0x1f9a4e, 0.8), 0, -0.005, 0)
    add(this.head, ball(0.09, 12), mat(C.red, 0.4), 0, 0.68, 0)
    this.head.position.set(0, REST_Y, 0)
    g.add(moving(this.head))
    // the sign over it all – look at it (or the stamp) to lend a hand
    const signTex = toTexture(board('Kvalitetskontroll', 'Stämpla leksakerna OK – men inte kolet!'))
    const sign = add(g, new THREE.PlaneGeometry(2.4, 0.7), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.12 }), 0, 2.6, -0.36)
    sign.castShadow = false
    for (const target of [sign, this.head]) shop.exhibit(target, { title: 'Kvalitetskontrollen', image: () => '', open: onOpen, prompt: '🔖 Hjälp till att stämpla leksaker' })
    // where they end up: a crate of approved toys, a bucket for the coal
    add(g, box(0.7, 0.5, 0.7), mat(0xb0864a, 0.9), -BELT / 2 - 0.55, 0.25, 0)
    add(g, cyl(0.2, 0.16, 0.32, 14), mat(0x5a5f68, 0.5, 0.5), -BELT / 2 - 0.55, 0.16, 0.6)
    shop.block(x, z, BELT / 2 + 0.95, 0.45)
    // the inspector, across the belt
    const inspector = new Nisse({ coat: C.blue, hat: C.red, beard: true, scale: 0.75, apron: C.white })
    inspector.group.position.set(0.9, 0, -0.85)
    inspector.setYaw(0)
    inspector.armR.rotation.x = -0.9
    g.add(inspector.group)
    // items to put on the belt, reused round and round
    const ok = okTexture()
    for (let i = 0; i < 12; i++) {
      const isCoal = i % 4 === 3
      const it = moving(isCoal ? coal() : toy(i))
      const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: ok, depthTest: false, transparent: true }))
      mark.scale.setScalar(0.26)
      mark.position.set(0, 0.5, 0.12)
      mark.visible = false
      it.add(mark)
      it.visible = false
      g.add(it)
      this.items.push({ g: it, coal: isCoal, x: 0, live: false, stamped: false, ok: mark })
    }
    shop.updaters.push((_, dt) => this.update(dt))
  }

  /** Where you stand to help: in front of the belt, looking down at the stamp. */
  viewpoint() {
    this.root.updateMatrixWorld(true)
    const p = this.root.localToWorld(new THREE.Vector3(0, 0, 2.1))
    const q = new THREE.Quaternion()
    this.root.getWorldQuaternion(q)
    const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y
    return { x: p.x, z: p.z, yaw, pitch: -0.3 }
  }

  start() {
    this.active = true
    this.time = 0
    this.score = this.oops = this.missed = 0
    this.over = 0
    this.spawnIn = 0.4
    for (const it of this.items) this.retire(it)
    this.el.hidden = false
    this.say('Stämpla leksakerna när de är under stämpeln – Space, klick eller tryck. Inte kolet!', 4)
    this.hud()
  }

  leave() {
    if (!this.active) return
    this.active = false
    this.el.hidden = true
    this.onLeft()
  }

  private retire(it: Item) {
    it.live = false
    it.g.visible = false
    it.ok.visible = false
  }

  private hit() {
    if (this.over) {
      // after a round: once the result has sunk in, another go
      if (this.over > 1.2) this.start()
      return
    }
    if (this.press >= 0) return
    this.press = 0
    blip(160, 0.06, 'square', 0.04)
  }

  /** The stamp reaches the belt: whatever is under it gets stamped. */
  private land() {
    const under = this.items.find((it) => it.live && !it.stamped && Math.abs(it.x) < 0.3)
    if (!under) return
    under.stamped = true
    // (the inspector stamping on his own does it quietly: sounds here aren't fainter with distance,
    // so his ding would carry right across the village)
    if (under.coal) {
      if (!this.active) return
      puff(0.3)
      this.oops++
      this.score = Math.max(0, this.score - 1)
      this.say('🙈 Kol! Det ska inte stämplas. −1')
    } else {
      under.ok.visible = true
      if (!this.active) return
      blip(1320, 0.1, 'triangle', 0.06)
      this.score++
      if (this.score % 5 === 0) this.say(['Bra jobbat! ⭐', 'Verkmästaren nickar gillande.', 'Lasse vill också prova!', 'Snabba händer!'][(this.score / 5) % 4])
    }
    this.hud()
  }

  private say(text: string, secs = 1.6) {
    const m = this.el.querySelector<HTMLElement>('.st-msg')!
    m.textContent = text
    m.hidden = false
    this.msgT = secs
  }

  private hud() {
    this.el.querySelector('.fl-score b')!.textContent = String(this.score)
    const left = Math.max(0, ROUND - this.time)
    const time = this.el.querySelector('.fl-time')!
    time.querySelector('b')!.textContent = String(Math.ceil(left))
    time.classList.toggle('low', left < 8 && !this.over)
    this.el.querySelector('.fl-best')!.textContent = `🏆 ${this.best}`
  }

  private update(dt: number) {
    if (!this.beltTex) return
    const k = this.active ? Math.min(1, this.time / ROUND) : 0
    const speed = this.over ? 0 : this.active ? 0.85 + k * 0.85 : 0.55
    this.beltTex.offset.x = (this.beltTex.offset.x + speed * dt * 2) % 1
    // the round's clock
    if (this.active && !this.over) {
      this.time += dt
      if (this.time >= ROUND) this.finish()
      else if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) this.hud()
    } else if (this.over) {
      this.over += dt
      if (this.over > 6) this.leave()
    }
    if (this.msgT > 0 && (this.msgT -= dt) <= 0) this.el.querySelector<HTMLElement>('.st-msg')!.hidden = true
    // new things on the belt
    if (!this.over && (this.spawnIn -= dt) <= 0) {
      this.spawnIn = this.active ? THREE.MathUtils.lerp(1.2, 0.6, k) * (0.8 + Math.random() * 0.4) : 1.7
      const coalNext = Math.random() < (this.active ? 0.28 : 0.2)
      const free = this.items.filter((it) => !it.live && it.coal === coalNext)
      const it = free[Math.floor(Math.random() * free.length)]
      if (it) {
        it.live = true
        it.stamped = false
        it.x = BELT / 2
        it.g.visible = true
        it.ok.visible = false
        it.g.rotation.y = Math.random() * Math.PI * 2
      }
    }
    for (const it of this.items) {
      if (!it.live) continue
      const before = it.x
      it.x -= speed * dt
      it.g.position.set(it.x, BELT_Y, 0)
      // left alone, the inspector stamps the toys himself
      if (!this.active && !it.coal && !it.stamped && before > 0 && it.x <= 0.05 && this.press < 0) this.press = 0
      if (it.x < -BELT / 2) {
        if (this.active && !it.coal && !it.stamped) this.missed++
        this.retire(it)
      }
    }
    // the stamp: down fast, a moment on the toy, back up
    if (this.press >= 0) {
      const before = this.press
      this.press += dt
      const p = this.press
      const y = p < 0.08 ? THREE.MathUtils.lerp(REST_Y, PRESS_Y, p / 0.08) : p < 0.14 ? PRESS_Y : THREE.MathUtils.lerp(PRESS_Y, REST_Y, Math.min(1, (p - 0.14) / 0.16))
      this.head.position.y = y
      if (before < 0.08 && p >= 0.08) this.land()
      if (p >= 0.3) {
        this.press = -1
        this.head.position.y = REST_Y
      }
    }
  }

  private finish() {
    this.over = 0.001
    const record = this.score > this.best
    if (record) {
      this.best = this.score
      store.set(BEST_KEY, String(this.score))
    }
    const verdict = this.score >= 30 ? 'Tomten vill anställa dig! 🎅' : this.score >= 18 ? 'Verkmästarnissen är imponerad.' : 'Bra hjälp – nissarna tackar!'
    this.say(`Klart! ${this.score} leksaker godkända${this.oops ? `, ${this.oops} kol` : ''}. ${record ? 'Nytt rekord! 🏆 ' : ''}${verdict}  (Space: en gång till)`, 6)
    this.hud()
  }
}

/* ---------- the tin soldiers' parade ---------- */

type Soldier = { g: THREE.Group; body: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[]; kind: 'drum' | 'horn' | 'rifle' | 'major'; s: number; sticks?: THREE.Group[]; baton?: THREE.Group }

function tinSoldier(kind: Soldier['kind']) {
  const g = new THREE.Group()
  const body = new THREE.Group()
  g.add(body)
  const legs = [-1, 1].map((x) => {
    const hip = new THREE.Group()
    hip.position.set(x * 0.075, 0.42, 0)
    add(hip, cyl(0.055, 0.055, 0.34, 10), mat(C.white, 0.6), 0, -0.17, 0)
    add(hip, box(0.11, 0.09, 0.17), mat(C.black, 0.35), 0, -0.37, 0.02)
    body.add(hip)
    return hip
  })
  const coat = kind === 'major' ? C.navy : C.red
  add(body, cyl(0.15, 0.13, 0.36, 14), mat(coat, 0.5), 0, 0.6, 0)
  add(body, cyl(0.135, 0.135, 0.05, 14), mat(C.black, 0.4), 0, 0.45, 0)
  add(body, box(0.06, 0.05, 0.02), mat(C.gold, 0.3, 0.8), 0, 0.45, 0.135)
  for (let i = 0; i < 3; i++) add(body, ball(0.014, 6), mat(C.gold, 0.3, 0.8), 0, 0.53 + i * 0.07, 0.15)
  for (const x of [-1, 1]) add(body, box(0.05, 0.4, 0.015), mat(C.white, 0.6), x * 0.05, 0.6, 0.14).rotation.z = x * 0.45
  for (const x of [-1, 1]) add(body, cyl(0.06, 0.07, 0.03, 12), mat(C.gold, 0.3, 0.8), x * 0.16, 0.77, 0)
  // the head and the tall shako
  add(body, ball(0.085, 14), mat(C.skin, 0.6), 0, 0.88, 0)
  for (const x of [-1, 1]) {
    add(body, ball(0.012, 6), mat(C.black, 0.3), x * 0.03, 0.9, 0.078)
    add(body, ball(0.018, 6), mat(0xe58a8a, 0.6), x * 0.05, 0.86, 0.07).scale.z = 0.4
  }
  add(body, box(0.07, 0.015, 0.01), mat(C.black, 0.5), 0, 0.855, 0.083)
  const hatH = kind === 'major' ? 0.3 : 0.2
  add(body, cyl(0.085, 0.08, hatH, 14), mat(C.black, 0.35), 0, 0.96 + hatH / 2, 0)
  add(body, cyl(0.087, 0.087, 0.03, 14), mat(C.gold, 0.3, 0.8), 0, 0.975, 0)
  add(body, new THREE.CircleGeometry(0.035, 5), mat(C.gold, 0.3, 0.8), 0, 1.03, 0.083)
  add(body, new THREE.ConeGeometry(0.03, 0.12, 8), mat(kind === 'major' ? C.white : C.red, 0.7), 0, 0.98 + hatH + 0.06, 0)
  // arms, each holding something
  const arms = [-1, 1].map((x) => {
    const sh = new THREE.Group()
    sh.position.set(x * 0.18, 0.75, 0)
    add(sh, cyl(0.035, 0.04, 0.28, 8), mat(coat, 0.5), 0, -0.14, 0)
    add(sh, ball(0.045, 8), mat(C.white, 0.6), 0, -0.3, 0)
    body.add(sh)
    return sh
  })
  const soldier: Soldier = { g, body, legs, arms, kind, s: 0 }
  if (kind === 'drum') {
    add(body, cyl(0.14, 0.14, 0.15, 18), mat(C.white, 0.5), 0, 0.5, 0.2).rotation.x = Math.PI / 2 - 0.2
    for (const z of [0.13, 0.27]) add(body, cyl(0.145, 0.145, 0.02, 18), mat(C.red, 0.5), 0, 0.5, z).rotation.x = Math.PI / 2 - 0.2
    soldier.sticks = arms.map((a) => {
      const stick = new THREE.Group()
      add(stick, cyl(0.008, 0.008, 0.25, 6), mat(C.wood, 0.6), 0, -0.1, 0.06).rotation.x = 1.2
      stick.position.y = -0.3
      a.add(stick)
      return stick
    })
    for (const a of arms) a.rotation.x = -0.8
  } else if (kind === 'horn') {
    const horn = new THREE.Group()
    add(horn, cyl(0.012, 0.012, 0.28, 8), mat(C.gold, 0.25, 0.85), 0, 0, 0).rotation.x = Math.PI / 2
    add(horn, new THREE.CylinderGeometry(0.06, 0.012, 0.12, 14, 1, true), mat(C.gold, 0.25, 0.85), 0, 0, 0.18).rotation.x = Math.PI / 2
    horn.position.set(0.16, 0.86, 0.2)
    body.add(horn)
    arms[1].rotation.set(-1.4, 0, 0.4)
    arms[0].rotation.set(-1.3, 0, -0.5)
  } else if (kind === 'rifle') {
    add(arms[1], cyl(0.012, 0.012, 0.7, 6), mat(C.dark, 0.6), 0, -0.05, 0.03)
    add(arms[1], cyl(0.004, 0.004, 0.14, 4), mat(0xb8bcc4, 0.3, 0.8), 0, 0.36, 0.03)
    arms[1].rotation.x = -0.15
  } else {
    soldier.baton = new THREE.Group()
    add(soldier.baton, cyl(0.01, 0.01, 0.5, 6), mat(C.gold, 0.3, 0.8), 0, 0.22, 0)
    add(soldier.baton, ball(0.03, 8), mat(C.gold, 0.3, 0.8), 0, 0.48, 0)
    soldier.baton.position.y = -0.3
    arms[1].add(soldier.baton)
  }
  return soldier
}

/** Full volume this close to the stage (m), silent this far. */
const NEAR = 7
const FAR = 19

export class Parade {
  readonly music = new ToyMarch()
  private soldiers: Soldier[] = []
  private root = new THREE.Group()
  private loop!: THREE.CurvePath<THREE.Vector3>
  private len = 0
  private s = 0
  private last = 0
  private step = 0

  /** The stage at (x, z) in the shop, w × d. */
  build(shop: Shop, x: number, z: number, w: number, d: number) {
    const g = this.root
    g.position.set(x, 0, z)
    shop.group.add(g)
    const top = 0.3
    add(g, box(w, top, d), mat(C.red, 0.6), 0, top / 2, 0)
    add(g, box(w + 0.1, 0.06, d + 0.1), mat(C.gold, 0.35, 0.7), 0, top, 0)
    const floor = add(g, box(w - 0.2, 0.02, d - 0.2), mat(0x2a6a46, 0.8), 0, top + 0.03, 0)
    floor.castShadow = false
    // bunting round the stage's front edge
    for (let i = 0; i < 18; i++) {
      const f = add(g, new THREE.ConeGeometry(0.08, 0.16, 3), mat([C.red, C.gold, C.white][i % 3], 0.7), -w / 2 + 0.2 + (i * (w - 0.4)) / 17, top - 0.1, d / 2 + 0.06)
      f.rotation.x = Math.PI
      f.castShadow = false
    }
    shop.block(x, z, w / 2 + 0.05, d / 2 + 0.05)
    // the route round the stage: a rounded rectangle, walked anticlockwise as seen from above
    const hw = w / 2 - 0.55
    const hd = d / 2 - 0.5
    const r = Math.min(hd, 0.7)
    const shape = new THREE.Shape()
    shape.moveTo(-hw + r, hd)
    shape.lineTo(hw - r, hd)
    shape.quadraticCurveTo(hw, hd, hw, hd - r)
    shape.lineTo(hw, -hd + r)
    shape.quadraticCurveTo(hw, -hd, hw - r, -hd)
    shape.lineTo(-hw + r, -hd)
    shape.quadraticCurveTo(-hw, -hd, -hw, -hd + r)
    shape.lineTo(-hw, hd - r)
    shape.quadraticCurveTo(-hw, hd, -hw + r, hd)
    const pts = shape.getSpacedPoints(120).map((p) => new THREE.Vector3(p.x, top + 0.04, p.y))
    this.loop = new THREE.CurvePath<THREE.Vector3>()
    this.loop.add(new THREE.CatmullRomCurve3(pts, true))
    this.len = this.loop.getLength()
    // a drum major out in front, then drums, horns and rifles, over and over
    const kinds: Soldier['kind'][] = ['major', ...Array.from({ length: 21 }, (_, i) => (['drum', 'horn', 'rifle', 'rifle', 'horn', 'drum', 'rifle'] as const)[i % 7])]
    kinds.forEach((k, i) => {
      const sd = tinSoldier(k)
      sd.g.scale.setScalar(0.62)
      sd.s = 1 - i / kinds.length
      g.add(moving(sd.g))
      this.soldiers.push(sd)
    })
    this.place(0)
    shop.updaters.push(() => this.update())
  }

  /** The band strikes up as you come near – full within NEAR metres, fading to nothing by FAR – and stops once you have gone. */
  near(pos: THREE.Vector3, enabled = true) {
    const p = this.root.getWorldPosition(new THREE.Vector3())
    const d = Math.hypot(pos.x - p.x, pos.z - p.z)
    const vol = enabled ? 0.32 * THREE.MathUtils.clamp((FAR - d) / (FAR - NEAR), 0, 1) : 0
    if (vol > 0.003) {
      if (!this.music.playing) this.music.start(0.0001)
      this.music.level(vol)
    } else if (this.music.playing) {
      this.music.level(0.0001)
      // out of earshot for good: stop the band
      if (d > FAR + 3 || !enabled) this.music.stop()
    }
  }

  private place(stepPhase: number) {
    const tangent = new THREE.Vector3()
    for (const sd of this.soldiers) {
      const u = (((sd.s + this.s / this.len) % 1) + 1) % 1
      const p = this.loop.getPointAt(u)
      tangent.copy(this.loop.getTangentAt(u))
      sd.g.position.copy(p)
      sd.g.rotation.y = Math.atan2(tangent.x, tangent.z)
      const swing = Math.sin(stepPhase * Math.PI)
      sd.legs[0].rotation.x = swing * 0.45
      sd.legs[1].rotation.x = -swing * 0.45
      sd.body.position.y = Math.abs(swing) * 0.025
      if (sd.kind === 'rifle' || sd.kind === 'major') sd.arms[0].rotation.x = -swing * 0.4
      if (sd.sticks) for (const [i, st] of sd.sticks.entries()) st.rotation.x = Math.max(0, Math.sin(stepPhase * Math.PI * 2 + i * Math.PI)) * 0.7
      if (sd.baton) sd.arms[1].rotation.x = -1.2 + Math.sin(stepPhase * Math.PI) * 0.9
    }
  }

  private update() {
    if (this.music.playing) {
      // one step a beat, in time with the music
      const beats = this.music.beats
      const db = Math.max(0, beats - this.last)
      this.last = beats
      this.s += db * 0.17
      this.step = beats
      this.place(this.step)
    } else if (this.step !== 0) {
      // halt: feet together, where they stand
      this.last = 0
      this.step = 0
      this.place(0)
    }
  }
}

export const stamping = new Stamping()
export const parade = new Parade()
