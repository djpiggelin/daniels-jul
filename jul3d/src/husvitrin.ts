// Gingerbread houses outside Tomtens bageri: at Bagar-Berit's table you build one – how big, the roof,
// the icing, the sweets, a chimney or not – and watch it go together as you choose; then into the
// glass window by the door with your name on it (netlify/functions/husvitrin.mts). The window shows the
// six most loved houses; give the ones you like a heart.
import * as THREE from 'three'
import { Nisse } from './npc'
import { FONT, makeCanvas, rng, toTexture } from './tex'
import { html, type Talk } from './ui'
import type { Circle } from './world'

export type House = { id: string; by: string; size: number; roof: string; icing: string; candy: string; chimney: boolean; votes: number }
type Plan = Pick<House, 'size' | 'roof' | 'icing' | 'candy' | 'chimney'>

const SIZES = ['🏠 En liten stuga', '🏡 Ett mellanstort hus', '🏰 En stor herrgård']
const ROOFS = [
  { id: 'sadel', label: '⛰️ Ett vanligt sadeltak' },
  { id: 'brant', label: '🔺 Ett brant, högt tak' },
  { id: 'platt', label: '🍪 Ett platt tak, tjockt med socker' },
]
const ICINGS = [
  { id: 'kanter', label: '✏️ Vita kanter längs allt' },
  { id: 'istappar', label: '🧊 Istappar av kristyr' },
  { id: 'snirklar', label: '🌀 Snirklar över väggarna' },
]
const CANDIES = [
  { id: 'godis', label: '🍬 Färggrant godis på taket' },
  { id: 'polkagris', label: '🍭 Polkagrisar i hörnen' },
  { id: 'inga', label: '🤍 Inget godis – stilrent' },
]
const PER_DAY = 2
/** Where the window and the table stand, by the bakery's door (the bakery faces east, over the square). */
const SHOP = { x: -22.5, z: -4.8, yaw: 1.36, d: 8 }

const std = (color: number, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness })
const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
const local = {
  get<T>(k: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fallback
    } catch {
      return fallback
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {
      /* fine */
    }
  },
}

/** Baked dough – warm brown, a little grain, darker at the edges – with icing swirls on it if asked. */
const doughs = new Map<string, THREE.Texture>()
function dough(swirls: boolean) {
  const k = swirls ? 'swirl' : 'plain'
  if (doughs.has(k)) return doughs.get(k)!
  const [c, ctx] = makeCanvas(256, 256)
  const r = rng(swirls ? 7 : 3)
  ctx.fillStyle = '#9a5a2a'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(60,25,8,0.12)' : 'rgba(200,130,70,0.12)'
    ctx.fillRect(r() * 256, r() * 256, 2 + r() * 3, 2 + r() * 3)
  }
  const edge = ctx.createRadialGradient(128, 128, 60, 128, 128, 190)
  edge.addColorStop(0, 'rgba(50,20,5,0)')
  edge.addColorStop(1, 'rgba(50,20,5,0.4)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, 256, 256)
  if (swirls) {
    ctx.strokeStyle = '#fffaf0'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (let i = 0; i < 9; i++) {
      const x = 30 + (i % 3) * 98
      const y = 40 + Math.floor(i / 3) * 88
      ctx.beginPath()
      for (let a = 0; a < Math.PI * 4; a += 0.2) ctx.lineTo(x + Math.cos(a) * a * 3, y + Math.sin(a) * a * 3)
      ctx.stroke()
    }
  }
  const t = toTexture(c)
  doughs.set(k, t)
  return t
}

/** A gingerbread house to plan, `k` metres to the unit (the table's is big, the window's small). */
export function gingerbreadHouse(p: Plan, k = 1, seed = 1) {
  const g = new THREE.Group()
  const r = rng(seed)
  const w = [0.5, 0.65, 0.85][p.size] * k
  const d = [0.4, 0.5, 0.6][p.size] * k
  const h = [0.32, 0.4, 0.5][p.size] * k
  const walls = new THREE.MeshStandardMaterial({ map: dough(p.icing === 'snirklar'), roughness: 0.85 })
  const icing = std(0xfffaf0, 0.6)
  const sugar = std(0xffffff, 0.95)
  // a board of sugar-snow under it
  add(g, new THREE.CylinderGeometry(Math.max(w, d) * 0.8, Math.max(w, d) * 0.82, 0.02 * k, 24), sugar, 0, 0.01 * k, 0)
  const body = add(g, new THREE.BoxGeometry(w, h, d), walls, 0, h / 2 + 0.02 * k, 0)
  body.receiveShadow = true
  // door and windows, lit with yellow candy glass
  const glass = new THREE.MeshBasicMaterial({ color: 0xffc95a, toneMapped: false })
  add(g, new THREE.BoxGeometry(w * 0.2, h * 0.55, 0.01 * k), std(0x5a2e12, 0.8), 0, 0.02 * k + h * 0.275, d / 2 + 0.002 * k)
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(w * 0.16, h * 0.22, 0.01 * k), glass, s * w * 0.3, 0.02 * k + h * 0.62, d / 2 + 0.002 * k)
    add(g, new THREE.BoxGeometry(0.01 * k, h * 0.22, d * 0.24), glass, s * (w / 2 + 0.002 * k), 0.02 * k + h * 0.6, 0)
  }
  // the roof
  const top = 0.02 * k + h
  const pitch = p.roof === 'brant' ? 0.95 : p.roof === 'sadel' ? 0.6 : 0
  const over = 0.06 * k
  if (pitch) {
    const rise = Math.tan(pitch) * (d / 2)
    const slope = Math.hypot(d / 2 + over, rise + over * Math.tan(pitch))
    for (const s of [-1, 1]) {
      const slab = add(g, new THREE.BoxGeometry(w + over * 2, 0.03 * k, slope), walls, 0, top + rise / 2, s * (d / 4))
      slab.rotation.x = s * pitch
      // (the sugar on it: lifted off the slope along its normal, not straight up)
      const snow = add(g, new THREE.BoxGeometry(w + over * 1.8, 0.014 * k, slope * 0.9), sugar, 0, top + rise / 2 + Math.cos(pitch) * 0.022 * k, s * (d / 4) + s * Math.sin(pitch) * 0.022 * k)
      snow.rotation.x = s * pitch
    }
    // the gables
    const tri = new THREE.Shape()
    tri.moveTo(-d / 2, 0)
    tri.lineTo(d / 2, 0)
    tri.lineTo(0, rise)
    tri.lineTo(-d / 2, 0)
    for (const s of [-1, 1]) {
      const gm = add(g, new THREE.ExtrudeGeometry(tri, { depth: 0.01 * k, bevelEnabled: false }), walls, s * (w / 2) - (s > 0 ? 0.01 * k : 0), top, 0)
      gm.rotation.y = Math.PI / 2
    }
    if (p.icing === 'kanter' || p.icing === 'snirklar')
      // (a line of icing along each eave)
      for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(w + over * 2, 0.012 * k, 0.012 * k), icing, 0, top - 0.005 * k, s * (d / 2 + over * 0.7))
    if (p.icing === 'istappar')
      for (const s of [-1, 1])
        for (let i = 0; i < 9; i++) {
          const len = (0.03 + r() * 0.05) * k
          add(g, new THREE.ConeGeometry(0.008 * k, len, 5), icing, -w / 2 + ((i + 0.5) / 9) * w, top - len / 2, s * (d / 2 + over * 0.7)).rotation.x = Math.PI
        }
    if (p.candy === 'godis')
      for (let i = 0; i < 9; i++) add(g, new THREE.SphereGeometry(0.018 * k, 8, 6), std([0xc8102e, 0x1d8a4e, 0xf2c230, 0x2b5fa8, 0xff7ac8][i % 5], 0.3), -w / 2 + ((i + 0.5) / 9) * (w + over), top + rise + 0.02 * k, 0)
    if (p.chimney) {
      add(g, new THREE.BoxGeometry(0.07 * k, 0.16 * k, 0.07 * k), walls, w * 0.25, top + rise * 0.6 + 0.06 * k, -d * 0.12)
      add(g, new THREE.BoxGeometry(0.08 * k, 0.02 * k, 0.08 * k), sugar, w * 0.25, top + rise * 0.6 + 0.15 * k, -d * 0.12)
    }
  } else {
    // flat: a thick slab, a thick blanket of sugar
    add(g, new THREE.BoxGeometry(w + over * 2, 0.04 * k, d + over * 2), walls, 0, top + 0.02 * k, 0)
    add(g, new THREE.BoxGeometry(w + over * 1.6, 0.03 * k, d + over * 1.6), sugar, 0, top + 0.055 * k, 0)
    if (p.icing === 'istappar')
      for (const s of [-1, 1])
        for (let i = 0; i < 9; i++) {
          const len = (0.03 + r() * 0.05) * k
          add(g, new THREE.ConeGeometry(0.008 * k, len, 5), icing, -w / 2 + ((i + 0.5) / 9) * w, top - len / 2, s * (d / 2 + over)).rotation.x = Math.PI
        }
    if (p.candy === 'godis')
      for (let i = 0; i < 10; i++) add(g, new THREE.SphereGeometry(0.018 * k, 8, 6), std([0xc8102e, 0x1d8a4e, 0xf2c230, 0x2b5fa8, 0xff7ac8][i % 5], 0.3), (r() - 0.5) * w, top + 0.08 * k, (r() - 0.5) * d)
    if (p.chimney) add(g, new THREE.BoxGeometry(0.07 * k, 0.14 * k, 0.07 * k), walls, w * 0.25, top + 0.12 * k, -d * 0.15)
  }
  // icing along the corners
  if (p.icing === 'kanter')
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new THREE.BoxGeometry(0.012 * k, h, 0.012 * k), icing, sx * (w / 2), 0.02 * k + h / 2, sz * (d / 2))
  // polkagrisar at the corners, red and white
  if (p.candy === 'polkagris')
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const cane = new THREE.Group()
        add(cane, new THREE.CylinderGeometry(0.012 * k, 0.012 * k, h * 1.1, 8), std(0xffffff, 0.35))
        for (let i = 0; i < 4; i++) add(cane, new THREE.TorusGeometry(0.013 * k, 0.004 * k, 4, 10), std(0xd0202a, 0.35), 0, -h * 0.4 + i * h * 0.27, 0).rotation.x = Math.PI / 2 + 0.4
        cane.position.set(sx * (w / 2 + 0.03 * k), 0.02 * k + h * 0.55, sz * (d / 2 + 0.03 * k))
        g.add(cane)
      }
  g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  return g
}

/** A little card: who built it, and its hearts. */
function card(by: string, votes: number) {
  const [c, ctx] = makeCanvas(256, 72)
  ctx.fillStyle = '#fff8e6'
  ctx.fillRect(0, 0, 256, 72)
  ctx.strokeStyle = '#9a5a2a'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, 252, 68)
  ctx.fillStyle = '#5a2e12'
  ctx.textAlign = 'center'
  ctx.font = `600 26px ${FONT.serif}`
  ctx.fillText(by.length > 13 ? by.slice(0, 13) + '…' : by, 128, 32)
  ctx.font = `600 22px ${FONT.sans}`
  ctx.fillStyle = '#c8102e'
  ctx.fillText(`❤️ ${votes}`, 128, 60)
  return toTexture(c)
}

type Ctx = { ask: (talk: Talk) => void; done: () => void; say: (text: string) => void; name: () => string }

export type Bakery = ReturnType<typeof buildHouseWindow>

export function buildHouseWindow(scene: THREE.Scene, ctx: Ctx) {
  const group = new THREE.Group()
  group.position.set(SHOP.x, 0, SHOP.z)
  group.rotation.y = SHOP.yaw
  scene.add(group)
  const colliders: Circle[] = []
  const at = (x: number, z: number) => {
    group.updateMatrixWorld(true)
    return group.localToWorld(new THREE.Vector3(x, 0, z))
  }

  /* ---------- the window: a glass case with two shelves, north of the door ---------- */
  const win = new THREE.Group()
  win.position.set(3.1, 0, SHOP.d / 2 + 0.75)
  group.add(win)
  const wood = std(0x5a3a22, 0.7)
  add(win, new THREE.BoxGeometry(2.6, 0.7, 0.8), wood, 0, 0.35, 0)
  for (const y of [0.72, 1.32]) add(win, new THREE.BoxGeometry(2.5, 0.04, 0.72), std(0xf2ece0, 0.6), 0, y, 0)
  add(win, new THREE.BoxGeometry(2.6, 0.08, 0.8), wood, 0, 1.96, 0)
  for (const x of [-1.27, 1.27]) add(win, new THREE.BoxGeometry(0.06, 1.26, 0.8), wood, x, 1.33, 0)
  const glass = new THREE.MeshStandardMaterial({ color: 0xdfefff, roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false })
  const pane = add(win, new THREE.PlaneGeometry(2.5, 1.22), glass, 0, 1.33, 0.4)
  pane.castShadow = false
  add(win, new THREE.BoxGeometry(2.5, 1.22, 0.02), wood, 0, 1.33, -0.39)
  // a sign on top
  const [sc, sctx] = makeCanvas(512, 96)
  sctx.fillStyle = '#9a5a2a'
  sctx.fillRect(0, 0, 512, 96)
  sctx.fillStyle = '#fff3dc'
  sctx.font = `600 46px ${FONT.serif}`
  sctx.textAlign = 'center'
  sctx.textBaseline = 'middle'
  sctx.fillText('🏠 Årets pepparkakshus', 256, 50)
  const st = toTexture(sc)
  add(win, new THREE.PlaneGeometry(2.0, 0.38), new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.3 }), 0, 2.22, 0.3).castShadow = false
  // a warm light inside it
  const shelfLight = new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false })
  add(win, new THREE.BoxGeometry(2.4, 0.02, 0.05), shelfLight, 0, 1.9, 0.3).castShadow = false
  const shown = new THREE.Group()
  win.add(shown)
  for (const dx of [-0.8, 0, 0.8]) {
    const p = at(3.1 + dx, SHOP.d / 2 + 0.75)
    colliders.push({ x: p.x, z: p.z, r: 0.55 })
  }

  /* ---------- the table, south of the door, and Bagar-Berit ---------- */
  const table = new THREE.Group()
  table.position.set(-3.2, 0, SHOP.d / 2 + 1.0)
  group.add(table)
  add(table, new THREE.BoxGeometry(1.8, 0.06, 1.0), std(0x8a5a32, 0.7), 0, 0.85, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(table, new THREE.BoxGeometry(0.07, 0.85, 0.07), wood, sx * 0.8, 0.42, sz * 0.42)
  add(table, new THREE.BoxGeometry(1.7, 0.01, 0.9), std(0xf6f0e2, 0.9), 0, 0.885, 0)
  // bowls of sweets and a piping bag
  for (const [x, c] of [[-0.65, 0xc8102e], [0.65, 0x1d8a4e]] as const) {
    add(table, new THREE.CylinderGeometry(0.12, 0.08, 0.08, 14), std(0xf2f2f2, 0.4), x, 0.93, 0.3)
    for (let i = 0; i < 5; i++) add(table, new THREE.SphereGeometry(0.03, 8, 6), std(c, 0.3), x + (i % 3 - 1) * 0.04, 0.98, 0.3 + (i - 2) * 0.02)
  }
  add(table, new THREE.ConeGeometry(0.05, 0.22, 10), std(0xffffff, 0.6), 0.6, 0.93, -0.25).rotation.z = Math.PI / 2
  const preview = new THREE.Group()
  preview.position.set(0, 0.89, 0)
  table.add(preview)
  {
    const p = at(-3.2, SHOP.d / 2 + 1.0)
    colliders.push({ x: p.x, z: p.z, r: 0.85 })
  }
  const berit = new Nisse({ coat: 0xf2ece0, hat: 0xc8102e, trim: true, apron: 0xffffff, beard: false, ears: true, scale: 1.05 })
  {
    const p = at(-3.2, SHOP.d / 2 + 0.2)
    berit.group.position.set(p.x, 0, p.z)
    berit.setYaw(SHOP.yaw)
  }
  scene.add(berit.group)
  colliders.push({ x: berit.group.position.x, z: berit.group.position.z, r: 0.35 })

  /* ---------- everyone's houses ---------- */
  let houses: House[] = []
  const show = (list: House[]) => {
    houses = list
    for (const c of [...shown.children]) shown.remove(c)
    const best = [...list].sort((a, b) => b.votes - a.votes || (a.id < b.id ? 1 : -1)).slice(0, 6)
    best.forEach((h, i) => {
      const row = Math.floor(i / 3)
      const x = (i % 3 - 1) * 0.8
      const y = row === 0 ? 1.36 : 0.76
      const m = gingerbreadHouse(h, 0.62, [...h.id].reduce((a, c) => a + c.charCodeAt(0), 0))
      m.position.set(x, y, -0.05)
      m.rotation.y = 0.25 - (i % 3) * 0.25
      shown.add(m)
      const cd = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.12), new THREE.MeshBasicMaterial({ map: card(h.by, h.votes), toneMapped: false }))
      cd.position.set(x, y + 0.08, 0.3)
      shown.add(cd)
    })
  }
  const load = async () => {
    try {
      const r = await fetch('/api/husvitrin')
      if (!r.ok) throw r.status
      show(await r.json())
    } catch {
      show(local.get<House[]>('dev-husvitrin', []))
    }
  }
  load()
  setInterval(load, 120_000)
  const post = async (body: unknown): Promise<House[] | null> => {
    try {
      const r = await fetch('/api/husvitrin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw r.status
      return await r.json()
    } catch {
      // (local development: kept in this browser)
      const list = local.get<House[]>('dev-husvitrin', [])
      const b = body as Partial<House> & { vote?: string }
      const next = b.vote ? list.map((h) => (h.id === b.vote ? { ...h, votes: h.votes + 1 } : h)) : [...list, { ...(b as House), id: String(Date.now()), votes: 0 }]
      local.set('dev-husvitrin', next)
      return next
    }
  }

  /* ---------- building one ---------- */
  const plan: Plan = { size: 1, roof: 'sadel', icing: 'kanter', candy: 'godis', chimney: true }
  const redraw = () => {
    for (const c of [...preview.children]) preview.remove(c)
    preview.add(gingerbreadHouse(plan, 1.25, 11))
  }
  redraw()
  const step = (title: string, text: string, options: { label: string; pick: () => void }[], next: () => void): Talk => ({
    name: 'Bagar-Berit',
    avatar: '🧁',
    greeting: () => [html.h(title) + html.p(text)],
    topics: options.map((o) => ({
      label: o.label,
      pages: () => [],
      go: () => {
        o.pick()
        redraw()
        next()
      },
    })),
    bye: 'Det står kvar på bordet och väntar.',
  })
  const finish = (): Talk => ({
    name: 'Bagar-Berit',
    avatar: '🧁',
    greeting: () => [html.p('Åh, vad fint det blev! Ska vi ställa in det i vitrinen, med ditt namn på? Där kan alla som går förbi ge det ett hjärta.')],
    topics: [
      { label: '🏠 Ja, ställ in det i vitrinen!', pages: () => [], go: () => save() },
      { label: '🔁 Börja om från början', pages: () => [], go: () => ctx.ask(sizes()) },
    ],
    bye: 'Det står kvar på bordet och väntar.',
  })
  const chimney = () => step('Skorsten?', 'En liten skorsten med socker på toppen?', [
    { label: '🏭 Ja, en skorsten', pick: () => (plan.chimney = true) },
    { label: '🙅 Nej tack', pick: () => (plan.chimney = false) },
  ], () => ctx.ask(finish()))
  const candies = () => step('Och godiset?', 'Det roligaste av allt.', CANDIES.map((c) => ({ label: c.label, pick: () => (plan.candy = c.id) })), () => ctx.ask(chimney()))
  const icings = () => step('Kristyren', 'Jag har spritspåsen redo.', ICINGS.map((c) => ({ label: c.label, pick: () => (plan.icing = c.id) })), () => ctx.ask(candies()))
  const roofs = () => step('Vilket tak?', 'Det är taket som håller ihop allt. Eller inte.', ROOFS.map((c) => ({ label: c.label, pick: () => (plan.roof = c.id) })), () => ctx.ask(icings()))
  const sizes = () => step('Hur stort?', 'Degen räcker till vad du vill.', SIZES.map((label, i) => ({ label, pick: () => (plan.size = i) })), () => ctx.ask(roofs()))
  const save = async () => {
    const n = local.get<number>(`husvitrin-${today()}`, 0)
    if (n >= PER_DAY) {
      ctx.done()
      return ctx.say(`🧁 Du har redan ställt in ${PER_DAY} hus i dag – låt de andra också få plats! Kom tillbaka i morgon.`)
    }
    const list = await post({ ...plan, by: ctx.name() || 'En nisse' })
    ctx.done()
    if (!list) return ctx.say('🧁 Huset kunde inte ställas in just nu – försök igen om en stund.')
    local.set(`husvitrin-${today()}`, n + 1)
    show(list)
    ctx.say('🏠 Ditt pepparkakshus står nu i vitrinen vid bageriet – för alla att se!')
  }

  /* ---------- hearts ---------- */
  const voteTalk = (): Talk => {
    const mine = local.get<string[]>('husvitrin-roster', [])
    const best = [...houses].sort((a, b) => b.votes - a.votes).slice(0, 6)
    return {
      name: 'Årets pepparkakshus',
      avatar: '🏠',
      greeting: () => [
        html.p(houses.length ? `${houses.length} pepparkakshus har byggts i år. Här står de sex mest älskade – ge ett hjärta till dem du gillar!` : 'Vitrinen är tom än så länge. Bygg det första vid Bagar-Berits bord på andra sidan dörren!'),
      ],
      topics: best.map((h) => ({
        label: mine.includes(h.id) ? `✅ ${h.by}s hus (${h.votes} ❤️)` : `❤️ Ge ${h.by}s hus ett hjärta (${h.votes})`,
        pages: () => [],
        go: async () => {
          ctx.done()
          if (mine.includes(h.id)) return ctx.say(`🏠 Du har redan gett ${h.by}s hus ett hjärta.`)
          local.set('husvitrin-roster', [...mine, h.id])
          const list = await post({ vote: h.id })
          if (list) show(list)
          ctx.say(`❤️ Ett hjärta till ${h.by}s pepparkakshus!`)
        },
      })),
      bye: 'Mums.',
    }
  }

  const beritTalk: Talk = {
    name: 'Bagar-Berit',
    avatar: '🧁',
    greeting: () => [html.p('Välkommen! Här bygger vi pepparkakshus. Degen är utkavlad, kristyren är vispad – vill du bygga ett?')],
    topics: [
      { label: '🏠 Ja, jag vill bygga ett pepparkakshus!', pages: () => [], go: () => ctx.ask(sizes()) },
      { label: '❤️ Hur fungerar vitrinen?', pages: () => [html.p('Varje hus som byggs här får stå i vitrinen med byggarens namn. De sex hus som fått flest hjärtan står längst fram – gå fram till vitrinen och ge ett hjärta till dem du gillar!')] },
    ],
    bye: 'Lycka till med bygget!',
  }

  function update(t: number, dt: number, player: THREE.Vector3) {
    berit.update(t, dt, player, false)
    preview.rotation.y = t * 0.25
  }

  return {
    group,
    colliders,
    talker: { npc: berit, talk: beritTalk },
    moving: [berit.group],
    update,
    voteTalk,
    /** In front of the window, facing it? */
    nearWindow(pos: THREE.Vector3, fwd: THREE.Vector3) {
      const c = at(3.1, SHOP.d / 2 + 0.75)
      const f = at(3.1, SHOP.d / 2 + 2.0)
      const dx = c.x - pos.x
      const dz = c.z - pos.z
      return Math.hypot(f.x - pos.x, f.z - pos.z) < 1.8 && (dx * fwd.x + dz * fwd.z) / Math.hypot(dx, dz) > 0.5
    },
  }
}
