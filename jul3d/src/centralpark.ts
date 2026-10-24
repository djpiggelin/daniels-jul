// Julglädje i Central Park – from the 23rd of December. Tomten is off early, handing out presents on the
// quiet in New York, and you can go with him. But the Christmas spirit over the city is so low that the
// sleigh can't stay up: it comes down in the snow in Central Park. Fill the park with song to fill the
// spirit back up – walk up to people and get them singing (they gather round the sleigh) – while the
// Park Rangers, who don't hold with singing in the park after dark, try to catch you.
//
// Its own little world, like the mine: a snowy park (paths, lamps, bare trees, the frozen pond and the
// fountain with its angel), the city lit up all round it, and the crashed sleigh in the middle.
// In metres; the park runs ±PARK.x by ±PARK.z, north is -z.
import * as THREE from 'three'
import { SingAlong, blip, noise, thud } from './sfx'
import { Sleigh, std } from './sleigh'
import { glowTexture, makeCanvas, rng, toTexture } from './tex'

const PARK = { x: 62, z: 38 }
/** The path round the park: an oval. */
const LOOP = { rx: 44, rz: 25 }
const FOUNTAIN = { x: 0, z: -11, r: 4.4 }
const POND = { x: -33, z: 11, rx: 11, rz: 6.5 }
/** Where the sleigh came down. */
const CRASH = new THREE.Vector3(8, 0, 9)
const START_CHEER = 12
const PEOPLE = 24
const LIVES = 3
const BEST_KEY = 'jul3d.best.centralpark'
/** What they sing: Jingle Bells, just the voices of a 1949 choir (see public/sounds/README.md). */
const SONG = '/sounds/park/jingle-bells.mp3'

type Circle = { x: number; z: number; r: number }

/* ---------- people ---------- */

const SKIN = [0xf1c7a5, 0xe0ac86, 0xc68a62, 0x8d5a3b, 0x6b4128, 0xf6d5bf]
const COATS = [0x2b2f3a, 0x7a1d24, 0x1f4e5f, 0x5b4a3a, 0x3a3a46, 0x8a6a3a, 0x2f5a3a, 0x6b2d5c, 0xb8862e, 0x24324f]
const HATS = [0xc8102e, 0xe7e2d6, 0x1d6e48, 0x2b5fa8, 0xf6c453, 0x3a3a46]

/** A New Yorker (or a ranger), built like the nissar but taller and without the pointed hat. */
class Person {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly head = new THREE.Group()
  readonly armR = new THREE.Group()
  readonly armL = new THREE.Group()
  private legs: THREE.Group[] = []

  constructor(o: { coat: number; skin: number; pants?: number; hat?: number | 'ranger'; scarf?: number; height?: number }) {
    const coat = std(o.coat, 0.85)
    const skin = std(o.skin, 0.6)
    const pants = std(o.pants ?? 0x23232b, 0.8)
    for (const x of [-0.11, 0.11]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.8, 0)
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.76, 8), pants)
      leg.position.y = -0.38
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.26), std(0x1a1410, 0.5))
      shoe.position.set(0, -0.76, 0.04)
      hip.add(leg, shoe)
      this.legs.push(hip)
      this.body.add(hip)
    }
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.78, 12), coat)
    torso.position.y = 1.18
    this.body.add(torso)
    if (o.scarf !== undefined) {
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 14), std(o.scarf, 0.9))
      scarf.rotation.x = Math.PI / 2
      scarf.position.y = 1.56
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.04), std(o.scarf, 0.9))
      end.position.set(0.07, 1.42, 0.17)
      this.body.add(scarf, end)
    }
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.25, 1.5, 0)
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.62, 8), coat)
      sleeve.position.y = -0.31
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin)
      hand.position.y = -0.64
      g.add(sleeve, hand)
      g.rotation.z = side * 0.12
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    this.head.position.y = 1.78
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), skin)
    face.scale.y = 1.12
    this.head.add(face)
    for (const x of [-0.055, 0.055]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), std(0x111111, 0.3))
      eye.position.set(x, 0.03, 0.145)
      this.head.add(eye)
    }
    if (o.hat === 'ranger') {
      // the campaign hat: a wide flat brim and a pinched crown
      const felt = std(0x7a5a32, 0.8)
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 20), felt)
      brim.position.y = 0.13
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 4), felt)
      crown.position.y = 0.24
      crown.rotation.y = Math.PI / 4
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 12), std(0x3a2a1a, 0.6))
      band.position.y = 0.155
      this.head.add(brim, crown, band)
      // and a badge on the chest
      const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 6), new THREE.MeshStandardMaterial({ color: 0xf6c453, metalness: 0.8, roughness: 0.3 }))
      badge.rotation.x = Math.PI / 2
      badge.position.set(-0.1, 1.38, 0.235)
      this.body.add(badge)
    } else if (o.hat !== undefined) {
      // a knitted beanie with a pompom
      const knit = std(o.hat, 0.95)
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), knit)
      cap.position.y = 0.03
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0xfbf8f2, 0.9))
      pom.position.y = 0.2
      this.head.add(cap, pom)
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std([0x2a1a10, 0x6b4a2a, 0xd8b06a, 0x1a1a1a][Math.floor(o.skin) % 4], 0.9))
      hair.position.set(0, 0.02, -0.02)
      this.head.add(hair)
    }
    this.body.add(this.head)
    this.group.add(this.body)
    this.group.scale.setScalar(o.height ?? 1)
    this.group.traverse((m) => ((m as THREE.Mesh).isMesh && (m.castShadow = true)))
  }

  walk(phase: number, amt: number) {
    const s = Math.sin(phase) * amt
    this.legs[0].rotation.x = s * 0.7
    this.legs[1].rotation.x = -s * 0.7
    this.armL.rotation.x = -s * 0.6
    this.armR.rotation.x = s * 0.6
    this.body.position.y = Math.abs(Math.cos(phase)) * 0.04 * amt
  }
}

/** Walk `from` towards `to` at `speed`; true once there. */
function stepTo(from: THREE.Vector3, to: THREE.Vector3, speed: number, dt: number) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const d = Math.hypot(dx, dz)
  if (d <= speed * dt) {
    from.x = to.x
    from.z = to.z
    return true
  }
  from.x += (dx / d) * speed * dt
  from.z += (dz / d) * speed * dt
  return false
}
const yawTo = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(to.x - from.x, to.z - from.z)
const turn = (g: THREE.Object3D, want: number, k: number) => {
  const d = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y))
  g.rotation.y += d * Math.min(1, k)
}

/** A spot somewhere on the paths. */
function onPath(r: () => number) {
  const k = r()
  if (k < 0.65) {
    const a = r() * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * LOOP.rx, 0, Math.sin(a) * LOOP.rz)
  }
  // the paths across the middle: east–west, and from the fountain down to the south
  if (k < 0.85) return new THREE.Vector3((r() - 0.5) * 2 * LOOP.rx, 0, 0.5)
  return new THREE.Vector3(0.5, 0, FOUNTAIN.z + FOUNTAIN.r + 1 + r() * (LOOP.rz - FOUNTAIN.z - FOUNTAIN.r - 1))
}

/* ---------- what they say ---------- */

const JOIN_LINES = [
  'Sjunga? Här? Nu? … Okej, en vers då!',
  'Jag kan bara refrängen. Den kör vi!',
  'Mamma sjöng den här när jag var liten …',
  'Äntligen någon som fattar vad december handlar om!',
  'Jag är egentligen på väg till jobbet. Äh, jobbet kan vänta.',
  'Ho ho – är det där Tomtens släde?! Klart jag sjunger!',
  'Jag sjunger falskt. Du har blivit varnad.',
  'I hela mitt liv har jag väntat på att någon ska fråga.',
  'Okej, men bara om vi tar den i stämmor.',
  'Det här ska jag berätta för alla på tunnelbanan.',
]
const RANGER_LINES = ['🚨 "Hey! No singing in the park after dark!"', '🚨 "Freeze! Park Rangers!"', '🚨 "You there! Stop right there!"', '🚨 "That\'s a violation of park regulations!"']
const CAUGHT_LINES = [
  '👮 "Sir, singing requires a permit." Rangern följer dig tillbaka till släden.',
  '👮 "Back to your… reindeer?" Rangern skakar på huvudet och leder dig tillbaka.',
  '👮 "I\'ll let you off with a warning. This time." Tillbaka till släden.',
]

/* ---------- the park ---------- */

export type ParkResult = { won: boolean; seconds: number; caught: number; best: boolean }

export class CentralPark {
  readonly scene = new THREE.Scene()
  /** The crash, the play, the lift-off at the end. */
  state: 'intro' | 'play' | 'caught' | 'liftoff' | 'over' = 'over'
  /** Called once you've your feet in the snow (the intro is over): put the player at `at`, facing `yaw`. */
  onPlay: (at: THREE.Vector3, yaw: number) => void = () => {}
  /** Back to the village. */
  onDone: (r: ParkResult) => void = () => {}
  /** Put back by the sleigh (caught). */
  onCaught: (at: THREE.Vector3, yaw: number) => void = () => {}
  /** A line shown as a toast. */
  say: (text: string) => void = () => {}

  private sleigh: Sleigh
  private colliders: Circle[] = []
  private people: { p: Person; pos: THREE.Vector3; to: THREE.Vector3; wait: number; singing: boolean; slot: THREE.Vector3 | null; phase: number; speed: number }[] = []
  private rangers: { p: Person; pos: THREE.Vector3; beam: THREE.Mesh; route: THREE.Vector3[]; leg: number; mode: 'patrol' | 'chase' | 'search'; seen: THREE.Vector3; lost: number; shout: number; active: boolean }[] = []
  private notes: { s: THREE.Sprite; age: number; vx: number }[] = []
  private noteTex: THREE.Texture[] = []
  private flakes: THREE.Points
  private sleighGlow: THREE.Sprite
  /** The park singing (a real choir, louder and fuller with every voice that joins). */
  private choir = new SingAlong(SONG, PEOPLE)
  private cheer = START_CHEER
  private lives = LIVES
  private caught = 0
  private time = 0
  private stateT = 0
  private nextNote = 0
  private burst: { p: THREE.Points; v: Float32Array; age: number } | null = null
  private hud: { root: HTMLElement; quit: HTMLElement; bar: HTMLElement; pct: HTMLElement; singers: HTMLElement; lives: HTMLElement; alert: HTMLElement; msg: HTMLElement }

  constructor() {
    const s = this.scene
    s.background = new THREE.Color(0x0c1430)
    s.fog = new THREE.FogExp2(0x18223f, 0.0085)
    s.add(new THREE.HemisphereLight(0xa8b8ff, 0x302838, 0.75))
    const moon = new THREE.DirectionalLight(0xc8d4ff, 0.7)
    moon.position.set(-30, 60, 20)
    s.add(moon)
    const r = rng(1223)

    /* the ground, the paths, the low stone wall round it all */
    const snow = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std(0xe6ecf6, 1))
    snow.rotation.x = -Math.PI / 2
    s.add(snow)
    const pathMat = std(0xb9c0cf, 0.95)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.955, 1.045, 128), pathMat)
    ring.rotation.x = -Math.PI / 2
    ring.scale.set(LOOP.rx, LOOP.rz, 1)
    ring.position.y = 0.01
    s.add(ring)
    const strip = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pathMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(x, 0.012, z)
      s.add(m)
    }
    strip(0, 0.5, LOOP.rx * 2, 3)
    strip(0.5, (FOUNTAIN.z + LOOP.rz) / 2, 3, LOOP.rz - FOUNTAIN.z)
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(8, 40), pathMat)
    plaza.rotation.x = -Math.PI / 2
    plaza.position.set(FOUNTAIN.x, 0.013, FOUNTAIN.z)
    s.add(plaza)
    const stone = std(0x8d8a84, 0.9)
    for (const [x, z, w, d] of [[0, -PARK.z - 1, PARK.x * 2 + 2, 0.6], [0, PARK.z + 1, PARK.x * 2 + 2, 0.6], [-PARK.x - 1, 0, 0.6, PARK.z * 2 + 2], [PARK.x + 1, 0, 0.6, PARK.z * 2 + 2]] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), stone)
      wall.position.set(x, 0.5, z)
      s.add(wall)
    }

    /* the frozen pond (skaters on it later) */
    const ice = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x9cc8e8, roughness: 0.15, metalness: 0.2 }))
    ice.rotation.x = -Math.PI / 2
    ice.scale.set(POND.rx, POND.rz, 1)
    ice.position.set(POND.x, 0.02, POND.z)
    s.add(ice)

    /* the fountain and its angel */
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(FOUNTAIN.r, FOUNTAIN.r + 0.2, 0.7, 32, 1, true), stone)
    basin.position.set(FOUNTAIN.x, 0.35, FOUNTAIN.z)
    const water = new THREE.Mesh(new THREE.CircleGeometry(FOUNTAIN.r - 0.05, 32), new THREE.MeshStandardMaterial({ color: 0xa8d0ec, roughness: 0.1 }))
    water.rotation.x = -Math.PI / 2
    water.position.set(FOUNTAIN.x, 0.55, FOUNTAIN.z)
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3.2, 12), stone)
    column.position.set(FOUNTAIN.x, 1.6, FOUNTAIN.z)
    const bronze = std(0x3f5a4a, 0.5)
    const angel = new THREE.Group()
    angel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 1.5, 10), bronze).translateY(0.75))
    angel.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bronze).translateY(1.7))
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), bronze)
      wing.position.set(side * 0.5, 1.4, -0.15)
      wing.rotation.z = side * 0.5
      angel.add(wing)
    }
    const raised = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), bronze)
    raised.position.set(0.3, 1.9, 0.1)
    raised.rotation.z = -0.5
    angel.add(raised)
    angel.position.set(FOUNTAIN.x, 3.2, FOUNTAIN.z)
    s.add(basin, water, column, angel)
    this.colliders.push({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: FOUNTAIN.r + 0.2 })

    /* lamp posts along the paths */
    const iron = std(0x1a1a20, 0.5)
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false })
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,220,150,0.9)', 'rgba(255,180,90,0)'), blending: THREE.AdditiveBlending, depthWrite: false })
    const lamp = (x: number, z: number) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.6, 8), iron)
      post.position.set(x, 1.8, z)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bulbMat)
      bulb.position.set(x, 3.75, z)
      const glow = new THREE.Sprite(glowMat)
      glow.scale.setScalar(2.6)
      glow.position.copy(bulb.position)
      s.add(post, bulb, glow)
      this.colliders.push({ x, z, r: 0.2 })
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      lamp(Math.cos(a) * (LOOP.rx + 2.2), Math.sin(a) * (LOOP.rz + 2.2))
    }
    for (const x of [-30, -15, 15, 30]) lamp(x, 2.6)
    // a few real lights, so the snow round the middle glows warm
    for (const [x, z] of [[0, 2], [-22, -18], [24, -16], [18, 22]] as const) {
      const l = new THREE.PointLight(0xffd29a, 30, 22, 1.6)
      l.position.set(x, 4, z)
      s.add(l)
    }

    /* benches */
    const wood = std(0x6b4a2a, 0.8)
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2
      const x = Math.cos(a) * (LOOP.rx - 2.4)
      const z = Math.sin(a) * (LOOP.rz - 2.4)
      const b = new THREE.Group()
      b.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.45), wood).translateY(0.45))
      b.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.06), wood).translateY(0.7).translateZ(-0.2))
      b.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.45), std(0xf4f8ff, 0.9)).translateY(0.5))
      b.position.set(x, 0, z)
      b.rotation.y = Math.atan2(-x / LOOP.rx ** 2, -z / LOOP.rz ** 2)
      s.add(b)
      this.colliders.push({ x, z, r: 0.75 })
    }

    /* trees: bare ones with snow on the branches, and some firs with lights */
    const bark = std(0x3a2a20, 0.9)
    const snowy = std(0xf4f8ff, 0.9)
    const needles = std(0x1d4a32, 0.9)
    const lights = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff, 0xff8de1].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }))
    const clear = (x: number, z: number) => {
      const loop = Math.hypot(x / LOOP.rx, z / LOOP.rz)
      if (Math.abs(loop - 1) * Math.min(LOOP.rx, LOOP.rz) < 4.5) return false
      if (Math.abs(z - 0.5) < 3.5 && Math.abs(x) < LOOP.rx + 2) return false
      if (Math.abs(x - 0.5) < 3.5 && z > FOUNTAIN.z && z < LOOP.rz + 2) return false
      if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 10) return false
      if (Math.hypot((x - POND.x) / (POND.rx + 2.5), (z - POND.z) / (POND.rz + 2.5)) < 1) return false
      if (Math.hypot(x - CRASH.x, z - CRASH.z) < 13) return false
      return true
    }
    let placed = 0
    for (let tries = 0; placed < 90 && tries < 2000; tries++) {
      const x = (r() - 0.5) * 2 * (PARK.x - 2)
      const z = (r() - 0.5) * 2 * (PARK.z - 2)
      if (!clear(x, z)) continue
      if (this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 2.5)) continue
      placed++
      const t = new THREE.Group()
      const h = 4 + r() * 3
      if (r() < 0.72) {
        t.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, h, 7), bark).translateY(h / 2))
        for (let b = 0; b < 5; b++) {
          const len = 1.4 + r() * 1.4
          const br = new THREE.Group()
          br.position.y = h * (0.5 + r() * 0.4)
          br.rotation.set(0, r() * Math.PI * 2, 0.7 + r() * 0.4)
          br.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, len, 5), bark).translateY(len / 2))
          br.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, len * 0.8, 0.06), snowy).translateY(len / 2).translateX(-0.06))
          t.add(br)
        }
      } else {
        t.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1, 7), bark).translateY(0.5))
        for (let k = 0; k < 3; k++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8 - k * 0.45, 2.2, 10), needles)
          cone.position.y = 1.6 + k * 1.3
          t.add(cone)
          for (let b = 0; b < 6; b++) {
            const a = r() * Math.PI * 2
            const rr = (1.6 - k * 0.45) * 0.75
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), lights[Math.floor(r() * lights.length)])
            bulb.position.set(Math.cos(a) * rr, 1.2 + k * 1.3, Math.sin(a) * rr)
            t.add(bulb)
          }
        }
      }
      t.position.set(x, 0, z)
      s.add(t)
      this.colliders.push({ x, z, r: 0.55 })
    }

    /* the city all round: towers of lit windows */
    const [wc, wctx] = makeCanvas(64, 128)
    wctx.fillStyle = '#10131c'
    wctx.fillRect(0, 0, 64, 128)
    for (let y = 2; y < 128; y += 8)
      for (let x = 2; x < 64; x += 8) {
        wctx.fillStyle = r() < 0.42 ? (r() < 0.8 ? '#ffd890' : '#cfe4ff') : '#1c2030'
        wctx.fillRect(x, y, 5, 5)
      }
    const windows = toTexture(wc)
    windows.wrapS = windows.wrapT = THREE.RepeatWrapping
    windows.magFilter = THREE.NearestFilter
    const tower = (x: number, z: number, w: number, d: number, h: number) => {
      const tex = windows.clone()
      tex.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 16)))
      tex.offset.set(r(), r())
      tex.needsUpdate = true
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ map: tex, color: 0xb0b4c8 }))
      m.position.set(x, h / 2, z)
      s.add(m)
      return m
    }
    for (const [axis, side] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]] as const) {
      const along = axis === 'x' ? PARK.z + 20 : PARK.x + 20
      for (let u = -along; u < along; u += 12 + r() * 6) {
        const w = 9 + r() * 7
        const h = 30 + r() * (r() < 0.2 ? 140 : 60)
        const off = (axis === 'x' ? PARK.x : PARK.z) + 14 + r() * 8
        if (axis === 'x') tower(side * off, u, 10, w, h)
        else tower(u, side * off, w, 10, h)
      }
    }
    // and one very tall one to the south, lit red and green at the top
    tower(18, PARK.z + 40, 16, 16, 230)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, 18, 8), new THREE.MeshBasicMaterial({ color: 0xd8304a, toneMapped: false }))
    top.position.set(18, 239, PARK.z + 40)
    s.add(top)

    /* the crashed sleigh, nose down in a drift */
    this.sleigh = new Sleigh(s)
    const g = this.sleigh.group
    g.position.copy(CRASH)
    g.rotation.set(-0.08, 2.4, 0.16, 'YXZ')
    const drift = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf4f8ff, 1))
    drift.scale.set(1.4, 0.45, 1)
    drift.position.copy(g.localToWorld(new THREE.Vector3(0, 0, -2.6)))
    s.add(drift)
    for (const c of this.sleigh.colliders()) this.colliders.push(c)
    this.sleighGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,215,120,1)', 'rgba(255,170,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    this.sleighGlow.position.copy(CRASH).setY(1.6)
    s.add(this.sleighGlow)

    /* falling snow */
    const N = 1600
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) pos.set([(r() - 0.5) * 80, r() * 30, (r() - 0.5) * 80], i * 3)
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.flakes = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }))
    this.flakes.frustumCulled = false
    s.add(this.flakes)

    /* the music notes they sing */
    for (const ch of ['♪', '♫', '♬']) {
      const [c, ctx] = makeCanvas(64, 64)
      ctx.fillStyle = '#ffe9a8'
      ctx.font = 'bold 52px Georgia, serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ch, 32, 34)
      this.noteTex.push(toTexture(c))
    }

    /* the people of the park: walking the paths, skating, waiting for a reason to sing */
    for (let i = 0; i < PEOPLE; i++) {
      const p = new Person({
        coat: COATS[i % COATS.length],
        skin: SKIN[Math.floor(r() * SKIN.length)],
        hat: r() < 0.6 ? HATS[Math.floor(r() * HATS.length)] : undefined,
        scarf: r() < 0.7 ? HATS[Math.floor(r() * HATS.length)] : undefined,
        pants: [0x23232b, 0x2b3a5a, 0x4a3a2a][i % 3],
        height: 0.88 + r() * 0.2,
      })
      // a few out on the ice, going round and round
      const skater = i < 4
      const at = skater ? new THREE.Vector3(POND.x, 0, POND.z) : onPath(r)
      p.group.position.copy(at)
      s.add(p.group)
      this.people.push({ p, pos: p.group.position, to: skater ? at.clone() : onPath(r), wait: r() * 3, singing: false, slot: null, phase: skater ? i * 1.6 : r() * 10, speed: skater ? -1 : 1.1 + r() * 0.5 })
    }

    /* the Park Rangers, with their torches */
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })
    const routes: THREE.Vector3[][] = [
      Array.from({ length: 12 }, (_, k) => new THREE.Vector3(Math.cos((k / 12) * Math.PI * 2) * LOOP.rx, 0, Math.sin((k / 12) * Math.PI * 2) * LOOP.rz)),
      Array.from({ length: 12 }, (_, k) => new THREE.Vector3(Math.cos(-(k / 12) * Math.PI * 2 + 2) * LOOP.rx, 0, Math.sin(-(k / 12) * Math.PI * 2 + 2) * LOOP.rz)),
      [new THREE.Vector3(-LOOP.rx, 0, 0.5), new THREE.Vector3(LOOP.rx, 0, 0.5)],
      [new THREE.Vector3(0.5, 0, LOOP.rz), new THREE.Vector3(0.5, 0, FOUNTAIN.z + 9), new THREE.Vector3(-9, 0, FOUNTAIN.z), new THREE.Vector3(0.5, 0, FOUNTAIN.z - 9), new THREE.Vector3(9, 0, FOUNTAIN.z)],
      [new THREE.Vector3(POND.x - 15, 0, POND.z + 9), new THREE.Vector3(POND.x + 15, 0, POND.z + 9), new THREE.Vector3(POND.x + 15, 0, POND.z - 9), new THREE.Vector3(POND.x - 15, 0, POND.z - 9)],
    ]
    for (const route of routes) {
      const p = new Person({ coat: 0x4b5a2a, skin: SKIN[Math.floor(r() * SKIN.length)], pants: 0x3a3a22, hat: 'ranger', height: 1.06 })
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 16, 1, true), beamMat)
      // (the cone points out ahead, from the torch in the right hand)
      beam.geometry.translate(0, -3.5, 0)
      beam.rotation.x = -Math.PI / 2 - 0.12
      beam.position.set(0.3, 1.2, 0.3)
      p.body.add(beam)
      p.armR.rotation.x = -1.2
      p.group.position.copy(route[0])
      p.group.visible = false
      s.add(p.group)
      this.rangers.push({ p, pos: p.group.position, beam, route, leg: 0, mode: 'patrol', seen: new THREE.Vector3(), lost: 0, shout: 0, active: false })
    }

    /* the HUD */
    const root = document.createElement('div')
    root.id = 'park'
    root.hidden = true
    root.innerHTML = `
      <div class="cheer"><span class="label">🎄 Julandan</span><div class="bar"><i></i></div><span class="pct"></span></div>
      <div class="row"><span class="singers"></span><span class="lives"></span></div>
      <div class="alert" hidden>🚨 En ranger har sett dig – spring!</div>
      <div class="msg" hidden></div>`
    const quit = document.createElement('button')
    quit.id = 'park-quit'
    quit.type = 'button'
    quit.hidden = true
    quit.innerHTML = '<kbd class="desk">Q</kbd> Ge upp'
    document.getElementById('hud')!.append(root, quit)
    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
    this.hud = { root, quit, bar: q('.bar i'), pct: q('.pct'), singers: q('.singers'), lives: q('.lives'), alert: q('.alert'), msg: q('.msg') }
    quit.addEventListener('click', () => this.quit())
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyQ' && (this.state === 'play' || this.state === 'caught')) this.quit()
    })
  }

  get active() {
    return this.state !== 'over'
  }

  /** The camera is the park's (the crash and the lift-off) rather than the player's. */
  get cinematic() {
    return this.state === 'intro' || this.state === 'liftoff'
  }

  /** Off to New York: the flight in, and the crash. */
  start() {
    const r = rng(Date.now() % 100000)
    this.state = 'intro'
    this.stateT = 0
    void this.choir.preload()
    this.time = 0
    this.cheer = START_CHEER
    this.lives = LIVES
    this.caught = 0
    for (const h of this.people) {
      h.singing = false
      h.slot = null
      h.p.armL.rotation.set(0, 0, -0.12)
      h.p.armR.rotation.set(0, 0, 0.12)
      if (h.speed > 0) h.pos.copy(onPath(r))
    }
    this.rangers.forEach((g, i) => {
      g.active = i < 3
      g.p.group.visible = g.active
      g.pos.copy(g.route[0])
      g.leg = 0
      g.mode = 'patrol'
    })
    this.sleigh.reseat()
    this.hud.root.hidden = this.hud.quit.hidden = false
    this.hud.alert.hidden = true
    this.message('🎅 "Vi tar en sväng över New York – i smyg!"', 3)
    this.syncHud()
  }

  /** Give up: straight back to the village. */
  quit() {
    if (!this.active) return
    this.finish(false)
  }

  private finish(won: boolean) {
    this.state = 'over'
    this.choir.stop()
    this.hud.root.hidden = this.hud.quit.hidden = true
    let best = false
    if (won) {
      try {
        const was = Number(localStorage.getItem(BEST_KEY)) || Infinity
        if (this.time < was) {
          localStorage.setItem(BEST_KEY, String(Math.round(this.time)))
          best = true
        }
      } catch {
        /* fine */
      }
    }
    this.onDone({ won, seconds: this.time, caught: this.caught, best })
  }

  private message(text: string, seconds: number) {
    const m = this.hud.msg
    m.textContent = text
    m.hidden = false
    clearTimeout(Number(m.dataset.timer))
    m.dataset.timer = String(setTimeout(() => (m.hidden = true), seconds * 1000))
  }

  private syncHud() {
    const pct = Math.min(100, Math.round(this.cheer))
    this.hud.bar.style.width = `${pct}%`
    this.hud.pct.textContent = `${pct}%`
    const n = this.people.filter((h) => h.singing).length
    this.hud.singers.textContent = `🎶 ${n} / ${PEOPLE} sjunger`
    this.hud.lives.textContent = '❤️'.repeat(this.lives) + '🤍'.repeat(LIVES - this.lives)
  }

  /** Where you stand next to the sleigh, facing it. */
  private bySleigh() {
    const at = this.sleigh.group.localToWorld(new THREE.Vector3(2.6, 0, 1.2)).setY(0)
    return { at, yaw: Math.atan2(at.x - CRASH.x, at.z - CRASH.z) }
  }

  /** Someone near and in front of you who isn't singing yet. */
  nearPerson(pos: THREE.Vector3, fwd: THREE.Vector3) {
    if (this.state !== 'play') return null
    let best: (typeof this.people)[number] | null = null
    let bestD = 2.6
    for (const h of this.people) {
      if (h.singing) continue
      const dx = h.pos.x - pos.x
      const dz = h.pos.z - pos.z
      const d = Math.hypot(dx, dz)
      if (d < bestD && (dx * fwd.x + dz * fwd.z) / d > 0.4) {
        best = h
        bestD = d
      }
    }
    return best
  }

  /** You sing to them – and they join in, and head over to the sleigh to sing there. */
  convert(h: NonNullable<ReturnType<CentralPark['nearPerson']>>, from: THREE.Vector3) {
    if (h.singing) return
    h.singing = true
    // a place in the ring round the sleigh
    const n = this.people.filter((x) => x.slot).length
    const ringN = n < 10 ? 10 : 14
    const a = ((n < 10 ? n : n - 10) / ringN) * Math.PI * 2 + (n < 10 ? 0 : 0.2)
    const rr = n < 10 ? 6 : 8.5
    h.slot = new THREE.Vector3(CRASH.x + Math.cos(a) * rr, 0, CRASH.z + Math.sin(a) * rr)
    h.wait = 1.2
    h.p.group.rotation.y = yawTo(h.pos, from)
    this.cheer += 3
    ;[523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.12, 'triangle', 0.05), i * 90))
    this.say(`🎶 "${JOIN_LINES[Math.floor(Math.random() * JOIN_LINES.length)]}"`)
    for (let i = 0; i < 5; i++) this.note(h.pos, 2.1 + i * 0.1)
    if (!this.choir.playing) this.choir.start()
    // singing carries: rangers nearby come to see what's going on
    for (const g of this.rangers)
      if (g.active && g.mode === 'patrol' && g.pos.distanceTo(h.pos) < 28) {
        g.mode = 'search'
        g.seen.copy(h.pos)
        g.lost = 0
      }
    this.syncHud()
  }

  private note(at: THREE.Vector3, y: number) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.noteTex[Math.floor(Math.random() * 3)], transparent: true, depthWrite: false }))
    s.position.set(at.x + (Math.random() - 0.5) * 0.4, y, at.z + (Math.random() - 0.5) * 0.4)
    s.scale.setScalar(0.4)
    this.scene.add(s)
    this.notes.push({ s, age: 0, vx: (Math.random() - 0.5) * 0.6 })
  }

  /** Bump into things, and stay in the park. */
  collide = (p: THREE.Vector3) => {
    for (const c of this.colliders) {
      const dx = p.x - c.x
      const dz = p.z - c.z
      const d = Math.hypot(dx, dz)
      const min = c.r + 0.35
      if (d < min && d > 1e-5) {
        p.x = c.x + (dx / d) * min
        p.z = c.z + (dz / d) * min
      }
    }
    p.x = THREE.MathUtils.clamp(p.x, -PARK.x, PARK.x)
    p.z = THREE.MathUtils.clamp(p.z, -PARK.z, PARK.z)
  }
  ground = () => 0

  /** The crash and the lift-off: where the camera is. */
  camera(cam: THREE.PerspectiveCamera) {
    const g = this.sleigh.group
    if (this.state === 'intro') {
      // behind and above the sleigh as it comes in over the city, then watching it go down
      const k = this.stateT
      if (k < 6.2) {
        const back = new THREE.Vector3(0, 3.2, 9).applyQuaternion(g.quaternion).add(g.position)
        cam.position.lerp(back, k < 0.1 ? 1 : 0.12)
        cam.lookAt(g.position.clone().add(new THREE.Vector3(0, 1, 0)))
      } else {
        const shake = k < 6.9 ? (6.9 - k) * 0.25 : 0
        cam.position.set(CRASH.x + 9 + Math.sin(k * 60) * shake, 3 + Math.sin(k * 47) * shake, CRASH.z + 9)
        cam.lookAt(CRASH.x, 1, CRASH.z)
      }
    } else {
      // the crowd round the sleigh, and up it goes
      const k = this.stateT
      cam.position.set(CRASH.x + 14 - k * 0.6, 3 + k * 0.6, CRASH.z + 14)
      cam.lookAt(g.position.x, g.position.y + 1, g.position.z)
    }
  }

  update(t: number, dt: number, player: THREE.Vector3) {
    if (!this.active) return
    this.stateT += dt
    this.sleigh.update(t, dt, player)

    /* the snow falls round wherever you are */
    const fp = this.flakes.geometry.attributes.position as THREE.BufferAttribute
    const cx = this.state === 'play' ? player.x : CRASH.x
    const cz = this.state === 'play' ? player.z : CRASH.z
    for (let i = 0; i < fp.count; i++) {
      let y = fp.getY(i) - dt * 1.4
      if (y < 0) y += 30
      let x = fp.getX(i)
      let z = fp.getZ(i)
      if (x - cx > 40) x -= 80
      if (cx - x > 40) x += 80
      if (z - cz > 40) z -= 80
      if (cz - z > 40) z += 80
      fp.setXYZ(i, x, y, z)
    }
    fp.needsUpdate = true

    if (this.state === 'intro') return this.intro(dt)
    if (this.state === 'liftoff') return this.liftoff(t, dt)

    this.time += dt
    const singers = this.people.filter((h) => h.singing)
    this.choir.singers = singers.length
    // everyone singing keeps filling it up
    this.cheer += dt * singers.length * 0.09
    this.sleighGlow.scale.setScalar(1 + (this.cheer / 100) * 6)
    ;(this.sleighGlow.material as THREE.SpriteMaterial).opacity = 0.2 + (this.cheer / 100) * 0.7
    // more rangers turn up as it gets louder
    for (const [i, at] of [[3, 45], [4, 75]] as const)
      if (this.cheer > at && !this.rangers[i].active) {
        const r = this.rangers[i]
        r.active = true
        r.p.group.visible = true
        r.pos.copy(r.route[0])
        this.say('🚨 Fler rangers på väg in i parken!')
      }
    if (this.cheer >= 100) {
      this.cheer = 100
      this.state = 'liftoff'
      this.stateT = 0
      this.hud.alert.hidden = true
      this.message('✨ Julandan är tillbaka! Släden lyfter!', 4)
      this.syncHud()
      ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.06), i * 120))
    }

    this.updatePeople(t, dt)
    if (this.state === 'play') this.updateRangers(t, dt, player)
    else if (this.state === 'caught' && this.stateT > 1.6) this.state = 'play'
    this.updateNotes(dt)
    if (Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) this.syncHud()
  }

  private intro(dt: number) {
    const g = this.sleigh.group
    const k = this.stateT
    this.sleigh.gallop = k < 6.2 ? 1 : 0
    if (k < 6.2) {
      // in over the city from the south-east, the spirit failing: lower and lower, lurching
      const u = k / 6.2
      const from = new THREE.Vector3(110, 160, 120)
      const mid = new THREE.Vector3(40, 60, 40)
      const p = new THREE.Vector3().lerpVectors(from, mid, Math.min(1, u * 1.6))
      if (u > 0.62) p.lerpVectors(mid, CRASH.clone().setY(0.4), (u - 0.62) / 0.38)
      p.y += Math.sin(k * 7) * 0.6 * u
      const ahead = (u > 0.62 ? CRASH.clone() : mid).sub(p)
      g.position.copy(p)
      g.rotation.set(-0.25 * u, Math.atan2(-ahead.x, -ahead.z), Math.sin(k * 5) * 0.25 * u, 'YXZ')
      if (k > 2 && Math.floor(k * 2.5) !== Math.floor((k - dt) * 2.5)) noise(0.25, 300, 80, 0.12, 0.6) // the sputter of a sleigh running out of spirit
      if (Math.floor(k) === 3 && Math.floor(k - dt) === 2) this.message('⚠️ Julandan över New York är farligt låg …', 3)
    } else {
      if (!this.burst) {
        // down in the drift
        g.position.copy(CRASH)
        g.rotation.set(-0.08, 2.4, 0.16, 'YXZ')
        thud()
        noise(1.2, 900, 120, 0.4, 0.5)
        this.snowBurst()
        this.message('💥 Kraschlandning i Central Park! Släden flyger inte utan julanda.', 4)
      }
      if (k > 9) {
        this.state = 'play'
        this.stateT = 0
        const { at, yaw } = this.bySleigh()
        this.onPlay(at, yaw)
        this.say('🎅 "Få parken att sjunga – högt, så alla hör! Då fylls julandan på igen."')
        this.choir.singers = 0
        this.choir.start()
      }
    }
    this.updateBurst(dt)
  }

  private snowBurst() {
    const N = 300
    const pos = new Float32Array(N * 3)
    const v = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      pos.set([CRASH.x, 0.6, CRASH.z], i * 3)
      const a = Math.random() * Math.PI * 2
      const s = 2 + Math.random() * 7
      v.set([Math.cos(a) * s, 3 + Math.random() * 7, Math.sin(a) * s], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, depthWrite: false }))
    this.scene.add(p)
    this.burst = { p, v, age: 0 }
  }

  private updateBurst(dt: number) {
    const b = this.burst
    if (!b || !b.p.visible) return
    b.age += dt
    const pos = b.p.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      b.v[i * 3 + 1] -= 9.8 * dt
      const y = Math.max(0.05, pos.getY(i) + b.v[i * 3 + 1] * dt)
      pos.setXYZ(i, pos.getX(i) + b.v[i * 3] * dt, y, pos.getZ(i) + b.v[i * 3 + 2] * dt)
    }
    pos.needsUpdate = true
    ;(b.p.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.age / 3)
    if (b.age > 3) b.p.visible = false
  }

  private liftoff(t: number, dt: number) {
    const g = this.sleigh.group
    const k = this.stateT
    this.updatePeople(t, dt)
    this.updateNotes(dt)
    // everybody cheering, arms up
    for (const h of this.people) if (h.singing) h.p.armR.rotation.z = h.p.armL.rotation.z = 0
    if (k > 1.5) {
      this.sleigh.gallop = 1
      const u = k - 1.5
      g.position.set(CRASH.x - u * u * 1.2, Math.min(60, u * u * 1.6), CRASH.z - u * u * 0.8)
      g.rotation.set(Math.min(0.35, u * 0.2), 2.4 - u * 0.1, 0, 'YXZ')
      this.sleighGlow.position.copy(g.position).setY(g.position.y + 1)
      if (Math.floor(k * 3) !== Math.floor((k - dt) * 3)) this.note(g.position, g.position.y + 2)
    }
    if (k > 7.5) this.finish(true)
  }

  private updatePeople(t: number, dt: number) {
    const r = Math.random
    for (const h of this.people) {
      const g = h.p.group
      if (h.singing && h.slot) {
        // a moment's surprise, then off to the sleigh to sing with the others
        if (h.wait > 0) {
          h.wait -= dt
          h.p.walk(0, 0)
        } else if (h.pos.distanceTo(h.slot) > 0.05) {
          const was = h.pos.clone()
          stepTo(h.pos, h.slot, 2.6, dt)
          turn(g, yawTo(was, h.pos), dt * 8)
          h.p.walk(t * 10, 1)
        } else {
          turn(g, yawTo(h.pos, CRASH), dt * 3)
          h.p.walk(0, 0)
          h.p.body.position.y = Math.abs(Math.sin(t * 4.3 + h.phase)) * 0.05
          h.p.body.rotation.z = Math.sin(t * 2.15 + h.phase) * 0.06
          h.p.armL.rotation.set(-0.3, 0, -0.5 - Math.sin(t * 4.3 + h.phase) * 0.25)
          h.p.armR.rotation.set(-0.3, 0, 0.5 + Math.sin(t * 4.3 + h.phase) * 0.25)
          h.p.head.rotation.x = -0.15
        }
        if (t > this.nextNote && r() < 0.08) this.note(h.pos, 2.1)
        continue
      }
      if (h.speed < 0) {
        // skating round the pond
        const a = t * 0.35 + h.phase
        h.pos.set(POND.x + Math.cos(a) * POND.rx * 0.7, 0.02, POND.z + Math.sin(a) * POND.rz * 0.7)
        g.rotation.y = Math.atan2(-Math.sin(a) * POND.rx, Math.cos(a) * POND.rz)
        h.p.walk(t * 3 + h.phase, 0.5)
        h.p.body.rotation.x = 0.15
        continue
      }
      if (h.wait > 0) {
        h.wait -= dt
        h.p.walk(0, 0)
        continue
      }
      const was = h.pos.clone()
      if (stepTo(h.pos, h.to, h.speed, dt)) {
        h.to = onPath(r)
        h.wait = 1 + r() * 4
      }
      this.collide(h.pos)
      turn(g, yawTo(was, h.pos), dt * 6)
      h.p.walk(t * 7 + h.phase, 0.8)
    }
    if (t > this.nextNote) this.nextNote = t + 0.15
  }

  private updateNotes(dt: number) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i]
      n.age += dt
      n.s.position.y += dt * 0.9
      n.s.position.x += n.vx * dt
      n.s.material.opacity = Math.max(0, 1 - n.age / 2.2)
      if (n.age > 2.2) {
        this.scene.remove(n.s)
        n.s.material.dispose()
        this.notes.splice(i, 1)
      }
    }
  }

  private updateRangers(t: number, dt: number, player: THREE.Vector3) {
    let chased = false
    for (const g of this.rangers) {
      if (!g.active) continue
      const grp = g.p.group
      const dx = player.x - g.pos.x
      const dz = player.z - g.pos.z
      const d = Math.hypot(dx, dz)
      // seen: close by, or ahead in the torchlight
      const facing = grp.rotation.y
      const ahead = (Math.sin(facing) * dx + Math.cos(facing) * dz) / Math.max(d, 1e-3)
      const sees = d < 4 || (d < 16 && ahead > 0.55)
      if (sees) {
        if (g.mode !== 'chase') {
          g.shout = 0
          this.say(RANGER_LINES[Math.floor(Math.random() * RANGER_LINES.length)])
          blip(880, 0.15, 'square', 0.04)
          setTimeout(() => blip(660, 0.2, 'square', 0.04), 160)
        }
        g.mode = 'chase'
        g.seen.set(player.x, 0, player.z)
        g.lost = 0
      } else if (g.mode === 'chase') {
        // lost sight: keep going to where you were last seen, then give up after a while
        g.lost += dt
        if (d > 22 || g.lost > 3) g.mode = 'search'
      }
      const was = g.pos.clone()
      let moving = true
      if (g.mode === 'chase') {
        chased = true
        stepTo(g.pos, g.seen, 5.3, dt)
        if (d < 1.1) return this.caughtBy()
      } else if (g.mode === 'search') {
        if (stepTo(g.pos, g.seen, 2.6, dt)) {
          g.lost += dt
          moving = false
          grp.rotation.y += dt * 1.5
          if (g.lost > 3.5) {
            g.mode = 'patrol'
            g.leg = this.nearestLeg(g)
          }
        }
      } else if (stepTo(g.pos, g.route[g.leg], 2.1, dt)) g.leg = (g.leg + 1) % g.route.length
      this.collide(g.pos)
      if (moving && was.distanceToSquared(g.pos) > 1e-6) turn(grp, yawTo(was, g.pos), dt * 7)
      g.p.walk(t * (g.mode === 'chase' ? 13 : 7), moving ? 1 : 0)
      g.p.armR.rotation.x = -1.2
      // the torch sweeps a little as they look about
      g.beam.rotation.y = Math.sin(t * 1.3 + g.route.length) * 0.35
    }
    this.hud.alert.hidden = !chased
  }

  private nearestLeg(g: (typeof this.rangers)[number]) {
    let best = 0
    g.route.forEach((p, i) => {
      if (p.distanceToSquared(g.pos) < g.route[best].distanceToSquared(g.pos)) best = i
    })
    return best
  }

  private caughtBy() {
    this.caught++
    this.lives--
    this.cheer = Math.max(START_CHEER, this.cheer - 8)
    this.hud.alert.hidden = true
    noise(0.4, 600, 200, 0.2, 1)
    if (this.lives <= 0) {
      this.message('👮 Tredje gången gillt för rangersen – Tomten får hämta dig på polisstationen!', 4)
      this.state = 'over'
      setTimeout(() => this.finish(false), 2600)
      return
    }
    this.message(CAUGHT_LINES[(this.caught - 1) % CAUGHT_LINES.length], 3.5)
    this.state = 'caught'
    this.stateT = 0
    // the rangers go back to their rounds
    for (const g of this.rangers) {
      g.mode = 'patrol'
      g.pos.copy(g.route[0])
      g.leg = 0
    }
    const { at, yaw } = this.bySleigh()
    this.onCaught(at, yaw)
    this.syncHud()
  }
}
