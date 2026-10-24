// Julmarknad on the square, every Advent weekend, Saturday and Sunday from ten to six (hogtider.ts):
// four stalls in an arc south-west of the julgran, striped awnings and strings of lights, a nisse behind
// each counter. Chokladhjulet – buy a number and the wheel spins; Lott-Lisa's lottery; Pepparkaks-Per,
// whose gingerbread you break in your palm and wish on; and Halm-Hulda with straw goats and baubles.
// A few nissar stroll round the stalls. The rest of the week the square is as it always is.
import * as THREE from 'three'
import { Nisse } from './npc'
import { blip } from './sfx'
import { FONT, makeCanvas, rng, toTexture } from './tex'
import { marketOpen } from './hogtider'
import { html, type Talk } from './ui'
import type { Circle } from './world'

const rand = rng(1128)
const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}
/** Round the julgran (as the lamps are placed: degrees from north, round through east), r metres out. */
const round = (deg: number, r: number) => ({ x: Math.sin((deg * Math.PI) / 180) * r, z: -Math.cos((deg * Math.PI) / 180) * r })

function stripes(a: string, b: string) {
  const [c, ctx] = makeCanvas(256, 64)
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? b : a
    ctx.fillRect(i * 32, 0, 32, 64)
  }
  // (the scalloped edge)
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 8; i++) {
    ctx.beginPath()
    ctx.arc(i * 32 + 16, 64, 12, Math.PI, 0)
    ctx.fill()
  }
  return toTexture(c)
}

function signTex(text: string) {
  const [c, ctx] = makeCanvas(512, 128)
  ctx.fillStyle = '#5a3a22'
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = '#f6c453'
  ctx.lineWidth = 6
  ctx.strokeRect(6, 6, 500, 116)
  ctx.fillStyle = '#fff3dc'
  ctx.font = `600 52px ${FONT.serif}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 68, 480)
  return toTexture(c)
}

/** A market stall: counter, back, a striped awning with lights along it, a sign on top. */
function stall(name: string, awning: [string, string]) {
  const g = new THREE.Group()
  const wood = std(0x7a5230)
  const dark = std(0x4a2e1c)
  add(g, new THREE.BoxGeometry(2.4, 1.0, 0.5), wood, 0, 0.5, 0.45)
  add(g, new THREE.BoxGeometry(2.5, 0.06, 0.62), dark, 0, 1.03, 0.45)
  add(g, new THREE.BoxGeometry(2.4, 2.4, 0.08), wood, 0, 1.2, -0.7)
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.1, 2.5, 0.1), dark, s * 1.2, 1.25, 0.7)
    add(g, new THREE.BoxGeometry(0.1, 2.5, 0.1), dark, s * 1.2, 1.25, -0.7)
    add(g, new THREE.BoxGeometry(0.06, 2.4, 1.4), wood, s * 1.22, 1.2, 0)
  }
  const tex = stripes(awning[0], awning[1])
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(2, 1)
  const roof = add(g, new THREE.PlaneGeometry(2.7, 1.9), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }), 0, 2.6, 0.1)
  roof.rotation.x = -Math.PI / 2 + 0.32
  // (snow on the back of it; at the front the stripes hang down in a scalloped valance)
  add(g, new THREE.BoxGeometry(2.6, 0.06, 0.8), std(0xf6f9ff, 0.9), 0, 2.86, -0.45).rotation.x = 0.32
  const valance = add(g, new THREE.PlaneGeometry(2.7, 0.32), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }), 0, 2.2, 0.98)
  valance.castShadow = false
  // the lights along the front edge
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ toneMapped: false }), 12)
  const m4 = new THREE.Matrix4()
  const colors = [0xffd34d, 0xff4d4d, 0x5dff9a, 0x5db8ff].map((c) => new THREE.Color(c))
  for (let i = 0; i < 12; i++) {
    const x = -1.25 + (i / 11) * 2.5
    m4.makeTranslation(x, 2.0 - Math.abs(Math.sin((i / 11) * Math.PI * 3)) * 0.08, 1.0)
    bulbs.setMatrixAt(i, m4)
    bulbs.setColorAt(i, colors[i % 4])
  }
  g.add(bulbs)
  // the name, up on top
  const sign = add(g, new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshStandardMaterial({ map: signTex(name), emissive: 0xffffff, emissiveMap: signTex(name), emissiveIntensity: 0.3 }), 0, 3.15, 0.55)
  sign.castShadow = false
  return g
}

/** Things on a counter: gingerbread hearts, polkagrisar, chocolate boxes, straw goats, baubles. */
function wares(kind: 'pepparkakor' | 'lotter' | 'choklad' | 'halm') {
  const g = new THREE.Group()
  if (kind === 'pepparkakor') {
    const ginger = std(0x9a5a2a, 0.8)
    const heart = new THREE.Shape()
    heart.moveTo(0, -0.06)
    heart.bezierCurveTo(-0.1, 0, -0.07, 0.07, 0, 0.035)
    heart.bezierCurveTo(0.07, 0.07, 0.1, 0, 0, -0.06)
    for (let i = 0; i < 14; i++) {
      const h = add(g, new THREE.ExtrudeGeometry(heart, { depth: 0.012, bevelEnabled: false }), ginger, -0.9 + (i % 7) * 0.28, 1.07 + Math.floor(i / 7) * 0.013, 0.3 + Math.floor(i / 7) * 0.2)
      h.rotation.x = -Math.PI / 2
      h.rotation.z = rand() * 0.6
    }
    const red = std(0xd0202a, 0.4)
    const white = std(0xffffff, 0.4)
    for (let i = 0; i < 6; i++) {
      const stick = new THREE.Group()
      add(stick, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), white)
      for (let k = 0; k < 3; k++) {
        const band = add(stick, new THREE.TorusGeometry(0.026, 0.006, 4, 8), red, 0, -0.1 + k * 0.1, 0)
        band.rotation.x = Math.PI / 2 + 0.4
      }
      stick.position.set(0.55 + i * 0.07, 1.22, 0.3)
      stick.rotation.z = 0.15 - i * 0.05
      g.add(stick)
    }
  } else if (kind === 'choklad') {
    for (let i = 0; i < 6; i++) add(g, new THREE.BoxGeometry(0.3, 0.06, 0.2), std([0x7a1020, 0xd4a017, 0x2a5a3a][i % 3], 0.4), -0.8 + i * 0.32, 1.09 + (i % 2) * 0.06, 0.4)
  } else if (kind === 'lotter') {
    const [c, ctx] = makeCanvas(128, 64)
    ctx.fillStyle = '#ffe9a0'
    ctx.fillRect(0, 0, 128, 64)
    ctx.fillStyle = '#c8102e'
    ctx.font = `700 30px ${FONT.sans}`
    ctx.fillText('LOTT', 26, 42)
    const t = toTexture(c)
    for (let i = 0; i < 18; i++) {
      const l = add(g, new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshStandardMaterial({ map: t }), -0.6 + (i % 9) * 0.14, 1.065, 0.25 + Math.floor(i / 9) * 0.14)
      l.rotation.x = -Math.PI / 2
      l.rotation.z = (rand() - 0.5) * 0.6
    }
    // the prizes on a shelf at the back
    for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(0.22, 0.22, 0.22), std([0xc8102e, 0x1d6e48, 0x1f4f8a, 0xf6c453, 0x7a3fa0][i], 0.5), -0.8 + i * 0.4, 1.75, -0.5)
    add(g, new THREE.BoxGeometry(2.2, 0.05, 0.3), std(0x5a3a22), 0, 1.62, -0.52)
  } else {
    const straw = std(0xd9b45a, 0.95)
    const ribbon = std(0xc8102e, 0.6)
    for (let i = 0; i < 4; i++) {
      const goat = new THREE.Group()
      add(goat, new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8).rotateZ(Math.PI / 2), straw, 0, 0.22, 0)
      for (const [x, z] of [[-0.1, -0.04], [0.1, -0.04], [-0.1, 0.04], [0.1, 0.04]]) add(goat, new THREE.CylinderGeometry(0.015, 0.015, 0.18, 5), straw, x, 0.1, z)
      add(goat, new THREE.CylinderGeometry(0.03, 0.04, 0.14, 6), straw, 0.17, 0.3, 0).rotation.z = -0.6
      add(goat, new THREE.TorusGeometry(0.05, 0.012, 4, 10), ribbon, 0.12, 0.27, 0).rotation.y = Math.PI / 2
      goat.position.set(-0.8 + i * 0.5, 1.06, 0.4)
      goat.scale.setScalar(1 + (i % 2) * 0.4)
      g.add(goat)
    }
    for (let i = 0; i < 8; i++) add(g, new THREE.SphereGeometry(0.06, 12, 8), std([0xc8102e, 0xf6c453, 0x1f4f8a, 0xe0e0e0][i % 4], 0.2, 0.6), -0.9 + i * 0.12, 1.4 + (i % 3) * 0.12, -0.6)
  }
  return g
}

/** The chocolate wheel: twelve numbers round it, a pointer at the top; it spins and slows and stops. */
function wheel() {
  const g = new THREE.Group()
  const [c, ctx] = makeCanvas(512, 512)
  const cols = ['#c8102e', '#f7f4ee', '#1d6e48']
  for (let i = 0; i < 12; i++) {
    ctx.beginPath()
    ctx.moveTo(256, 256)
    ctx.arc(256, 256, 250, ((i - 0.5) / 12) * Math.PI * 2 - Math.PI / 2, ((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2)
    ctx.fillStyle = cols[i % 3]
    ctx.fill()
    ctx.save()
    ctx.translate(256, 256)
    ctx.rotate((i / 12) * Math.PI * 2)
    ctx.fillStyle = i % 3 === 1 ? '#c8102e' : '#fff'
    ctx.font = `700 54px ${FONT.sans}`
    ctx.textAlign = 'center'
    ctx.fillText(String(i + 1), 0, -180)
    ctx.restore()
  }
  ctx.fillStyle = '#f6c453'
  ctx.beginPath()
  ctx.arc(256, 256, 30, 0, Math.PI * 2)
  ctx.fill()
  const disk = add(g, new THREE.CircleGeometry(0.72, 48), new THREE.MeshStandardMaterial({ map: toTexture(c), emissive: 0xffffff, emissiveMap: toTexture(c), emissiveIntensity: 0.25 }))
  const rim = add(g, new THREE.TorusGeometry(0.73, 0.03, 8, 48), std(0xf6c453, 0.3, 0.8))
  rim.position.z = 0.01
  const pointer = new THREE.Shape()
  pointer.moveTo(-0.08, 0.86)
  pointer.lineTo(0.08, 0.86)
  pointer.lineTo(0, 0.68)
  add(g, new THREE.ShapeGeometry(pointer), std(0x111111, 0.4), 0, 0, 0.03)
  return { group: g, disk }
}

type Ctx = { resume: () => void; say: (text: string) => void }

export type Market = ReturnType<typeof buildMarket>

export function buildMarket(scene: THREE.Scene, ctx: Ctx) {
  const group = new THREE.Group()
  scene.add(group)
  const colliders: Circle[] = []
  const talkers: { npc: Nisse; talk: Talk }[] = []
  const vendors: Nisse[] = []

  const SPOTS = [-88, -108, -128, -148].map((d) => round(d, 11.5))
  const place = (o: THREE.Object3D, i: number) => {
    const p = SPOTS[i]
    o.position.set(p.x, 0, p.z)
    o.rotation.y = Math.atan2(-p.x, -p.z)
    group.add(o)
    colliders.push({ x: p.x, z: p.z, r: 1.25 })
  }
  const vendor = (i: number, look: ConstructorParameters<typeof Nisse>[0], talk: Talk) => {
    const n = new Nisse(look)
    const p = SPOTS[i]
    // behind the counter, facing out over it
    const back = 0.15
    n.group.position.set(p.x * (1 + back / 11.5), 0, p.z * (1 + back / 11.5))
    n.setYaw(Math.atan2(-p.x, -p.z))
    group.add(n.group)
    vendors.push(n)
    talkers.push({ npc: n, talk })
  }

  /* --- Chokladhjulet --- */
  const s0 = stall('🍫 Chokladhjulet', ['#c8102e', '#f7f4ee'])
  s0.add(wares('choklad'))
  const wh = wheel()
  wh.group.position.set(0, 1.85, -0.64)
  s0.add(wh.group)
  place(s0, 0)
  let spin = { v: 0, angle: 0, mine: 0, told: true }
  const spinFor = (n: number) => {
    spin = { v: 9 + rand() * 5, angle: spin.angle, mine: n, told: false }
    ctx.resume()
  }
  const numbers = (() => {
    const pick = new Set<number>()
    while (pick.size < 3) pick.add(1 + Math.floor(rand() * 12))
    return [...pick].sort((a, b) => a - b)
  })()
  vendor(0, { coat: 0xc8102e, hat: 0xf2f2f2, trim: true, apron: 0xffffff, scale: 1.1 }, {
    name: 'Hjul-Harald',
    avatar: '🍫',
    greeting: () => [html.p('Chokladhjulet! Köp ett nummer, så snurrar jag. Stannar det på ditt nummer vinner du en hel chokladkartong!') + html.p('Ett nummer kostar en pepparkaka. Eller ett leende. Jag är inte så noga.')],
    topics: [
      ...numbers.map((n) => ({ label: `🎟️ Jag tar nummer ${n}`, pages: () => [], go: () => spinFor(n) })),
      { label: '🎲 Välj ett nummer åt mig', pages: () => [], go: () => spinFor(1 + Math.floor(Math.random() * 12)) },
    ],
    bye: 'Lycka till nästa snurr!',
  })

  /* --- Lott-Lisa --- */
  const s1 = stall('🎟️ Lotteriet', ['#1d6e48', '#f7f4ee'])
  s1.add(wares('lotter'))
  place(s1, 1)
  const PRIZES = [
    { p: 0.5, text: '🎟️ Nitlott! Men pengarna går till nissarnas julfest, så det är inte bortkastat.' },
    { p: 0.25, text: '🎟️ Vinst! En pepparkaka – med ditt namn på i kristyr.' },
    { p: 0.13, text: '🎟️ Vinst! En glittrande julgranskula.' },
    { p: 0.09, text: '🎟️ Vinst! En ask chokladpraliner.' },
    { p: 0.03, text: '🎟️ HÖGSTA VINSTEN! En gris av marsipan, stor som en katt!' },
  ]
  vendor(1, { coat: 0x1d6e48, hat: 0xc8102e, trim: true, beard: false, ears: true, scale: 1.0 }, {
    name: 'Lott-Lisa',
    avatar: '🎟️',
    greeting: () => [html.p('Lotter, lotter! Varannan lott vinner – nästan! Högsta vinsten är en gris av marsipan.')],
    topics: [
      {
        label: '🎟️ En lott, tack',
        pages: () => [],
        go: () => {
          ctx.resume()
          let r = Math.random()
          const prize = PRIZES.find((x) => (r -= x.p) < 0) ?? PRIZES[0]
          blip(880, 0.08, 'triangle', 0.05)
          setTimeout(() => ctx.say(prize.text), 700)
        },
      },
    ],
    bye: 'Välkommen åter!',
  })

  /* --- Pepparkaks-Per --- */
  const s2 = stall('🍪 Pepparkakor', ['#9a5a2a', '#f7f4ee'])
  s2.add(wares('pepparkakor'))
  place(s2, 2)
  vendor(2, { coat: 0x9a5a2a, hat: 0xc8102e, trim: true, apron: 0xffffff, longBeard: true, scale: 1.15 }, {
    name: 'Pepparkaks-Per',
    avatar: '🍪',
    greeting: () => [html.p('Nybakade pepparkakor och polkagrisar! Allt bakat i natt, i Leksaksfabrikens ugn, när ingen såg.')],
    topics: [
      {
        label: '🍪 En pepparkaka, tack',
        pages: () => [
          html.p('Varsågod! Lägg den i handflatan och tryck mitt på med ett finger. Går den i tre bitar får du önska dig något.') +
            html.p(Math.random() < 0.4 ? 'Krack! Tre bitar! Blunda och önska – men säg inte vad, då går det inte i uppfyllelse.' : 'Krack… två bitar. Ät upp dem och ta en till, det är så man gör.'),
        ],
      },
      {
        label: '🍬 En polkagris',
        pages: () => [html.p('Röd och vit och pepparmint. Polkagrisen uppfanns av en änka i Gränna för länge sedan – hon bakade dem för att försörja sig, och nu äter hela Sverige dem.')],
      },
    ],
    bye: 'Smaklig måltid!',
  })

  /* --- Halm-Hulda --- */
  const s3 = stall('🐐 Julprydnader', ['#d9b45a', '#c8102e'])
  s3.add(wares('halm'))
  place(s3, 3)
  vendor(3, { coat: 0x7a3fa0, hat: 0xd9b45a, trim: true, beard: false, ears: true, scale: 1.0 }, {
    name: 'Halm-Hulda',
    avatar: '🐐',
    greeting: () => [html.p('Halmbockar, halmstjärnor och glaskulor! Allt flätat för hand, av halm från stallets egna balar.')],
    topics: [
      {
        label: '🐐 Klarar halmbocken sig hela julen?',
        pages: () => [html.p('Den här? Garanterat hela julen. Nästan garanterat. Så länge ingen ställer den i Gävle.')],
      },
      {
        label: '✨ Varför halm?',
        pages: () => [html.p('Förr i tiden strödde man halm på golvet på julafton, och sov på det. Halmen påminner om krubban. Och den är billig.')],
      },
    ],
    bye: 'God jul, och akta bocken för ljusen!',
  })

  /* --- people strolling round the stalls --- */
  const strollers = [0x2a9d8f, 0xe76f51, 0x1f4f8a].map((coat, i) => {
    const n = new Nisse({ coat, hat: [0xc8102e, 0xf6c453, 0xf2f2f2][i], trim: true, scale: 1.05 })
    group.add(n.group)
    return { n, phase: i * 2.1, r: 8.6 + i * 0.5, x: 0, z: 0 }
  })

  let open = false
  function update(t: number, dt: number, player: THREE.Vector3, clock: number) {
    open = marketOpen(clock)
    group.visible = open
    for (const c of colliders) c.r = open ? 1.25 : -1
    for (const v of vendors) v.group.visible = open
    if (!open) return
    for (const v of vendors) v.update(t, dt, player, false)
    // the wheel: spinning, slowing, stopping – and what it stopped on
    if (spin.v > 0) {
      spin.angle += spin.v * dt
      spin.v = Math.max(0, spin.v - dt * 3.2)
      if (Math.floor(spin.angle * 12 / (Math.PI * 2)) !== Math.floor((spin.angle - spin.v * dt) * 12 / (Math.PI * 2))) blip(1500, 0.02, 'square', 0.02)
    } else if (!spin.told) {
      spin.told = true
      // (the number at the top: the wheel turns clockwise as we look at it, so it's the one that was that far round the other way)
      const k = ((-Math.round((spin.angle / (Math.PI * 2)) * 12) % 12) + 12) % 12
      const got = k + 1
      ctx.say(got === spin.mine ? `🍫 ${got}! Ditt nummer! Du vann en hel chokladkartong!` : `🍫 Hjulet stannade på ${got} – du hade ${spin.mine}. Snurra igen!`)
    }
    wh.disk.rotation.z = -spin.angle
    // the strollers, round and round the arc of stalls, stopping now and then to look
    for (const s of strollers) {
      const stopping = Math.sin(t * 0.3 + s.phase * 3) > 0.6
      if (!stopping) {
        const a = -1.55 - (Math.sin(t * 0.05 + s.phase) * 0.5 + 0.5) * 1.05
        const x = Math.sin(a) * s.r
        const z = -Math.cos(a) * s.r
        if (Math.hypot(x - s.x, z - s.z) > 0.001) s.n.group.rotation.y = Math.atan2(x - s.x, z - s.z)
        s.x = x
        s.z = z
        s.n.group.position.set(x, 0, z)
      } else {
        // (a look at the stalls, out from the tree)
        s.n.group.rotation.y = Math.atan2(s.x, s.z)
      }
      s.n.walkPose(t * 6 + s.phase, stopping ? 0 : 0.6)
    }
  }

  return {
    group,
    colliders,
    talkers,
    update,
    get open() {
      return open
    },
  }
}
