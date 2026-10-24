// Tomten and Tomtemor at home in Tomtegården (tomtegarden.ts), each in a wing chair by the fire: built
// with more care than the nissar – round rosy faces, bushy brows, little round spectacles, a big soft
// beard, red velvet and white fur, in the spirit of the classic mid-century Christmas-card Santa – and
// moving more like people: they breathe, blink, look at each other, at the films and at you, their arms
// bending at the elbow (two-bone IK) as they lift their cups of hot chocolate. He chuckles now and then
// till his belly shakes; she knits between sips.
//
// Everything is in figure space: seated, facing +z, the floor under the middle of the seat at the origin.
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { glowTexture } from './tex'

const DOWN = new THREE.Vector3(0, -1, 0)
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt))

const SKIN = new THREE.MeshStandardMaterial({ color: 0xf3c4a2, roughness: 0.55 })
const ROSY = new THREE.MeshStandardMaterial({ color: 0xf09a8a, roughness: 0.6 })
const NOSE = new THREE.MeshStandardMaterial({ color: 0xec9c86, roughness: 0.5 })
const WHITE = new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 1 })
const VELVET = new THREE.MeshPhysicalMaterial({ color: 0xb3121f, roughness: 0.8, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xff7a7a) })
const BLACK = new THREE.MeshStandardMaterial({ color: 0x17151a, roughness: 0.35, metalness: 0.1 })
const GOLD = new THREE.MeshStandardMaterial({ color: 0xe0b24a, roughness: 0.3, metalness: 0.85 })
const EYE_WHITE = new THREE.MeshStandardMaterial({ color: 0xfcfbf8, roughness: 0.2 })
const IRIS = new THREE.MeshStandardMaterial({ color: 0x4f86c6, roughness: 0.3 })
const PUPIL = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.1 })

const ball = (r: number, mat: THREE.Material, w = 16, h = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat)

/** Soft white fur: a shape with its surface roughed up a little, so it isn't smooth plastic. */
function fur(geo: THREE.BufferGeometry, amount = 0.012) {
  geo = geo.index ? geo.toNonIndexed() : geo
  geo.computeVertexNormals()
  const p = geo.attributes.position as THREE.BufferAttribute
  const n = geo.attributes.normal as THREE.BufferAttribute
  // the same lump for the same spot (vertices are shared between faces once indexed again)
  const key = (i: number) => `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`
  const lumps = new Map<string, number>()
  for (let i = 0; i < p.count; i++) {
    const k = key(i)
    if (!lumps.has(k)) lumps.set(k, Math.random() * amount)
    const d = lumps.get(k)!
    p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d)
  }
  // (joined up again, so the light runs smoothly over the lumps instead of picking out every facet)
  geo.deleteAttribute('normal')
  geo = mergeVertices(geo, 1e-4)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, WHITE)
}

/** A limb segment: its local -y runs down the bone from the joint. */
function bone(len: number, r0: number, r1: number, mat: THREE.Material) {
  const g = new THREE.Group()
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 24), mat)
  m.position.y = -len / 2
  g.add(m)
  return g
}
const q = new THREE.Vector3()
/** Point a bone from one joint to the next. */
function aim(b: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  b.position.copy(from)
  b.quaternion.setFromUnitVectors(DOWN, q.subVectors(to, from).normalize())
}
/** Two-bone IK: where the elbow goes for the hand to reach `to` from the shoulder, bending towards `pole`. */
function elbow(from: THREE.Vector3, to: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, out: THREE.Vector3) {
  const dir = q.subVectors(to, from)
  const d = THREE.MathUtils.clamp(dir.length(), 0.02, a + b - 0.002)
  dir.normalize()
  const x = (a * a - b * b + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, a * a - x * x))
  const side = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize()
  return out.copy(from).addScaledVector(dir, x).addScaledVector(side, h)
}

/** A cup of hot chocolate: whipped cream and marshmallows on top, and a wisp of steam. */
function cocoaCup(color: number) {
  const g = new THREE.Group()
  const china = new THREE.MeshStandardMaterial({ color, roughness: 0.35 })
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.09, 18, 1, true), china)
  cup.material.side = THREE.DoubleSide
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.008, 18), china)
  base.position.y = -0.045
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12, Math.PI), china)
  handle.rotation.z = -Math.PI / 2
  handle.position.x = 0.045
  const cocoa = new THREE.Mesh(new THREE.CircleGeometry(0.042, 18), new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.3 }))
  cocoa.rotation.x = -Math.PI / 2
  cocoa.position.y = 0.035
  const cream = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), WHITE)
  cream.position.y = 0.035
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8), WHITE)
    m.position.set(Math.cos(i * 2.1) * 0.026, 0.042, Math.sin(i * 2.1) * 0.026)
    g.add(m)
  }
  const steam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,0.35)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false }))
  steam.position.y = 0.12
  steam.scale.set(0.08, 0.16, 1)
  g.add(cup, base, handle, cocoa, cream, steam)
  g.userData.steam = steam
  return g
}

/** A deep wing chair in velvet, its seat cushion top at 0.48 m (figure space: facing +z). */
export function wingChair(color: number) {
  const g = new THREE.Group()
  const cloth = new THREE.MeshPhysicalMaterial({ color, roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35) })
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.5 })
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = cloth) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    g.add(m)
    return m
  }
  box(0.82, 0.3, 0.72, 0, 0.24, 0.02)
  // the seat cushion, rounded a little
  const cushion = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 10), cloth)
  cushion.rotation.z = Math.PI / 2
  cushion.scale.set(1, 1, 3)
  cushion.position.set(0, 0.42, 0.06)
  g.add(cushion)
  // the high back, tilted back a touch, and its wings
  box(0.82, 0.95, 0.16, 0, 0.88, -0.32).rotation.x = -0.12
  for (const s of [-1, 1]) {
    box(0.14, 0.62, 0.62, s * 0.4, 0.62, 0.03)
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.66, 12), cloth)
    roll.rotation.x = Math.PI / 2
    roll.position.set(s * 0.4, 0.66, 0.05)
    g.add(roll)
    const wing = box(0.12, 0.48, 0.34, s * 0.4, 1.08, -0.18)
    wing.rotation.y = s * 0.25
    for (const z of [-0.28, 0.32]) box(0.06, 0.1, 0.06, s * 0.34, 0.05, z, wood)
  }
  // buttons on the back
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), cloth)
    b.position.set(-0.2 + (i % 3) * 0.2, 0.8 + Math.floor(i / 3) * 0.3, -0.23 + Math.floor(i / 3) * -0.035)
    g.add(b)
  }
  return g
}

export type ClausKind = 'tomten' | 'tomtemor'

export class Claus {
  readonly group = new THREE.Group()
  readonly head = new THREE.Group()
  /** The other one, to look at and smile at now and then. */
  partner: Claus | null = null
  private torso = new THREE.Group()
  private belly: THREE.Mesh
  private lids: THREE.Mesh[] = []
  private arms: { up: THREE.Group; fore: THREE.Group; hand: THREE.Group; shoulder: THREE.Vector3; pole: THREE.Vector3; at: THREE.Vector3 }[] = []
  private hat: THREE.Group[] = []
  private cup: THREE.Group
  /** Where the cup rests when it isn't in her hand (on the side table) – null: he always holds his. */
  private cupHome: THREE.Vector3 | null
  private needles: THREE.Mesh[] = []
  private blinkAt = 2 + Math.random() * 3
  private blinkT = 9
  private sipAt: number
  private sipT = 99
  private laughT = 99
  private laughAt: number
  private glance = { at: 0, who: 'film' as 'film' | 'partner' | 'look' }
  private yaw = 0
  private pitch = 0
  private mouthOpen: THREE.Mesh | null = null
  private elbowTmp = new THREE.Vector3()

  constructor(readonly kind: ClausKind) {
    const him = kind === 'tomten'
    const g = this.group
    this.sipAt = 4 + Math.random() * 6
    this.laughAt = 10 + Math.random() * 15

    /* legs: thighs along the seat, shins down, black boots with fur tops (him) or buttoned shoes (her) */
    const trouser = him ? VELVET : new THREE.MeshPhysicalMaterial({ color: 0xa3101c, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color(0xff8080) })
    for (const s of [-1, 1]) {
      const thigh = bone(0.44, him ? 0.1 : 0.085, him ? 0.09 : 0.075, trouser)
      aim(thigh, new THREE.Vector3(s * 0.12, 0.54, -0.02), new THREE.Vector3(s * 0.13, 0.52, 0.42))
      const shin = bone(0.42, 0.075, 0.065, trouser)
      aim(shin, new THREE.Vector3(s * 0.13, 0.52, 0.42), new THREE.Vector3(s * 0.14, 0.1, 0.46))
      g.add(thigh, shin)
      const boot = new THREE.Group()
      const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.12, 4, 10), BLACK)
      toe.rotation.x = Math.PI / 2
      toe.position.set(0, 0.06, 0.06)
      boot.add(toe)
      if (him) {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.16, 12), BLACK)
        top.position.y = 0.14
        const cuff = fur(new THREE.TorusGeometry(0.085, 0.03, 8, 16), 0.008)
        cuff.rotation.x = Math.PI / 2
        cuff.position.y = 0.23
        boot.add(top, cuff)
      }
      boot.position.set(s * 0.14, 0, 0.46)
      g.add(boot)
    }
    if (!him) {
      // her long skirt falling over the knees, and the white apron
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 0.5, 20, 1, true, -Math.PI * 0.75, Math.PI * 1.5), trouser)
      skirt.material.side = THREE.DoubleSide
      skirt.position.set(0, 0.32, 0.36)
      skirt.rotation.x = 0.12
      // the apron: over her lap and down over her knees, a frill along its hem
      const linen = new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.9, side: THREE.DoubleSide })
      const lap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16, 1, true, -1.0, 2.0), linen)
      lap.rotation.x = Math.PI / 2
      lap.position.set(0, 0.47, 0.24)
      const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.36, 16, 1, true, -1.0, 2.0), linen)
      drop.position.set(0, 0.48, 0.3)
      drop.rotation.x = 0.08
      const frill = fur(new THREE.TorusGeometry(0.235, 0.015, 6, 20, 2.0), 0.006)
      frill.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 1.0)
      frill.position.set(0, 0.3, 0.3)
      g.add(skirt, lap, drop, frill)
    }

    /* the body: a round belly (his is very round), the belt with its gold buckle, fur down the front */
    const profile = (him
      ? [[0, 0.46], [0.24, 0.48], [0.3, 0.6], [0.33, 0.74], [0.31, 0.88], [0.26, 1.0], [0.23, 1.1], [0.16, 1.17], [0.06, 1.2]]
      : [[0, 0.46], [0.21, 0.48], [0.23, 0.62], [0.2, 0.78], [0.22, 0.92], [0.21, 1.03], [0.18, 1.1], [0.12, 1.16], [0.05, 1.18]]
    ).map(([r, y]) => new THREE.Vector2(r, y))
    this.belly = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), him ? VELVET : trouser)
    this.belly.scale.z = him ? 0.92 : 0.8
    this.torso.add(this.belly)
    if (him) {
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.334, 0.334, 0.07, 28, 1, true), BLACK)
      belt.material.side = THREE.DoubleSide
      belt.position.y = 0.7
      belt.scale.z = 0.92
      const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 4), GOLD)
      buckle.rotation.z = Math.PI / 4
      buckle.position.set(0, 0.7, 0.31)
      const strip = fur(new THREE.BoxGeometry(0.08, 0.5, 0.05), 0.01)
      strip.position.set(0, 0.92, 0.27)
      strip.rotation.x = -0.35
      this.torso.add(belt, buckle, strip)
      // and the hem of his coat over the thighs
      const hem = fur(new THREE.TorusGeometry(0.3, 0.035, 8, 28), 0.01)
      hem.rotation.x = Math.PI / 2
      hem.scale.y = 0.92
      hem.position.y = 0.5
      this.torso.add(hem)
    } else {
      // a green knitted shawl round her shoulders
      const shawl = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 10, 24), new THREE.MeshStandardMaterial({ color: 0x2f6b45, roughness: 1 }))
      shawl.rotation.x = Math.PI / 2 - 0.15
      shawl.position.set(0, 1.1, 0.02)
      shawl.scale.set(1.15, 1, 0.9)
      const collar = fur(new THREE.TorusGeometry(0.1, 0.025, 8, 20), 0.006)
      collar.rotation.x = Math.PI / 2
      collar.position.y = 1.17
      this.torso.add(shawl, collar)
    }
    this.torso.rotation.x = -0.1
    g.add(this.torso)

    /* the head */
    const h = this.head
    h.position.set(0, him ? 1.36 : 1.33, 0.02)
    const skull = ball(0.125, SKIN, 24, 18)
    skull.scale.set(1, 1.1, 1.02)
    h.add(skull)
    const nose = ball(him ? 0.032 : 0.025, NOSE)
    nose.scale.set(1, 0.9, 1.1)
    nose.position.set(0, -0.005, 0.125)
    h.add(nose)
    for (const s of [-1, 1]) {
      const cheek = ball(him ? 0.046 : 0.04, ROSY)
      cheek.scale.set(1, 0.85, 0.7)
      cheek.position.set(s * 0.068, -0.03, 0.088)
      const ear = ball(0.028, SKIN)
      ear.scale.set(0.5, 1, 0.8)
      ear.position.set(s * 0.125, 0, 0)
      // the eyes: white, a blue iris, the pupil – and a lid to blink with
      const eye = new THREE.Group()
      eye.position.set(s * 0.043, 0.03, 0.1)
      eye.add(ball(0.019, EYE_WHITE, 12, 10))
      eye.add(ball(0.0105, IRIS, 10, 8).translateZ(0.012))
      eye.add(ball(0.005, PUPIL, 8, 6).translateZ(0.018))
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), SKIN)
      lid.scale.y = 0.3
      eye.add(lid)
      this.lids.push(lid)
      h.add(cheek, ear, eye)
      // brows: big and bushy on him, fine on her
      for (let k = 0; k < (him ? 4 : 3); k++) {
        const brow = ball(him ? 0.016 : 0.008, him ? WHITE : new THREE.MeshStandardMaterial({ color: 0xc8c2b8, roughness: 1 }), 8, 6)
        brow.scale.set(1.4, 0.7, 0.8)
        brow.position.set(s * (0.022 + k * 0.014), 0.064 + Math.sin((k / 3) * Math.PI) * 0.008, 0.112 - k * 0.006)
        h.add(brow)
      }
      // little round spectacles
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0025, 6, 20), GOLD)
      rim.position.set(s * 0.043, him ? 0.022 : 0.03, 0.126)
      const temple = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.11, 4), GOLD)
      temple.rotation.x = Math.PI / 2
      temple.position.set(s * 0.068, him ? 0.024 : 0.032, 0.07)
      h.add(rim, temple)
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.04, 4), GOLD)
    bridge.rotation.z = Math.PI / 2
    bridge.position.set(0, him ? 0.026 : 0.034, 0.13)
    h.add(bridge)

    if (him) {
      // the beard: one big soft shape from ear to ear, flowing down over his chest in waves and curls
      const bg = new THREE.SphereGeometry(1, 48, 36)
      const bp = bg.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < bp.count; i++) {
        let x = bp.getX(i)
        let y = bp.getY(i)
        let z = bp.getZ(i)
        // (only the front and sides: the back of it tucks in under the jaw)
        z = Math.max(z, -0.25) * (z < 0 ? 0.6 : 1)
        const below = Math.max(0, -y)
        y = y < 0 ? y * 1.95 : y * 0.3
        // narrowing to a rounded point at the bottom, the waves of it running down
        x *= 1 - below * 0.42
        const a2 = Math.atan2(x, z)
        const wave = 1 + Math.sin(a2 * 9 + y * 5) * 0.06 * below + Math.sin(y * 14 + a2 * 3) * 0.035 * below
        bp.setXYZ(i, x * wave, y, z * wave)
      }
      bg.computeVertexNormals()
      const beard = new THREE.Mesh(bg, WHITE)
      beard.scale.set(0.15, 0.15, 0.13)
      beard.position.set(0, -0.13, 0.04)
      h.add(beard)
      // the moustache, curling up at the ends
      for (const s of [-1, 1]) {
        const mo = ball(0.03, WHITE, 16, 12)
        mo.scale.set(1.45, 0.55, 0.7)
        mo.position.set(s * 0.032, -0.045, 0.142)
        mo.rotation.z = s * 0.35
        const curl = ball(0.016, WHITE, 8, 6)
        curl.position.set(s * 0.074, -0.032, 0.128)
        h.add(mo, curl)
      }
      // white hair at the sides and back, under the hat
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.55 + (i / 8) * Math.PI * 0.9
        const tuft = ball(0.04, WHITE, 8, 6)
        tuft.position.set(Math.cos(a) * 0.12, 0.03, Math.sin(a) * 0.11 - 0.01)
        h.add(tuft)
      }
      // the hat: velvet, a fur brim, flopping over to one side, the pompom at its tip
      const brim = fur(new THREE.TorusGeometry(0.128, 0.035, 14, 40), 0.0012)
      brim.rotation.x = Math.PI / 2
      brim.position.y = 0.095
      h.add(brim)
      let parent: THREE.Object3D = h
      const seg = [[0.13, 0.11, 0.1], [0.11, 0.085, 0.1], [0.085, 0.055, 0.1], [0.055, 0.03, 0.09]]
      seg.forEach(([r0, r1, len], i) => {
        const s = new THREE.Group()
        s.position.y = i ? len * 0.95 : 0.11
        s.rotation.z = i ? -0.42 : -0.15
        s.rotation.x = i ? -0.18 : -0.1
        const m2 = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 16), VELVET)
        m2.position.y = len / 2
        s.add(m2)
        parent.add(s)
        this.hat.push(s)
        parent = s
      })
      const pom = fur(new THREE.SphereGeometry(0.045, 18, 14), 0.0012)
      pom.position.y = 0.1
      parent.add(pom)
    } else {
      // her: soft white hair in a bun, a smile
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.133, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 1 }))
      hair.position.set(0, 0.012, -0.012)
      hair.rotation.x = -0.25
      const bun = ball(0.06, hair.material, 12, 10)
      bun.position.set(0, 0.1, -0.1)
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 6, 14, Math.PI), new THREE.MeshStandardMaterial({ color: 0xb04a4a, roughness: 0.5 }))
      smile.rotation.z = Math.PI
      smile.position.set(0, -0.055, 0.112)
      this.mouthOpen = smile
      // a little white cap with a frill
      const cap = fur(new THREE.SphereGeometry(0.08, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0.005)
      cap.position.set(0, 0.075, -0.03)
      cap.rotation.x = -0.4
      h.add(hair, bun, smile, cap)
    }
    g.add(h)

    /* arms: velvet sleeves with fur cuffs, bare hands */
    const sleeve = him ? VELVET : trouser
    for (const s of [-1, 1]) {
      const up = bone(0.29, 0.068, 0.058, sleeve)
      const fore = bone(0.26, 0.056, 0.048, sleeve)
      const cuff = fur(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 14), 0.007)
      cuff.position.y = -0.24
      fore.add(cuff)
      const hand = new THREE.Group()
      const palm = ball(0.045, SKIN, 12, 10)
      palm.scale.set(0.9, 1.1, 0.7)
      const thumb = ball(0.018, SKIN, 8, 6)
      thumb.position.set(-s * 0.035, 0.01, 0.025)
      hand.add(palm, thumb)
      g.add(up, fore, hand)
      this.arms.push({ up, fore, hand, shoulder: new THREE.Vector3(s * (him ? 0.25 : 0.2), 1.1, -0.02), pole: new THREE.Vector3(s, -0.6, -0.4), at: new THREE.Vector3() })
    }

    /* the cup: in his right hand, on the table by her */
    this.cup = cocoaCup(him ? 0xc8102e : 0xf2ead8)
    g.add(this.cup)
    // (on the little table between the chairs, by her right hand)
    this.cupHome = him ? null : new THREE.Vector3(0.48, 0.69, 0.18)
    if (!him) {
      // her knitting: two needles and the scarf growing between them
      for (const s of [-1, 1]) {
        const n = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.24, 5), new THREE.MeshStandardMaterial({ color: 0xc0c4cc, metalness: 0.8, roughness: 0.3 }))
        this.needles.push(n)
        g.add(n)
        void s
      }
      const knit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.012), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 1 }))
      knit.position.set(0, 0.72, 0.36)
      knit.rotation.x = -0.9
      g.add(knit)
    }
    g.traverse((o) => ((o as THREE.Mesh).isMesh && (o.castShadow = true)))
    this.update(0, 0, null)
  }

  /** The eyes, in the world (for looking at, and for the talk prompt). */
  eyes(out = new THREE.Vector3()) {
    return this.head.localToWorld(out.set(0, 0.03, 0.1))
  }

  /** Something funny: a good long chuckle. */
  laugh() {
    if (this.laughT > 1.6) this.laughT = 0
  }

  /** `look`: what to look at instead (you, close by), or null. */
  update(t: number, dt: number, look: THREE.Vector3 | null) {
    const him = this.kind === 'tomten'
    this.sipT += dt
    this.laughT += dt
    this.blinkT += dt

    // breathing (and the chuckle shaking the belly)
    const laughing = this.laughT < 1.6
    const shake = laughing ? Math.sin(this.laughT * 22) * 0.025 * (1 - this.laughT / 1.6) : 0
    const breath = Math.sin(t * 1.6) * 0.012
    this.belly.scale.set(1 + breath * 0.6 + shake, 1 + breath, (him ? 0.92 : 0.8) * (1 + breath * 0.8 + shake))
    this.torso.rotation.x = -0.1 - (laughing ? Math.sin(this.laughT * 11) * 0.03 + 0.06 : 0)

    // now and then: a sip, a laugh
    if (t > this.sipAt && this.sipT > 4) {
      this.sipT = 0
      this.sipAt = t + (him ? 12 : 18) + Math.random() * 12
    }
    if (him && t > this.laughAt) {
      this.laugh()
      this.laughAt = t + 25 + Math.random() * 30
    }

    // where to look: you (if you're close), the film, each other, a little glance about
    if (t > this.glance.at) {
      this.glance.at = t + 2.5 + Math.random() * 5
      const r = Math.random()
      this.glance.who = r < 0.55 ? 'film' : r < 0.85 ? 'partner' : 'look'
    }
    let wantYaw = 0
    let wantPitch = -0.05
    const target = look ?? (this.glance.who === 'partner' && this.partner ? this.partner.eyes() : null)
    if (target) {
      const local = this.group.worldToLocal(target.clone())
      const dx = local.x - this.head.position.x
      const dy = local.y - this.head.position.y
      const dz = local.z - this.head.position.z
      wantYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.0, 1.0)
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.4, 0.4)
    } else if (this.glance.who === 'look') wantYaw = Math.sin(t * 0.37) * 0.5
    const sipping = this.sipT < 3.2
    if (sipping) {
      wantYaw *= 0.2
      wantPitch = -0.12
    }
    if (laughing) wantPitch = -0.25
    this.yaw = damp(this.yaw, wantYaw, 3.5, dt)
    this.pitch = damp(this.pitch, wantPitch, 3.5, dt)
    this.head.rotation.set(this.pitch + breath * 0.5, this.yaw, laughing ? Math.sin(this.laughT * 9) * 0.04 : 0, 'YXZ')
    this.head.position.y = (him ? 1.36 : 1.33) + breath * 0.8 + shake * 0.6
    for (const [i, s] of this.hat.entries()) s.rotation.z = (i ? -0.42 : -0.15) + Math.sin(t * 1.3 + i) * 0.02 - this.yaw * 0.05 * i

    // blinking (and a squint when laughing)
    if (this.blinkT > 0.18 && t > this.blinkAt) {
      this.blinkT = 0
      this.blinkAt = t + 2 + Math.random() * 4
    }
    const blink = this.blinkT < 0.18 ? Math.sin((this.blinkT / 0.18) * Math.PI) : 0
    for (const l of this.lids) l.scale.y = Math.max(blink, laughing ? 0.75 : 0.3)
    if (this.mouthOpen) this.mouthOpen.scale.y = laughing ? 1.6 : 1

    // the hands: where they want to be this moment
    const mouth = this.head.localToWorld(new THREE.Vector3(0.02, -0.05, 0.2))
    this.group.worldToLocal(mouth)
    // a sip: up to the mouth (from the lap for him; from the side table for her), tip, and back
    const sip = sipping ? THREE.MathUtils.smoothstep(this.sipT, 0, 0.9) * (1 - THREE.MathUtils.smoothstep(this.sipT, 2.2, 3.2)) : 0
    const R = this.arms[1]
    const L = this.arms[0]
    let tip = 0
    if (him) {
      const rest = new THREE.Vector3(0.12, 0.84, 0.3)
      R.at.lerpVectors(rest, mouth.clone().add(new THREE.Vector3(0.02, -0.06, 0.02)), sip)
      tip = THREE.MathUtils.smoothstep(this.sipT, 0.8, 1.3) * (1 - THREE.MathUtils.smoothstep(this.sipT, 1.9, 2.4))
      // the other hand on his belly – patting it when he laughs
      L.at.set(-0.1, 0.78 + (laughing ? Math.abs(Math.sin(this.laughT * 11)) * 0.04 : 0), 0.32)
    } else {
      // knitting in her lap, needles clicking – or reaching for the cup
      const knitL = new THREE.Vector3(-0.07, 0.76 + Math.sin(t * 6) * 0.01, 0.34)
      const knitR = new THREE.Vector3(0.07, 0.76 + Math.sin(t * 6 + Math.PI) * 0.01, 0.34)
      const home = this.cupHome!
      const reach = sipping ? THREE.MathUtils.smoothstep(this.sipT, 0, 0.5) * (1 - THREE.MathUtils.smoothstep(this.sipT, 2.7, 3.2)) : 0
      const lift = sipping ? THREE.MathUtils.smoothstep(this.sipT, 0.5, 1.2) * (1 - THREE.MathUtils.smoothstep(this.sipT, 2.0, 2.7)) : 0
      R.at.lerpVectors(knitR, home, reach).lerp(mouth.clone().add(new THREE.Vector3(0.02, -0.06, 0.02)), lift)
      L.at.copy(knitL)
      tip = THREE.MathUtils.smoothstep(this.sipT, 1.1, 1.5) * (1 - THREE.MathUtils.smoothstep(this.sipT, 1.8, 2.1))
      // the needles follow the hands, crossing; the cup stays on the table unless lifted
      const [n0, n1] = this.needles
      n0.position.copy(L.at).add(new THREE.Vector3(0.04, 0.02, 0.02))
      n0.rotation.set(-0.5, 0, -0.9 + Math.sin(t * 6) * 0.15)
      n1.position.copy(knitR).add(new THREE.Vector3(-0.04, 0.02, 0.02))
      n1.rotation.set(-0.5, 0, 0.9 - Math.sin(t * 6) * 0.15)
      n1.visible = reach < 0.5
    }
    for (const a of this.arms) {
      const sh = a.shoulder.clone()
      sh.y += breath * 0.5 + shake * 0.5
      const e = elbow(sh, a.at, 0.29, 0.26, a.pole, this.elbowTmp)
      aim(a.up, sh, e)
      aim(a.fore, e, a.at)
      a.hand.position.copy(a.at)
      a.hand.quaternion.copy(a.fore.quaternion)
    }
    // the cup: in the hand (tipped to drink), or on the table
    const held = him || (this.sipT < 3.2 && this.sipT > 0.5 && this.sipT < 2.7)
    if (held) {
      this.cup.position.copy(R.at).add(new THREE.Vector3(-0.01, 0.03, 0.03))
      this.cup.rotation.set(-tip * 1.1, -0.4, 0)
    } else {
      this.cup.position.copy(this.cupHome!)
      this.cup.rotation.set(0, 0.6, 0)
    }
    const steam = this.cup.userData.steam as THREE.Sprite
    steam.material.opacity = 0.5 + Math.sin(t * 2) * 0.2
    steam.position.y = 0.1 + ((t * 0.3) % 0.06)
  }
}
