// Paketlinjen: an open shed at the west end of Leksaksfabriken's yard where the toys get wrapped. They
// come along the belt, each with a child's wish note floating over it – red, green or blue paper – and
// under the wrapping station you give it the paper it wished for (1/2/3, the arrows, or the buttons on a
// phone): wrapped, a bow on, off it goes. The wrong paper costs a point, a golden note counts double. The
// belt runs faster the nearer julafton it is. 45 seconds a round; the season's best on the board.
import * as THREE from 'three'
import { Nisse } from './npc'
import { blip, puff } from './sfx'
import { FONT, makeCanvas, toTexture } from './tex'
import { today } from './julkalender'
import type { Circle } from './world'

const ROUND = 45
const BELT = 4.4
const BELT_Y = 0.9
/** The shed: where it stands in the yard, facing east (the belt runs north–south). */
const AT = { x: -23, z: -58 }
const YAW = Math.PI / 2
const PAPERS = [
  { color: 0xc8102e, css: '#e0303f', name: 'rött', key: ['Digit1', 'ArrowLeft', 'KeyA', 'Numpad1'] },
  { color: 0x1d8a4e, css: '#2aa660', name: 'grönt', key: ['Digit2', 'ArrowDown', 'KeyS', 'Numpad2', 'ArrowUp', 'KeyW'] },
  { color: 0x2b5fa8, css: '#3f7fd8', name: 'blått', key: ['Digit3', 'ArrowRight', 'KeyD', 'Numpad3'] },
]

const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* fine */
    }
  },
}

/** A toy, unwrapped: a teddy, a train engine, a ball, a doll's house, a rocking horse… simply. */
function toy(kind: number) {
  const g = new THREE.Group()
  const c = [0xc98a2b, 0xc8102e, 0x2b5fa8, 0x1d6e48, 0xf2c230][kind % 5]
  if (kind % 4 === 0) {
    add(g, new THREE.SphereGeometry(0.13, 12, 10), std(0x8a5a32, 0.9), 0, 0.13, 0)
    add(g, new THREE.SphereGeometry(0.09, 12, 10), std(0x8a5a32, 0.9), 0, 0.3, 0)
    for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.035, 8, 6), std(0x8a5a32, 0.9), s * 0.07, 0.38, 0)
  } else if (kind % 4 === 1) {
    add(g, new THREE.BoxGeometry(0.34, 0.14, 0.18), std(c, 0.5), 0, 0.12, 0)
    add(g, new THREE.BoxGeometry(0.12, 0.14, 0.18), std(0x222222, 0.5), -0.1, 0.25, 0)
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), std(0x222222, 0.5), 0.1, 0.24, 0)
  } else if (kind % 4 === 2) {
    add(g, new THREE.SphereGeometry(0.15, 14, 10), std(c, 0.4), 0, 0.15, 0)
  } else {
    add(g, new THREE.BoxGeometry(0.26, 0.2, 0.2), std(0xf7f4ee, 0.6), 0, 0.1, 0)
    const roof = add(g, new THREE.ConeGeometry(0.2, 0.14, 4), std(c, 0.6), 0, 0.27, 0)
    roof.rotation.y = Math.PI / 4
  }
  return g
}

/** The wrapped present: a box in its paper, a gold bow. */
function parcel(color: number) {
  const g = new THREE.Group()
  add(g, new THREE.BoxGeometry(0.36, 0.3, 0.3), std(color, 0.55), 0, 0.15, 0)
  const gold = std(0xf6c453, 0.35, 0.6)
  add(g, new THREE.BoxGeometry(0.37, 0.31, 0.05), gold, 0, 0.15, 0)
  add(g, new THREE.BoxGeometry(0.05, 0.31, 0.31), gold, 0, 0.15, 0)
  for (const s of [-1, 1]) add(g, new THREE.TorusGeometry(0.05, 0.015, 6, 12), gold, s * 0.04, 0.33, 0).rotation.y = Math.PI / 2
  return g
}

/** A wish note: the colour of paper wished for (gold: any colour, and it counts double) – made once each. */
const notes = new Map<string, THREE.SpriteMaterial>()
function noteMaterial(css: string, gold: boolean) {
  const k = gold ? 'gold' : css
  if (!notes.has(k)) notes.set(k, new THREE.SpriteMaterial({ map: noteTexture(css, gold), depthTest: false, transparent: true }))
  return notes.get(k)!
}
function noteTexture(css: string, gold: boolean) {
  const [c, ctx] = makeCanvas(128, 128)
  ctx.fillStyle = '#fff8e6'
  ctx.beginPath()
  ctx.roundRect(8, 8, 112, 112, 18)
  ctx.fill()
  ctx.fillStyle = gold ? '#f6c453' : css
  ctx.beginPath()
  ctx.arc(64, 64, 38, 0, Math.PI * 2)
  ctx.fill()
  if (gold) {
    ctx.fillStyle = '#7a4c08'
    ctx.font = `700 40px ${FONT.sans}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('×2', 64, 66)
  }
  return toTexture(c)
}

type Item = { g: THREE.Group; toy: THREE.Group; parcels: THREE.Group[]; note: THREE.Sprite; want: number; gold: boolean; x: number; live: boolean; done: boolean }

export class PackingLine {
  readonly group = new THREE.Group()
  readonly colliders: Circle[] = []
  active = false
  onLeft: () => void = () => {}
  onScore: (score: number) => void = () => {}

  private items: Item[] = []
  private beltTex: THREE.Texture
  private time = 0
  private spawnIn = 0
  private score = 0
  private wrong = 0
  private over = 0
  private msgT = 0
  private best = Number(store.get('jul3d.paketlinjen')) || 0
  private el: HTMLDivElement
  private board: { draw: (list: { name: string; score: number }[]) => void }
  private wrapper: Nisse

  constructor(scene: THREE.Scene) {
    const g = this.group
    g.position.set(AT.x, 0, AT.z)
    g.rotation.y = YAW
    scene.add(g)
    // the shed: four posts, a roof with snow, a back wall with the paper rolls on it
    const wood = std(0x7a5230)
    const dark = std(0x4a2e1c)
    for (const [x, z] of [[-3, -1.4], [3, -1.4], [-3, 1.6], [3, 1.6]]) add(g, new THREE.BoxGeometry(0.16, 2.9, 0.16), dark, x, 1.45, z)
    const roof = add(g, new THREE.BoxGeometry(6.6, 0.14, 3.8), std(0x2c3a35, 0.8), 0, 3.0, 0.1)
    roof.rotation.x = -0.12
    add(g, new THREE.BoxGeometry(6.5, 0.1, 3.6), std(0xf6f9ff, 0.9), 0, 3.1, 0.1).rotation.x = -0.12
    add(g, new THREE.BoxGeometry(6.2, 2.6, 0.1), wood, 0, 1.3, -1.45)
    for (const [i, p] of PAPERS.entries()) {
      const roll = add(g, new THREE.CylinderGeometry(0.12, 0.12, 1.2, 14), std(p.color, 0.6), -1.6 + i * 1.6, 1.9, -1.25)
      roll.rotation.z = Math.PI / 2
    }
    // the belt
    add(g, new THREE.BoxGeometry(BELT + 0.4, 0.12, 0.75), dark, 0, BELT_Y - 0.07, 0)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new THREE.BoxGeometry(0.08, BELT_Y - 0.1, 0.08), dark, sx * (BELT / 2), (BELT_Y - 0.1) / 2, sz * 0.3)
    const [bc, bctx] = makeCanvas(128, 32)
    bctx.fillStyle = '#2b2b30'
    bctx.fillRect(0, 0, 64, 32)
    bctx.fillStyle = '#3d3d46'
    bctx.fillRect(64, 0, 64, 32)
    this.beltTex = toTexture(bc, { live: true })
    this.beltTex.wrapS = THREE.RepeatWrapping
    this.beltTex.repeat.set(BELT * 2, 1)
    const belt = add(g, new THREE.PlaneGeometry(BELT, 0.62), new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.8 }), 0, BELT_Y + 0.001, 0)
    belt.rotation.x = -Math.PI / 2
    // the wrapping station over the middle: a frame, gold
    const gold = std(0xf6c453, 0.35, 0.6)
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.06, 0.9, 0.06), gold, s * 0.4, BELT_Y + 0.45, -0.36)
    add(g, new THREE.BoxGeometry(0.86, 0.06, 0.06), gold, 0, BELT_Y + 0.9, -0.36)
    // the sign
    const [sc, sctx] = makeCanvas(512, 128)
    sctx.fillStyle = '#5a3a22'
    sctx.fillRect(0, 0, 512, 128)
    sctx.fillStyle = '#fff3dc'
    sctx.font = `600 54px ${FONT.serif}`
    sctx.textAlign = 'center'
    sctx.textBaseline = 'middle'
    sctx.fillText('📦 Paketlinjen', 256, 66)
    const st = toTexture(sc)
    add(g, new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.3 }), 0, 2.55, 1.62).castShadow = false
    // the season's best, on a board at the end
    const [lc, lctx] = makeCanvas(256, 320)
    const lt = toTexture(lc, { live: true })
    this.board = {
      draw: (list) => {
        lctx.fillStyle = '#1a2b22'
        lctx.fillRect(0, 0, 256, 320)
        lctx.strokeStyle = '#f6c453'
        lctx.lineWidth = 6
        lctx.strokeRect(4, 4, 248, 312)
        lctx.fillStyle = '#fff3dc'
        lctx.textAlign = 'center'
        lctx.font = `600 28px ${FONT.serif}`
        lctx.fillText('Bästa inslagarna', 128, 42)
        lctx.font = `600 22px ${FONT.sans}`
        lctx.textAlign = 'left'
        if (!list.length) {
          lctx.textAlign = 'center'
          lctx.fillText('Ingen än – bli först!', 128, 140)
        }
        list.slice(0, 7).forEach((e, i) => {
          lctx.fillText(`${i + 1}. ${e.name.slice(0, 12)}`, 18, 88 + i * 32)
          lctx.textAlign = 'right'
          lctx.fillText(String(e.score), 238, 88 + i * 32)
          lctx.textAlign = 'left'
        })
        lt.needsUpdate = true
      },
    }
    this.board.draw([])
    const lb = add(g, new THREE.PlaneGeometry(0.9, 1.12), new THREE.MeshStandardMaterial({ map: lt, emissive: 0xffffff, emissiveMap: lt, emissiveIntensity: 0.35 }), 2.75, 1.6, -1.39)
    lb.castShadow = false
    // the nisse who works the line when nobody's helping
    this.wrapper = new Nisse({ coat: 0x1d6e48, hat: 0xc8102e, trim: true, apron: 0xffffff, scale: 0.85 })
    this.wrapper.group.position.set(0.2, 0, -0.85)
    g.add(this.wrapper.group)
    // things for the belt
    for (let i = 0; i < 10; i++) {
      const it = new THREE.Group()
      const t = toy(i)
      const parcels = PAPERS.map((p) => {
        const pc = parcel(p.color)
        pc.visible = false
        it.add(pc)
        return pc
      })
      it.add(t)
      const n = new THREE.Sprite(noteMaterial(PAPERS[0].css, false))
      n.scale.setScalar(0.3)
      n.position.y = 0.75
      it.add(n)
      it.visible = false
      g.add(it)
      this.items.push({ g: it, toy: t, parcels, note: n, want: 0, gold: false, x: 0, live: false, done: false })
    }
    g.updateMatrixWorld(true)
    for (const [x, z] of [[-3, -1.4], [3, -1.4], [-3, 1.6], [3, 1.6]]) {
      const w = g.localToWorld(new THREE.Vector3(x, 0, z))
      this.colliders.push({ x: w.x, z: w.z, r: 0.2 })
    }
    for (const x of [-1.6, 0, 1.6]) {
      const w = g.localToWorld(new THREE.Vector3(x, 0, 0))
      this.colliders.push({ x: w.x, z: w.z, r: 0.55 })
    }

    // the HUD: score, time, best, a message, the three paper buttons, stop
    this.el = document.createElement('div')
    this.el.id = 'paketlinje'
    this.el.hidden = true
    this.el.innerHTML =
      '<div class="fl-top"><div class="fl-score"><b>0</b><span>paket</span></div><div class="fl-time"><b>45</b><span>sekunder</span></div><div class="fl-best">🏆 0</div></div>' +
      '<div class="st-msg" hidden></div>' +
      `<div class="pl-papers">${PAPERS.map((p, i) => `<button type="button" data-i="${i}" style="background:${p.css}">${i + 1}</button>`).join('')}</div>` +
      '<button class="st-stop" type="button">Sluta slå in</button>'
    document.getElementById('hud')!.appendChild(this.el)
    this.el.querySelector('.st-stop')!.addEventListener('click', () => this.leave())
    for (const b of this.el.querySelectorAll<HTMLButtonElement>('.pl-papers button'))
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.wrap(Number(b.dataset.i))
      })
    addEventListener(
      'keydown',
      (e) => {
        if (!this.active || e.repeat) return
        const i = PAPERS.findIndex((p) => p.key.includes(e.code))
        if (i >= 0) {
          e.preventDefault()
          e.stopImmediatePropagation()
          this.wrap(i)
        } else if ((e.code === 'Space' || e.code === 'Enter') && this.over > 1.2) {
          e.preventDefault()
          e.stopImmediatePropagation()
          this.start()
        }
      },
      true,
    )
  }

  /** In front of the line, facing it? */
  near(pos: THREE.Vector3, fwd: THREE.Vector3) {
    const front = this.group.localToWorld(new THREE.Vector3(0, 0, 2.0))
    const dx = AT.x - pos.x
    const dz = AT.z - pos.z
    return Math.hypot(front.x - pos.x, front.z - pos.z) < 2.2 && (dx * fwd.x + dz * fwd.z) / Math.hypot(dx, dz) > 0.5
  }

  /** Where you stand to help: in front of the belt, looking down at the station. */
  viewpoint() {
    const p = this.group.localToWorld(new THREE.Vector3(0, 0, 2.3))
    return { x: p.x, z: p.z, yaw: YAW, pitch: -0.48 }
  }

  /** The season's best, for the board. */
  showBoard(list: { name: string; score: number }[]) {
    this.board.draw(list)
  }

  start() {
    this.active = true
    this.time = 0
    this.score = this.wrong = 0
    this.over = 0
    this.spawnIn = 0.5
    for (const it of this.items) this.retire(it)
    this.el.hidden = false
    this.say('Ge varje leksak det papper som står på önskelappen: 1 röd, 2 grön, 3 blå. Guld = valfritt, dubbla poäng!', 4)
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
  }

  /** How fast the belt runs: faster the nearer julafton it is (and as the round goes on). */
  private speed() {
    const day = today()
    const near = day.open > 0 ? Math.min(1, day.open / 24) : 0
    const k = Math.min(1, this.time / ROUND)
    return (0.7 + near * 0.5) * (1 + k * 0.7)
  }

  private wrap(i: number) {
    if (!this.active || this.over) return
    // whatever is under the station, not yet wrapped
    const it = this.items.find((x) => x.live && !x.done && Math.abs(x.x) < 0.45)
    if (!it) {
      blip(220, 0.05, 'square', 0.03)
      return
    }
    it.done = true
    it.toy.visible = false
    it.note.visible = false
    it.parcels[i].visible = true
    if (it.gold || it.want === i) {
      const pts = it.gold ? 2 : 1
      this.score += pts
      blip(it.gold ? 1568 : 1180, 0.1, 'triangle', 0.06)
      if (this.score % 8 === 0) this.say(['Snyggt inslaget! 🎀', 'Tomten blir glad!', 'Rosetten sitter perfekt.', 'Paketnissarna applåderar!'][(this.score / 8) % 4])
    } else {
      this.wrong++
      this.score = Math.max(0, this.score - 1)
      puff(0.25)
      this.say(`🙈 Fel papper! Det skulle vara ${PAPERS[it.want].name}. −1`)
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

  update(t: number, dt: number) {
    const speed = this.over ? 0 : this.active ? this.speed() : 0.5
    this.beltTex.offset.x = (this.beltTex.offset.x + speed * dt * 2) % 1
    if (this.active && !this.over) {
      this.time += dt
      if (this.time >= ROUND) this.finish()
      else if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) this.hud()
    } else if (this.over) {
      this.over += dt
      if (this.over > 7) this.leave()
    }
    if (this.msgT > 0 && (this.msgT -= dt) <= 0) this.el.querySelector<HTMLElement>('.st-msg')!.hidden = true
    // new toys on the belt
    if (!this.over && (this.spawnIn -= dt) <= 0) {
      const k = Math.min(1, this.time / ROUND)
      this.spawnIn = this.active ? THREE.MathUtils.lerp(1.4, 0.75, k) * (0.85 + Math.random() * 0.3) : 2.2
      const it = this.items.find((x) => !x.live)
      if (it) {
        it.live = true
        it.done = false
        it.x = BELT / 2
        it.want = Math.floor(Math.random() * 3)
        it.gold = this.active && Math.random() < 0.1
        it.note.material = noteMaterial(PAPERS[it.want].css, it.gold)
        it.note.visible = true
        it.toy.visible = true
        it.parcels.forEach((p) => (p.visible = false))
        it.g.visible = true
        it.g.rotation.y = (Math.random() - 0.5) * 0.6
      }
    }
    for (const it of this.items) {
      if (!it.live) continue
      it.x -= speed * dt
      it.g.position.set(it.x, BELT_Y, 0)
      // (when nobody's helping, the nisse wraps them himself, always right)
      if (!this.active && !it.done && it.x <= 0.05) {
        it.done = true
        it.toy.visible = false
        it.note.visible = false
        it.parcels[it.want].visible = true
      }
      it.note.position.y = 0.75 + Math.sin(t * 3 + it.x) * 0.04
      if (it.x < -BELT / 2 - 0.2) this.retire(it)
    }
    this.wrapper.armR.rotation.x = -0.9 + Math.sin(t * 5) * 0.2
  }

  private finish() {
    this.over = 0.001
    const record = this.score > this.best
    if (record) {
      this.best = this.score
      store.set('jul3d.paketlinjen', String(this.score))
    }
    const verdict = this.score >= 35 ? 'Paketmästare! 🎅' : this.score >= 20 ? 'Tomten blir nöjd.' : 'Tack för hjälpen!'
    this.say(`Klart! ${this.score} paket${this.wrong ? `, ${this.wrong} fel papper` : ''}. ${record ? 'Nytt rekord! 🏆 ' : ''}${verdict}  (Space: en gång till)`, 7)
    this.hud()
    this.onScore(this.score)
  }
}
