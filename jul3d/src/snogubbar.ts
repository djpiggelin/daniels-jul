// Snögubbsbacken, at the south-west of the square: roll a snowball (it grows as you push it along), put
// it down, roll two smaller ones and lift them up on top, then dress it – a hat, a scarf, arms – and it
// stays in the village for everyone, with your name on a little sign beside it, for the rest of the
// season (netlify/functions/snogubbar.mts). The snowman you're building is your own until it's dressed.
import * as THREE from 'three'
import { FONT, makeCanvas, rng, toTexture } from './tex'
import { html, type Talk } from './ui'
import { SNOWFIELD, type Circle } from './world'

const HATS = [
  { id: 'hatt', label: '🎩 En hög svart hatt' },
  { id: 'luva', label: '🎅 En tomteluva' },
  { id: 'mossa', label: '🧶 En stickad mössa' },
  { id: 'kastrull', label: '🍲 En gammal kastrull' },
]
const SCARVES = [
  { color: 0xc8102e, label: '❤️ Röd' },
  { color: 0x1d6e48, label: '💚 Grön' },
  { color: 0x1f4f8a, label: '💙 Blå' },
  { color: 0xf6c453, label: '💛 Gul' },
  { color: 0x7a3fa0, label: '💜 Lila' },
  { color: 0xf2f2f2, label: '🤍 Vit' },
]
const ARMS = [
  { id: 'pinnar', label: '🌿 Två pinnar' },
  { id: 'kvast', label: '🧹 En kvast' },
  { id: 'inga', label: '⛄ Inga armar' },
]
/** As many snowmen a day as each of you may put up. */
const PER_DAY = 3
/** Snowballs: how big they start, how fast they grow as they roll (per metre), how big they get. */
const BALL = { start: 0.14, grow: 0.02, max: 0.72 }

export type Snowman = { id: string; x: number; z: number; yaw: number; r: [number, number, number]; hat: string; scarf: number; arms: string; name: string }
type Dress = { hat: string; scarf: number; arms: string }

const std = (color: number, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness })
const snowMat = new THREE.MeshStandardMaterial({ color: 0xfbfcff, roughness: 0.95 })
const coal = std(0x151515, 0.6)
const carrot = std(0xf07a1a, 0.6)
const twig = std(0x5a3a22, 0.9)
const inField = (x: number, z: number, m = 0) => x > SNOWFIELD.x0 + m && x < SNOWFIELD.x1 - m && z > SNOWFIELD.z0 + m && z < SNOWFIELD.z1 - m
const clampField = (x: number, z: number, m: number) => ({ x: THREE.MathUtils.clamp(x, SNOWFIELD.x0 + m, SNOWFIELD.x1 - m), z: THREE.MathUtils.clamp(z, SNOWFIELD.z0 + m, SNOWFIELD.z1 - m) })
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })

/** A snowball, a little lumpy, as packed snow is. */
function snowball(r: number, seed: number) {
  const geo = new THREE.SphereGeometry(r, 22, 16)
  const rand = rng(seed)
  const p = geo.attributes.position
  const v = new THREE.Vector3()
  const bumps = [0, 1, 2].map(() => new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize())
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = v.clone().normalize()
    const k = 1 + bumps.reduce((s, b, j) => s + Math.max(0, n.dot(b)) ** 3 * (0.05 - j * 0.012), 0) + (rand() - 0.5) * 0.015
    p.setXYZ(i, v.x * k, v.y * k * 0.94, v.z * k)
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, snowMat)
  m.castShadow = m.receiveShadow = true
  return m
}

/** Where each ball of a stack sits (its middle, metres up). */
function heights(r: number[]) {
  const y = [r[0] * 0.88]
  for (let i = 1; i < r.length; i++) y.push(y[i - 1] + r[i - 1] * 0.78 + r[i] * 0.8)
  return y
}

function hat(kind: string, scarf: number, r: number) {
  const g = new THREE.Group()
  if (kind === 'hatt') {
    const black = std(0x161616, 0.5)
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.03, 20), black)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.62, r * 1.1, 20), black)
    top.position.y = r * 0.55
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.63, r * 0.63, r * 0.18, 20), std(0xc8102e, 0.5))
    band.position.y = r * 0.12
    g.add(brim, top, band)
  } else if (kind === 'luva') {
    const red = std(0xc8102e, 0.8)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.75, r * 1.6, 16), red)
    cone.position.set(0, r * 0.75, -r * 0.1)
    cone.rotation.x = -0.35
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, r * 0.13, 8, 20), std(0xffffff, 0.9))
    rim.rotation.x = Math.PI / 2
    const pom = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 10, 8), std(0xffffff, 0.9))
    pom.position.set(0, r * 1.4, -r * 0.6)
    g.add(cone, rim, pom)
  } else if (kind === 'mossa') {
    const wool = std(SCARVES[scarf].color, 0.95)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), wool)
    const fold = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, r * 0.25, 18), wool)
    fold.position.y = r * 0.05
    const pom = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 10, 8), std(0xffffff, 0.95))
    pom.position.y = r * 0.82
    g.add(cap, fold, pom)
  } else {
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.35, metalness: 0.8 })
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.68, r * 0.75, 18), steel)
    pot.position.y = r * 0.3
    const handle = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, 0.03, 0.05), steel)
    handle.position.set(r * 1.1, r * 0.55, 0)
    g.add(pot, handle)
    g.rotation.z = 0.15
  }
  g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  return g
}

/** Everything that makes a stack of three snowballs a snowman. */
function dressUp(group: THREE.Group, r: number[], d: Dress) {
  const y = heights(r)
  const [, r1, r2] = r
  // the face: coal eyes, a carrot nose, a smile of coal
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r2 * 0.09, 8, 6), coal)
    eye.position.set(s * r2 * 0.32, y[2] + r2 * 0.22, r2 * 0.86)
    group.add(eye)
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(r2 * 0.1, r2 * 0.65, 10).rotateX(Math.PI / 2), carrot)
  nose.position.set(0, y[2], r2 * 1.12)
  group.add(nose)
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25
    const c = new THREE.Mesh(new THREE.SphereGeometry(r2 * 0.055, 6, 5), coal)
    c.position.set(Math.sin(a) * r2 * 0.5, y[2] - r2 * 0.35 - Math.cos(a * 2) * r2 * 0.08, r2 * 0.86)
    group.add(c)
  }
  // coal buttons down the middle
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r1 * 0.08, 8, 6), coal)
    b.position.set(0, y[1] + r1 * (0.4 - i * 0.38), r1 * 0.95 - Math.abs(i - 1) * r1 * 0.06)
    group.add(b)
  }
  // the scarf round the neck, one end hanging down
  const wool = std(SCARVES[d.scarf].color, 0.95)
  const neck = y[1] + r1 * 0.72
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(r2 * 0.88, r2 * 0.14, 8, 24), wool)
  scarf.rotation.x = Math.PI / 2
  scarf.position.y = neck
  const end = new THREE.Mesh(new THREE.BoxGeometry(r2 * 0.32, r2 * 1.1, r2 * 0.1), wool)
  end.position.set(r2 * 0.45, neck - r2 * 0.5, r2 * 0.82)
  end.rotation.z = 0.15
  group.add(scarf, end)
  // the hat
  const h = hat(d.hat, d.scarf, r2)
  h.position.y = y[2] + r2 * 0.78
  group.add(h)
  // arms: two sticks out to the sides, or a broom held in one
  if (d.arms !== 'inga') {
    for (const s of d.arms === 'kvast' ? [1] : [-1, 1]) {
      const from = new THREE.Vector3(s * r1 * 0.85, y[1] + r1 * 0.2, 0)
      const to = from.clone().add(new THREE.Vector3(s * r1 * 1.6, r1 * (d.arms === 'kvast' ? 0.2 : 0.9), 0.1))
      const len = from.distanceTo(to)
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, len, 5), twig)
      arm.position.copy(from).lerp(to, 0.5)
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
      group.add(arm)
      if (d.arms === 'pinnar')
        for (const k of [0.6, 0.85]) {
          const t = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, len * 0.3, 4), twig)
          t.position.copy(from).lerp(to, k).add(new THREE.Vector3(0, len * 0.1, 0))
          t.rotation.z = -s * 0.2
          group.add(t)
        }
      else {
        // the broom: a long handle up through the hand, the bristles at the bottom
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), std(0xb08a5a, 0.7))
        handle.position.set(to.x, y[1] - 0.05, to.z + 0.05)
        const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 10), std(0xc9a24a, 0.95))
        bristles.position.set(to.x, y[1] - 0.92, to.z + 0.05)
        bristles.rotation.x = Math.PI
        group.add(handle, bristles)
      }
    }
  }
  group.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
}

/** The little sign beside a finished snowman: who built it. */
function nameSign(name: string) {
  const [c, ctx] = makeCanvas(256, 96)
  ctx.fillStyle = '#7a5230'
  ctx.fillRect(0, 0, 256, 96)
  ctx.fillStyle = '#fff3dc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 34px ${FONT.serif}`
  ctx.fillText(name.length > 12 ? name.slice(0, 12) + '…' : name, 128, 50, 236)
  const g = new THREE.Group()
  const tex = toTexture(c)
  for (const ry of [0, Math.PI]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshStandardMaterial({ map: tex }))
    plate.position.set(0, 0.62, ry ? -0.016 : 0.016)
    plate.rotation.y = ry
    g.add(plate)
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.21, 0.03), std(0x7a5230))
  board.position.y = 0.62
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.04), std(0x5a3a22))
  post.position.y = 0.3
  g.add(board, post)
  return g
}

/** A finished snowman. */
function buildSnowman(m: Pick<Snowman, 'r' | 'hat' | 'scarf' | 'arms'> & { name?: string; seed: number }) {
  const g = new THREE.Group()
  const y = heights(m.r)
  m.r.forEach((r, i) => {
    const b = snowball(r, m.seed + i)
    b.position.y = y[i]
    b.rotation.y = i * 1.3
    g.add(b)
  })
  dressUp(g, m.r, m)
  if (m.name) {
    const sign = nameSign(m.name)
    sign.position.set(m.r[0] + 0.35, 0, m.r[0] * 0.3)
    sign.rotation.y = -0.3
    g.add(sign)
  }
  return g
}

/** What the module needs from the village. */
type Village = {
  addCollider: (c: Circle) => void
  addSolid: (o: THREE.Object3D) => void
  ask: (talk: Talk) => void
  done: () => void
  say: (text: string) => void
  name: () => string
  /** When a snowman you've built goes up (for the julstämning). */
  built: () => void
}

export type Snowmen = ReturnType<typeof buildSnowmen>

export function buildSnowmen(scene: THREE.Scene, v: Village) {
  const group = new THREE.Group()
  scene.add(group)

  // the sign at the corner of the field
  {
    const [c, ctx] = makeCanvas(512, 200)
    ctx.fillStyle = '#6b4226'
    ctx.fillRect(0, 0, 512, 200)
    ctx.fillStyle = '#fff3dc'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 56px ${FONT.serif}`
    ctx.fillText('⛄ Snögubbsbacken', 256, 72)
    ctx.font = `400 28px ${FONT.sans}`
    ctx.fillText('Rulla en snöboll – bygg en snögubbe!', 256, 146)
    const tex = toTexture(c)
    const sign = new THREE.Group()
    sign.position.set(SNOWFIELD.x1 - 0.2, 0, SNOWFIELD.z0 - 0.2)
    sign.rotation.y = -0.6
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, side: THREE.DoubleSide }))
    plate.position.y = 1.7
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.1), std(0x5a3a22))
    post.position.set(0, 1.0, -0.06)
    sign.add(plate, post)
    sign.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
    group.add(sign)
    v.addCollider({ x: sign.position.x, z: sign.position.z, r: 0.15 })
    v.addSolid(sign)
  }

  /* --- everyone's snowmen, from the server --- */
  const standing = new Map<string, { group: THREE.Group; circle: Circle; m: Snowman }>()
  const show = (list: Snowman[]) => {
    const ids = new Set(list.map((m) => m.id))
    for (const [id, s] of standing)
      if (!ids.has(id)) {
        group.remove(s.group)
        s.circle.r = -1
        standing.delete(id)
      }
    for (const m of list) {
      if (standing.has(m.id)) continue
      const g = buildSnowman({ ...m, seed: [...m.id].reduce((a, c) => a + c.charCodeAt(0), 0) })
      g.position.set(m.x, 0, m.z)
      g.rotation.y = m.yaw
      group.add(g)
      const circle = { x: m.x, z: m.z, r: m.r[0] * 0.9 }
      v.addCollider(circle)
      v.addSolid(g)
      g.userData.onSnowball = () => {}
      standing.set(m.id, { group: g, circle, m })
    }
  }
  const load = async () => {
    try {
      const r = await fetch('/api/snogubbar')
      if (!r.ok) throw r.status
      show(await r.json())
    } catch {
      // (local development: the ones built in this browser)
      try {
        show(JSON.parse(localStorage.getItem('dev-snogubbar') ?? '[]'))
      } catch {
        /* none */
      }
    }
  }
  load()
  setInterval(load, 90_000)

  /* --- yours, being built --- */
  let rolling: { mesh: THREE.Mesh; r: number; x: number; z: number; seed: number } | null = null
  let pile: { group: THREE.Group; x: number; z: number; r: number[]; circle: Circle } | null = null
  const was = new THREE.Vector3()
  let seed = Math.floor(Math.random() * 1e6)

  const newBall = (r: number) => {
    const m = snowball(1, ++seed)
    m.scale.setScalar(r)
    group.add(m)
    return m
  }
  const dropPile = () => {
    if (!pile) return
    group.remove(pile.group)
    pile.circle.r = -1
    pile = null
  }
  /** Near your snowman, in reach of it. */
  const atPile = (x: number, z: number, reach: number) => !!pile && Math.hypot(pile.x - x, pile.z - z) < pile.r[0] + reach

  function prompt(pos: THREE.Vector3, fwd: THREE.Vector3): string | null {
    if (rolling) {
      if (pile && pile.r.length < 3 && atPile(rolling.x, rolling.z, rolling.r + 0.5)) return rolling.r <= pile.r[pile.r.length - 1] - 0.02 ? 'Lyft upp snöbollen' : 'Lägg ner snöbollen (för stor att lyfta upp)'
      return 'Lägg ner snöbollen'
    }
    if (pile && pile.r.length === 3 && atPile(pos.x, pos.z, 1.6)) {
      const dx = pile.x - pos.x
      const dz = pile.z - pos.z
      if ((dx * fwd.x + dz * fwd.z) / Math.hypot(dx, dz) > 0.4) return 'Klä snögubben'
    }
    if (inField(pos.x, pos.z)) return 'Rulla en snöboll'
    return null
  }

  function act(pos: THREE.Vector3, fwd: THREE.Vector3) {
    if (rolling) {
      const b = rolling
      rolling = null
      // up on top of your snowman, if it fits…
      if (pile && pile.r.length < 3 && atPile(b.x, b.z, b.r + 0.5) && b.r <= pile.r[pile.r.length - 1] - 0.02) {
        group.remove(b.mesh)
        const m = snowball(b.r, b.seed)
        m.position.y = heights([...pile.r, b.r])[pile.r.length]
        m.rotation.y = pile.r.length
        pile.group.add(m)
        pile.r.push(b.r)
        v.say(pile.r.length === 3 ? '⛄ Där! Nu behöver den bara kläder. Gå fram till den och klä den.' : '⛄ Upp med den! En till, lite mindre.')
        return
      }
      // …or down on the snow: the start of a snowman (a half-built one before melts away)
      dropPile()
      const at = clampField(b.x, b.z, b.r)
      group.remove(b.mesh)
      const g = new THREE.Group()
      g.position.set(at.x, 0, at.z)
      const m = snowball(b.r, b.seed)
      m.position.y = heights([b.r])[0]
      g.add(m)
      group.add(g)
      const circle = { x: at.x, z: at.z, r: b.r * 0.9 }
      v.addCollider(circle)
      pile = { group: g, x: at.x, z: at.z, r: [b.r], circle }
      v.say(b.r < 0.35 ? '⛄ Lite liten för att stå längst ner – men det går. Rulla nästa, mindre!' : '⛄ En bra grund! Rulla en mindre och lyft upp den.')
      return
    }
    if (pile && pile.r.length === 3 && atPile(pos.x, pos.z, 1.6)) return dress(pos)
    if (inField(pos.x, pos.z)) {
      rolling = { mesh: newBall(BALL.start), r: BALL.start, x: pos.x + fwd.x, z: pos.z + fwd.z, seed }
      was.copy(pos)
      v.say('⛄ Gå runt med den – den växer ju längre du rullar den.')
    }
  }

  /** Dressing it: a hat, a scarf, arms – each its own question – then up it goes. */
  function dress(pos: THREE.Vector3) {
    const p = pile!
    const tally = (() => {
      try {
        return JSON.parse(localStorage.getItem(`snogubbar-${today()}`) ?? '0') as number
      } catch {
        return 0
      }
    })()
    if (tally >= PER_DAY) {
      v.say(`⛄ Du har redan byggt ${PER_DAY} snögubbar i dag – ge plats åt de andra! Kom tillbaka i morgon.`)
      return
    }
    const d: Dress = { hat: 'hatt', scarf: 0, arms: 'pinnar' }
    const preview = () => {
      // (the clothes, tried on as you choose)
      for (const c of [...p.group.children].slice(3)) p.group.remove(c)
      dressUp(p.group, p.r, d)
    }
    p.group.rotation.y = Math.atan2(pos.x - p.x, pos.z - p.z)
    const step = (title: string, text: string, options: { label: string; pick: () => void }[], next: () => void): Talk => ({
      name: 'Din snögubbe',
      avatar: '⛄',
      greeting: () => [html.h(title) + html.p(text)],
      topics: options.map((o) => ({
        label: o.label,
        pages: () => [],
        go: () => {
          o.pick()
          preview()
          next()
        },
      })),
      bye: 'Den står kvar och väntar på dig.',
    })
    const finish = (): Talk => ({
      name: 'Din snögubbe',
      avatar: '⛄',
      greeting: () => [html.p('Så fin den blev! Ska den få stå kvar i byn, så att alla som kommer hit ser den? Ditt namn står på en liten skylt bredvid.')],
      topics: [
        { label: '⛄ Ja, låt den stå kvar i byn!', pages: () => [], go: () => save() },
        { label: '🔁 Byt kläder', pages: () => [], go: () => v.ask(hats()) },
      ],
      bye: 'Den står kvar och väntar på dig.',
    })
    const arms = () => step('Armar?', 'Två pinnar att vinka med, eller en kvast att hålla i?', ARMS.map((a) => ({ label: a.label, pick: () => (d.arms = a.id) })), () => v.ask(finish()))
    const scarves = () => step('Vilken halsduk?', 'Det blåser kallt här ute.', SCARVES.map((s, i) => ({ label: s.label, pick: () => (d.scarf = i) })), () => v.ask(arms()))
    const hats = () => step('Vad ska den ha på huvudet?', 'Välj något fint – den ska stå här hela julen.', HATS.map((h) => ({ label: h.label, pick: () => (d.hat = h.id) })), () => v.ask(scarves()))
    const save = async () => {
      const man = { x: p.x, z: p.z, yaw: p.group.rotation.y, r: p.r as [number, number, number], hat: d.hat, scarf: d.scarf, arms: d.arms, name: v.name() || 'En nisse' }
      let list: Snowman[] | null = null
      let refused = ''
      try {
        const r = await fetch('/api/snogubbar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(man) })
        if (r.status === 409 || r.status === 400) refused = ((await r.json()) as { error?: string }).error ?? 'Det gick inte'
        else if (!r.ok) throw r.status
        else list = await r.json()
      } catch {
        // (local development: kept in this browser)
        try {
          const l = JSON.parse(localStorage.getItem('dev-snogubbar') ?? '[]') as Snowman[]
          list = [...l, { ...man, id: String(Date.now()) }]
          localStorage.setItem('dev-snogubbar', JSON.stringify(list))
        } catch {
          list = null
        }
      }
      v.done()
      if (refused || !list) return v.say(`⛄ ${refused || 'Snögubben kunde inte sparas just nu – försök igen om en stund.'}`)
      try {
        localStorage.setItem(`snogubbar-${today()}`, JSON.stringify(tally + 1))
      } catch {
        /* fine */
      }
      dropPile()
      show(list)
      v.built()
      v.say('⛄ Där står den nu – i Snögubbsbacken, för alla som kommer hit i jul!')
    }
    preview()
    v.ask(hats())
  }

  /** `pos`: where you are (null up in the sleigh, or on the pulka); `yaw`: which way you face. */
  function update(pos: THREE.Vector3 | null, yaw: number) {
    if (!rolling || !pos) return
    // the ball in front of you, rolling as you push it – bigger and bigger (only on the field's snow)
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const moved = Math.hypot(pos.x - was.x, pos.z - was.z)
    was.copy(pos)
    const b = rolling
    // (a jump of metres in one go is being taken somewhere, not rolling)
    if (inField(pos.x, pos.z, -1) && moved < 1) b.r = Math.min(BALL.max, b.r + moved * BALL.grow)
    const nx = pos.x + fx * (0.55 + b.r)
    const nz = pos.z + fz * (0.55 + b.r)
    const dx = nx - b.x
    const dz = nz - b.z
    const d = Math.hypot(dx, dz)
    if (d > 0.0001) b.mesh.rotateOnWorldAxis(new THREE.Vector3(dz / d, 0, -dx / d), d / b.r)
    b.x = nx
    b.z = nz
    b.mesh.scale.setScalar(b.r)
    b.mesh.position.set(b.x, b.r * 0.92, b.z)
    // too far from the field: it stays behind
    if (!inField(pos.x, pos.z, -4)) {
      group.remove(b.mesh)
      rolling = null
      v.say('⛄ Snöbollen blev kvar – snögubbar byggs i Snögubbsbacken.')
    }
  }

  return {
    group,
    prompt,
    act,
    update,
    get rolling() {
      return rolling ? { x: rolling.x, z: rolling.z, r: rolling.r } : null
    },
    /** The snowman you're building: where, and its snowballs so far. */
    get building() {
      return pile ? { x: pile.x, z: pile.z, r: [...pile.r] } : null
    },
  }
}
