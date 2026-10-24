// The chapel in its clearing north-west of the village: whitewashed stone, a steep black shingle roof, and
// beside it a wooden bell tower (a klockstapel, as country churches in Sweden have) whose bell swings
// when it rings – every evening at six, on Sundays before the service, before julotta on Christmas
// morning and on the stroke of the new year (hogtider.ts). At julotta, seven on Christmas morning, the
// windows are bright with candles, the doors stand open, marschaller line the way and the nissar walk
// over from the square with their lanterns. The klockare by the tower knows the times.
import * as THREE from 'three'
import { Nisse } from './npc'
import { audio } from './sfx'
import { FONT, glowTexture, makeCanvas, toTexture } from './tex'
import { bellsRinging, julotta } from './hogtider'
import { Lot } from './tomtegarden'
import { html, type Talk } from './ui'
import { CHAPEL, type Circle, type Roof } from './world'

const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

/** The chapel stands in the middle of its clearing, its door towards the village. */
const AT = { x: (CHAPEL.x0 + CHAPEL.x1) / 2 + 1, z: (CHAPEL.z0 + CHAPEL.z1) / 2 }
const YAW = Math.atan2(-AT.x, -AT.z)
/** The nave: width, length, wall height, the roof's rise. */
const N = { w: 6.4, d: 10, h: 4.4, rise: 4.2 }

function shingles(base: string) {
  const [c, ctx] = makeCanvas(128, 128)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 128, 128)
  for (let row = 0; row < 8; row++) {
    const y = row * 16
    for (let x = (row % 2) * 8 - 8; x < 128; x += 16) {
      ctx.fillStyle = `rgba(0,0,0,${0.15 + ((x * 7 + row * 13) % 5) * 0.04})`
      ctx.fillRect(x, y, 15, 15)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(x, y, 15, 2)
    }
  }
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** An arched window shape (w wide, h tall, its bottom at y 0). */
function archShape(w: number, h: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h - w / 2)
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false)
  s.lineTo(-w / 2, 0)
  return s
}

/** A church bell: its profile turned round. */
function bellMesh(mat: THREE.Material) {
  const pts = [
    [0.0, 0.62],
    [0.12, 0.62],
    [0.2, 0.56],
    [0.24, 0.42],
    [0.27, 0.22],
    [0.33, 0.08],
    [0.4, 0.0],
    [0.37, -0.02],
    [0.3, 0.04],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), mat)
  ;(m.material as THREE.Material).side = THREE.DoubleSide
  return m
}

/** Two bells, a big and a small, swinging and striking: struck partials of a bell, dying away. */
class Bells {
  private next = [0, 0.9]
  constructor(private pitch = [196, 262]) {}
  strike(i: number, vol: number) {
    const a = audio()
    const t0 = a.currentTime
    const f = this.pitch[i]
    // (a bell's partials: the hum an octave down, the strike note, a minor third, a fifth, the octave…)
    for (const [ratio, amp, decay] of [
      [0.5, 0.5, 4.5],
      [1, 1, 3.2],
      [1.19, 0.55, 2.4],
      [1.5, 0.35, 1.8],
      [2, 0.45, 1.5],
      [2.52, 0.25, 1.0],
      [3.01, 0.18, 0.7],
    ]) {
      const o = a.createOscillator()
      const g = a.createGain()
      o.frequency.value = f * ratio * (1 + (Math.random() - 0.5) * 0.002)
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(vol * amp * 0.12, t0 + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
      o.connect(g).connect(a.destination)
      o.start(t0)
      o.stop(t0 + decay + 0.05)
    }
  }
  /** Ringing: each bell strikes as it swings, the big one slower. */
  update(t: number, vol: number) {
    if (vol <= 0.002) return
    for (const i of [0, 1]) {
      if (t >= this.next[i]) {
        this.strike(i, vol)
        this.next[i] = t + (i ? 1.45 : 2.1)
      }
    }
  }
}

export type Chapel = ReturnType<typeof buildChapel>

export function buildChapel(scene: THREE.Scene) {
  const lot = new Lot(AT.x, AT.z, YAW)
  const g = lot.group
  scene.add(g)
  const colliders: Circle[] = []
  const roofs: Roof[] = [lot.roof(N.w / 2 + 0.6, N.d / 2 + 0.6, N.h + N.rise)]

  /* ---------- the nave ---------- */
  const plaster = std(0xf3f0e8, 0.9)
  const shingle = new THREE.MeshStandardMaterial({ map: shingles('#2a2622'), roughness: 0.9 })
  shingle.map!.repeat.set(4, 3)
  const snow = std(0xf6f9ff, 0.9)
  const oak = std(0x4a2e1c, 0.7)
  const iron = std(0x1a1a1e, 0.5, 0.5)
  const T = 0.5
  // the walls (the front one with its doorway), blocks to bump into
  const DOOR = { w: 1.6, h: 2.6 }
  add(g, new THREE.BoxGeometry(T, N.h, N.d), plaster, -N.w / 2 + T / 2, N.h / 2, 0)
  add(g, new THREE.BoxGeometry(T, N.h, N.d), plaster, N.w / 2 - T / 2, N.h / 2, 0)
  add(g, new THREE.BoxGeometry(N.w, N.h, T), plaster, 0, N.h / 2, -N.d / 2 + T / 2)
  const side = (N.w - DOOR.w) / 2
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(side, N.h, T), plaster, s * (DOOR.w / 2 + side / 2), N.h / 2, N.d / 2 - T / 2)
  add(g, new THREE.BoxGeometry(DOOR.w, N.h - DOOR.h, T), plaster, 0, DOOR.h + (N.h - DOOR.h) / 2, N.d / 2 - T / 2)
  // (you can look in through the open doors at julotta, but not go in: it is full)
  lot.block(0, 0, N.w / 2, N.d / 2)
  // the gables, white, up under the roof
  const gable = new THREE.Shape()
  gable.moveTo(-N.w / 2, 0)
  gable.lineTo(N.w / 2, 0)
  gable.lineTo(0, N.rise)
  gable.lineTo(-N.w / 2, 0)
  for (const s of [-1, 1]) {
    const gm = add(g, new THREE.ExtrudeGeometry(gable, { depth: T, bevelEnabled: false }), plaster, 0, N.h, s > 0 ? N.d / 2 - T : -N.d / 2)
    gm.castShadow = true
  }
  // the roof: steep, black shingles, snow on it
  const slope = Math.hypot(N.w / 2 + 0.6, N.rise)
  const pitch = Math.atan2(N.rise, N.w / 2)
  for (const s of [-1, 1]) {
    const r = add(g, new THREE.BoxGeometry(slope, 0.18, N.d + 1.0), shingle, s * (N.w / 4 + 0.15), N.h + N.rise / 2 - 0.05, 0)
    r.rotation.z = -s * pitch
    const sn = add(g, new THREE.BoxGeometry(slope * 0.92, 0.12, N.d + 0.9), snow, s * (N.w / 4 + 0.12), N.h + N.rise / 2 + 0.08, 0)
    sn.rotation.z = -s * pitch
  }
  // a gilded cross on the front gable
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b24a, roughness: 0.3, metalness: 0.85 })
  add(g, new THREE.BoxGeometry(0.1, 1.1, 0.1), gold, 0, N.h + N.rise + 0.5, N.d / 2 - 0.1)
  add(g, new THREE.BoxGeometry(0.6, 0.1, 0.1), gold, 0, N.h + N.rise + 0.72, N.d / 2 - 0.1)

  // the windows: tall and arched down each side, a round one over the door – lit from within
  const glass = new THREE.MeshBasicMaterial({ color: 0x2a3550, toneMapped: false })
  const lit = new THREE.Color(0xffc472)
  const dark = new THREE.Color(0x1d2438)
  for (const s of [-1, 1])
    for (const z of [-3, 0, 3]) {
      const w = add(g, new THREE.ShapeGeometry(archShape(0.9, 2.0), 12), glass, s * (N.w / 2 + 0.01), 1.4, z)
      w.rotation.y = s * (Math.PI / 2)
      w.castShadow = false
    }
  const rose = add(g, new THREE.CircleGeometry(0.45, 24), glass, 0, N.h + 1.3, N.d / 2 + 0.01)
  rose.castShadow = false

  // the doors, on hinges: shut, or open for julotta – warm light inside
  const leaves: THREE.Group[] = []
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group()
    hinge.position.set(s * DOOR.w / 2, 0, N.d / 2 + 0.02)
    const leaf = add(hinge, new THREE.BoxGeometry(DOOR.w / 2, DOOR.h, 0.08), oak, -s * DOOR.w / 4, DOOR.h / 2, 0)
    for (const y of [0.6, 1.9]) add(leaf, new THREE.BoxGeometry(DOOR.w / 2 - 0.06, 0.06, 0.03), iron, 0, y - DOOR.h / 2, 0.05)
    add(leaf, new THREE.TorusGeometry(0.07, 0.015, 6, 12), iron, s * (DOOR.w / 4 - 0.12), 0, 0.06)
    g.add(hinge)
    leaves.push(hinge)
  }
  // inside, seen through the open doors: candlelight down to the altar
  const inside = new THREE.Group()
  const glow = add(inside, new THREE.PlaneGeometry(N.w - 1.2, N.h - 0.3), new THREE.MeshBasicMaterial({ color: 0x5a3416, toneMapped: false }), 0, (N.h - 0.3) / 2, -N.d / 2 + T + 0.05)
  glow.castShadow = false
  const candleGlow = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,130,1)', 'rgba(255,140,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false })
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Sprite(candleGlow)
    c.position.set((i % 2 ? 1 : -1) * (1.2 + (i % 3) * 0.3), 1.1 + (i % 4) * 0.25, N.d / 2 - 1.5 - Math.floor(i / 2) * 1.1)
    c.scale.setScalar(0.5)
    inside.add(c)
  }
  for (const x of [-0.4, 0.4]) {
    const c = new THREE.Sprite(candleGlow)
    c.position.set(x, 1.6, -N.d / 2 + 1)
    c.scale.setScalar(0.9)
    inside.add(c)
  }
  // the pews, nissar on them
  for (let r = 0; r < 4; r++)
    for (const s of [-1, 1]) add(inside, new THREE.BoxGeometry(2.0, 0.5, 0.45), oak, s * 1.4, 0.25, N.d / 2 - 2.6 - r * 1.5)
  inside.visible = false
  g.add(inside)

  /* ---------- the klockstapel ---------- */
  const tower = new THREE.Group()
  tower.position.set(N.w / 2 + 4.2, 0, N.d / 2 - 2)
  g.add(tower)
  const tar = new THREE.MeshStandardMaterial({ map: shingles('#3a2418'), roughness: 0.9 })
  tar.map!.repeat.set(3, 3)
  const base = add(tower, new THREE.CylinderGeometry(1.1, 1.7, 4.2, 4, 1), tar, 0, 2.1, 0)
  base.rotation.y = Math.PI / 4
  for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) add(tower, new THREE.BoxGeometry(0.14, 2.0, 0.14), oak, x, 5.2, z)
  const cap = add(tower, new THREE.CylinderGeometry(0.5, 1.25, 1.2, 4, 1), tar, 0, 6.8, 0)
  cap.rotation.y = Math.PI / 4
  const spire = add(tower, new THREE.ConeGeometry(0.42, 2.6, 8), tar, 0, 8.7, 0)
  spire.castShadow = true
  add(tower, new THREE.SphereGeometry(0.1, 10, 8), gold, 0, 10.05, 0)
  add(tower, new THREE.BoxGeometry(0.06, 0.6, 0.06), gold, 0, 10.4, 0)
  add(tower, new THREE.BoxGeometry(0.34, 0.06, 0.06), gold, 0, 10.5, 0)
  add(tower, new THREE.BoxGeometry(1.8, 0.12, 1.8), snow, 0, 4.25, 0)
  // the bell, hung from a beam: it swings when it rings
  add(tower, new THREE.BoxGeometry(1.6, 0.14, 0.16), oak, 0, 5.95, 0)
  const bellPivot = new THREE.Group()
  bellPivot.position.set(0, 5.85, 0)
  const bell = bellMesh(new THREE.MeshStandardMaterial({ color: 0x8a6a32, roughness: 0.35, metalness: 0.85 }))
  bell.position.y = -0.7
  bell.scale.setScalar(1.3)
  bellPivot.add(bell)
  tower.add(bellPivot)
  lot.block(tower.position.x, tower.position.z, 1.4, 1.4)
  const tw = lot.toWorld(tower.position.x, 0, tower.position.z)
  roofs.push({ x: tw.x, z: tw.z, cos: Math.cos(YAW), sin: Math.sin(YAW), hw: 1.4, hd: 1.4, h: 10 })

  /* ---------- the way there: marschaller, lit for julotta and in the evenings ---------- */
  const torchGlow = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,200,110,1)', 'rgba(255,120,30,0)'), blending: THREE.AdditiveBlending, depthWrite: false })
  const flames: THREE.Sprite[] = []
  const tin = std(0x3a3a3a, 0.5, 0.6)
  for (let i = 0; i < 6; i++)
    for (const s of [-1, 1]) {
      const z = N.d / 2 + 1.5 + i * 1.8
      add(g, new THREE.CylinderGeometry(0.1, 0.11, 0.17, 10), tin, s * 1.4, 0.085, z)
      const f = new THREE.Sprite(torchGlow)
      f.position.set(s * 1.4, 0.32, z)
      f.scale.setScalar(0.8)
      g.add(f)
      flames.push(f)
    }

  // a low white wall round the churchyard, on the forest's side
  const wallMat = std(0xe9e5dc, 0.95)
  const wallCap = std(0x9a958c, 0.8)
  for (const [x0, z0, x1, z1] of [[CHAPEL.x0, CHAPEL.z0, CHAPEL.x1 - 6, CHAPEL.z0], [CHAPEL.x0, CHAPEL.z0, CHAPEL.x0, CHAPEL.z1 - 3]]) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.5), wallMat)
    w.position.set((x0 + x1) / 2, 0.45, (z0 + z1) / 2)
    w.rotation.y = -Math.atan2(z1 - z0, x1 - x0)
    const c = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.6), wallCap)
    c.position.set(0, 0.5, 0)
    w.add(c)
    w.castShadow = w.receiveShadow = true
    scene.add(w)
    g.userData.walls = [...(g.userData.walls ?? []), w]
  }

  /* ---------- the klockare ---------- */
  const klockare = new Nisse({ coat: 0x2b2b33, hat: 0x2b2b33, trim: false, longBeard: true, scale: 1.1 })
  const kw = lot.toWorld(tower.position.x - 0.4, 0, tower.position.z + 2.0)
  klockare.group.position.set(kw.x, 0, kw.z)
  klockare.setYaw(YAW + 0.4)
  scene.add(klockare.group)
  colliders.push({ x: kw.x, z: kw.z, r: 0.35 })
  const talk: Talk = {
    name: 'Klockaren',
    avatar: '🔔',
    greeting: () => [html.p(julotta() ? 'God jul! Skynda dig in – julottan börjar klockan sju. Det är fullt med ljus där inne.' : 'Goddag, goddag. Det är jag som ringer i klockan här.') + html.p('Kapellet är äldre än byn, säger de. Klockan är gjuten av en gammal kanon, säger de också. Folk säger mycket.')],
    topics: [
      {
        label: '🔔 När ringer klockan?',
        pages: () => [html.list(['Varje kväll klockan sex, en liten stund – på lördagar och helgaftnar lite längre.', 'På söndagar kvart i elva, före gudstjänsten.', 'På juldagsmorgonen ringer vi till julotta – den börjar klockan sju.', 'Och på nyårsnatten ringer vi ut det gamla året, precis vid tolvslaget.'])],
      },
      {
        label: '🕯️ Vad är julotta?',
        pages: () => [html.p('Tidigt, tidigt på juldagsmorgonen, när det fortfarande är kolsvart ute, går alla hit med lyktor och facklor. Kapellet är fullt av levande ljus och vi sjunger in julen.') + html.p('Kom hit klockan sju på juldagen, så får du se.')],
      },
    ],
    bye: 'Gud bevare dig!',
  }

  /* ---------- julotta: the nissar walk over from the square with their lanterns ---------- */
  const walkers = Array.from({ length: 8 }, (_, i) => {
    const n = new Nisse({ coat: [0xc8102e, 0x1d6e48, 0x1f4f8a, 0x7a3fa0][i % 4], hat: [0xc8102e, 0xf2f2f2, 0x1d6e48][i % 3], trim: true, scale: 1.05 })
    const lamp = new THREE.Group()
    add(lamp, new THREE.BoxGeometry(0.12, 0.16, 0.12), std(0x2a2a2a, 0.5, 0.6), 0, -0.1, 0)
    const lg = new THREE.Sprite(torchGlow)
    lg.scale.setScalar(0.6)
    lg.position.y = -0.1
    lamp.add(lg)
    lamp.position.set(0, -0.55, 0.15)
    n.armR.add(lamp)
    n.group.visible = false
    scene.add(n.group)
    return { n, off: i * 0.07 + (i % 2) * 0.02, side: i % 2 ? 0.5 : -0.5 }
  })
  const doorWorld = lot.toWorld(0, 0, N.d / 2 + 1.2)
  const from = new THREE.Vector3(-8, 0, -6)

  const bells = new Bells()
  let swing = 0
  const ringingFor = { k: 0 }
  let doorOpen = 0

  function update(t: number, dt: number, player: THREE.Vector3 | null, clock: number) {
    // the bell: swinging up when it rings, settling when it stops
    const ringing = bellsRinging(clock)
    ringingFor.k += ((ringing ? 1 : 0) - ringingFor.k) * Math.min(1, dt * 0.6)
    swing = Math.sin(t * 2.2) * 0.65 * ringingFor.k
    bellPivot.rotation.x = swing
    if (player && ringing) {
      const d = Math.hypot(player.x - AT.x, player.z - AT.z)
      bells.update(t, ringingFor.k * Math.max(0, 1 - d / 160) ** 1.5)
    }
    // julotta: the light, the doors, the marschaller, the walk over
    const otta = julotta(clock)
    const d = new Date(clock)
    const evening = d.getUTCHours() >= 15 && d.getUTCHours() < 22
    const light = otta ? 1 : evening ? 0.35 : 0
    glass.color.lerpColors(dark, lit, light)
    doorOpen += ((otta ? 1 : 0) - doorOpen) * Math.min(1, dt * 1.2)
    leaves[0].rotation.y = -doorOpen * 1.6
    leaves[1].rotation.y = doorOpen * 1.6
    inside.visible = doorOpen > 0.05
    for (const [i, f] of flames.entries()) {
      f.visible = otta || evening
      f.scale.setScalar(0.75 + Math.sin(t * 11 + i * 1.7) * 0.06)
    }
    const minute = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60
    const walking = otta && minute < 7 * 60
    for (const w of walkers) {
      // from 06:35 to 06:58 they make their way over, two by two, and go in
      const u = THREE.MathUtils.clamp((minute - (6 * 60 + 35)) / 20 - w.off, 0, 1)
      const on = walking && u > 0 && u < 1
      w.n.group.visible = on
      if (!on) continue
      const p = from.clone().lerp(doorWorld, u)
      const dir = doorWorld.clone().sub(from).normalize()
      p.x += -dir.z * w.side
      p.z += dir.x * w.side
      w.n.group.position.set(p.x, 0, p.z)
      w.n.group.rotation.y = Math.atan2(dir.x, dir.z)
      w.n.walkPose(t * 7 + w.off * 20, 0.7)
      w.n.armR.rotation.x = -0.5
    }
    klockare.update(t, dt, player ?? new THREE.Vector3(1e4, 0, 1e4), false)
  }

  return {
    lot,
    colliders,
    roofs,
    update,
    /** What moves (and so mustn't be merged into still meshes): the bell, the doors, the klockare, the nissar walking to julotta. */
    moving: [g, klockare.group, ...walkers.map((w) => w.n.group)],
    talker: { npc: klockare, talk },
    /** Where the chapel is (for the sound of its bells, and the toast at julotta). */
    at: AT,
  }
}

/** The sign on the way out of the village: this way to the chapel. */
export function chapelSign(scene: THREE.Scene) {
  const [c, ctx] = makeCanvas(512, 128)
  ctx.fillStyle = '#6b4226'
  ctx.beginPath()
  ctx.moveTo(60, 14)
  ctx.lineTo(500, 14)
  ctx.lineTo(500, 114)
  ctx.lineTo(60, 114)
  ctx.lineTo(10, 64)
  ctx.fill()
  ctx.fillStyle = '#fff3dc'
  ctx.font = `600 52px ${FONT.serif}`
  ctx.textBaseline = 'middle'
  ctx.fillText('⛪ Kapellet', 120, 66)
  const sign = new THREE.Group()
  // (beside the way in, not on it)
  sign.position.set(-29.6, 0, -30.8)
  sign.rotation.y = YAW + Math.PI / 2
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), std(0x5a3a22))
  post.position.y = 1.1
  const tex = toTexture(c)
  for (const ry of [0, Math.PI]) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }))
    a.position.set(0, 1.9, ry ? -0.03 : 0.03)
    a.rotation.y = ry
    sign.add(a)
  }
  sign.add(post)
  scene.add(sign)
  return sign
}
