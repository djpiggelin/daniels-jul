// Kolgruvan – the secret coal mine. The nissar who weren't quite nice enough to work in Leksaksfabriken
// work down here instead, digging out all the coal that goes to the naughty children. The way in is
// a hollow old stump, hidden behind a fir at the far west edge of the village: stand right at it and
// look down into it, and you can climb down. Below: a ladder shaft, a timbered tunnel and a great
// cavern lit by lanterns, where sooty nissar with headlamps hack at the coal faces, singing the
// boatmen's song in deep dark voices, their picks coming down on the heave.
// Everything down here is a scene of its own (like the bull ring): x/z on the mine floor, the shaft at
// the origin, the tunnel running north (−z) to the cavern.
import * as THREE from 'three'
import { bakeStatic, keepApart, mergeRigid } from './batch'
import { Nisse } from './npc'
import { Playlist, blip, noise } from './sfx'
import { SUNG } from './sung'
import { glowTexture, makeCanvas, toTexture } from './tex'
import type { Circle } from './world'

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

/** The shaft at the bottom of the ladder: you arrive here, facing down the tunnel. */
const SHAFT_R = 2.6
const TUNNEL = { x0: -1.7, x1: 1.7, z0: -15, z1: -1.2 }
const CAVE = { x: 0, z: -25, rx: 11.5, rz: 9.5 }
/** How high the cavern's dome is. */
const DOME = 7
/** Where you arrive at the foot of the ladder, facing down the tunnel. */
export const ARRIVE = { x: 0, z: 0.9, yaw: 0 }
const LADDER = new THREE.Vector3(0, 0, SHAFT_R - 0.25)

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
/** The way through from the shaft to the tunnel, and from the tunnel into the cavern. */
const doorway = (c: THREE.Vector3) => Math.abs(c.x) < 2.1 && c.y < 3.1

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

export function buildMine() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050403)
  scene.fog = new THREE.FogExp2(0x070504, 0.032)
  scene.add(new THREE.HemisphereLight(0x6a5644, 0x1a140e, 0.6))
  lampGlow = glowTexture('rgba(255,236,190,0.9)', 'rgba(255,200,120,0)')
  const lanternGlow = glowTexture('rgba(255,190,110,0.8)', 'rgba(255,140,50,0)')
  const statics = new THREE.Group()
  scene.add(statics)
  const obstacles: Circle[] = []

  const tex = rockTexture()
  const rock = (rx: number, ry: number) => {
    const t = tex.clone()
    t.repeat.set(rx, ry)
    t.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.BackSide })
  }
  const floorTex = tex.clone()
  floorTex.repeat.set(10, 10)
  floorTex.needsUpdate = true
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: floorTex, color: 0x9a8a7a, roughness: 1 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, -20)
  statics.add(floor)

  // the shaft: a rough round hole going up to the stump, the ladder up its side
  const shaftWall = new THREE.Mesh(rough(new THREE.CylinderGeometry(SHAFT_R + 0.3, SHAFT_R + 0.5, 12, 24, 8, true), 0.6, (v) => new THREE.Vector3(v.x, 0, v.z).normalize()), rock(3, 4))
  shaftWall.position.y = 6
  statics.add(cut(shaftWall, (c) => c.z < -1 && doorway(c)))
  const wood = std(0x6a4a2e, 0.9)
  const darkWood = std(0x4a3220, 0.95)
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

  // the tunnel, timbered every couple of metres
  const tunnelLen = TUNNEL.z1 - TUNNEL.z0 + 3
  const tunnelGeo = rough(new THREE.CylinderGeometry(2.3, 2.3, tunnelLen, 16, 10, true, Math.PI / 2 - 1.2, Math.PI + 2.4), 0.45, (v) => new THREE.Vector3(v.x, 0, v.z).normalize())
  const tunnel = new THREE.Mesh(tunnelGeo, rock(2, 4))
  tunnel.rotation.x = Math.PI / 2
  tunnel.position.set(0, 0.6, (TUNNEL.z0 + TUNNEL.z1) / 2)
  statics.add(tunnel)
  for (let z = TUNNEL.z1 - 1; z > TUNNEL.z0; z -= 2.6) {
    for (const x of [-1.45, 1.45]) statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.22), darkWood).translateX(x).translateY(1.45).translateZ(z))
    statics.add(new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.24, 0.26), darkWood).translateY(2.95).translateZ(z))
  }

  // the great cavern: a rough dome over an oval floor
  const caveWall = new THREE.Mesh(
    rough(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), 0.09, (v) => v.clone().normalize()),
    rock(8, 4),
  )
  caveWall.scale.set(CAVE.rx + 1.2, DOME, CAVE.rz + 1.2)
  caveWall.position.set(CAVE.x, 0, CAVE.z)
  statics.add(cut(caveWall, (c) => c.z > CAVE.z + 8 && doorway(c)))
  // stalactites
  let seed = 9
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const stoneMat = std(0x3a322c, 0.9)
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2
    const r = Math.sqrt(rnd()) * 0.85
    const x = CAVE.x + Math.cos(a) * r * CAVE.rx
    const z = CAVE.z + Math.sin(a) * r * CAVE.rz
    const y = DOME * Math.sqrt(Math.max(0.05, 1 - r * r)) - 0.2
    const h = 0.5 + rnd() * 1.6
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.12 + rnd() * 0.25, h, 6), stoneMat)
    s.rotation.x = Math.PI
    s.position.set(x, y - h / 2, z)
    statics.add(s)
  }

  // rails: from the tunnel mouth round the cavern, sleepers under them
  const railMat = std(0x5a5e66, 0.4, 0.7)
  const railPath = new THREE.CatmullRomCurve3(
    [[0, -2], [0, -14], [1.5, -17], [6, -19], [8.3, -25], [6, -30], [0, -31.5], [-6, -30], [-8.3, -25], [-6, -19], [-1.5, -17], [0, -14]].map(([x, z]) => new THREE.Vector3(x, 0.06, z)),
    false,
    'catmullrom',
    0.4,
  )
  const loop = new THREE.CatmullRomCurve3(railPath.points.slice(2), true, 'catmullrom', 0.4)
  for (const curve of [new THREE.CatmullRomCurve3(railPath.points.slice(0, 3), false), loop]) {
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
  }

  // coal: glossy black lumps in heaps, and seams in the walls where they dig
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.3, metalness: 0.35 })
  const lumpGeo = new THREE.DodecahedronGeometry(0.16, 0)
  const lumps: THREE.Matrix4[] = []
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
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
  heap(-8, -30.5, 0.8, 50)

  /* the coal faces, where the nissar dig: a glinting seam in the wall behind each */
  const faces = [160, 195, 228, 312, 345, 15, 48].map((deg) => {
    const a = THREE.MathUtils.degToRad(deg)
    const x = CAVE.x + Math.cos(a) * CAVE.rx * 0.95
    const z = CAVE.z + Math.sin(a) * CAVE.rz * 0.95
    // (facing out, at the rock)
    return { x, z, yaw: Math.atan2(x - CAVE.x, (z - CAVE.z) * (CAVE.rx / CAVE.rz)) }
  })
  for (const f of faces) {
    // the seam: lumps stuck in the wall a little beyond where he stands
    const bx = f.x + Math.sin(f.yaw) * 1.5
    const bz = f.z + Math.cos(f.yaw) * 1.5
    for (let i = 0; i < 44; i++) {
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3))
      const s = 0.55 + rnd() * 0.9
      const side = (rnd() - 0.5) * 2.2
      lumps.push(new THREE.Matrix4().compose(new THREE.Vector3(bx + Math.cos(f.yaw) * side, 0.3 + rnd() * 1.8, bz - Math.sin(f.yaw) * side), q, new THREE.Vector3(s, s, s)))
    }
  }
  const coal = new THREE.InstancedMesh(lumpGeo, coalMat, lumps.length)
  lumps.forEach((m, i) => coal.setMatrixAt(i, m))
  coal.computeBoundingSphere()
  scene.add(coal)

  /* lanterns on the timbers and round the cavern – a few real lights, the rest just glow */
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false })
  const iron = std(0x1a1a1e, 0.5, 0.6)
  const lantern = (x: number, y: number, z: number, light: boolean, power = 9, reach = 13) => {
    statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), lanternMat).translateX(x).translateY(y).translateZ(z))
    statics.add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 4), iron).translateX(x).translateY(y + 0.19).translateZ(z).rotateY(Math.PI / 4))
    statics.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), iron).translateX(x).translateY(y + 0.5).translateZ(z))
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: lanternGlow, blending: THREE.AdditiveBlending, depthWrite: false }))
    g.position.set(x, y, z)
    g.scale.setScalar(1.5)
    statics.add(keepApart(g))
    if (light) {
      const l = new THREE.PointLight(0xffa860, power, reach, 1.5)
      l.position.set(x, y - 0.1, z)
      scene.add(l)
    }
  }
  for (let z = TUNNEL.z1 - 1, i = 0; z > TUNNEL.z0; z -= 5.2, i++) lantern(i % 2 ? 1.2 : -1.2, 2.55, z - 0.3, i % 2 === 0)
  for (const [x, z, l] of [[-7.5, -19.5, true], [7.5, -20.5, false], [-9, -26.5, false], [7.5, -30.5, true], [0, -25, true], [2.5, -33.2, false]] as const) {
    // (on a post, or hanging from the dome in the middle)
    const y = x === 0 && z === -25 ? 4.2 : 2.4
    if (y < 3) statics.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), darkWood).translateX(x).translateY(1.3).translateZ(z + 0.3))
    if (y < 3) obstacles.push({ x, z: z + 0.3, r: 0.2 })
    // (the cavern is big: its lanterns burn brighter, the one in the middle brightest)
    lantern(x, y, z, l, y > 3 ? 70 : 32, y > 3 ? 30 : 18)
  }

  /* carts on the loop, trundling round, heaped with coal */
  const carts: { g: THREE.Group; k: number }[] = []
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
  for (let i = 0; i < 3; i++) carts.push({ g: makeCart(), k: i / 3 })

  /* the board with Stygga listan on it, and the foreman by it */
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
  const board = new THREE.Group()
  board.position.set(-1.6, 0, -33.9)
  board.add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.95), new THREE.MeshStandardMaterial({ map: toTexture(lc), roughness: 0.9 })).translateY(1.9))
  for (const x of [-0.72, 0.72]) board.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 3, 0.12), darkWood).translateX(x).translateY(1.5).translateZ(-0.05))
  statics.add(board)
  obstacles.push({ x: -1.6, z: -34, r: 0.8 })
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), darkWood)
  crate.position.set(0.9, 0.3, -33.0)
  statics.add(crate)
  obstacles.push({ x: 0.9, z: -33.0, r: 0.6 })

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
  for (const [x, z, a] of [[-2.2, -27.4, 0.3], [-3.1, -28.1, -0.2], [-2.4, -28.8, 0.8], [-3.4, -27.2, 1.5]] as const) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), sackMat)
    s.scale.set(1, 1.35, 0.85)
    s.position.set(x, 0.55, z)
    s.rotation.y = a
    statics.add(s)
    // a label tied on the front
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), labelMat)
    label.position.set(x + Math.sin(a) * 0.37, 0.62, z + Math.cos(a) * 0.37)
    label.rotation.y = a
    statics.add(label)
    statics.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), std(0xb3202a, 0.6)).translateX(x).translateY(1.05).translateZ(z).rotateX(Math.PI / 2))
  }
  obstacles.push({ x: -2.8, z: -27.9, r: 1.2 })

  /* the miners */
  const miners = faces.map((f, i) => {
    const { n, mouth } = miner(i)
    n.group.position.set(f.x, 0, f.z)
    // (half turned from the rock, so you see them sing as you come by)
    n.setYaw(f.yaw + (i % 2 ? 0.95 : -0.95))
    // where his headlamp shines on the seam
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlow, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }))
    spot.position.set(f.x + Math.sin(f.yaw) * 1.3, 1.2, f.z + Math.cos(f.yaw) * 1.3)
    spot.scale.setScalar(2.2)
    scene.add(spot)
    const p = pick()
    n.armR.add(p)
    n.armL.rotation.set(-1.0, 0, 0.3)
    mergeRigid(n.group)
    scene.add(n.group)
    obstacles.push({ x: f.x, z: f.z, r: 0.45 })
    return { n, mouth, phase: rnd() * 6, swing: 0, open: 0 }
  })
  // the foreman: bigger, a red hat, holding up a lantern by the list
  const foreman = miner(1)
  foreman.n.group.scale.setScalar(0.95)
  foreman.n.group.position.set(0.9, 0.6, -33.0)
  foreman.n.setYaw(0.2)
  foreman.n.armL.rotation.set(-2.2, 0, 0.1)
  const held = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), lanternMat)
  held.position.y = -0.48
  foreman.n.armL.add(held)
  mergeRigid(foreman.n.group)
  scene.add(foreman.n.group)

  bakeStatic(statics)

  /* the song: the boatmen's song, sung by the miners as they work – heard all through the mine */
  const SONG = '/sounds/kor/pramdragarna.mp3'
  const song = new Playlist(4)
  let loud = 0
  let floor0 = 0.2
  let peak = 0.3
  let was = 0
  let lastStrike = 0
  let drip = 2
  function sungNow() {
    const p = song.position()
    if (!p) return false
    const parts = SUNG['pramdragarna']
    return !parts || parts.some(([a, b]) => p.at >= a && p.at <= b)
  }

  /* walking about: the shaft, the tunnel and the cavern, round the things in them */
  function inside(x: number, z: number, R: number) {
    if (Math.hypot(x, z) < SHAFT_R - R) return true
    if (x > TUNNEL.x0 + R && x < TUNNEL.x1 - R && z > TUNNEL.z0 && z < TUNNEL.z1 + 0.5) return true
    return ((x - CAVE.x) / (CAVE.rx - R)) ** 2 + ((z - CAVE.z) / (CAVE.rz - R)) ** 2 < 1
  }
  function collide(p: THREE.Vector3, _feet: number) {
    const R = 0.35
    for (const c of obstacles) {
      const dx = p.x - c.x
      const dz = p.z - c.z
      const d = Math.hypot(dx, dz)
      if (d < c.r + R && d > 1e-5) {
        p.x = c.x + (dx / d) * (c.r + R)
        p.z = c.z + (dz / d) * (c.r + R)
      }
    }
    // the ladder
    if (Math.hypot(p.x - LADDER.x, p.z - LADDER.z) < 0.5 + R) {
      const dx = p.x - LADDER.x
      const dz = p.z - LADDER.z
      const d = Math.hypot(dx, dz) || 1
      p.x = LADDER.x + (dx / d) * (0.5 + R)
      p.z = LADDER.z + (dz / d) * (0.5 + R)
    }
    if (inside(p.x, p.z, R)) return
    // back onto the floor, the shortest way: into the shaft, the tunnel or the cavern
    const options: [number, number][] = []
    const r = Math.hypot(p.x, p.z) || 1
    options.push([(p.x / r) * (SHAFT_R - R - 0.01), (p.z / r) * (SHAFT_R - R - 0.01)])
    options.push([THREE.MathUtils.clamp(p.x, TUNNEL.x0 + R + 0.01, TUNNEL.x1 - R - 0.01), THREE.MathUtils.clamp(p.z, TUNNEL.z0, TUNNEL.z1)])
    const ex = (p.x - CAVE.x) / (CAVE.rx - R)
    const ez = (p.z - CAVE.z) / (CAVE.rz - R)
    const e = Math.hypot(ex, ez) || 1
    options.push([CAVE.x + (ex / e) * (CAVE.rx - R) * 0.999, CAVE.z + (ez / e) * (CAVE.rz - R) * 0.999])
    let best = options[0]
    for (const o of options) if (Math.hypot(o[0] - p.x, o[1] - p.z) < Math.hypot(best[0] - p.x, best[1] - p.z)) best = o
    p.x = best[0]
    p.z = best[1]
  }
  const ground = () => 0

  /** By the ladder, facing it: climb back up. */
  function nearLadder(pos: THREE.Vector3, fwd: THREE.Vector3) {
    const dx = LADDER.x - pos.x
    const dz = LADDER.z - pos.z
    const d = Math.hypot(dx, dz)
    return d < 1.6 && (dx * fwd.x + dz * fwd.z) / d > 0.4
  }

  const centre = new THREE.Vector3(CAVE.x, 0, CAVE.z + 2)
  function update(t: number, dt: number, player: THREE.Vector3, enabled: boolean) {
    // the song: loud in the cavern, a far-off echo up the tunnel
    const d = Math.hypot(player.x - centre.x, player.z - centre.z)
    const vol = enabled ? 0.9 * THREE.MathUtils.clamp(1 - (d - 8) / 32, 0.12, 1) : 0
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
    foreman.mouth.scale.y = 0.2 + (singing ? level : 0)
    // the carts trundle round the loop
    for (const c of carts) {
      c.k = (c.k + dt * 0.012) % 1
      const p = loop.getPointAt(c.k)
      const tn = loop.getTangentAt(c.k)
      c.g.position.set(p.x, 0.02, p.z)
      c.g.rotation.y = Math.atan2(tn.x, tn.z)
    }
    // water dripping somewhere
    if (enabled && (drip -= dt) <= 0) {
      drip = 1.5 + Math.random() * 4
      blip(2400 + Math.random() * 900, 0.05, 'sine', 0.018)
    }
  }

  function leave() {
    song.stop()
  }
  /** The sound of the ladder (down or up). */
  function climb() {
    for (let i = 0; i < 6; i++) setTimeout(() => noise(0.12, 600, 300, 0.12, 1.2), i * 160)
  }

  return { scene, collide, ground, update, nearLadder, leave, climb, arrive: ARRIVE }
}
export type Mine = ReturnType<typeof buildMine>
