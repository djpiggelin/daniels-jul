// Byns julstämning: one count for the whole village, filled together by everyone there today
// (netlify/functions/stamning.mts) and emptied at midnight. A sip of glögg, a snowball that lands, the
// day's door in the calendar, a chat, a sleigh ride, a game – each adds a little (only so much of each
// a day, from each of you). It shows on the square as a great thermometer, and the higher it gets the
// more Christmas the village puts on, for everyone:
//   a quarter – the marschaller round the square and along the path north are lit,
//   half – the julgran glitters with hundreds more lights,
//   three quarters – gold glitter dances over the square, and at night the northern lights flare,
//   full – stars rain from the top of the julgran.
// ?stamning=80 shows the village at 80 % (and sends nothing).
import * as THREE from 'three'
import type { Circle } from './world'
import { FONT, glowTexture, makeCanvas, rng, toTexture } from './tex'
import { html, type Talk } from './ui'

/** Points for a full thermometer. */
export const GOAL = 150

export const TIERS = [
  { at: 0.25, icon: '🔥', name: 'Marschallerna tänds', toast: '🔥 Byns julstämning har nått en fjärdedel – marschallerna runt torget tänds!' },
  { at: 0.5, icon: '🎄', name: 'Granen glittrar', toast: '🎄 Halvvägs! Granen på torget glittrar med hundratals nya ljus.' },
  { at: 0.75, icon: '✨', name: 'Guldglitter och norrsken', toast: '✨ Tre fjärdedelar! Guldglitter dansar över torget – och när det är mörkt flammar norrskenet.' },
  { at: 1, icon: '⭐', name: 'Stjärnregn', toast: '⭐ Julstämningen i byn är på topp! Det regnar stjärnor från granens topp.' },
]

/** What raises it, how much, and how many times a day from each visitor. */
const REASONS = {
  door: { points: 5, perDay: 1, label: 'dagens lucka i julkalendern' },
  glogg: { points: 1, perDay: 10, label: 'en klunk glögg' },
  snowball: { points: 1, perDay: 15, label: 'en snöboll som träffar' },
  talk: { points: 2, perDay: 8, label: 'en pratstund med någon i byn' },
  sleigh: { points: 3, perDay: 3, label: 'en tur med Tomtens släde' },
  game: { points: 3, perDay: 5, label: 'ett spel i spelhallen' },
  park: { points: 10, perDay: 2, label: 'att få Central Park att sjunga' },
  moose: { points: 3, perDay: 2, label: 'att möta älgen på stigen' },
  pulka: { points: 2, perDay: 5, label: 'ett åk i Pulkabacken' },
  snowman: { points: 5, perDay: 2, label: 'en snögubbe i Snögubbsbacken' },
  market: { points: 2, perDay: 5, label: 'något från julmarknaden på adventshelgerna' },
  tomte: { points: 10, perDay: 1, label: 'ett paket från Tomten på julaftonskvällen' },
  julotta: { points: 5, perDay: 1, label: 'julottan i kapellet' },
  nyar: { points: 5, perDay: 1, label: 'tolvslaget på nyårsnatten' },
  bandy: { points: 3, perDay: 3, label: 'ett mål i bandy på Skridskosjön' },
}
export type Cheer = keyof typeof REASONS

/** Where the thermometer stands on the square, and which way it faces (towards where you come in). */
const AT = new THREE.Vector3(6.5, 0, 10.5)
const YAW = Math.atan2(0 - AT.x, 32 - AT.z)
/** The tube: where the liquid starts and how high a full one reaches (in the thermometer's space). */
const TUBE = { x: -0.35, y0: 1.2, h: 1.62 }

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* fine */
    }
  },
}

/* ---------- the count, shared ---------- */

class MoodCount {
  /** what the village has (as last heard) */
  points = 0
  /** what you've done since that hasn't been sent yet */
  pending = 0
  private sending = 0
  readonly fixed: number | null
  constructor() {
    const q = new URLSearchParams(location.search).get('stamning')
    this.fixed = q == null || q === '' || isNaN(Number(q)) ? null : (Math.max(0, Math.min(100, Number(q))) / 100) * GOAL
  }
  get value() {
    return this.fixed ?? this.points + this.pending + this.sending
  }
  get level() {
    return Math.min(1, this.value / GOAL)
  }
  /** Something Christmassy done: counted if there's room left in today's share of it. */
  cheer(reason: Cheer) {
    if (this.fixed != null) return false
    const r = REASONS[reason]
    const key = `stamning-${today()}`
    let tally: Record<string, number> = {}
    try {
      tally = JSON.parse(store.get(key) ?? '{}')
    } catch {
      /* start afresh */
    }
    if ((tally[reason] ?? 0) >= r.perDay) return false
    tally[reason] = (tally[reason] ?? 0) + 1
    store.set(key, JSON.stringify(tally))
    this.pending += r.points
    return true
  }
  start() {
    if (this.fixed != null) return
    const take = (r: Response) => (r.ok ? r.json() : Promise.reject(r.status))
    const poll = () =>
      fetch('/api/stamning')
        .then(take)
        .then((d: { points: number }) => (this.points = d.points))
        .catch(() => {})
    const flush = () => {
      if (!this.pending || this.sending) return
      this.sending = this.pending
      this.pending = 0
      fetch('/api/stamning', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ add: this.sending }) })
        .then(take)
        .then((d: { points: number }) => {
          this.points = d.points
          this.sending = 0
        })
        .catch(() => {
          // (not there – local development – or a hiccup: keep it, as your own, and try again later)
          this.pending += this.sending
          this.sending = 0
        })
    }
    poll()
    setInterval(poll, 30_000)
    setInterval(flush, 15_000)
    // (and what's left when you go)
    addEventListener('pagehide', () => {
      if (this.pending) navigator.sendBeacon?.('/api/stamning', new Blob([JSON.stringify({ add: this.pending })], { type: 'application/json' }))
    })
  }
}

/* ---------- the thermometer on the square ---------- */

function boardTexture() {
  const W = 420
  const H = 980
  const [c, ctx] = makeCanvas(W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#7a1420')
  g.addColorStop(1, '#4f0c15')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#f6c453'
  ctx.lineWidth = 8
  ctx.strokeRect(10, 10, W - 20, H - 20)
  ctx.lineWidth = 2
  ctx.strokeRect(22, 22, W - 44, H - 44)
  ctx.fillStyle = '#f6c453'
  ctx.textAlign = 'center'
  ctx.font = `600 34px ${FONT.serif}`
  ctx.fillText('Byns', W / 2, 74)
  ctx.font = `600 46px ${FONT.serif}`
  ctx.fillText('julstämning', W / 2, 122)
  ctx.font = `400 22px ${FONT.sans}`
  ctx.fillStyle = '#fbe7c0'
  ctx.fillText('i dag – alla tillsammans', W / 2, 156)
  // the scale: a mark at each tier, with what happens there
  const yOf = (level: number) => H - ((TUBE.y0 - 0.6 + level * TUBE.h) / 3.0) * H
  const tx = ((0.65 + TUBE.x) / 1.3) * W
  ctx.textAlign = 'left'
  for (let k = 0; k <= 20; k++) {
    const y = yOf(k / 20)
    ctx.fillStyle = '#f6c453'
    ctx.fillRect(tx + 24, y - 1.5, k % 5 ? 14 : 26, 3)
  }
  for (const t of TIERS) {
    const y = yOf(t.at)
    ctx.font = `30px ${FONT.sans}`
    ctx.fillText(t.icon, tx + 54, y + 11)
    ctx.font = `700 21px ${FONT.sans}`
    ctx.fillStyle = '#fff3dc'
    // (long names on two lines)
    const sp = t.name.lastIndexOf(' ')
    const [a, b] = t.name.length > 12 && sp > 0 ? [t.name.slice(0, sp), t.name.slice(sp + 1)] : [t.name, '']
    ctx.fillText(a, tx + 96, y + (b ? -3 : 7))
    if (b) ctx.fillText(b, tx + 96, y + 20)
    ctx.fillStyle = '#f6c453'
  }
  ctx.textAlign = 'center'
  ctx.font = `italic 400 24px ${FONT.serif}`
  ctx.fillStyle = '#fbe7c0'
  ctx.fillText('Gör något juligt –', W / 2, H - 70)
  ctx.fillText('så stiger stämningen!', W / 2, H - 42)
  return toTexture(c)
}

function buildThermometer(parent: THREE.Object3D) {
  const g = new THREE.Group()
  g.position.copy(AT)
  g.rotation.y = YAW
  parent.add(g)
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xf6c453, roughness: 0.35, metalness: 0.7 })
  const snow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })
  // two posts and the painted board between them, a little roof with snow on it
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.0, 0.12), wood)
    post.position.set(s * 0.72, 2.0, -0.02)
    post.castShadow = true
    g.add(post)
  }
  // (lit a little from within, so it reads in the dark too)
  const tex = boardTexture()
  const face = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.7 })
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.0, 0.06), [wood, wood, wood, wood, face, wood])
  board.position.set(0, 2.1, 0)
  board.castShadow = true
  g.add(board)
  for (const s of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0x2c4a36, roughness: 0.7 }))
    roof.position.set(s * 0.39, 3.84, 0)
    roof.rotation.z = -s * 0.42
    const sn = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.46), snow)
    sn.position.set(s * 0.39, 3.88, 0)
    sn.rotation.z = -s * 0.42
    g.add(roof, sn)
  }
  // the glass tube and its bulb, gold fittings top and bottom
  const glass = new THREE.MeshStandardMaterial({ color: 0xdfefff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.15, depthWrite: false })
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, TUBE.h + 0.12, 16), glass)
  tube.position.set(TUBE.x, TUBE.y0 + TUBE.h / 2, 0.13)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), glass)
  bulb.position.set(TUBE.x, TUBE.y0 - 0.1, 0.13)
  g.add(tube, bulb)
  for (const y of [TUBE.y0 + TUBE.h + 0.08, TUBE.y0 + 0.06]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 16), gold)
    ring.position.set(TUBE.x, y, 0.13)
    g.add(ring)
  }
  for (const y of [TUBE.y0 + 0.45, TUBE.y0 + 1.35]) {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), gold)
    clip.position.set(TUBE.x, y, 0.06)
    g.add(clip)
  }
  // what's inside: glowing red, gold at the top
  const liquidMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, toneMapped: false })
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 12).translate(0, 0.5, 0), liquidMat)
  liquid.position.set(TUBE.x, TUBE.y0, 0.13)
  const pool = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), liquidMat)
  pool.position.copy(bulb.position)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,190,90,1)', 'rgba(255,90,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.scale.setScalar(0.5)
  const bulbGlow = new THREE.Sprite(glow.material)
  bulbGlow.scale.setScalar(0.9)
  bulbGlow.position.copy(bulb.position)
  g.add(liquid, pool, glow, bulbGlow)
  // a lamp beside each tier that lights when it's reached
  const lamps = TIERS.map((t) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,230,150,1)', 'rgba(255,170,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
    s.scale.setScalar(0.3)
    // (behind its icon on the board)
    s.position.set(TUBE.x + 0.215, TUBE.y0 + t.at * TUBE.h, 0.06)
    g.add(s)
    return s
  })
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== tube && o !== bulb) o.castShadow = true
  })
  let shown = 0
  let pulse = 0
  return {
    group: g,
    /** The liquid towards `level`; a little flare whenever it rises. */
    update(level: number, dt: number, t: number) {
      if (level > shown + 0.001) pulse = 1
      shown += (level - shown) * Math.min(1, dt * 1.5)
      pulse = Math.max(0, pulse - dt * 1.2)
      liquid.scale.y = Math.max(0.001, shown * TUBE.h)
      glow.position.set(TUBE.x, TUBE.y0 + shown * TUBE.h, 0.15)
      glow.scale.setScalar(0.45 + pulse * 0.5 + Math.sin(t * 3) * 0.04)
      liquidMat.color.setHSL(0.015 + shown * 0.09, 1, 0.55)
      for (const [i, l] of lamps.entries()) l.material.opacity += ((shown >= TIERS[i].at - 0.001 ? 1 : 0) - l.material.opacity) * Math.min(1, dt * 3)
    },
  }
}

/* ---------- what the village puts on ---------- */

const rand = rng(2412)

/** Marschaller: little tins of fire on the snow, round the square and along the path north. */
function buildTorches(parent: THREE.Object3D) {
  const g = new THREE.Group()
  parent.add(g)
  const spots: { x: number; z: number }[] = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2
    spots.push({ x: Math.sin(a) * 8.6, z: Math.cos(a) * 8.6 })
  }
  for (let z = -16; z >= -38; z -= 4.4) for (const x of [-4.4, 4.4]) spots.push({ x, z })
  const tin = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 })
  const fire = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false })
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,200,110,1)', 'rgba(255,120,30,0)'), blending: THREE.AdditiveBlending, depthWrite: false })
  const flames = spots.map((p) => {
    const m = new THREE.Group()
    m.position.set(p.x, 0, p.z)
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.17, 10), tin)
    can.position.y = 0.085
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), fire)
    flame.position.y = 0.27
    const glow = new THREE.Sprite(glowMat)
    glow.position.y = 0.3
    glow.scale.setScalar(0.9)
    m.add(can, flame, glow)
    g.add(m)
    return { flame, glow, phase: rand() * 10 }
  })
  return {
    group: g,
    update(t: number) {
      for (const f of flames) {
        const k = 1 + Math.sin(t * 13 + f.phase) * 0.12 + Math.sin(t * 7.3 + f.phase * 2) * 0.1
        f.flame.scale.set(1, k, 1)
        f.glow.scale.setScalar(0.85 * k)
      }
    },
  }
}

/** Sparkles as points: each its own place, colour and twinkle. */
function sparkles(n: number, size: number, colors: number[]) {
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const base = Array.from({ length: n }, (_, i) => new THREE.Color(colors[i % colors.length]))
  const phase = Float32Array.from({ length: n }, () => rand() * 10)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  pts.frustumCulled = false
  return {
    pts,
    pos,
    phase,
    /** Twinkle (`fade` 0 … 1 for the whole lot). */
    twinkle(t: number, fade: number, speed = 3) {
      for (let i = 0; i < n; i++) {
        const k = fade * (0.35 + 0.65 * Math.max(0, Math.sin(t * speed + phase[i] * 7)))
        col[i * 3] = base[i].r * k
        col[i * 3 + 1] = base[i].g * k
        col[i * 3 + 2] = base[i].b * k
      }
      geo.attributes.color.needsUpdate = true
    },
    moved() {
      geo.attributes.position.needsUpdate = true
    },
  }
}

/* ---------- all of it ---------- */

export type Julstamning = ReturnType<typeof buildJulstamning>

export function buildJulstamning(scene: THREE.Scene, say: (text: string) => void) {
  const count = new MoodCount()
  count.start()
  const group = new THREE.Group()
  scene.add(group)
  const meter = buildThermometer(group)
  const colliders: Circle[] = [{ x: AT.x, z: AT.z, r: 0.75 }]

  const torches = buildTorches(group)
  // more lights on the julgran: a glittering cloud over its branches
  const TREE = [
    { y: 1.3, r: 2.85 },
    { y: 8.1, r: 0.2 },
  ]
  const glitter = sparkles(420, 0.22, [0xfff2c0, 0xffd76a, 0xffffff, 0xffb0b0, 0xb0e0ff])
  for (let i = 0; i < 420; i++) {
    const y = TREE[0].y + rand() * (TREE[1].y - TREE[0].y)
    const r = THREE.MathUtils.lerp(TREE[0].r, TREE[1].r, (y - TREE[0].y) / (TREE[1].y - TREE[0].y)) * (0.85 + rand() * 0.2) + 0.05
    const a = rand() * Math.PI * 2
    glitter.pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3)
  }
  glitter.moved()
  group.add(glitter.pts)
  // gold dust drifting over the square
  const DUST = 260
  const dust = sparkles(DUST, 0.16, [0xffd76a, 0xfff0b8, 0xffc04a])
  for (let i = 0; i < DUST; i++) {
    const a = rand() * Math.PI * 2
    const r = 2 + rand() * 11
    dust.pos.set([Math.cos(a) * r, 0.4 + rand() * 9, Math.sin(a) * r], i * 3)
  }
  group.add(dust.pts)
  // falling stars from the top of the tree
  const STARS = 160
  const STAR_AT = new THREE.Vector3(0, 8.55, 0)
  const shower = sparkles(STARS, 0.3, [0xffe9a0, 0xffffff, 0xffd060])
  const vel = new Float32Array(STARS * 3)
  const life = new Float32Array(STARS)
  const spawn = (i: number) => {
    const a = rand() * Math.PI * 2
    const up = 1 + rand() * 2.5
    const out = 1 + rand() * 2.2
    shower.pos.set([STAR_AT.x, STAR_AT.y, STAR_AT.z], i * 3)
    vel.set([Math.cos(a) * out, up, Math.sin(a) * out], i * 3)
    life[i] = rand() * 3
  }
  for (let i = 0; i < STARS; i++) spawn(i)
  group.add(shower.pts)

  /** How far each tier has faded in (0 … 1). */
  const fade = TIERS.map(() => 0)
  let tier = -1
  let told = false

  function update(t: number, dt: number) {
    const level = count.level
    meter.update(level, dt, t)
    const now = TIERS.filter((x) => level >= x.at - 0.0001).length - 1
    // (the tiers reached before you came are just there; any reached while you're here are announced)
    if (told && now > tier && now >= 0) say(TIERS[now].toast)
    if (count.value > 0 || count.fixed != null || t > 8) told = true
    tier = now
    for (let i = 0; i < TIERS.length; i++) fade[i] += ((i <= tier ? 1 : 0) - fade[i]) * Math.min(1, dt * 0.8)

    torches.group.visible = fade[0] > 0.02
    if (torches.group.visible) torches.update(t)
    glitter.pts.visible = fade[1] > 0.02
    if (glitter.pts.visible) glitter.twinkle(t, fade[1], 2.4)
    dust.pts.visible = fade[2] > 0.02
    if (dust.pts.visible) {
      for (let i = 0; i < DUST; i++) {
        const j = i * 3
        const a = t * 0.05 + dust.phase[i]
        dust.pos[j] += Math.cos(a) * dt * 0.25
        dust.pos[j + 2] += Math.sin(a) * dt * 0.25
        dust.pos[j + 1] += dt * 0.18
        if (dust.pos[j + 1] > 9.5) dust.pos[j + 1] = 0.4
      }
      dust.moved()
      dust.twinkle(t, fade[2] * 0.9, 4)
    }
    shower.pts.visible = fade[3] > 0.02
    if (shower.pts.visible) {
      for (let i = 0; i < STARS; i++) {
        const j = i * 3
        life[i] += dt
        vel[j + 1] -= 2.2 * dt
        shower.pos[j] += vel[j] * dt
        shower.pos[j + 1] += vel[j + 1] * dt
        shower.pos[j + 2] += vel[j + 2] * dt
        if (life[i] > 3.2 || shower.pos[j + 1] < 0.1) spawn(i)
      }
      shower.moved()
      shower.twinkle(t, fade[3], 8)
    }
  }

  /** The talk at the thermometer: how the village is doing today, and what raises it. */
  const talk = (): Talk => ({
    name: 'Byns julstämning',
    avatar: '✨',
    greeting: () => {
      const pct = Math.round(count.level * 100)
      const next = TIERS.find((x) => count.level < x.at)
      return [
        html.p(`Julstämningen i byn i dag: ${pct} %.`) +
          html.p(next ? `Vid ${Math.round(next.at * 100)} %: ${next.icon} ${next.name.toLowerCase()}. Alla som är i byn hjälps åt, och vid midnatt börjar det om.` : 'Den är på topp! Alla som är här i dag har gjort byn alldeles julig. Vid midnatt börjar det om.'),
      ]
    },
    topics: [
      {
        label: '✨ Hur höjer man stämningen?',
        pages: () => [html.p('Allt juligt du gör i byn räknas – lite grann av varje sak om dagen:') + html.list(Object.values(REASONS).map((r) => r.label))],
      },
      {
        label: '🎁 Vad händer när den stiger?',
        pages: () => [html.list(TIERS.map((x) => `${count.level >= x.at ? '✅' : '◻️'} ${Math.round(x.at * 100)} % – ${x.icon} ${x.name}`))],
      },
    ],
    bye: 'God jul!',
  })

  return {
    group,
    colliders,
    solids: [meter.group],
    update,
    talk,
    /** Something Christmassy done (see REASONS). */
    cheer: (reason: Cheer) => count.cheer(reason),
    /** How bright the northern lights should be at least (they flare from three quarters). */
    get aurora() {
      return 1 + fade[2] * 1.2
    },
    get level() {
      return count.level
    },
    /** In front of the thermometer, facing it. */
    near(pos: THREE.Vector3, fwd: THREE.Vector3) {
      const front = meter.group.localToWorld(new THREE.Vector3(0, 0, 1.0))
      const dx = AT.x - pos.x
      const dz = AT.z - pos.z
      const d = Math.hypot(front.x - pos.x, front.z - pos.z)
      return d < 2.4 && (dx * fwd.x + dz * fwd.z) / Math.hypot(dx, dz) > 0.5
    },
  }
}
