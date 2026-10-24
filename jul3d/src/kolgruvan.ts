// Kolgruvan – the secret coal mine. The nissar who weren't quite nice enough to work in Leksaksfabriken
// work down here instead, digging out all the coal that goes to the naughty children. The way in is
// a hollow old stump, hidden behind a fir at the far west edge of the village: stand right at it and
// look down into it, and you can climb down. Below: a ladder shaft and timbered tunnels to Stora orten,
// a great cavern lit by lanterns where sooty nissar with headlamps hack at the coal faces, singing the
// boatmen's song in deep dark voices, their picks coming down on the heave; Svartsjön, a black lake
// with glowing mushrooms and an old miner fishing; Sorteringen, where the coal goes into sacks and
// Gruvexpressen leaves from (gruvvagn.ts); the foreman's office with Stygga listan; and deepest of
// all, Kristallgrottan.
// Everything down here is a scene of its own (like the bull ring): x/z on the mine floor, the shaft at
// the origin, the tunnels running north (−z) from it.
import * as THREE from 'three'
import { bakeStatic, keepApart, mergeRigid } from './batch'
import { Nisse } from './npc'
import { Playlist, blip, noise } from './sfx'
import { SUNG } from './sung'
import { glowTexture, makeCanvas, toTexture } from './tex'
import type { Circle } from './world'
import type { HackSpot } from './kolhackning'
import { MINE_TALK } from './gruvfolk'
import { html, type Talk } from './ui'
import { wallClock } from './korsang'

const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

/* ---------- the stump, up in the village ---------- */

/** Where the stump is: behind the fir at the west edge of the village, right against the forest. */
export const STUMP = new THREE.Vector3(-40.4, 0, -13.9)

export function buildStump(scene: THREE.Scene) {
  const g = new THREE.Group()
  g.position.copy(STUMP)
  const bark = std(0x4a3524, 0.95)
  const wood = std(0x7a5a3a, 0.9)
  const snow = std(0xf4f8ff, 0.9)
  // an old stump, broad and hollow, roots spreading into the snow
  const R = 0.62
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.18, 0.75, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95, side: THREE.DoubleSide }))
  shell.position.y = 0.37
  g.add(shell)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.04, 0.07, 6, 16), wood)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.75
  g.add(rim)
  // snow on the rim, but not in the hole
  const cap = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.06, 5, 16, Math.PI * 1.3), snow)
  cap.rotation.x = Math.PI / 2
  cap.position.y = 0.8
  g.add(cap)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.9, 6), bark)
    root.position.set(Math.cos(a) * (R + 0.25), 0.08, Math.sin(a) * (R + 0.25))
    root.rotation.set(0, -a, Math.PI / 2 - 0.25)
    root.rotation.order = 'YZX'
    g.add(root)
  }
  // inside: dark, a ladder's top rungs going down – and far below, the faintest warm glow
  const hole = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 14), new THREE.MeshBasicMaterial({ color: 0x050302 }))
  hole.rotation.x = -Math.PI / 2
  hole.position.y = 0.12
  g.add(hole)
  for (let i = 0; i < 3; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), wood)
    rung.rotation.z = Math.PI / 2
    rung.position.set(0, 0.62 - i * 0.22, -R + 0.18)
    g.add(rung)
  }
  for (const x of [-0.3, 0.3]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), wood).translateX(x).translateY(0.35).translateZ(-R + 0.18))
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,150,60,0.35)', 'rgba(255,120,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.position.y = 0.16
  glow.scale.setScalar(0.7)
  g.add(keepApart(glow))
  // a thicket of young firs round it, so you'd never see it from the square
  const needles = std(0x1d5236, 0.9)
  const tipMat = std(0xf4f8ff, 0.9)
  for (const [x, z, s] of [[1.6, 1.1, 0.75], [1.4, -1.5, 0.65], [-0.4, 1.9, 0.7], [-1.7, -0.2, 0.8], [0.2, -2.0, 0.6]] as const) {
    const fir = new THREE.Group()
    fir.position.set(x, 0, z)
    fir.scale.setScalar(s)
    fir.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6), bark).translateY(0.3))
    for (const [r, h, y] of [[1.2, 1.6, 1.2], [0.9, 1.3, 2.0], [0.55, 1.0, 2.7]]) {
      fir.add(new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), needles).translateY(y))
      fir.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.4, h * 0.3, 10), tipMat).translateY(y + h * 0.36))
    }
    g.add(fir)
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true
  })
  scene.add(g)
  const colliders: Circle[] = [{ x: STUMP.x, z: STUMP.z, r: R + 0.05 }]
  for (const [x, z, s] of [[1.6, 1.1, 0.75], [1.4, -1.5, 0.65], [-0.4, 1.9, 0.7], [-1.7, -0.2, 0.8], [0.2, -2.0, 0.6]]) colliders.push({ x: STUMP.x + x, z: STUMP.z + z, r: 0.55 * s })
  return {
    group: g,
    colliders,
    /** Right at the stump and looking down into it – only then do you find you can climb in. */
    near(pos: THREE.Vector3, pitch: number) {
      return Math.hypot(pos.x - STUMP.x, pos.z - STUMP.z) < 1.35 && pitch < -0.5
    },
  }
}

/* ---------- the mine ---------- */

// The mine, seen from above (north is −z): the ladder shaft, a tunnel north to Stora orten (the great
// cavern where they dig); off it west to Svartsjön (the black lake), east to Sorteringen (and
// Gruvexpressen's platform), and south down a long winding tunnel past the foreman's office to
// Kristallgrottan, deepest of all.
type Room = { x: number; z: number; rx: number; rz: number; h: number }
const SHAFT_R = 2.6
const ROOMS = {
  hall: { x: 0, z: -25, rx: 11.5, rz: 9.5, h: 7 },
  lake: { x: -31, z: -27, rx: 10, rz: 8, h: 6 },
  sort: { x: 28, z: -22, rx: 8.5, rz: 6.5, h: 5.5 },
  bend: { x: 4, z: -46, rx: 2.6, rz: 2.6, h: 3.4 },
  office: { x: -9.5, z: -52, rx: 4.4, rz: 3.8, h: 3.8 },
  crystal: { x: 5, z: -70, rx: 8, rz: 7.5, h: 7 },
} satisfies Record<string, Room>
/** The tunnels, as centre lines (they reach a little into the rooms at each end). */
const TUNNELS: [number, number, number, number][] = [
  [0, -1.2, 0, -16.2],
  [-11.0, -26, -21.4, -27],
  [11.0, -24, 19.8, -22],
  [0, -34.2, 4, -46],
  [4, -46, 5, -62.8],
  [2.2, -46.6, -5.4, -51],
]
/** Half the width of a tunnel. */
const TUNNEL_W = 1.7
/** The black lake, in Svartsjön (you walk round it). */
const LAKE = { x: -31.5, z: -27.5, rx: 6, rz: 4.2 }
/** Where you arrive at the foot of the ladder, facing down the tunnel. */
export const ARRIVE = { x: 0, z: 0.9, yaw: 0 }
const LADDER = new THREE.Vector3(0, 0, SHAFT_R - 0.25)
/** Gruvexpressen, waiting at its platform in Sorteringen. */
const STATION = { x: 33.2, z: -21.6 }

/** A rough rock texture: dark stone with seams of coal and a glint here and there. */
function rockTexture() {
  const [c, ctx] = makeCanvas(256, 256)
  ctx.fillStyle = '#2b2420'
  ctx.fillRect(0, 0, 256, 256)
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 900; i++) {
    const v = 25 + rnd() * 40
    ctx.fillStyle = `rgba(${v + 10},${v},${v - 6},${0.25 + rnd() * 0.3})`
    ctx.beginPath()
    ctx.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 10, 1 + rnd() * 6, rnd() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  // coal seams
  for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = 'rgba(8,8,10,0.85)'
    ctx.lineWidth = 6 + rnd() * 10
    ctx.beginPath()
    let y = rnd() * 256
    ctx.moveTo(-10, y)
    for (let x = 0; x <= 266; x += 24) ctx.lineTo(x, (y += (rnd() - 0.5) * 18))
    ctx.stroke()
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255,240,200,${0.3 + rnd() * 0.5})`
    ctx.fillRect(rnd() * 256, rnd() * 256, 1, 1)
  }
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Bumps for the rock: the same everywhere for the same point. */
const bump = (x: number, y: number, z: number) => Math.sin(x * 1.3 + z * 0.7) * Math.cos(y * 1.7 - x * 0.4) * 0.35 + Math.sin(z * 2.9 + y * 2.1) * 0.12 + Math.sin(x * 4.1 - z * 3.3) * 0.06

/** Push each vertex of `geo` in or out along `dir(v)` by the rock's bumps. */
function rough(geo: THREE.BufferGeometry, amount: number, dir: (v: THREE.Vector3) => THREE.Vector3) {
  const p = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    v.addScaledVector(dir(v), bump(v.x, v.y, v.z) * amount)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

/** Bake a mesh's place into its geometry and drop the triangles `gone` says (by their middle, in the world). */
function cut(mesh: THREE.Mesh, gone: (c: THREE.Vector3) => boolean) {
  mesh.updateMatrix()
  const geo = mesh.geometry.toNonIndexed().applyMatrix4(mesh.matrix)
  const p = geo.attributes.position as THREE.BufferAttribute
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const keepP: number[] = []
  const keepUv: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    if (gone(a.clone().add(b).add(c).divideScalar(3))) continue
    for (let k = 0; k < 3; k++) {
      keepP.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k))
      keepUv.push(uv.getX(i + k), uv.getY(i + k))
    }
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3))
  out.setAttribute('uv', new THREE.Float32BufferAttribute(keepUv, 2))
  out.computeVertexNormals()
  mesh.geometry = out
  mesh.position.set(0, 0, 0)
  mesh.rotation.set(0, 0, 0)
  mesh.scale.set(1, 1, 1)
  return mesh
}

/** How far (x, z) is from the line from (ax, az) to (bx, bz). */
function toSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax
  const dz = bz - az
  const k = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1)
  return { d: Math.hypot(x - ax - dx * k, z - az - dz * k), px: ax + dx * k, pz: az + dz * k }
}
/** Is this point where a tunnel goes through a wall (so the wall has a hole there)? */
const inTunnel = (c: THREE.Vector3) => c.y < 3.2 && TUNNELS.some(([ax, az, bx, bz]) => toSegment(c.x, c.z, ax, az, bx, bz).d < TUNNEL_W + 0.35)

/** A pick, for a nisse's right hand. */
function pick() {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.7, 6), std(0x7a5a3a, 0.9)).translateY(-0.3))
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.42, 6), std(0x6a6e78, 0.4, 0.7))
  head.rotation.z = Math.PI / 2
  head.position.y = -0.62
  head.scale.set(1, 1, 0.6)
  g.add(head)
  g.position.y = -0.42
  return g
}

/** A sooty miner: dark coat, dark beard, a headlamp on his hat – and a mouth for singing. */
function miner(i: number) {
  const coats = [0x2a2420, 0x34302c, 0x2b2f36, 0x3a2a22]
  const n = new Nisse({ coat: coats[i % coats.length], hat: [0x3a1010, 0x1e2530, 0x2a2a2a][i % 3], pants: 0x1a1816, skin: 0xb59a86, beardColor: [0x2a2622, 0x4a4440, 0x1a1816][i % 3], scale: 0.9, longBeard: i % 2 === 0, trim: false })
  // the headlamp
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c8, toneMapped: false }))
  lamp.rotation.x = Math.PI / 2
  lamp.position.set(0, 0.13, 0.19)
  n.head.add(lamp)
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlow, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  beam.position.set(0, 0.13, 0.25)
  beam.scale.setScalar(0.45)
  n.head.add(beam)
  // a dark mouth just under the moustache, opened by the song
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0x240808, roughness: 0.6 }))
  mouth.position.set(0, -0.115, 0.24)
  mouth.scale.set(1.3, 0.25, 0.6)
  n.head.add(keepApart(mouth))
  return { n, mouth }
}
let lampGlow: THREE.Texture

/** A painted sign on a board. */
function sign(text: string, w: number, h: number, size: number) {
  const [c, ctx] = makeCanvas(512, Math.round((512 * h) / w))
  ctx.fillStyle = '#3a2614'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = '#c8962a'
  ctx.lineWidth = 10
  ctx.strokeRect(8, 8, c.width - 16, c.height - 16)
  ctx.fillStyle = '#f2d48a'
  ctx.font = `bold ${size}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, c.width / 2, c.height / 2 + 4)
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.8 }))
}

export function buildMine() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050403)
  scene.fog = new THREE.FogExp2(0x070504, 0.03)
  scene.add(new THREE.HemisphereLight(0x6a5644, 0x1a140e, 0.6))
  lampGlow = glowTexture('rgba(255,236,190,0.9)', 'rgba(255,200,120,0)')
  const lanternGlow = glowTexture('rgba(255,190,110,0.8)', 'rgba(255,140,50,0)')
  const statics = new THREE.Group()
  scene.add(statics)
  const obstacles: Circle[] = []
  let seed = 9
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const updaters: ((t: number, dt: number) => void)[] = []

  const tex = rockTexture()
  const rock = (rx: number, ry: number) => {
    const t = tex.clone()
    t.repeat.set(rx, ry)
    t.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.BackSide })
  }
  const floorTex = tex.clone()
  floorTex.repeat.set(24, 24)
  floorTex.needsUpdate = true
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ map: floorTex, color: 0x9a8a7a, roughness: 1 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, -35)
  statics.add(floor)
  const wood = std(0x6a4a2e, 0.9)
  const darkWood = std(0x4a3220, 0.95)
  const iron = std(0x1a1a1e, 0.5, 0.6)
  const railMat = std(0x5a5e66, 0.4, 0.7)
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false })
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.3, metalness: 0.35 })
  const lumpGeo = new THREE.DodecahedronGeometry(0.16, 0)
  const lumps: THREE.Matrix4[] = []
  const q = new THREE.Quaternion()

  /** A lantern: hanging (from the dome) or on a post; only some of them really light the place. */
  const lantern = (x: number, y: number, z: number, light = 0, reach = 16, post = false) => {
    statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), lanternMat).translateX(x).translateY(y).translateZ(z))
    statics.add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 4), iron).translateX(x).translateY(y + 0.19).translateZ(z).rotateY(Math.PI / 4))
    if (post) {
      statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, y + 0.3, 0.16), darkWood).translateX(x).translateY((y + 0.3) / 2).translateZ(z + 0.25))
      obstacles.push({ x, z: z + 0.25, r: 0.2 })
    } else statics.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), iron).translateX(x).translateY(y + 0.9).translateZ(z))
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: lanternGlow, blending: THREE.AdditiveBlending, depthWrite: false }))
    g.position.set(x, y, z)
    g.scale.setScalar(1.5)
    statics.add(keepApart(g))
    if (light) {
      const l = new THREE.PointLight(0xffa860, light, reach, 1.5)
      l.position.set(x, y - 0.1, z)
      scene.add(l)
    }
  }

  /* ---------- the rock: shaft, rooms and tunnels ---------- */
  // the shaft: a rough round hole going up to the stump, the ladder up its side
  const shaftWall = new THREE.Mesh(rough(new THREE.CylinderGeometry(SHAFT_R + 0.3, SHAFT_R + 0.5, 12, 24, 8, true), 0.6, (v) => new THREE.Vector3(v.x, 0, v.z).normalize()), rock(3, 4))
  shaftWall.position.y = 6
  statics.add(cut(shaftWall, inTunnel))
  for (const x of [-0.3, 0.3]) statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 11.5, 0.07), wood).translateX(LADDER.x + x).translateY(5.75).translateZ(LADDER.z))
  for (let y = 0.3; y < 11.4; y += 0.32) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), wood)
    r.rotation.z = Math.PI / 2
    r.position.set(LADDER.x, y, LADDER.z)
    statics.add(r)
  }
  // a faint cold light from the hole far above
  const sky = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(180,200,255,0.55)', 'rgba(120,150,255,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  sky.position.set(0, 11.5, 0.8)
  sky.scale.setScalar(3.5)
  statics.add(keepApart(sky))
  const skyLight = new THREE.PointLight(0x8aa0ff, 4, 9, 1.6)
  skyLight.position.set(0, 8, 0.5)
  scene.add(skyLight)

  // the rooms: rough domes with holes where the tunnels come in
  for (const r of Object.values(ROOMS)) {
    const dome = new THREE.Mesh(rough(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), 0.09, (v) => v.clone().normalize()), rock(Math.max(3, r.rx * 0.6), 3))
    dome.scale.set(r.rx + 1.2, r.h, r.rz + 1.2)
    dome.position.set(r.x, 0, r.z)
    statics.add(cut(dome, inTunnel))
    // stalactites
    const stoneMat = std(0x3a322c, 0.9)
    for (let i = 0; i < Math.round(r.rx * r.rz * 0.35); i++) {
      const a = rnd() * Math.PI * 2
      const k = Math.sqrt(rnd()) * 0.85
      const y = r.h * Math.sqrt(Math.max(0.05, 1 - k * k)) - 0.2
      const h = Math.min(r.h * 0.3, 0.5 + rnd() * 1.6)
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.1 + rnd() * 0.22, h, 6), stoneMat)
      s.rotation.x = Math.PI
      s.position.set(r.x + Math.cos(a) * k * r.rx, y - h / 2, r.z + Math.sin(a) * k * r.rz)
      statics.add(s)
    }
  }
  // the tunnels: rough half-pipes along their lines, timbered every couple of metres
  TUNNELS.forEach(([ax, az, bx, bz], ti) => {
    const len = Math.hypot(bx - ax, bz - az)
    const yaw = Math.atan2(bx - ax, bz - az)
    const geo = rough(new THREE.CylinderGeometry(TUNNEL_W + 0.6, TUNNEL_W + 0.6, len + 1.6, 16, Math.max(2, Math.round(len / 1.5)), true, Math.PI / 2 - 1.2, Math.PI + 2.4), 0.45, (v) => new THREE.Vector3(v.x, 0, v.z).normalize())
    geo.rotateX(Math.PI / 2).translate(0, 0.6, 0).rotateY(yaw).translate((ax + bx) / 2, 0, (az + bz) / 2)
    const others = TUNNELS.filter((_, j) => j !== ti)
    statics.add(cut(new THREE.Mesh(geo, rock(2, Math.max(1, len / 4))), (c) => c.y < 3.2 && others.some(([cx, cz, dx, dz]) => toSegment(c.x, c.z, cx, cz, dx, dz).d < TUNNEL_W + 0.35)))
    const g = new THREE.Group()
    g.position.set((ax + bx) / 2, 0, (az + bz) / 2)
    g.rotation.y = yaw
    for (let d = -len / 2 + 1.3; d < len / 2 - 0.8; d += 2.6) {
      for (const x of [-1.45, 1.45]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.22), darkWood).translateX(x).translateY(1.45).translateZ(d))
      g.add(new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.24, 0.26), darkWood).translateY(2.95).translateZ(d))
    }
    statics.add(g)
    // lanterns along it (lighting only in the first, short one: the rest glow)
    const n = Math.max(1, Math.floor(len / 6))
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n
      const side = i % 2 ? 1 : -1
      const px = ax + (bx - ax) * k + Math.cos(yaw) * side * 1.2
      const pz = az + (bz - az) * k - Math.sin(yaw) * side * 1.2
      lantern(px, 2.55, pz, ti === 0 && i === 0 ? 9 : 0, 13)
    }
  })

  /* ---------- rails ---------- */
  const rails = (pts: [number, number][], closed = false) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.06, z)), closed, 'catmullrom', 0.4)
    const n = Math.round(curve.getLength() / 0.7)
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(Math.min(1, i / n))
      const t = curve.getTangentAt(Math.min(1, i / n))
      const yaw = Math.atan2(t.x, t.z)
      const sl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.18), darkWood)
      sl.position.copy(p).setY(0.04)
      sl.rotation.y = yaw
      statics.add(sl)
      for (const side of [-0.42, 0.42]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.72), railMat)
        r.position.set(p.x + Math.cos(yaw) * side, 0.12, p.z - Math.sin(yaw) * side)
        r.rotation.y = yaw
        statics.add(r)
      }
    }
    return curve
  }
  rails([[0, -2], [0, -14], [1.5, -17]])
  const loop = rails([[1.5, -17], [6, -19], [8.3, -25], [6, -30], [0, -31.5], [-6, -30], [-8.3, -25], [-6, -19], [-1.5, -17], [0, -16.2]], true)
  rails([[8.3, -25], [12, -24], [20, -22.2], [27, -21.8], [STATION.x + 2.5, STATION.z]])

  /* ---------- Stora orten: where they dig, and sing ---------- */
  const hall = ROOMS.hall
  const heap = (x: number, z: number, r: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * r
      const y = (1 - d / r) * r * 0.7 + 0.05
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3))
      const s = 0.6 + rnd() * 0.9
      lumps.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * d, y, z + Math.sin(a) * d), q, new THREE.Vector3(s, s, s)))
    }
    obstacles.push({ x, z, r: r * 0.85 })
  }
  heap(3, -26.5, 1.3, 110)
  heap(-3.5, -22, 0.9, 60)
  // the coal faces round the walls (clear of the tunnel mouths), a miner at each
  const faces = [122, 150, 205, 226, 302, 328, 32, 58].map((deg) => {
    const a = THREE.MathUtils.degToRad(deg)
    const x = hall.x + Math.cos(a) * hall.rx * 0.95
    const z = hall.z + Math.sin(a) * hall.rz * 0.95
    // (facing out, at the rock)
    return { x, z, yaw: Math.atan2(x - hall.x, (z - hall.z) * (hall.rx / hall.rz)) }
  })
  for (const f of faces) {
    const bx = f.x + Math.sin(f.yaw) * 1.5
    const bz = f.z + Math.cos(f.yaw) * 1.5
    for (let i = 0; i < 44; i++) {
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3))
      const s = 0.55 + rnd() * 0.9
      const side = (rnd() - 0.5) * 2.2
      lumps.push(new THREE.Matrix4().compose(new THREE.Vector3(bx + Math.cos(f.yaw) * side, 0.3 + rnd() * 1.8, bz - Math.sin(f.yaw) * side), q, new THREE.Vector3(s, s, s)))
    }
  }
  // a free seam of your own, with a pick left leaning on a rock and a tub for the coal (kolhackning.ts)
  const hackA = THREE.MathUtils.degToRad(249)
  const hx = hall.x + Math.cos(hackA) * hall.rx * 0.88
  const hz = hall.z + Math.sin(hackA) * hall.rz * 0.88
  const hyaw = Math.atan2(hx - hall.x, (hz - hall.z) * (hall.rx / hall.rz))
  const hack: HackSpot = { x: hx, z: hz, yaw: hyaw, seam: new THREE.Vector3(hx + Math.sin(hyaw) * 1.25, 1.2, hz + Math.cos(hyaw) * 1.25) }
  for (let i = 0; i < 90; i++) {
    q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3))
    const s = 0.6 + rnd() * 1.2
    const side = (rnd() - 0.5) * 2.8
    lumps.push(new THREE.Matrix4().compose(new THREE.Vector3(hack.seam.x + Math.cos(hyaw) * side + Math.sin(hyaw) * 0.15, 0.3 + rnd() * 1.9, hack.seam.z - Math.sin(hyaw) * side + Math.cos(hyaw) * 0.15), q, new THREE.Vector3(s, s, s)))
  }
  const restRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), std(0x3a322c, 0.9))
  const rx0 = hx + Math.cos(hyaw) * 1.3 + Math.sin(hyaw) * 0.6
  const rz0 = hz - Math.sin(hyaw) * 1.3 + Math.cos(hyaw) * 0.6
  restRock.position.set(rx0, 0.2, rz0)
  statics.add(restRock)
  const leaning = pick()
  leaning.position.set(rx0, 0.95, rz0)
  leaning.rotation.set(0.35, hyaw, 0.2)
  statics.add(leaning)
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 0.5, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.9, side: THREE.DoubleSide }))
  const tx = hx - Math.cos(hyaw) * 1.3 + Math.sin(hyaw) * 0.7
  const tz = hz + Math.sin(hyaw) * 1.3 + Math.cos(hyaw) * 0.7
  tub.position.set(tx, 0.25, tz)
  statics.add(tub)
  obstacles.push({ x: rx0, z: rz0, r: 0.4 }, { x: tx, z: tz, r: 0.5 })
  const free = sign('LEDIG ÅDER', 1.2, 0.3, 64)
  free.position.set(rx0 - Math.sin(hyaw) * 0.1, 1.55, rz0 - Math.cos(hyaw) * 0.1)
  free.rotation.y = hyaw + Math.PI
  statics.add(free)
  statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), darkWood).translateX(rx0 + Math.sin(hyaw) * 0.05).translateY(0.75).translateZ(rz0 + Math.cos(hyaw) * 0.05))

  lantern(0, 4.2, -25, 70, 30)
  lantern(-5, 3.8, -29.5, 0)
  lantern(5, 3.8, -20.5, 0)
  lantern(7.2, 2.4, -29, 32, 18, true)

  // carts on the loop, trundling round, heaped with coal
  const cartBody = std(0x4a3a30, 0.6, 0.4)
  const makeCart = () => {
    const g = new THREE.Group()
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.3), cartBody)
    box.position.y = 0.55
    g.add(box)
    for (const x of [-0.42, 0.42]) for (const z of [-0.42, 0.42]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), railMat)
      w.rotation.z = Math.PI / 2
      w.position.set(x, 0.18, z)
      g.add(w)
    }
    for (let i = 0; i < 14; i++) {
      const l = new THREE.Mesh(lumpGeo, coalMat)
      l.position.set((rnd() - 0.5) * 0.6, 0.85 + rnd() * 0.15, (rnd() - 0.5) * 1)
      l.rotation.set(rnd() * 3, rnd() * 3, 0)
      g.add(l)
    }
    mergeRigid(g)
    scene.add(g)
    return g
  }
  const carts = [0, 1, 2].map((i) => ({ g: makeCart(), k: i / 3 }))
  updaters.push((_t, dt) => {
    for (const c of carts) {
      c.k = (c.k + dt * 0.012) % 1
      const p = loop.getPointAt(c.k)
      const tn = loop.getTangentAt(c.k)
      c.g.position.set(p.x, 0.02, p.z)
      c.g.rotation.y = Math.atan2(tn.x, tn.z)
    }
  })
  const miners = faces.map((f, i) => {
    const { n, mouth } = miner(i)
    n.group.position.set(f.x, 0, f.z)
    // (half turned from the rock, so you see them sing as you come by)
    n.setYaw(f.yaw + (i % 2 ? 0.95 : -0.95))
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlow, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }))
    spot.position.set(f.x + Math.sin(f.yaw) * 1.3, 1.2, f.z + Math.cos(f.yaw) * 1.3)
    spot.scale.setScalar(2.2)
    scene.add(spot)
    n.armR.add(pick())
    n.armL.rotation.set(-1.0, 0, 0.3)
    mergeRigid(n.group)
    scene.add(n.group)
    obstacles.push({ x: f.x, z: f.z, r: 0.45 })
    return { n, mouth, phase: rnd() * 6, swing: 0, open: 0 }
  })

  /* ---------- Svartsjön: a still black lake, glowing mushrooms, an old miner fishing ---------- */
  const lake = ROOMS.lake
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x0a1620, roughness: 0.05, metalness: 0.9 }))
  water.rotation.x = -Math.PI / 2
  water.scale.set(LAKE.rx, LAKE.rz, 1)
  water.position.set(LAKE.x, 0.04, LAKE.z)
  statics.add(water)
  const shoreMat = std(0x3a322c, 0.9)
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2
    const s = 0.25 + rnd() * 0.35
    statics.add(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), shoreMat).translateX(LAKE.x + Math.cos(a) * LAKE.rx * (1.02 + rnd() * 0.06)).translateY(s * 0.3).translateZ(LAKE.z + Math.sin(a) * LAKE.rz * (1.02 + rnd() * 0.06)))
  }
  // glowing mushrooms in clumps round the shore and the walls
  const capMat = new THREE.MeshBasicMaterial({ color: 0x6ff0e0, toneMapped: false })
  const stemMat = std(0xd8e8e0, 0.6)
  const shroomGlow = glowTexture('rgba(120,255,230,0.7)', 'rgba(60,200,200,0)')
  for (let c = 0; c < 14; c++) {
    const a = rnd() * Math.PI * 2
    const k = c % 2 ? 1.12 : 0.88
    const cx = c % 2 ? LAKE.x + Math.cos(a) * LAKE.rx * k : lake.x + Math.cos(a) * lake.rx * 0.9
    const cz = c % 2 ? LAKE.z + Math.sin(a) * LAKE.rz * k : lake.z + Math.sin(a) * lake.rz * 0.9
    for (let i = 0; i < 5; i++) {
      const x = cx + (rnd() - 0.5) * 0.6
      const z = cz + (rnd() - 0.5) * 0.6
      const h = 0.08 + rnd() * 0.2
      statics.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 5), stemMat).translateX(x).translateY(h / 2).translateZ(z))
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05 + rnd() * 0.05, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMat)
      cap.position.set(x, h, z)
      statics.add(cap)
    }
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: shroomGlow, blending: THREE.AdditiveBlending, depthWrite: false }))
    g.position.set(cx, 0.25, cz)
    g.scale.setScalar(1.4)
    statics.add(keepApart(g))
  }
  const lakeLight = new THREE.PointLight(0x60d8ff, 22, 22, 1.4)
  lakeLight.position.set(lake.x, 3.5, lake.z)
  scene.add(lakeLight)
  // a rowing boat pulled up on the shore
  const boat = new THREE.Group()
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.85, side: THREE.DoubleSide }))
  hull.scale.set(0.6, 0.35, 1.5)
  hull.position.y = 0.35
  boat.add(hull)
  boat.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.25), wood).translateY(0.3))
  const oar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.8), wood)
  oar.position.set(0.4, 0.45, 0.2)
  oar.rotation.y = 0.3
  boat.add(oar)
  boat.position.set(LAKE.x + LAKE.rx * 0.95, 0, LAKE.z - 1.8)
  boat.rotation.y = 0.4
  statics.add(boat)
  // the old miner, sat on a rock with his rod out over the water
  const fisher = miner(4)
  const seat = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), shoreMat)
  const fx = LAKE.x - 1.2
  const fz = LAKE.z + LAKE.rz + 0.9
  seat.position.set(fx, 0.2, fz)
  statics.add(seat)
  obstacles.push({ x: fx, z: fz, r: 0.6 })
  fisher.n.group.position.set(fx, 0.42, fz)
  fisher.n.setYaw(Math.PI)
  fisher.n.sit(true)
  fisher.n.armR.rotation.set(-1.4, 0, 0)
  fisher.n.armL.rotation.set(-1.3, 0, 0.3)
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 2.4, 5), wood)
  rod.position.set(0, -0.5, 1.0)
  rod.rotation.x = Math.PI / 2 - 0.5
  fisher.n.armR.add(rod)
  mergeRigid(fisher.n.group)
  scene.add(fisher.n.group)
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.6, 3), std(0xd0d0d0, 0.5))
  line.position.set(fx, 1.1, fz - 2.15)
  statics.add(line)
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0xd8202c, 0.5))
  scene.add(float)
  updaters.push((t) => {
    float.position.set(fx, 0.08 + Math.sin(t * 1.3) * 0.02, fz - 2.15)
    fisher.n.head.rotation.x = 0.15 + Math.sin(t * 0.3) * 0.05
  })

  /* ---------- Sorteringen: the coal on a belt, sorted into sacks – and Gruvexpressen's platform ---------- */
  const sort = ROOMS.sort
  const belt = new THREE.Group()
  belt.position.set(sort.x - 1, 0, sort.z + 2.6)
  belt.add(new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.9), std(0x22201e, 0.7)).translateY(0.85))
  for (const z of [-0.5, 0.5]) belt.add(new THREE.Mesh(new THREE.BoxGeometry(8, 0.22, 0.08), iron).translateY(0.8).translateZ(z))
  for (let x = -3.6; x <= 3.6; x += 1.2) for (const z of [-0.45, 0.45]) belt.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), iron).translateX(x).translateY(0.4).translateZ(z))
  statics.add(belt)
  obstacles.push(...[-3, -1, 1, 3].map((x) => ({ x: belt.position.x + x, z: belt.position.z, r: 0.75 })))
  const riding = new THREE.InstancedMesh(lumpGeo, coalMat, 24)
  riding.frustumCulled = false
  scene.add(riding)
  const m4 = new THREE.Matrix4()
  updaters.push((t) => {
    for (let i = 0; i < 24; i++) {
      const k = (t * 0.06 + i / 24) % 1
      q.setFromEuler(new THREE.Euler(i, i * 2, 0))
      riding.setMatrixAt(i, m4.compose(new THREE.Vector3(belt.position.x - 4 + k * 8, 1.0, belt.position.z + Math.sin(i * 7) * 0.25), q, new THREE.Vector3(1, 1, 1)))
    }
    riding.instanceMatrix.needsUpdate = true
  })
  // two sorters at the belt
  const sorters = [-1.5, 1.8].map((dx, i) => {
    const { n } = miner(i + 2)
    n.group.position.set(belt.position.x + dx, 0, belt.position.z - 1.0)
    n.setYaw(0)
    mergeRigid(n.group)
    scene.add(n.group)
    obstacles.push({ x: belt.position.x + dx, z: belt.position.z - 1.0, r: 0.45 })
    return n
  })
  updaters.push((t) => sorters.forEach((n, i) => {
    n.armR.rotation.x = -1.2 + Math.sin(t * 3 + i * 2) * 0.4
    n.armL.rotation.x = -1.2 + Math.sin(t * 3 + i * 2 + 1.5) * 0.4
  }))
  // sacks of coal, tied up and labelled, ready to go up
  const [sc, sctx] = makeCanvas(128, 64)
  sctx.fillStyle = '#8a6a48'
  sctx.fillRect(0, 0, 128, 64)
  sctx.fillStyle = '#1a1010'
  sctx.font = 'bold 34px Georgia, serif'
  sctx.textAlign = 'center'
  sctx.fillText('KOL', 64, 44)
  const sackMat = std(0x8a6a48, 1)
  const labelMat = new THREE.MeshStandardMaterial({ map: toTexture(sc), roughness: 1 })
  for (let i = 0; i < 9; i++) {
    const x = sort.x - 5.5 + (i % 3) * 0.85 + (rnd() - 0.5) * 0.2
    const z = sort.z - 3.2 + Math.floor(i / 3) * 0.8
    const a = (rnd() - 0.5) * 1.2
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), sackMat)
    s.scale.set(1, 1.35, 0.85)
    s.position.set(x, 0.55, z)
    s.rotation.y = a
    statics.add(s)
    statics.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), std(0xb3202a, 0.6)).translateX(x).translateY(1.05).translateZ(z).rotateX(Math.PI / 2))
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), labelMat)
    label.position.set(x + Math.sin(a) * 0.37, 0.62, z + Math.cos(a) * 0.37)
    label.rotation.y = a
    statics.add(label)
  }
  obstacles.push({ x: sort.x - 4.6, z: sort.z - 2.4, r: 1.5 })
  const sortSign = sign('SORTERINGEN', 2.6, 0.55, 64)
  sortSign.position.set(sort.x - 1, 2.6, sort.z + 3.6)
  sortSign.rotation.y = Math.PI
  statics.add(sortSign)
  lantern(sort.x - 1, 3.6, sort.z, 30, 18)
  // the platform, with Gruvexpressen waiting at it and a black tunnel mouth beyond
  const platform = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 3.2), darkWood)
  platform.position.set(STATION.x - 1.5, 0.12, STATION.z)
  statics.add(platform)
  const express = new THREE.Group()
  express.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.35), std(0x8a2020, 0.5, 0.4)).translateY(0.58))
  express.add(new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.06, 1.41), std(0xc8962a, 0.35, 0.8)).translateY(0.89))
  for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 14), railMat)
    w.rotation.z = Math.PI / 2
    w.position.set(x, 0.2, z)
    express.add(w)
  }
  express.position.set(STATION.x, 0, STATION.z)
  express.rotation.y = Math.PI / 2
  statics.add(express)
  obstacles.push({ x: STATION.x, z: STATION.z, r: 0.75 })
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.5, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x000000 }))
  mouth.position.set(sort.x + sort.rx + 0.9, 0, STATION.z)
  mouth.rotation.y = -Math.PI / 2
  statics.add(mouth)
  const expressSign = sign('GRUVEXPRESSEN', 2.4, 0.5, 58)
  // (over the end of the platform, facing you as you come in)
  expressSign.position.set(STATION.x - 2.4, 2.3, STATION.z)
  expressSign.rotation.y = -Math.PI / 2
  statics.add(expressSign)
  for (const dz of [-1.15, 1.15]) statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.1), darkWood).translateX(STATION.x - 2.45).translateY(1.25).translateZ(STATION.z + dz))
  obstacles.push({ x: STATION.x - 2.45, z: STATION.z - 1.15, r: 0.15 }, { x: STATION.x - 2.45, z: STATION.z + 1.15, r: 0.15 })

  /* ---------- the foreman's office, and Stygga listan ---------- */
  const office = ROOMS.office
  const [lc, lctx] = makeCanvas(256, 384)
  lctx.fillStyle = '#e8d8b0'
  lctx.fillRect(0, 0, 256, 384)
  lctx.fillStyle = '#5a1010'
  lctx.font = 'bold 30px Georgia, serif'
  lctx.textAlign = 'center'
  lctx.fillText('STYGGA', 128, 46)
  lctx.fillText('LISTAN', 128, 82)
  lctx.strokeStyle = '#2a1a10'
  lctx.lineWidth = 2
  for (let y = 110; y < 360; y += 22) {
    lctx.beginPath()
    lctx.moveTo(30, y)
    for (let x = 30; x < 226; x += 8) lctx.lineTo(x, y + Math.sin(x * 0.7 + y) * 2)
    lctx.stroke()
  }
  lctx.fillStyle = '#5a1010'
  lctx.font = 'italic 18px Georgia, serif'
  lctx.fillText('…och så vidare', 128, 372)
  const listTex = toTexture(lc)
  const board = new THREE.Group()
  board.position.set(office.x - 1.2, 0, office.z - office.rz + 0.5)
  board.add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.95), new THREE.MeshStandardMaterial({ map: listTex, roughness: 0.9 })).translateY(1.6))
  for (const x of [-0.72, 0.72]) board.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.12), darkWood).translateX(x).translateY(1.35).translateZ(-0.05))
  statics.add(board)
  obstacles.push({ x: board.position.x, z: board.position.z, r: 0.8 })
  // and the rest of the list, unrolled across the floor
  const scroll = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3), new THREE.MeshStandardMaterial({ map: listTex, roughness: 0.9 }))
  scroll.rotation.x = -Math.PI / 2
  scroll.position.set(office.x - 1.2, 0.02, office.z - office.rz + 2.6)
  statics.add(scroll)
  statics.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 10), std(0xe8d8b0, 0.9)).translateX(office.x - 1.2).translateY(0.09).translateZ(office.z - office.rz + 4.1).rotateZ(Math.PI / 2))
  // the desk, a candle, the ledgers
  const desk = new THREE.Group()
  desk.position.set(office.x + 1.8, 0, office.z - 0.6)
  desk.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.8), wood).translateY(0.75))
  for (const x of [-0.68, 0.68]) for (const z of [-0.33, 0.33]) desk.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), darkWood).translateX(x).translateY(0.37).translateZ(z))
  for (let i = 0; i < 5; i++) desk.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.3), std([0x5a1010, 0x1e3a5a, 0x2a4a2a][i % 3], 0.8)).translateX(-0.45).translateY(0.82 + i * 0.06).rotateY(i * 0.2))
  desk.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), std(0xfbf8f2, 0.5)).translateX(0.45).translateY(0.88))
  desk.add(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 6), lanternMat).translateX(0.45).translateY(1.0))
  statics.add(desk)
  obstacles.push({ x: desk.position.x, z: desk.position.z, r: 0.85 })
  const candle = new THREE.PointLight(0xffb060, 10, 9, 1.5)
  candle.position.set(desk.position.x + 0.45, 1.2, desk.position.z)
  scene.add(candle)
  // the foreman: bigger, holding up a lantern by the list
  const foreman = miner(1)
  foreman.n.group.scale.setScalar(0.95)
  foreman.n.group.position.set(office.x + 0.3, 0, office.z - office.rz + 1.1)
  foreman.n.setYaw(0.4)
  foreman.n.armL.rotation.set(-2.2, 0, 0.1)
  const held = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), lanternMat)
  held.position.y = -0.48
  foreman.n.armL.add(held)
  mergeRigid(foreman.n.group)
  scene.add(foreman.n.group)
  obstacles.push({ x: foreman.n.group.position.x, z: foreman.n.group.position.z, r: 0.45 })

  /* ---------- Kristallgrottan: deepest of all, glittering ---------- */
  const crystal = ROOMS.crystal
  const crystalMats = [0xb070ff, 0x60b0ff, 0xff70d0].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88 }))
  const crystalGlow = glowTexture('rgba(190,140,255,0.6)', 'rgba(120,90,255,0)')
  const cluster = (x: number, z: number, size: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const h = size * (0.5 + rnd())
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), crystalMats[Math.floor(rnd() * 3)])
      c.scale.set(h * 0.18, h, h * 0.18)
      c.position.set(x + (rnd() - 0.5) * size * 0.8, h * 0.6, z + (rnd() - 0.5) * size * 0.8)
      c.rotation.set((rnd() - 0.5) * 0.8, rnd() * 3, (rnd() - 0.5) * 0.8)
      statics.add(c)
    }
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: crystalGlow, blending: THREE.AdditiveBlending, depthWrite: false }))
    g.position.set(x, size * 0.6, z)
    g.scale.setScalar(size * 3)
    statics.add(keepApart(g))
    obstacles.push({ x, z, r: size * 0.5 })
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.2
    // (none across the way in, at the south)
    if (Math.abs(a - Math.PI / 2) < 0.45) continue
    cluster(crystal.x + Math.cos(a) * crystal.rx * 0.85, crystal.z + Math.sin(a) * crystal.rz * 0.85, 0.7 + rnd() * 0.6, 7)
  }
  cluster(crystal.x, crystal.z - 1, 1.6, 9)
  const purple = new THREE.PointLight(0xb080ff, 26, 20, 1.4)
  purple.position.set(crystal.x, 4, crystal.z)
  scene.add(purple)
  // a nisse polishing gems at a little bench, a chest of them beside him
  const jeweller = miner(6)
  jeweller.n.group.position.set(crystal.x + 3.2, 0, crystal.z + 3.4)
  jeweller.n.setYaw(-2.2)
  jeweller.n.armR.rotation.set(-1.3, 0, -0.2)
  jeweller.n.armL.rotation.set(-1.3, 0, 0.2)
  mergeRigid(jeweller.n.group)
  scene.add(jeweller.n.group)
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.6), wood)
  bench.position.set(crystal.x + 2.6, 0.8, crystal.z + 2.7)
  bench.rotation.y = -2.2 + Math.PI / 2
  statics.add(bench)
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), crystalMats[2])
  gem.position.set(crystal.x + 2.6, 0.95, crystal.z + 2.7)
  scene.add(gem)
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), std(0x6a4422, 0.7))
  chest.position.set(crystal.x + 4.2, 0.25, crystal.z + 1.8)
  statics.add(chest)
  for (let i = 0; i < 12; i++) statics.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.06), crystalMats[i % 3]).translateX(chest.position.x + (rnd() - 0.5) * 0.6).translateY(0.52).translateZ(chest.position.z + (rnd() - 0.5) * 0.35))
  obstacles.push({ x: crystal.x + 3.2, z: crystal.z + 3.0, r: 1.0 }, { x: chest.position.x, z: chest.position.z, r: 0.5 })
  updaters.push((t) => {
    gem.rotation.y = t * 1.5
    jeweller.n.armR.rotation.x = -1.3 + Math.sin(t * 6) * 0.15
  })

  /* ---------- the rest of them: on a break, at cards, asleep, skimming stones ---------- */
  const people: { npc: Nisse; talk: Talk }[] = [
    { npc: foreman.n, talk: MINE_TALK.foreman },
    { npc: fisher.n, talk: MINE_TALK.fisher },
    { npc: jeweller.n, talk: MINE_TALK.jeweller },
    { npc: sorters[0], talk: MINE_TALK.sorter },
  ]
  const crateMat = darkWood
  const sitOn = (i: number, x: number, z: number, yaw: number, seat: number, talk?: Talk) => {
    const { n } = miner(i)
    n.sit(true)
    n.group.position.set(x, seat, z)
    n.setYaw(yaw)
    n.armR.rotation.set(-1.0, 0, -0.1)
    n.armL.rotation.set(-1.0, 0, 0.1)
    mergeRigid(n.group)
    scene.add(n.group)
    obstacles.push({ x, z, r: 0.45 })
    if (talk) people.push({ npc: n, talk })
    return n
  }
  // Lill-Snorre, the youngest, on a crate near the way in, dreaming of the factory
  statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), crateMat).translateX(2.4).translateY(0.22).translateZ(-21.3))
  const snorre = sitOn(5, 2.4, -21.3, -2.6, 0.45, MINE_TALK.apprentice)
  snorre.group.scale.setScalar(0.62)
  // Tjurige Tore, on his break by the heap, with a mug
  const tore = sitOn(3, -2.3, -23.5, 2.2, 0.32, MINE_TALK.grump)
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 10), std(0x8a8e98, 0.4, 0.6))
  mug.position.y = -0.45
  tore.armR.add(mug)
  // Fusk-Folke and Knorr-Knut, at cards on a crate
  statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), crateMat).translateX(-1).translateY(0.25).translateZ(-28.6))
  for (let i = 0; i < 5; i++) statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.005, 0.09), std(0xfbf8f2, 0.6)).translateX(-1.15 + i * 0.07).translateY(0.505).translateZ(-28.6 + (i % 2) * 0.05).rotateY(i * 0.4))
  for (const [x, yaw, i] of [[-1.85, Math.PI / 2, 0], [-0.15, -Math.PI / 2, 2]] as const) {
    statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), crateMat).translateX(x).translateY(0.15).translateZ(-28.6))
    const n = sitOn(i, x, -28.6, yaw, 0.3, i === 0 ? MINE_TALK.cards : undefined)
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.005), std(0xfbf8f2, 0.6))
    hand.position.set(0, -0.45, 0.05)
    n.armL.add(hand)
  }
  obstacles.push({ x: -1, z: -28.6, r: 0.5 })
  // Slö-Stig, fast asleep on the sacks in Sorteringen
  {
    const { n } = miner(7)
    n.group.position.set(sort.x - 4.9, 1.05, sort.z - 2.5)
    n.group.rotation.set(0, 0.4, Math.PI / 2 - 0.15, 'YXZ')
    n.armL.rotation.set(0, 0, 0.6)
    mergeRigid(n.group)
    scene.add(n.group)
    const stig = { npc: n, talk: MINE_TALK.sleeper }
    people.push(stig)
    // on julafton, wake him and it finally sinks in: up he gets and off he runs, up the ladder to wake Tomten
    const julafton = () => {
      const d = new Date(wallClock())
      return d.getUTCMonth() === 11 && d.getUTCDate() === 24
    }
    const sleeper = MINE_TALK.sleeper
    const dozing = sleeper.greeting
    sleeper.greeting = () => (julafton() ? [html.p('Zzz … mmh … julgröt … tomtar … zzz …'), html.p('… vad är det för dag i dag … zzz …')] : dozing())
    const nudge = sleeper.topics[0].pages
    let woken = false
    sleeper.topics[0].pages = () => {
      if (!julafton()) return nudge()
      woken = true
      return [html.p('Mmh? … Är det julafton?'), html.p('… JULAFTON?! I DAG?! Jag skulle ju väcka Tomten! Han ska ut med släden i kväll!'), html.p('Ur vägen, ur vägen! Stora dit, små hit!')]
    }
    // the way out: down off the sacks, along the tunnel to Stora salen, round the young one's crate, up to the ladder
    const way = [
      new THREE.Vector3(sort.x - 4.4, 0, sort.z - 1.4),
      new THREE.Vector3(19.8, 0, -22.4),
      new THREE.Vector3(11, 0, -24),
      new THREE.Vector3(4.5, 0, -19),
      new THREE.Vector3(0.4, 0, -15.5),
      new THREE.Vector3(0, 0, LADDER.z - 0.45),
    ]
    const lying = n.group.position.clone()
    const lyingRot = n.group.rotation.clone()
    let run = -1 // seconds since he jumped up (once the talk is over)
    let leg = 0
    const RUN = 3.4
    updaters.push((_t, dt) => {
      if (!woken) return
      if (run < 0) {
        if (!document.getElementById('dialog')?.hidden) return
        run = 0
        const i = people.indexOf(stig)
        if (i >= 0) people.splice(i, 1)
        zzz.visible = false
        blip(660, 0.1, 'square', 0.04)
      }
      run += dt
      const g = n.group
      if (run < 0.7) {
        // up off the sacks with a jolt
        const k = run / 0.7
        g.position.lerpVectors(lying, way[0], k)
        g.position.y = THREE.MathUtils.lerp(lying.y, 0, k) + Math.sin(k * Math.PI) * 0.5
        g.rotation.set(0, lyingRot.y, THREE.MathUtils.lerp(lyingRot.z, 0, Math.min(1, k * 1.6)), 'YXZ')
        return
      }
      if (leg < way.length - 1) {
        const to = way[leg + 1]
        const dx = to.x - g.position.x
        const dz = to.z - g.position.z
        const d = Math.hypot(dx, dz)
        const step = RUN * dt
        if (d <= step) {
          g.position.set(to.x, 0, to.z)
          leg++
        } else g.position.set(g.position.x + (dx / d) * step, 0, g.position.z + (dz / d) * step)
        g.rotation.set(0, Math.atan2(dx, dz), 0, 'YXZ')
        n.walkPose(run * 14, 1)
        return
      }
      // and up the ladder he goes, out of sight
      g.rotation.set(0, Math.PI, 0, 'YXZ')
      n.walkPose(run * 10, 0.5)
      g.position.y += 1.8 * dt
      if (g.position.y > 11) g.visible = false
    })
    // (and the Zzz over him)
    const [zc, zctx] = makeCanvas(128, 64)
    zctx.fillStyle = '#fbf3e0'
    zctx.font = 'bold 44px Georgia, serif'
    zctx.fillText('z z Z', 6, 48)
    const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(zc), transparent: true, depthWrite: false }))
    zzz.scale.set(0.7, 0.35, 1)
    scene.add(zzz)
    updaters.push((t) => {
      const k = (t * 0.25) % 1
      zzz.position.set(sort.x - 4.6, 1.9 + k * 0.6, sort.z - 2.3)
      zzz.material.opacity = 1 - k
    })
  }
  // Smyg-Sigge, skimming stones on Svartsjön (and nothing in his pocket, honest)
  {
    const { n } = miner(6)
    const x = LAKE.x + 3.2
    const z = LAKE.z + LAKE.rz + 1.3
    n.group.position.set(x, 0, z)
    n.setYaw(Math.PI + 0.5)
    mergeRigid(n.group)
    scene.add(n.group)
    obstacles.push({ x, z, r: 0.45 })
    people.push({ npc: n, talk: MINE_TALK.skipper })
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0x6a625a, 0.8))
    stone.scale.y = 0.4
    scene.add(stone)
    const ripples = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.14, 20), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, depthWrite: false }))
    ripples.rotation.x = -Math.PI / 2
    scene.add(ripples)
    updaters.push((t) => {
      // a throw every few seconds: the arm swings, the stone skips out over the water
      const k = (t / 4) % 1
      n.armR.rotation.x = k < 0.15 ? -0.4 - (k / 0.15) * 1.4 : k < 0.22 ? -1.8 + ((k - 0.15) / 0.07) * 2.4 : 0.1
      const f = k > 0.22 ? (k - 0.22) / 0.6 : -1
      if (f < 0 || f > 1) {
        stone.visible = ripples.visible = false
        return
      }
      stone.visible = true
      const d = f * 5
      const hop = Math.abs(Math.sin(f * Math.PI * 5)) * 0.25 * (1 - f)
      stone.position.set(x - Math.sin(0.5) * d, 0.08 + hop, z - Math.cos(0.5) * d)
      ripples.visible = hop < 0.03
      ripples.position.set(stone.position.x, 0.06, stone.position.z)
      ripples.scale.setScalar(1 + ((f * 5) % 1) * 3)
      ;(ripples.material as THREE.MeshBasicMaterial).opacity = 1 - ((f * 5) % 1)
    })
  }

  const coal = new THREE.InstancedMesh(lumpGeo, coalMat, lumps.length)
  lumps.forEach((m, i) => coal.setMatrixAt(i, m))
  coal.computeBoundingSphere()
  scene.add(coal)

  bakeStatic(statics)

  /* ---------- the song: the boatmen's song, sung as they work – heard all through the mine ---------- */
  const SONG = '/sounds/kor/pramdragarna.mp3'
  const song = new Playlist(4)
  let loud = 0
  let floor0 = 0.2
  let peak = 0.3
  let was = 0
  let lastStrike = 0
  let drip = 2
  let now = 0
  function sungNow() {
    const p = song.position()
    if (!p) return false
    const parts = SUNG['pramdragarna']
    return !parts || parts.some(([a, b]) => p.at >= a && p.at <= b)
  }

  /* ---------- walking about: rooms and tunnels, round the lake and the things in them ---------- */
  const R = 0.35
  function inside(x: number, z: number) {
    if (Math.hypot(x, z) < SHAFT_R - R) return true
    for (const [ax, az, bx, bz] of TUNNELS) if (toSegment(x, z, ax, az, bx, bz).d < TUNNEL_W - 0.35 - R) return true
    for (const r of Object.values(ROOMS)) if (((x - r.x) / (r.rx - R)) ** 2 + ((z - r.z) / (r.rz - R)) ** 2 < 1) return true
    return false
  }
  function collide(p: THREE.Vector3, _feet: number) {
    for (const c of [...obstacles, { x: LADDER.x, z: LADDER.z, r: 0.5 }]) {
      const dx = p.x - c.x
      const dz = p.z - c.z
      const d = Math.hypot(dx, dz)
      if (d < c.r + R && d > 1e-5) {
        p.x = c.x + (dx / d) * (c.r + R)
        p.z = c.z + (dz / d) * (c.r + R)
      }
    }
    // not into the lake
    const lx = (p.x - LAKE.x) / (LAKE.rx + R)
    const lz = (p.z - LAKE.z) / (LAKE.rz + R)
    const l = Math.hypot(lx, lz)
    if (l < 1 && l > 1e-5) {
      p.x = LAKE.x + (lx / l) * (LAKE.rx + R)
      p.z = LAKE.z + (lz / l) * (LAKE.rz + R)
    }
    if (inside(p.x, p.z)) return
    // back onto the floor, the shortest way: into the shaft, a tunnel or a room
    const options: [number, number][] = []
    const r = Math.hypot(p.x, p.z) || 1
    options.push([(p.x / r) * (SHAFT_R - R - 0.01), (p.z / r) * (SHAFT_R - R - 0.01)])
    const w = TUNNEL_W - 0.35 - R - 0.01
    for (const [ax, az, bx, bz] of TUNNELS) {
      const s = toSegment(p.x, p.z, ax, az, bx, bz)
      const k = s.d > 1e-5 ? w / s.d : 0
      options.push([s.px + (p.x - s.px) * k, s.pz + (p.z - s.pz) * k])
    }
    for (const rm of Object.values(ROOMS)) {
      const ex = (p.x - rm.x) / (rm.rx - R)
      const ez = (p.z - rm.z) / (rm.rz - R)
      const e = Math.hypot(ex, ez) || 1
      options.push([rm.x + (ex / e) * (rm.rx - R) * 0.999, rm.z + (ez / e) * (rm.rz - R) * 0.999])
    }
    let best = options[0]
    for (const o of options) if (Math.hypot(o[0] - p.x, o[1] - p.z) < Math.hypot(best[0] - p.x, best[1] - p.z)) best = o
    p.x = best[0]
    p.z = best[1]
  }
  const ground = () => 0

  const facing = (pos: THREE.Vector3, fwd: THREE.Vector3, x: number, z: number, reach: number) => {
    const dx = x - pos.x
    const dz = z - pos.z
    const d = Math.hypot(dx, dz)
    return d < reach && (dx * fwd.x + dz * fwd.z) / d > 0.4
  }
  /** By the ladder, facing it: climb back up. */
  const nearLadder = (pos: THREE.Vector3, fwd: THREE.Vector3) => facing(pos, fwd, LADDER.x, LADDER.z, 1.6)
  /** At the free seam, facing it: take the pick. */
  const nearHack = (pos: THREE.Vector3, fwd: THREE.Vector3) => facing(pos, fwd, hack.seam.x, hack.seam.z, 3.4)
/** Someone to talk to, close by and in front of you (the nearest). */
  function nearPerson(pos: THREE.Vector3, fwd: THREE.Vector3) {
    let best: (typeof people)[number] | null = null
    let bestD = 2.6
    for (const p of people) {
      const at = p.npc.group.position
      const dx = at.x - pos.x
      const dz = at.z - pos.z
      const d = Math.hypot(dx, dz)
      if (d < bestD && (dx * fwd.x + dz * fwd.z) / d > 0.55) {
        best = p
        bestD = d
      }
    }
    return best
  }
  /** By Gruvexpressen, facing it: get in. */
  const nearCart = (pos: THREE.Vector3, fwd: THREE.Vector3) => facing(pos, fwd, STATION.x, STATION.z, 2.2)

  const centre = new THREE.Vector3(hall.x, 0, hall.z + 2)
  function update(t: number, dt: number, player: THREE.Vector3, enabled: boolean) {
    now = t
    // the song: loud in Stora orten, a far-off echo down the tunnels
    const d = Math.hypot(player.x - centre.x, player.z - centre.z)
    const vol = enabled ? 0.75 * THREE.MathUtils.clamp(1 - (d - 8) / 32, 0.1, 1) : 0
    if (vol > 0.003) {
      song.start([SONG])
      song.level(vol)
    } else if (song.playing) song.stop()
    // the picks come down on the heave: when the singing swells
    const raw = song.loudness()
    loud += (raw - loud) * Math.min(1, dt * 20)
    floor0 = loud < floor0 ? floor0 + (loud - floor0) * Math.min(1, dt * 3) : floor0 + dt * 0.004
    peak = Math.max(loud, peak - dt * 0.05, floor0 + 0.05)
    const level = THREE.MathUtils.clamp((loud - floor0) / (peak - floor0), 0, 1)
    const singing = loud > 0.03 && level > 0.12 && sungNow()
    if (singing && level > 0.6 && was <= 0.6 && t - lastStrike > 1.2) {
      lastStrike = t
      for (const m of miners) m.swing = 1
      // the ring of the picks (quieter the further you are)
      if (enabled) for (let i = 0; i < 3; i++) setTimeout(() => blip(1600 + Math.random() * 500, 0.05, 'triangle', 0.04 * vol), 380 + i * 25)
    }
    was = level
    for (const m of miners) {
      // up over the shoulder, then down onto the coal; idle swings now and then between songs
      if (!singing && m.swing <= 0 && Math.sin(t * 0.7 + m.phase) > 0.995) m.swing = 1
      m.swing = Math.max(0, m.swing - dt * 1.1)
      const k = 1 - m.swing
      const raise = k < 0.35 ? k / 0.35 : k < 0.45 ? 1 - (k - 0.35) / 0.1 : 0
      m.n.armR.rotation.x = -1.0 - raise * 1.9 + (k >= 0.45 && k < 0.6 ? 0.25 : 0)
      m.n.body.rotation.x = raise * -0.12 + (k > 0.4 && k < 0.6 ? 0.12 : 0)
      m.n.head.rotation.x = singing ? -0.15 - level * 0.12 : 0.05
      const want = singing ? 0.15 + level * (0.75 + 0.25 * Math.sin(t * 7 + m.phase)) : 0
      m.open += (want - m.open) * Math.min(1, dt * 18)
      m.mouth.scale.y = 0.2 + m.open * 1.2
    }
    foreman.n.head.rotation.y = Math.sin(t * 0.4) * 0.5
    foreman.mouth.scale.y = 0.2 + (singing ? level * 0.6 : 0)
    fisher.mouth.scale.y = 0.2 + (singing ? level * 0.4 : 0)
    for (const u of updaters) u(t, dt)
    // water dripping somewhere (more of it by the lake)
    if (enabled && (drip -= dt) <= 0) {
      const byLake = Math.hypot(player.x - lake.x, player.z - lake.z) < 14
      drip = (byLake ? 0.6 : 1.5) + Math.random() * (byLake ? 2 : 4)
      blip(2400 + Math.random() * 900, 0.05, 'sine', byLake ? 0.03 : 0.018)
    }
  }

  function leave() {
    song.stop()
  }
  /** The sound of the ladder (down or up). */
  function climb() {
    for (let i = 0; i < 6; i++) setTimeout(() => noise(0.12, 600, 300, 0.12, 1.2), i * 160)
  }

  return {
    scene, collide, ground, update, nearLadder, nearCart, nearHack, nearPerson, leave, climb, arrive: ARRIVE, station: STATION, hack,
    /** Seconds since the miners' picks last came down on the heave. */
    heave: () => now - lastStrike,
  }
}
export type Mine = ReturnType<typeof buildMine>
