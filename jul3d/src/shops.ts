// What's inside each shop: the shopkeeper's lines and everything hanging on the walls.
import * as THREE from 'three'
import { DISHES, EVENTS, GUESTS, MEMORIES, PARTICIPANTS, POTLUCK_IMAGE, YEAR, type Competition, type JulEvent } from './data'
import { Nisse } from './npc'
import { Shop, framed, sheet, D } from './shop'
import { drawArrowSign, drawBoard, drawCorkboard, drawPoster, drawTvScreen, glowTexture, loadImage, loadSvg, makeCanvas, toTexture } from './tex'
import { downloadIcs, formatDate, formatShortDate, formatTime, untilText } from './time'
import { html, type Talk, type Topic } from './ui'
import { openKnytis } from './knytis'
import { openRitbord } from './ritbord'
import { setHouseSlot } from './teamhouse'
import { keepApart } from './batch'
import { julbakHouse } from './pepparkakshus'
import { buildLeksaksfabriken } from './leksaksfabriken'
import { furnishJulbord, knytisBoardItems, showClaimsOnBuffet } from './julbord'
import type { Claims } from '../../src/lib/api'

const JULBAK = EVENTS.find((e) => e.id === 'julbak')!
// (only there for those invited – see netlify/lib/invite.mts)
const JULBORD = EVENTS.find((e) => e.potluck)
const JULAFTON = EVENTS.find((e) => e.santa)!
const VERKSTAD = JULBAK.competitions?.find((c) => c.art === 'verkstad')
const DESTILLERI = JULBAK.competitions?.find((c) => c.art === 'destilleri')

/** Someone else to talk to in a shop, standing at (x, z) in shop space facing `yaw`. */
export type Extra = { npc: Nisse; talk: Talk; x: number; z: number; yaw: number }

/** `event` drives the sign over the door; `emoji` (default: the event's) is used on the signpost. */
/** `spot`: where the shopkeeper stands, if not behind the usual counter (NPC_SPOT).
 *  `hitboxes`: invisible stand-ins that rays and snowballs hit instead of the whole building. */
export type BuiltShop = { shop: Shop; event: JulEvent; npc: Nisse; talk: Talk; emoji?: string; extras?: Extra[]; spot?: { x: number; z: number; yaw: number }; hitboxes?: THREE.Object3D }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dataUrl = (c: HTMLCanvasElement) => {
  let url = ''
  return () => (url ||= c.toDataURL('image/jpeg', 0.92))
}

/* ------------------------------------------------------------------ shared dialog topics */

function whenWhere(e: JulEvent): Topic {
  return {
    label: '📍 När och var?',
    pages: () => [
      html.p(`${cap(formatDate(e.start))} kl. ${formatTime(e.start)} – ${e.location}.`) + html.p(`${e.name} ${untilText(e)}. ${e.tagline}!`),
    ],
  }
}
const about = (e: JulEvent, label: string): Topic => ({ label, pages: () => [html.p(e.description)] })
const calendar = (e: JulEvent): Topic => ({
  label: '📅 Lägg in det i min kalender',
  action: () => downloadIcs(e),
  pages: () => [html.p(`Klart! Kalenderfilen för ${e.name} laddas ner nu – öppna den så hamnar den i din kalender.`)],
})
function competitionTopics(c: Competition, labels: { theme: string; rules: string; criteria: string }): Topic[] {
  const out: Topic[] = []
  if (c.theme) out.push({ label: labels.theme, pages: () => [html.h(c.theme!.title) + html.p(c.theme!.intro[0]), ...c.theme!.intro.slice(1).map(html.p)] })
  out.push({
    label: labels.rules,
    pages: () => [...(c.notice ? [html.note(c.notice)] : []), html.p('Så här är det:') + html.list(c.rules) + html.p('Reglerna sitter uppe på väggen också, om du glömmer.')],
  })
  if (c.criteria) out.push({ label: labels.criteria, pages: () => [html.p('Juryn tittar på:') + html.list(c.criteria!, 'stars')] })
  return out
}

/* ------------------------------------------------------------------ props */

const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const wood = std(0x6b4226, 0.8)

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  return m
}

function counter(shop: Shop, color: number) {
  const g = new THREE.Group()
  g.add(box(0.8, 0.78, 2.6, wood, 0, 0.39, 0))
  g.add(box(0.95, 0.07, 2.75, std(0x4a2c1c, 0.5), 0, 0.815, 0))
  g.add(box(0.04, 0.5, 2.2, std(color, 0.6), 0.42, 0.42, 0))
  // a candle in a jar on the counter
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10), std(0xfff3dc))
  candle.position.set(0, 0.93, -0.9)
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false }))
  flame.position.set(0, 1.04, -0.9)
  flame.scale.y = 1.8
  keepApart(flame)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.position.copy(flame.position)
  glow.scale.setScalar(0.5)
  g.add(candle, flame, glow)
  g.position.set(-3.5, 0, 1.2)
  shop.group.add(g)
  shop.block(-3.5, 1.2, 0.5, 1.4)
  shop.updaters.push((t) => {
    flame.scale.y = 1.8 + Math.sin(t * 13) * 0.3
    glow.scale.setScalar(0.45 + Math.sin(t * 9) * 0.04)
  })
  return g
}

function table(shop: Shop, x: number, z: number, w: number, d: number, cloth?: number) {
  const g = new THREE.Group()
  g.add(box(w, 0.07, d, wood, 0, 0.8, 0))
  if (cloth) g.add(box(w + 0.06, 0.02, d * 0.55, std(cloth, 0.9), 0, 0.845, 0))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.08, 0.8, 0.08, wood, sx * (w / 2 - 0.1), 0.4, sz * (d / 2 - 0.1)))
  g.position.set(x, 0, z)
  shop.group.add(g)
  shop.block(x, z, w / 2 + 0.1, d / 2 + 0.1)
  return g
}

function steam(shop: Shop, x: number, y: number, z: number) {
  const tex = glowTexture('rgba(235,240,255,0.7)', 'rgba(235,240,255,0)')
  const puffs = Array.from({ length: 6 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 }))
    s.userData.o = i / 6
    shop.group.add(s)
    return s
  })
  shop.updaters.push((t) => {
    for (const s of puffs) {
      const k = (t * 0.35 + s.userData.o) % 1
      s.position.set(x + Math.sin(t + k * 6) * 0.08, y + k * 1.3, z)
      s.scale.setScalar(0.25 + k * 0.6)
      ;(s.material as THREE.SpriteMaterial).opacity = 0.45 * (1 - k)
    }
  })
}

function gingerbreadHouse() {
  const g = new THREE.Group()
  const dough = std(0xa0622d, 0.9)
  const icing = std(0xfffaf0, 0.5)
  g.add(box(0.7, 0.45, 0.55, dough, 0, 0.225, 0))
  const a = Math.atan2(0.3, 0.35)
  for (const s of [-1, 1]) {
    const roof = box(0.47, 0.04, 0.68, dough, s * 0.17, 0.6, 0)
    roof.rotation.z = -s * a
    const snow = box(0.47, 0.03, 0.66, icing, s * 0.165, 0.625, 0)
    snow.rotation.z = -s * a
    g.add(roof, snow)
  }
  g.add(box(0.14, 0.24, 0.02, std(0x5a3420), 0, 0.12, 0.28))
  const cols = [0xe5383b, 0x2fa36b, 0xf6c453, 0x4a7bd0]
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(cols[i % 4], 0.3))
    c.position.set(-0.3 + i * 0.066, 0.43, 0.285)
    g.add(c)
  }
  for (const x of [-0.2, 0.2]) {
    const win = box(0.12, 0.12, 0.02, new THREE.MeshBasicMaterial({ color: 0xffc66b, toneMapped: false }), x, 0.27, 0.28)
    g.add(win)
  }
  // a candy cane by the door
  const cane = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), std(0xe5383b, 0.4))
  cane.position.set(0.15, 0.3, 0.33)
  const stick = box(0.024, 0.28, 0.024, std(0xe5383b, 0.4), 0.2, 0.16, 0.33)
  g.add(cane, stick)
  return g
}

function copperPot(shop: Shop, x: number, z: number, s = 1) {
  const g = new THREE.Group()
  const copper = std(0xd98a4a, 0.35, 0.35)
  const stone = std(0x55555e, 0.95)
  g.add(box(1.0 * s, 0.3, 1.0 * s, stone, 0, 0.15, 0))
  const fire = keepApart(new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 0.35, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false })))
  fire.position.y = 0.42
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), copper)
  pot.rotation.x = Math.PI
  pot.position.y = 0.9 * s
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33 * s, 0.035, 8, 24), copper)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.9 * s
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.32 * s, 20), new THREE.MeshStandardMaterial({ color: 0x7a1020, emissive: 0x3a0008, roughness: 0.2 }))
  brew.rotation.x = -Math.PI / 2
  brew.position.y = 0.86 * s
  const light = new THREE.PointLight(0xff8a3a, 3, 3, 2)
  light.position.y = 0.5
  g.add(fire, pot, rim, brew, light)
  // (meshes only: a point light casting shadows renders the whole scene six more times a frame)
  g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh === true))
  g.position.set(x, 0, z)
  shop.group.add(g)
  shop.block(x, z, 0.55 * s, 0.55 * s)
  steam(shop, x, 1.0 * s, z)
  shop.updaters.push((t) => {
    fire.scale.set(1 + Math.sin(t * 11 + x) * 0.1, 1 + Math.sin(t * 15 + z) * 0.2, 1)
    light.intensity = 3 + Math.sin(t * 17 + x) * 0.6
  })
}

function bottleShelf(shop: Shop, along: number, y: number) {
  const g = new THREE.Group()
  g.add(box(2.0, 0.06, 0.32, wood, 0, 0, 0.16))
  const glass = [0x2fa36b, 0xb3202a, 0xf6c453, 0x6a3fb0, 0x2b6cb0, 0xd96b2b]
  glass.forEach((c, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 })
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.32, 10), mat)
    b.position.set(-0.8 + i * 0.32, 0.19, 0.16)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.12, 8), mat)
    neck.position.set(-0.8 + i * 0.32, 0.41, 0.16)
    g.add(b, neck)
  })
  shop.hang(g, 'right', along, y)
}

function fireplace(shop: Shop) {
  const g = new THREE.Group()
  const stone = std(0x8a7f78, 0.95)
  g.add(box(2.6, 1.3, 0.6, stone, 0, 0.65, 0.3))
  g.add(box(1.4, 0.8, 0.62, std(0x140b07, 1), 0, 0.42, 0.31))
  g.add(box(2.9, 0.12, 0.75, wood, 0, 1.36, 0.35))
  g.add(box(2.2, 0.06, 0.6, stone, 0, 0.03, 0.85))
  const fire = keepApart(new THREE.Group())
  for (const [x, s, c] of [[-0.25, 0.8, 0xff7a2a], [0.05, 1, 0xffa53a], [0.3, 0.7, 0xff5a1a], [0, 0.55, 0xffd36a]] as const) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.55 * s, 8), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }))
    f.position.set(x, 0.3 * s, 0.78)
    fire.add(f)
  }
  for (const x of [-0.25, 0.25]) {
    const log = box(0.6, 0.1, 0.1, std(0x3d2516), x * 0.6, 0.06, 0.78)
    log.rotation.y = x * 2
    fire.add(log)
  }
  const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,170,80,0.9)', 'rgba(255,120,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  fireGlow.position.set(0, 0.35, 0.85)
  fireGlow.scale.setScalar(1.6)
  fire.add(fireGlow)
  g.add(fire)
  const light = new THREE.PointLight(0xff8a3a, 10, 7, 1.6)
  light.position.set(0, 0.6, 1.2)
  g.add(light)
  // stockings
  for (const [i, c] of [0xe5383b, 0x2fa36b, 0xe5383b].entries()) {
    const sock = new THREE.Group()
    sock.add(box(0.18, 0.34, 0.06, std(c, 0.9), 0, -0.17, 0))
    sock.add(box(0.26, 0.12, 0.06, std(c, 0.9), 0.05, -0.38, 0))
    sock.add(box(0.2, 0.07, 0.07, std(0xfdfcf8, 0.9), 0, 0, 0))
    sock.position.set(-0.8 + i * 0.8, 1.3, 0.75)
    g.add(sock)
  }
  shop.hang(g, 'back', 0, 0)
  shop.block(0, -D / 2 + 0.7, 1.5, 0.8)
  shop.updaters.push((t) => {
    fire.children.forEach((f, i) => {
      if ((f as THREE.Mesh).geometry.type === 'ConeGeometry') f.scale.set(1, 1 + Math.sin(t * 12 + i * 2) * 0.18, 1)
    })
    light.intensity = 10 + Math.sin(t * 14) * 1.5 + Math.sin(t * 23) * 1
  })
}

function littleTree(shop: Shop, x: number, z: number) {
  const g = new THREE.Group()
  const needle = std(0x1d5236, 0.9)
  for (const [r, h, y] of [[0.75, 1.0, 0.75], [0.58, 0.85, 1.25], [0.38, 0.7, 1.7]]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), needle)
    c.position.y = y
    c.castShadow = true
    g.add(c)
  }
  const cols = [0xe5383b, 0xf6c453, 0x4a7bd0, 0xfdfcf8]
  for (let i = 0; i < 22; i++) {
    const y = 0.45 + (i / 22) * 1.55
    const r = 0.75 * (1 - (y - 0.3) / 1.9) + 0.04
    const a = i * 2.4
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: cols[i % 4], roughness: 0.2, metalness: 0.6 }))
    ball.position.set(Math.cos(a) * r, y, Math.sin(a) * r)
    g.add(ball)
  }
  const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false }))
  top.position.y = 2.1
  g.add(top)
  for (let i = 0; i < 5; i++) {
    const s = 0.22 + (i % 3) * 0.08
    const a = i * 1.3
    g.add(box(s, s * 0.8, s, std(cols[i % 4], 0.6), Math.cos(a) * 0.7, s * 0.4, Math.sin(a) * 0.7))
  }
  g.position.set(x, 0, z)
  shop.group.add(g)
  shop.block(x, z, 0.8, 0.8)
}

function tv(shop: Shop, along: number) {
  const g = new THREE.Group()
  g.add(box(1.2, 0.6, 0.5, wood, 0, 0.3, 0.25))
  const set = box(1.0, 0.8, 0.5, std(0x3a2a20, 0.6), 0, 1.0, 0.25)
  g.add(set)
  const [c] = makeCanvas(512, 384)
  const tex = toTexture(c, { live: true })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
  screen.position.set(0, 1.0, 0.51)
  g.add(screen)
  shop.hang(g, 'back', along, 0)
  shop.block(along, -D / 2 + 0.4, 0.65, 0.4)
  let last = -1
  shop.updaters.push((t) => {
    const f = Math.floor(t * 4)
    if (f === last) return
    last = f
    c.getContext('2d')!.drawImage(drawTvScreen(t), 0, 0)
    tex.needsUpdate = true
  })
  return screen
}

/* ------------------------------------------------------------------ the four shops */

async function buildVerkstad(): Promise<BuiltShop> {
  const e = JULBAK
  const c = VERKSTAD!
  const shop = new Shop('Tomtens bageri', { wall: '#9a5a2c', trim: 0xfff3dc, roof: 0x5c3216, inner: '#c99a6a' })
  shop.place(-78, 23)
  counter(shop, 0x2fa36b)

  const art = await loadSvg('/art/verkstad.svg', 3)
  const pic = shop.hang(framed(art, 5.2, { frame: 0xd4a64a }), 'back', 0, 1.95)
  shop.exhibit(pic, { title: c.theme?.title ?? 'Tomtens bageri', caption: c.theme?.intro.join(' '), image: dataUrl(art) })

  const rules = drawBoard({ style: 'parchment', title: 'Verkstadsordning', subtitle: c.name, items: c.rules, marker: 'check', footer: 'Underskrivet av Tomten själv', seed: 4 })
  const r = shop.hang(sheet(rules, 2.15), 'left', 2.1, 1.85)
  shop.exhibit(r, { title: 'Verkstadsordning', caption: 'Pepparkakstävlingens regler', image: dataUrl(rules) })

  if (c.notice) {
    const note = drawBoard({ style: 'note', title: 'OBS!', items: [c.notice], marker: 'none', w: 768, h: 768, seed: 8 })
    const n = shop.hang(sheet(note, 1.25, 0.04), 'back', -3.85, 2.15)
    shop.exhibit(n, { title: 'OBS!', caption: c.notice, image: dataUrl(note) })
  }

  const photo = await loadImage(e.image)
  const ph = shop.hang(framed(photo, 1.45, { frame: 0x5c3a20 }), 'back', 3.85, 2.1)
  shop.exhibit(ph, { title: `${e.emoji} ${e.name}`, caption: e.tagline, image: () => encodeURI(e.image) })

  if (c.criteria) {
    const crit = drawBoard({ style: 'chalk', title: 'Så bedöms husen', items: c.criteria, marker: 'star', footer: `Max 3 personer per lag`, w: 1024, h: 820, seed: 2 })
    const b = shop.hang(framed(crit, 2.4, { frame: 0x6b4226, border: 0.05 }), 'right', -2.1, 2.05)
    shop.exhibit(b, { title: 'Så bedöms husen', caption: c.criteria.join(' · '), image: dataUrl(crit) })
  }

  // the four workshop rooms as little framed windows
  const rooms = [
    { kind: 'bageriet', name: 'Bageriet', text: 'Där ugnarna aldrig svalnar och degen alltid jäser.' },
    { kind: 'leksaker', name: 'Leksaksverkstaden', text: 'Kugghjul som snurrar och tennsoldater som ställer sig i ledet.' },
    { kind: 'glitter', name: 'Glitterlagret', text: 'Burkar av stjärnstoft, frost och allt som gnistrar.' },
    { kind: 'post', name: 'Postkontoret', text: 'Önskelistor från hela världen, sorterade fack för fack.' },
  ]
  await Promise.all(
    rooms.map(async (room, i) => {
      const cv = await loadSvg(`/art/room-${room.kind}.svg`, 8)
      const f = shop.hang(framed(cv, 1.0, { frame: 0xfff3dc, border: 0.07 }), 'right', 0.6 + (i % 2) * 1.35, i < 2 ? 2.55 : 1.45)
      shop.exhibit(f, { title: room.name, caption: room.text, image: dataUrl(cv) })
    }),
  )

  const t = table(shop, 1.4, -1.2, 1.6, 1.1, 0xe5383b)
  // the house from the Julbak photo (NO JUSTICE · NO JINGLE)
  const house = julbakHouse()
  house.position.y = 0.845
  house.rotation.y = 0.45
  house.scale.setScalar(1.25)
  t.add(house)

  const npc = new Nisse({ coat: 0x2fa36b, hat: 0xe5383b, apron: 0xfff3dc })
  const talk: Talk = {
    name: 'Pepparnissen',
    avatar: '🍪',
    avatarBg: '#2fa36b',
    greeting: () => [
      html.p('Nämen hej! Välkommen in i Tomtens bageri – här luktar det alltid ingefära och kanel.') +
        html.p(`Jag håller koll på pepparkakstävlingen. Julbaket ${untilText(e)} – hög tid att börja skissa!`),
    ],
    topics: [
      whenWhere(e),
      about(e, '🍪 Vad händer på julbaket?'),
      ...competitionTopics(c, { theme: '🏠 Vad är årets tema?', rules: '📜 Vilka regler gäller?', criteria: '⭐ Hur bedöms husen?' }),
      {
        label: '🧝 Vad gör ni här inne egentligen?',
        pages: () => [html.p('Bakom de frostiga fönstren på väggen där borta finns bageriet, leksaksverkstaden, glitterlagret och postkontoret.') + html.p('Gå fram och titta på dem – och glöm inte att kika in i destilleriet längre bort.')],
      },
      calendar(e),
    ],
    bye: 'Lycka till med bygget – och kom ihåg, inga limpistoler!',
  }
  return { shop, event: e, npc, talk }
}

async function buildDestilleri(): Promise<BuiltShop> {
  const e = JULBAK
  const c = DESTILLERI!
  const shop = new Shop('Tomtens destilleri', { wall: '#5a2e22', trim: 0xc8803c, roof: 0x2a1d17, inner: '#8a5a3a' })
  shop.place(-30, 23)
  counter(shop, 0xc8803c)

  const art = await loadSvg('/art/destilleri.svg', 3)
  const pic = shop.hang(framed(art, 5.2, { frame: 0xc8803c }), 'back', 0, 1.95)
  shop.exhibit(pic, { title: c.theme?.title ?? 'Tomtens destilleri', caption: 'Tre kopparpannor över elden', image: dataUrl(art) })

  if (c.theme) {
    const story = drawBoard({ style: 'parchment', title: c.theme.title, items: c.theme.intro, marker: 'none', w: 900, h: 1300, seed: 12 })
    const s = shop.hang(sheet(story, 1.45), 'back', -3.9, 1.95)
    shop.exhibit(s, { title: c.theme.title, caption: 'Årets tema för drinktävlingen', image: dataUrl(story) })
  }

  const rules = drawBoard({ style: 'chalk', title: 'Destilleriets regler', items: c.rules, marker: 'check', w: 1024, h: 1180, seed: 5 })
  const r = shop.hang(framed(rules, 2.35, { frame: 0x6b4226, border: 0.05 }), 'left', 2.1, 1.9)
  shop.exhibit(r, { title: 'Destilleriets regler', caption: c.name, image: dataUrl(rules) })

  if (c.criteria) {
    const crit = drawBoard({ style: 'chalk', title: 'Så bedöms brygden', items: c.criteria, marker: 'star', w: 1024, h: 900, seed: 6 })
    const b = shop.hang(framed(crit, 2.4, { frame: 0x6b4226, border: 0.05 }), 'right', -2.0, 2.0)
    shop.exhibit(b, { title: 'Så bedöms brygden', caption: c.criteria.join(' · '), image: dataUrl(crit) })
  }
  const last = c.rules.find((x) => /senast/i.test(x))
  if (last) {
    const note = drawBoard({ style: 'note', title: 'Kom ihåg!', items: [last], marker: 'none', w: 700, h: 700, seed: 9 })
    const n = shop.hang(sheet(note, 1.0, -0.05), 'back', 3.9, 2.3)
    shop.exhibit(n, { title: 'Kom ihåg!', caption: last, image: dataUrl(note) })
  }
  bottleShelf(shop, 1.6, 1.55)
  bottleShelf(shop, 1.6, 2.35)

  copperPot(shop, 0.4, -1.4)
  copperPot(shop, 2.4, -1.4)
  copperPot(shop, 1.4, 0.6, 0.85)

  const npc = new Nisse({ coat: 0x8e1b1b, hat: 0x1d6e48, apron: 0x5a3420, pants: 0x3a2a20 })
  const talk: Talk = {
    name: 'Glöggmästaren',
    avatar: '🍸',
    avatarBg: '#8e1b1b',
    greeting: () => [html.p('Psst… kom in, kom in! Det här är Tomtens destilleri. Känner du doften av kanel och kardemumma?') + html.p('Jag är glöggmästaren – jag håller i drinktävlingen på julbaket.')],
    topics: [
      whenWhere(e),
      ...competitionTopics(c, { theme: '🔥 Berätta om destilleriet', rules: '📜 Vilka regler gäller?', criteria: '⭐ Hur bedöms brygden?' }),
      {
        label: '🥃 Får jag smaka?',
        pages: () => [html.p('Ha! Inte förrän den sjätte december, min vän. Men gör tillräckligt mycket själv så att alla kan smaka – det är reglerna.')],
      },
      calendar(e),
    ],
    bye: 'Skål – och låt brygderna porla!',
  }
  return { shop, event: e, npc, talk }
}

async function buildJulbord(e: JulEvent): Promise<BuiltShop> {
  // white panelled walls inside, like the dining room in the photo
  const shop = new Shop('Julbordet', { wall: '#a8282c', trim: 0xfdfcf8, roof: 0x3a2a24, inner: '#ece3d3' })
  shop.place(30, 23)
  counter(shop, 0xe5383b)

  const photo = await loadImage(e.image)
  // (hung high enough to clear the buffet along the back wall)
  const p = shop.hang(framed(photo, 1.85, { frame: 0xd4a64a, maxH: 1.7 }), 'back', -2.3, 2.15)
  shop.exhibit(p, { title: `${e.emoji} ${e.name}`, caption: e.tagline, image: () => encodeURI(e.image) })

  const knytis = await loadImage(POTLUCK_IMAGE)
  const k = shop.hang(framed(knytis, 2.3, { frame: 0xd4a64a, maxH: 1.6 }), 'back', 1.9, 2.15)
  shop.exhibit(k, { title: 'Knytis-bordet', caption: 'Så här ska julbordet se ut när alla tagit med sig något.', image: () => encodeURI(POTLUCK_IMAGE) })

  const cats = ['Fisk', 'Kött', 'Tillbehör', 'Dryck'] as const
  // the chalkboard ticks dishes off (with who) as they're claimed – here, on the buffet and on /knytis alike
  const boardSpec = (claims: Claims) => ({ style: 'chalk' as const, title: 'Knytis – vem tar med vad?', items: knytisBoardItems(claims), marker: 'check' as const, w: 1024, h: 1300, seed: 14 })
  const list = drawBoard(boardSpec({}))
  const l = shop.hang(framed(list, 2.3, { frame: 0x6b4226, border: 0.05, live: true }), 'left', 2.05, 1.85)
  const boardTex = ((l.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).map!
  addEventListener('jul:claims', (ev) => {
    const claims = (ev as CustomEvent<Claims>).detail
    list.getContext('2d')!.drawImage(drawBoard(boardSpec(claims)), 0, 0)
    boardTex.needsUpdate = true
    showClaimsOnBuffet(claims)
  })
  shop.exhibit(l, { title: 'Knytis-listan', caption: 'Välj en rätt och paxa den – alla tar med något till julbordet.', image: dataUrl(list), open: openKnytis, prompt: 'Paxa en rätt på knytis-listan' })

  const imgs = await Promise.all(PARTICIPANTS.map((g) => (g.image ? loadImage(g.image).catch(() => null) : Promise.resolve(null))))
  const guests = drawCorkboard({ title: 'Gästlistan', cards: PARTICIPANTS.map((g, i) => ({ label: g.name, img: imgs[i] })), cols: 6 })
  const gw = shop.hang(framed(guests, 3.7, { frame: 0x5c3a20, border: 0.06 }), 'right', -1.0, 1.95)
  shop.exhibit(gw, { title: 'Gästlistan', caption: `${GUESTS.length} gäster i år`, image: dataUrl(guests) })

  furnishJulbord(shop)

  const npc = new Nisse({ coat: 0xfdfcf8, hat: 0xe5383b, apron: 0xe5383b, pants: 0x2b2b33 })
  const talk: Talk = {
    name: 'Skinknissen',
    avatar: '🍖',
    avatarBg: '#e5383b',
    greeting: () => [html.p('Välkommen till julbordet! Sill, skinka, snaps och sång – jag har dukat sedan i oktober.') + html.p('Behöver du veta något om julbordet eller knytis?')],
    topics: [
      whenWhere(e),
      about(e, '🍽️ Vad blir det för julbord?'),
      {
        label: '🧺 Vad är knytis?',
        pages: () => [
          html.p('Knytkalas! Alla tar med sig en rätt till julbordet. Listan på tavlan visar allt som behövs:'),
          ...cats.map((cat) => html.h(cat) + html.list(DISHES.filter((d) => d.category === cat).map((d) => `${d.emoji} ${d.name}`))),
          html.p('Välj något som ingen annan har tagit – och paxa det här hos mig så vi inte får fem skålar Jansson.'),
        ],
      },
      {
        label: '✍️ Jag vill paxa en rätt',
        pages: () => [],
        go: openKnytis,
      },
      {
        label: '👥 Vilka kommer?',
        pages: () => [html.p(`Vi är ${GUESTS.length} stycken i år: ${GUESTS.map((g) => g.name).join(', ')}.`) + html.p('Alla sitter uppnålade på anslagstavlan där borta.')],
      },
      calendar(e),
    ],
    bye: 'Klä upp dig fint och ta med aptiten!',
  }
  return { shop, event: e, npc, talk }
}

async function buildJulafton(): Promise<BuiltShop> {
  const e = JULAFTON
  const shop = new Shop('Julstugan', { wall: '#1d6e48', trim: 0xf6c453, roof: 0x7a1d1d, inner: '#c9a072' })
  shop.place(78, 23)
  counter(shop, 0xf6c453)

  fireplace(shop)
  const photo = await loadImage(e.image)
  const p = shop.hang(framed(photo, 1.15, { frame: 0xd4a64a }), 'back', 0, 2.55)
  shop.exhibit(p, { title: `${e.emoji} ${e.name}`, caption: e.tagline, image: () => encodeURI(e.image) })

  const screen = tv(shop, -3.5)
  shop.exhibit(screen, { title: 'Kalle Anka och hans vänner önskar God Jul', caption: 'Klockan 15.00, som alltid.', image: () => drawTvScreen(0).toDataURL() })

  const todo = drawBoard({
    style: 'parchment',
    title: 'Att göra på julafton',
    subtitle: `${cap(formatDate(e.start))} från kl. ${formatTime(e.start)}`,
    items: ['Kalle Anka kl. 15.00', 'Julmys i soffan', 'Dela ut klappar', 'Värme och gemenskap', 'Vinka till släden i natt'],
    marker: 'check',
    footer: e.location,
    seed: 21,
  })
  const td = shop.hang(sheet(todo, 2.15), 'left', 2.1, 1.85)
  shop.exhibit(td, { title: 'Att göra på julafton', caption: e.description, image: dataUrl(todo) })

  const memories = await Promise.all(
    MEMORIES.slice(0, 3).map(async ({ image, label }) => ({ label, img: await loadImage(image).catch(() => null) })),
  )
  const mem = drawCorkboard({ title: 'Minnen', cards: memories, cols: 3, w: 1500, h: 900, seed: 30 })
  const m = shop.hang(framed(mem, 3.2, { frame: 0x5c3a20, border: 0.06 }), 'right', -1.3, 2.0)
  shop.exhibit(m, { title: 'Minnen från tidigare år', image: dataUrl(mem) })

  littleTree(shop, 3.6, 2.4)

  const npc = new Nisse({ coat: 0xc8102e, hat: 0xc8102e, trim: true, scale: 1.4, longBeard: true, pants: 0xc8102e })
  const talk: Talk = {
    name: 'Tomten',
    avatar: '🎅',
    avatarBg: '#c8102e',
    greeting: () => [html.p('Ho ho ho! Där är du ju. Välkommen in i min stuga – sätt dig vid brasan en stund.') + html.p(`Julafton ${untilText(e)}. Jag leder släden själv i år, som vanligt.`)],
    topics: [
      whenWhere(e),
      about(e, '🎄 Vad händer på julafton?'),
      {
        label: '📝 Vad ska man hinna med?',
        pages: () => [html.p('Det står på listan på väggen, men här har du den:') + html.list(['Kalle Anka kl. 15.00', 'Julmys i soffan', 'Dela ut klappar', 'Värme och gemenskap'])],
      },
      {
        label: '🎁 Har du någon klapp till mig?',
        pages: () => [html.p('Hmm… låt mig titta i boken.') , html.p('Jodå, du står på listan över snälla. Men klappar delas inte ut förrän den 24:e – det vet du väl!')],
      },
      {
        label: '🦌 Var är renarna?',
        pages: () => [html.p(`Ute och flyger provvarv över byn! ${JULBORD ? 'Rudolf leder julbordet, ' : ''}Dasher julbaket – och på julafton kör jag själv.`)],
      },
      calendar(e),
    ],
    bye: 'God jul, och var snäll nu!',
  }
  return { shop, event: e, npc, talk }
}

/** A blueprint of a gingerbread house: front and side elevation with measurements, like the ones Pepparkaksarkitekten prints. */
function drawBlueprint(seed = 1) {
  const [c, ctx] = makeCanvas(1400, 1000)
  ctx.fillStyle = '#1f4f8a'
  ctx.fillRect(0, 0, 1400, 1000)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  for (let x = 0; x <= 1400; x += 50) (ctx.beginPath(), ctx.moveTo(x, 0), ctx.lineTo(x, 1000), ctx.stroke())
  for (let y = 0; y <= 1000; y += 50) (ctx.beginPath(), ctx.moveTo(0, y), ctx.lineTo(1400, y), ctx.stroke())
  ctx.strokeStyle = '#eaf3ff'
  ctx.fillStyle = '#eaf3ff'
  ctx.lineWidth = 5
  ctx.lineJoin = 'round'
  const wobble = (n: number) => n + Math.sin(n * 0.37 + seed) * 2
  const path = (pts: [number, number][], close = true) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(wobble(x), wobble(y)) : ctx.moveTo(wobble(x), wobble(y))))
    if (close) ctx.closePath()
    ctx.stroke()
  }
  // front: gable wall with a door, a round window and two windows
  path([[150, 800], [150, 480], [380, 260], [610, 480], [610, 800]])
  path([[330, 800], [330, 650], [430, 650], [430, 800]], false)
  ctx.beginPath()
  ctx.arc(380, 420, 42, 0, Math.PI * 2)
  ctx.stroke()
  path([[190, 540], [270, 540], [270, 610], [190, 610]])
  path([[490, 540], [570, 540], [570, 610], [490, 610]])
  // side: wall + roof slab
  path([[760, 800], [760, 480], [1240, 480], [1240, 800]])
  path([[730, 500], [790, 300], [1210, 300], [1270, 500]])
  for (const x of [820, 960, 1100]) path([[x, 560], [x + 80, 560], [x + 80, 640], [x, 640]])
  // measurements
  ctx.lineWidth = 3
  const dim = (x1: number, y1: number, x2: number, y2: number, label: string) => {
    path([[x1, y1], [x2, y2]], false)
    for (const [x, y] of [[x1, y1], [x2, y2]]) path([[x - 8, y - 8], [x + 8, y + 8]], false)
    ctx.font = '600 38px Caveat, cursive'
    ctx.textAlign = 'center'
    ctx.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - 14)
  }
  dim(150, 860, 610, 860, '18 cm')
  dim(760, 860, 1240, 860, '24 cm')
  dim(90, 480, 90, 800, '12 cm')
  // title block
  ctx.font = '700 64px Caveat, cursive'
  ctx.textAlign = 'left'
  ctx.fillText('Pepparkakshus – fasad A & B', 150, 140)
  ctx.font = '600 40px Caveat, cursive'
  ctx.fillText('Skala 1:1 · ritat av Ritnissen', 150, 195)
  return c
}

async function buildArkitektkontor(): Promise<BuiltShop> {
  const e = JULBAK
  const c = VERKSTAD
  const shop = new Shop('Arkitektkontoret', { wall: '#c98a2b', trim: 0xfff3dc, roof: 0x3a2a24, inner: '#d9c3a0' })
  shop.place(130, 23)
  counter(shop, 0x1f4f8a)

  const print = drawBlueprint(3)
  const bp = shop.hang(framed(print, 4.2, { frame: 0xfff3dc, border: 0.05 }), 'back', 0.4, 2.0)
  shop.exhibit(bp, { title: 'Ritning', caption: 'Rita ert hus och skriv ut mallarna i skala 1:1.', image: dataUrl(print), open: openRitbord, prompt: 'Sätt dig vid ritbordet' })

  const steps = drawBoard({
    style: 'chalk',
    title: 'Så ritar ni huset',
    items: ['Välj en mall – eller börja från noll', 'Bygg ihop flera byggnader på kakbrickan', 'Rita egna bitar med bågar och urtag', 'Skissa glasyren på fasaderna', 'Skriv ut mallarna i skala 1:1', 'Dela ritningen med laget'],
    marker: 'number',
    w: 1024,
    h: 1100,
    seed: 41,
  })
  const s = shop.hang(framed(steps, 2.2, { frame: 0x6b4226, border: 0.05 }), 'left', 2.05, 1.9)
  shop.exhibit(s, { title: 'Så ritar ni huset', caption: 'Pepparkaksarkitekten – rita, planera och skriv ut', image: dataUrl(steps) })

  if (c?.theme) {
    const art = await loadSvg('/art/verkstad.svg', 3)
    const a = shop.hang(framed(art, 2.6, { frame: 0xd4a64a }), 'right', -1.4, 2.05)
    shop.exhibit(a, { title: `Årets tema: ${c.theme.title}`, caption: c.theme.intro.join(' '), image: dataUrl(art) })
  }

  const note = drawBoard({ style: 'note', title: 'OBS!', items: ['Planera hur mycket ni vill – men bygget och pyntet sker först på plats.'], marker: 'none', w: 768, h: 768, seed: 43 })
  const n = shop.hang(sheet(note, 1.2, -0.05), 'right', 1.6, 2.1)
  shop.exhibit(n, { title: 'OBS!', caption: 'Planera hur mycket ni vill – men bygget och pyntet sker först på plats.', image: dataUrl(note) })

  // the drafting table: a blueprint, and the house you're drawing (built from your plan)
  const t = table(shop, 1.4, -1.2, 1.8, 1.1)
  const sheetTex = toTexture(drawBlueprint(7))
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.57), new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.9 }))
  paper.rotation.set(-Math.PI / 2, 0, 0.12)
  paper.position.set(-0.45, 0.842, 0.1)
  t.add(paper)
  // rebuilt from your plan whenever the drawing board closes
  const slot = keepApart(new THREE.Group())
  slot.position.set(0.42, 0.84, 0)
  slot.rotation.y = -0.6
  t.add(slot)
  setHouseSlot(slot, () => {
    const h = gingerbreadHouse()
    h.scale.setScalar(0.9)
    return h
  })
  shop.exhibit(t, { title: 'Ritbordet', caption: 'Huset ni ritar står här på bordet.', image: dataUrl(print), open: openRitbord, prompt: 'Rita ert hus vid ritbordet' })

  const npc = new Nisse({ coat: 0x1f4f8a, hat: 0xc98a2b, apron: 0xfff3dc })
  const talk: Talk = {
    name: 'Ritnissen',
    avatar: '📐',
    avatarBg: '#1f4f8a',
    greeting: () => [
      html.p('Välkommen till arkitektkontoret! Här ritas varenda pepparkakshus innan någon ens tänt ugnen.') +
        html.p(`Julbaket ${untilText(e)} – har ni ritat ert hus än?`),
    ],
    topics: [
      {
        label: '✏️ Jag vill rita vårt hus',
        pages: () => [],
        go: openRitbord,
      },
      {
        label: '📐 Vad gör ni här inne?',
        pages: () => [
          html.p('Rita huset innan ni står med degen. Bygg ihop flera byggnader, rita egna bitar med bågar och urtag, skissa glasyren och skriv ut mallarna i skala 1:1.') +
            html.p('Huset ni ritar byggs upp på ritbordet här inne. Spara ritningen med ert lagnamn så kan resten av laget öppna den.'),
        ],
      },
      ...(c?.theme ? [{ label: '🏠 Vad är årets tema?', pages: () => [html.h(c.theme!.title) + html.p(c.theme!.intro[0]), ...c.theme!.intro.slice(1).map(html.p)] }] : []),
      ...(c ? [{ label: '📜 Vad får man förbereda?', pages: () => [html.p('Ur verkstadsordningen:') + html.list(c.rules)] }] : []),
      whenWhere(e),
    ],
    bye: 'Mät två gånger, skär en gång!',
  }
  return { shop, event: e, npc, talk, emoji: '📐' }
}

export async function buildShops(): Promise<BuiltShop[]> {
  // no julbord house at all if you're not invited – just snow where it would have stood
  return Promise.all([buildVerkstad(), buildDestilleri(), ...(JULBORD ? [buildJulbord(JULBORD)] : []), buildJulafton(), buildArkitektkontor(), buildLeksaksfabriken()])
}

/** NPC spot in shop-local space: behind the counter, facing the room. */
export const NPC_SPOT = { x: -4.35, z: 1.2, yaw: Math.PI / 2 }

/* ------------------------------------------------------------------ props on the square */

export type SquareExhibit = { target: THREE.Object3D; title: string; caption?: string; image: () => string }

export async function buildSquare(scene: THREE.Scene, shops: BuiltShop[]) {
  const exhibits: SquareExhibit[] = []
  const colliders: { x: number; z: number; r: number }[] = []

  // advertising column with a poster per event
  const col = new THREE.Group()
  col.position.set(-7, 0, 18.5)
  const green = std(0x1d4a35, 0.6)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 3.4, 32), green)
  shaft.position.y = 1.7
  const capM = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), green)
  capM.position.y = 3.45
  const capSnow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), std(0xf4f8ff, 0.9))
  capSnow.position.y = 3.55
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 32), std(0xd4a64a, 0.4, 0.6))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 3.45
  col.add(shaft, capM, capSnow, ring)
  col.traverse((o) => (o.castShadow = true))
  const accents: Record<string, string> = { red: '#c8102e', green: '#1d6e48', gold: '#c99a2e' }
  const overview = drawPoster({
    accent: '#141d45',
    emoji: '🎄',
    title: `Daniels Jul ${YEAR}`,
    lines: EVENTS.map((ev) => `${ev.emoji} ${ev.name} – ${formatShortDate(ev.start)}`).concat(['', 'Gå in i butikerna och prata med nissarna!']),
  })
  const posters: { canvas: HTMLCanvasElement; title: string; caption: string }[] = [{ canvas: overview, title: `Daniels Jul ${YEAR}`, caption: 'Årets alla händelser' }]
  for (const ev of EVENTS) {
    const img = await loadImage(ev.image)
    posters.push({
      canvas: drawPoster({ accent: accents[ev.accent], emoji: ev.emoji, title: ev.name, lines: [ev.tagline, `${cap(formatDate(ev.start))} kl. ${formatTime(ev.start)}`, ev.location], photo: img }),
      title: `${ev.emoji} ${ev.name}`,
      caption: ev.description,
    })
  }
  posters.forEach((p, i) => {
    const seg = (Math.PI * 2) / posters.length
    const geo = new THREE.CylinderGeometry(1.0, 1.0, 1.95, 24, 1, true, i * seg + 0.1, seg - 0.2)
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: toTexture(p.canvas), roughness: 0.85 }))
    mesh.position.y = 1.75
    col.add(mesh)
    exhibits.push({ target: mesh, title: p.title, caption: p.caption, image: dataUrl(p.canvas) })
  })
  // turn the overview poster towards where you start
  const seg = (Math.PI * 2) / posters.length
  col.rotation.y = Math.atan2(-col.position.x, 24 - col.position.z) - seg / 2
  scene.add(col)
  colliders.push({ x: col.position.x, z: col.position.z, r: 1.3 })

  // signpost pointing at each shop
  const post = new THREE.Group()
  post.position.set(6, 0, 19.5)
  post.add(box(0.16, 3.4, 0.16, wood, 0, 1.7, 0))
  const topSnow = box(0.24, 0.1, 0.24, std(0xf4f8ff, 0.9), 0, 3.45, 0)
  post.add(topSnow)
  shops.forEach((s, i) => {
    const dx = s.shop.group.position.x - post.position.x
    const dz = s.shop.group.position.z - post.position.z
    const ang = Math.atan2(-dz, dx)
    const label = `${s.emoji ?? s.event.emoji} ${s.shop.title}`
    const front = toTexture(drawArrowSign(label, false))
    const back = toTexture(drawArrowSign(label, true))
    const board = new THREE.Group()
    const geo = new THREE.PlaneGeometry(1.8, 0.375)
    const f = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: front, alphaTest: 0.5 }))
    f.position.z = 0.015
    const b = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: back, alphaTest: 0.5 }))
    b.position.z = -0.015
    b.rotation.y = Math.PI
    board.add(f, b)
    board.position.set(Math.cos(ang) * 0.85, 2.9 - i * 0.45, -Math.sin(ang) * 0.85)
    board.rotation.y = ang
    board.castShadow = true
    post.add(board)
  })
  post.traverse((o) => (o.castShadow = true))
  scene.add(post)
  colliders.push({ x: post.position.x, z: post.position.z, r: 0.35 })

  return { exhibits, colliders, solids: [col, post] as THREE.Object3D[] }
}

