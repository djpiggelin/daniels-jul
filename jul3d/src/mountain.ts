// The world behind the painted backdrop: a city dump at the foot of one tall, narrow, ugly-steep mountain,
// with a dirt road spiralling up it, a railway crossing halfway up (a trestle out to a rock pillar) and a
// "Vägen avstängd" barrier at the top. Daylight, flat cartoon colours. Built once, on the first trip.
import * as THREE from 'three'
import { faceted, outline, toon } from './cartoon'
import { FONT, glowTexture, makeCanvas, rng, toTexture } from './tex'

export const ROAD_W = 5
/** Mountain height, base and top radius (of the rock; the road runs just outside it). */
const H = 130
const RB = 34
const RT = 10
const LAPS = 3
/** The run across the dump: it starts this far out, going round the mountain (so it stands to your right)… */
const LEAD_R = 95
/** …and winds in this far round to meet the climb. */
const LEAD_SWEEP = 1.9
const THETA0 = 0.35 * Math.PI
const TAU = Math.PI * 2

const coneR = (y: number) => RB - (RB - RT) * THREE.MathUtils.clamp(y / H, 0, 1)
/** Road centre on the climb, u = 0 at the foot … 1 at the top. The rock is on your right going up. */
function spiral(u: number) {
  const th = THETA0 + u * LAPS * TAU
  const y = u * H
  const r = coneR(y) + 3
  return new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th))
}
const fract = (x: number) => x - Math.floor(x)

/** The road as evenly spaced samples: s metres from the start, d metres to the left (out towards the drop). */
export class Road {
  readonly step = 0.5
  readonly length: number
  /** Where the climb starts (before it: the run across the dump). */
  readonly climbFrom: number
  /** Stretches with no fence on the outside. */
  readonly gaps: [number, number][]
  private pts: THREE.Vector3[] = []
  private lefts: THREE.Vector3[] = []
  private yaws: number[] = []
  private curvs: number[] = []

  constructor() {
    const raw: THREE.Vector3[] = []
    // in across the dump on a widening curve, straight onto the foot of the climb
    const N0 = 500
    for (let i = 0; i < N0; i++) {
      const f = i / N0
      const th = THETA0 - LEAD_SWEEP * (1 - f)
      const r = RB + 3 + (LEAD_R - RB - 3) * (1 - THREE.MathUtils.smootherstep(f, 0, 1))
      raw.push(new THREE.Vector3(r * Math.cos(th), 0, r * Math.sin(th)))
    }
    const N = 8000
    for (let i = 0; i <= N; i++) raw.push(spiral(i / N))
    const cum = [0]
    for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + raw[i].distanceTo(raw[i - 1]))
    this.length = cum[cum.length - 1]
    this.climbFrom = cum[N0]
    let j = 0
    for (let s = 0; s <= this.length; s += this.step) {
      while (j < raw.length - 2 && cum[j + 1] < s) j++
      this.pts.push(raw[j].clone().lerp(raw[j + 1], (s - cum[j]) / (cum[j + 1] - cum[j])))
    }
    const n = this.pts.length
    for (let i = 0; i < n; i++) {
      const t = this.pts[Math.min(n - 1, i + 1)].clone().sub(this.pts[Math.max(0, i - 1)]).setY(0).normalize()
      this.lefts.push(new THREE.Vector3(t.z, 0, -t.x))
      this.yaws.push(Math.atan2(-t.x, -t.z))
    }
    // how fast the road turns right (towards the rock), per metre
    for (let i = 0; i < n; i++) {
      const a = this.yaws[Math.max(0, i - 2)]
      const b = this.yaws[Math.min(n - 1, i + 2)]
      const span = (Math.min(n - 1, i + 2) - Math.max(0, i - 2)) * this.step
      this.curvs.push(-Math.atan2(Math.sin(b - a), Math.cos(b - a)) / span)
    }
    const lead = this.climbFrom
    const climb = this.length - lead
    this.gaps = [0.3, 0.63, 0.86].map((f) => [lead + climb * f, lead + climb * f + 20] as [number, number])
  }

  private idx(s: number) {
    const x = THREE.MathUtils.clamp(s / this.step, 0, this.pts.length - 1.001)
    const i = Math.floor(x)
    return [i, x - i] as const
  }
  /** Centre of the road at s, plus d to the left. */
  at(s: number, d = 0, out = new THREE.Vector3()) {
    const [i, f] = this.idx(s)
    out.lerpVectors(this.pts[i], this.pts[i + 1], f)
    return d ? out.addScaledVector(this.leftAt(s), d) : out
  }
  leftAt(s: number, out = new THREE.Vector3()) {
    const [i, f] = this.idx(s)
    return out.lerpVectors(this.lefts[i], this.lefts[i + 1], f).normalize()
  }
  /** Which way the road points (three.js yaw: forward is (-sin, -cos)). */
  yawAt(s: number) {
    const [i, f] = this.idx(s)
    const a = this.yaws[i]
    const b = this.yaws[i + 1]
    return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * f
  }
  /** Uphill slope (rise per metre). */
  gradeAt(s: number) {
    return (this.at(s + 1).y - this.at(s - 1).y) / 2
  }
  curvAt(s: number) {
    return this.curvs[this.idx(s)[0]]
  }
  /** Is there a fence on the outside here? */
  fence(s: number) {
    return s > this.climbFrom + 4 && !this.gaps.some(([a, b]) => s > a && s < b)
  }
  /** Is there a drop on the outside (rather than flat ground)? */
  drop(s: number) {
    return this.at(s).y > 4
  }
  /** The nearest sample to a point (looked for close to a guess). */
  nearest(p: THREE.Vector3, guess: number, span = 12) {
    let best = guess
    let bestD = Infinity
    for (let s = Math.max(0, guess - span); s <= Math.min(this.length, guess + span); s += this.step) {
      const q = this.pts[Math.round(s / this.step)]
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2 + ((q.y - p.y) * 0.5) ** 2
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    return best
  }
}

/** A strip between two edges, with v running along it. */
function ribbon(a: THREE.Vector3[], b: THREE.Vector3[], vPer = 1, u0 = 0, u1 = 1) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let v = 0
  for (let i = 0; i < a.length; i++) {
    if (i) v += a[i].distanceTo(a[i - 1]) * vPer
    pos.push(a[i].x, a[i].y, a[i].z, b[i].x, b[i].y, b[i].z)
    uv.push(u0, v, u1, v)
    if (i) {
      const k = i * 2
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Packed dirt with two worn wheel tracks and pebbles along the edges. */
function dirtTexture() {
  const [c, ctx] = makeCanvas(128, 256)
  ctx.fillStyle = '#b08a5c'
  ctx.fillRect(0, 0, 128, 256)
  const rand = rng(7)
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(90,60,35,0.35)' : 'rgba(230,200,150,0.35)'
    ctx.fillRect(rand() * 128, rand() * 256, 2 + rand() * 4, 2 + rand() * 3)
  }
  ctx.fillStyle = 'rgba(110,78,48,0.55)'
  ctx.fillRect(26, 0, 14, 256)
  ctx.fillRect(88, 0, 14, 256)
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** A soft puff for smoke, dust and clouds. */
function puffTexture(inner: string, outer: string) {
  const [c, ctx] = makeCanvas(128, 128)
  for (let i = 0; i < 6; i++) {
    const x = 34 + (i % 3) * 30
    const y = 50 + Math.floor(i / 3) * 26
    const g = ctx.createRadialGradient(x, y, 0, x, y, 34)
    g.addColorStop(0, inner)
    g.addColorStop(1, outer)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 34, 0, TAU)
    ctx.fill()
  }
  return toTexture(c)
}

function signTexture(lines: string[], bg = '#fbf3df', fg = '#c21f2a') {
  const [c, ctx] = makeCanvas(512, 256)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 256)
  ctx.strokeStyle = fg
  ctx.lineWidth = 18
  ctx.strokeRect(9, 9, 494, 238)
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${lines.length > 1 ? 74 : 92}px ${FONT.sans}`
  lines.forEach((l, i) => ctx.fillText(l, 256, 128 + (i - (lines.length - 1) / 2) * 86))
  return toTexture(c)
}

/** Loco and two carriages, the head at the origin pointing +x, the rest trailing behind (-x). */
export const TRAIN_LEN = 17.5
function buildTrain() {
  const g = new THREE.Group()
  const blk = toon(0x26221f)
  const red = toon(0xc0262c)
  const gold = toon(0xe0b04a)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    g.add(m)
    return m
  }
  // loco: boiler, cab, stack, cowcatcher, big red wheels
  add(new THREE.CylinderGeometry(0.85, 0.85, 3.8, 14), blk, -0.6, 1.9).rotation.z = Math.PI / 2
  add(new THREE.BoxGeometry(2.0, 2.4, 2.4), red, -3.4, 2.2)
  add(new THREE.BoxGeometry(2.4, 0.2, 2.8), blk, -3.4, 3.5)
  add(new THREE.CylinderGeometry(0.45, 0.25, 1.1, 10), blk, 0.6, 3.1)
  add(new THREE.SphereGeometry(0.35, 10, 8), gold, -1.0, 2.85)
  add(new THREE.SphereGeometry(0.3, 10, 8), toon(0xfff1b8, { emissive: 0xffe9a0, emissiveIntensity: 0.6 }), 1.3, 2.35)
  const cow = add(new THREE.ConeGeometry(1.1, 1.0, 4), red, 1.7, 0.75)
  cow.rotation.set(0, Math.PI / 4, -Math.PI / 2)
  for (const x of [-3.6, -2.2, -0.8, 0.6]) for (const z of [-1.0, 1.0]) add(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 14), red, x, 0.65, z).rotation.x = Math.PI / 2
  add(new THREE.BoxGeometry(5.6, 0.4, 2.2), blk, -1.6, 0.95)
  // two carriages
  const cols = [0x2f6a3b, 0x7a3a22]
  for (let k = 0; k < 2; k++) {
    const x = -4.4 - 0.6 - 2.5 - k * 5.6
    add(new THREE.BoxGeometry(5.0, 2.3, 2.6), toon(cols[k]), x, 2.0)
    add(new THREE.BoxGeometry(5.2, 0.2, 2.9), blk, x, 3.25)
    add(new THREE.BoxGeometry(4.2, 0.6, 2.62), toon(0xf2d27a, { emissive: 0xf2d27a, emissiveIntensity: 0.25 }), x, 2.35)
    for (const dx of [-1.6, 1.6]) for (const z of [-1.0, 1.0]) add(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12), blk, x + dx, 0.5, z).rotation.x = Math.PI / 2
  }
  outline(g, 0.06, 0.3)
  return g
}

 /** An old flatbed lorry with a red cab, coming up the mountain the other way. Front is -z. */
function buildTruck() {
  const g = new THREE.Group()
  const red = toon(0xb8322a)
  const blk = toon(0x26221f)
  const wood = toon(0x8a6236)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    g.add(m)
    return m
  }
  add(new THREE.BoxGeometry(2.2, 0.35, 5.6), blk, 0, 0.75, 0)
  add(new THREE.BoxGeometry(2.1, 1.0, 1.3), red, 0, 1.3, -2.25)
  add(new THREE.BoxGeometry(2.2, 1.5, 1.4), red, 0, 1.75, -1.0)
  add(new THREE.BoxGeometry(1.9, 0.6, 0.05), toon(0x9cc3d8), 0, 2.05, -1.72)
  add(new THREE.BoxGeometry(2.3, 0.15, 3.3), wood, 0, 1.0, 1.15)
  for (const x of [-1.1, 1.1]) add(new THREE.BoxGeometry(0.1, 0.5, 3.3), wood, x, 1.3, 1.15)
  for (const [x, z] of [[-0.5, 0.6], [0.5, 1.4], [-0.3, 2.2]]) add(new THREE.BoxGeometry(0.9, 0.8, 0.8), toon(0xc49a5c), x, 1.5, z)
  for (const z of [-2.0, 1.8]) for (const x of [-1.05, 1.05]) add(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 14), blk, x, 0.48, z).rotation.z = Math.PI / 2
  for (const x of [-0.7, 0.7]) add(new THREE.SphereGeometry(0.16, 10, 8), toon(0xfff1b8, { emissive: 0xffe9a0, emissiveIntensity: 0.5 }), x, 1.35, -2.92)
  outline(g, 0.05, 0.3)
  return g
}

export type Rock = { s: number; d: number; mesh: THREE.Mesh }

export function buildMountain() {
  const scene = new THREE.Scene()
  const road = new Road()
  /** Length of the run across the dump, before the climb. */
  const LEAD = road.climbFrom
  const rand = rng(1938)
  const updaters: ((t: number, dt: number, focus: THREE.Vector3) => void)[] = []

  scene.fog = new THREE.FogExp2(0xd8ccaa, 0.0032)
  scene.background = new THREE.Color(0xd8ccaa)

  /* ---------- sky + clouds ---------- */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vP; void main(){
        float h = clamp(vP.y, 0.0, 1.0);
        vec3 hor = vec3(0.86, 0.81, 0.64);
        vec3 top = vec3(0.47, 0.68, 0.9);
        gl_FragColor = vec4(mix(hor, top, smoothstep(0.0, 0.45, h)), 1.0);
      }`,
    }),
  )
  sky.renderOrder = -10
  scene.add(sky)
  const cloudTex = puffTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)')
  for (let i = 0; i < 16; i++) {
    const a = rand() * TAU
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, opacity: 0.95 }))
    c.position.set(Math.cos(a) * 420, 90 + rand() * 120, Math.sin(a) * 420)
    c.scale.set(110 + rand() * 60, 50 + rand() * 25, 1)
    c.renderOrder = -9
    scene.add(c)
  }

  /* ---------- light: starts out like the village at night, turned to day as the backdrop folds ---------- */
  const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x8a7650, 1.2)
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = sun.shadow.camera
  sc.left = sc.bottom = -28
  sc.right = sc.top = 28
  sc.near = 1
  sc.far = 160
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.04
  scene.add(hemi, sun, sun.target)
  /** Where the sun shines from (the light sits at target + this). */
  const SUN_DIR = new THREE.Vector3(40, 70, 30).normalize()
  const sunDir = SUN_DIR.clone()
  updaters.push((_t, _dt, focus) => {
    sun.target.position.copy(focus)
    sun.position.copy(focus).addScaledVector(sunDir, 80)
  })

  /* ---------- the dump ---------- */
  const groundGeo = new THREE.PlaneGeometry(1600, 1600, 100, 100)
  groundGeo.rotateX(-Math.PI / 2)
  const gp = groundGeo.attributes.position as THREE.BufferAttribute
  const gcol: number[] = []
  const muck = [new THREE.Color(0x7d7262), new THREE.Color(0x8f8160), new THREE.Color(0x6a6458), new THREE.Color(0x9a8a66)]
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i)
    const z = gp.getZ(i)
    gp.setY(i, Math.sin(x * 0.05) * Math.cos(z * 0.04) * 0.2 - 0.12)
    const c = muck[Math.floor(fract(Math.sin(x * 12.9 + z * 78.2) * 437.5) * muck.length)]
    gcol.push(c.r, c.g, c.b)
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3))
  groundGeo.computeVertexNormals()
  const ground = new THREE.Mesh(groundGeo, toon(0xffffff, { vertexColors: true }))
  ground.receiveShadow = true
  scene.add(ground)

  // keep junk off the road, out of the rock, and out of the shot round the parked camper
  const startP = road.at(5)
  const clearOf = (x: number, z: number, pad: number) => {
    if (Math.hypot(x, z) < RB + 10 + pad) return false
    if (Math.hypot(x - startP.x, z - startP.z) < 18 + pad) return false
    for (let s = 0; s < LEAD + 30; s += 2) {
      const p = road.at(s)
      if (Math.hypot(x - p.x, z - p.z) < ROAD_W + pad + 2) return false
    }
    return true
  }
  const scatter = (count: number, pad: number, place: (m: THREE.Object3D, x: number, z: number) => void, near = 230) => {
    const dummy = new THREE.Object3D()
    const out: THREE.Matrix4[] = []
    for (let tries = 0; out.length < count && tries < count * 30; tries++) {
      // mostly on the side you start from, so the dump is what you see first
      let x: number
      let z: number
      if (rand() < 0.6) {
        // either side of the run-in road
        const along = rand() * (LEAD + 10)
        const p = road.at(along)
        const l = road.leftAt(along)
        const off = (rand() < 0.5 ? -1 : 1) * (ROAD_W + 3 + Math.pow(rand(), 1.5) * 45)
        x = p.x + l.x * off
        z = p.z + l.z * off
      } else {
        const a = Math.atan2(startP.z, startP.x) + (rand() - 0.5) * (rand() < 0.7 ? 2.2 : TAU)
        const r = RB + 12 + Math.pow(rand(), 0.8) * near
        x = Math.cos(a) * r
        z = Math.sin(a) * r
      }
      if (!clearOf(x, z, pad)) continue
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, rand() * TAU, 0)
      dummy.scale.setScalar(1)
      place(dummy, x, z)
      dummy.updateMatrix()
      out.push(dummy.matrix.clone())
    }
    return out
  }
  const junk = (geo: THREE.BufferGeometry, color: number, mats: THREE.Matrix4[]) => {
    const m = new THREE.InstancedMesh(geo, toon(color), mats.length)
    mats.forEach((x, i) => m.setMatrixAt(i, x))
    m.castShadow = m.receiveShadow = true
    scene.add(m)
  }
  junk(new THREE.SphereGeometry(1, 9, 6), 0x6b6152, scatter(26, 10, (d) => {
    d.scale.set(6 + rand() * 9, 2 + rand() * 3, 6 + rand() * 9)
    d.position.y = -0.8
  }))
  junk(new THREE.BoxGeometry(1.2, 1.0, 1.2), 0x7a5a36, scatter(110, 1, (d) => {
    d.position.y = 0.3 + rand() * 0.6
    d.rotation.set(rand() * 0.6, rand() * TAU, rand() * 0.6)
  }))
  junk(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10), 0x8a4a2a, scatter(110, 1, (d) => {
    const lying = rand() < 0.5
    d.position.y = lying ? 0.2 : 0.4
    d.rotation.set(lying ? Math.PI / 2 : 0, rand() * TAU, 0)
  }))
  junk(new THREE.TorusGeometry(0.5, 0.18, 6, 14), 0x2a2624, scatter(150, 1, (d) => {
    d.position.y = 0
    d.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.4, 0, rand() * TAU)
  }))
  junk(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8), 0x9a9a92, scatter(260, 0.5, (d) => {
    d.position.y = -0.2
    d.rotation.set(rand() * 2, rand() * TAU, rand() * 2)
  }))
  // dead, bare trees
  const bark = toon(0x4a3f36)
  for (const m of scatter(26, 2, () => {})) {
    const tree = new THREE.Group()
    const p = new THREE.Vector3().setFromMatrixPosition(m)
    const h = 5 + rand() * 5
    const limb = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
      const dd = b.clone().sub(a)
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, dd.length(), 5), bark)
      mesh.position.copy(a).addScaledVector(dd, 0.5)
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dd.normalize())
      mesh.castShadow = true
      tree.add(mesh)
    }
    const top = new THREE.Vector3((rand() - 0.5) * 1.5, h, (rand() - 0.5) * 1.5)
    limb(new THREE.Vector3(0, -0.5, 0), top, 0.3)
    for (let k = 0; k < 4; k++) {
      const from = top.clone().multiplyScalar(0.45 + rand() * 0.5)
      const a = rand() * TAU
      limb(from, from.clone().add(new THREE.Vector3(Math.cos(a) * 2.2, 1 + rand() * 1.5, Math.sin(a) * 2.2)), 0.12)
    }
    tree.position.copy(p)
    scene.add(tree)
  }
  // a factory beyond the dump: sheds and three smokestacks pouring black smoke
  const smokeTex = puffTexture('rgba(40,36,34,0.9)', 'rgba(40,36,34,0)')
  const brick = toon(0x8a4b34)
  const shed = toon(0x5d5a58)
  const toMountain = new THREE.Vector3(-startP.x, 0, -startP.z).normalize()
  const side = new THREE.Vector3(toMountain.z, 0, -toMountain.x)
  const smoke: { s: THREE.Sprite; base: THREE.Vector3; k: number }[] = []
  for (const [along, across] of [
    [80, -120],
    [110, -150],
    [150, 130],
  ]) {
    const base = startP.clone().addScaledVector(toMountain, along).addScaledVector(side, across).setY(0)
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.8, 38, 12), brick)
    stack.position.copy(base).setY(19)
    stack.castShadow = true
    scene.add(stack)
    const b = new THREE.Mesh(new THREE.BoxGeometry(24, 10, 14), shed)
    b.position.copy(base).addScaledVector(side, Math.sign(across) * 14).setY(5)
    b.rotation.y = Math.atan2(side.x, side.z)
    scene.add(b)
    for (let k = 0; k < 9; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false }))
      scene.add(s)
      smoke.push({ s, base: base.clone().setY(38), k: k / 9 })
    }
  }
  updaters.push((_t, dt) => {
    for (const p of smoke) {
      p.k = (p.k + dt * 0.07) % 1
      p.s.position.copy(p.base).add(new THREE.Vector3(p.k * 30, p.k * 34, p.k * 8))
      p.s.scale.setScalar(5 + p.k * 26)
      ;(p.s.material as THREE.SpriteMaterial).opacity = Math.sin(p.k * Math.PI) * 0.9
    }
  })

  /* ---------- the mountain ---------- */
  const SEG = 160
  const ROWS = 170
  const Y0 = -8
  const pos: number[] = []
  const col: number[] = []
  const strata = [new THREE.Color(0xcc9452), new THREE.Color(0xe0bd80), new THREE.Color(0xa85a36), new THREE.Color(0xd6a868)]
  const slag = new THREE.Color(0x6e665c)
  const c = new THREE.Color()
  for (let j = 0; j <= ROWS; j++) {
    const y = Y0 + ((H - Y0) * j) / ROWS
    for (let i = 0; i <= SEG; i++) {
      const th = (i / SEG) * TAU
      let n = 1.8 * Math.sin(3 * th + y * 0.09) + 1.2 * Math.sin(7 * th - y * 0.05 + 1.3) + 0.7 * Math.sin(17 * th + y * 0.21) + 0.5 * Math.sin(y * 0.8 + th * 5)
      // eroded ledges every few metres
      n -= 1.3 * THREE.MathUtils.smoothstep(fract(y / 6.5 + 0.1 * Math.sin(4 * th)), 0.55, 0.95)
      // keep the rock clear of the road shelf (and of the run-in at the foot)
      const base = (((th - THETA0) % TAU) + TAU) % TAU
      for (let k = 0; k <= LAPS; k++) {
        const u = (base + TAU * k) / (TAU * LAPS)
        if (u > 1) break
        const dy = y - u * H
        if (dy > -4 && dy < 9) n = Math.min(n, -0.25)
      }
      const off = Math.abs(Math.atan2(Math.sin(th - THETA0), Math.cos(th - THETA0)))
      if (y < 7 && off < 0.6) n = Math.min(n, -0.25)
      if (y > H - 3) n = Math.min(n, 0.4)
      let r = coneR(y) + n
      if (y < 0) r -= y * 0.8
      pos.push(r * Math.cos(th), y, r * Math.sin(th))
      // bands of ochre, tan and rust; scarred slag-grey at the foot where the dump creeps up
      const band = fract(y / 5 + 0.15 * Math.sin(3 * th + y * 0.05))
      c.copy(strata[Math.floor(band * strata.length)])
      c.lerp(slag, THREE.MathUtils.smoothstep(22 - y + Math.sin(th * 6) * 5, 0, 14) * 0.85)
      col.push(c.r, c.g, c.b)
    }
  }
  const idx: number[] = []
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i
      const b = a + SEG + 1
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const rockGeo = new THREE.BufferGeometry()
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  rockGeo.setIndex(idx)
  rockGeo.computeVertexNormals()
  const rock = new THREE.Mesh(faceted(rockGeo), toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }))
  rock.castShadow = rock.receiveShadow = true
  scene.add(rock)
  const cap = new THREE.Mesh(new THREE.CircleGeometry(RT + 1.6, 28).rotateX(-Math.PI / 2), toon(0xc9a46c))
  cap.position.y = H - 0.04
  cap.receiveShadow = true
  scene.add(cap)

  /* ---------- the road: a dirt shelf with a slab under it ---------- */
  const inT: THREE.Vector3[] = []
  const outT: THREE.Vector3[] = []
  const outB: THREE.Vector3[] = []
  const inB: THREE.Vector3[] = []
  for (let s = 0; s <= road.length; s += road.step) {
    const p = road.at(s)
    const l = road.leftAt(s)
    inT.push(p.clone().addScaledVector(l, -(ROAD_W / 2 + 0.4)))
    outT.push(p.clone().addScaledVector(l, ROAD_W / 2))
    outB.push(outT[outT.length - 1].clone().setY(p.y - 2.2))
    inB.push(inT[inT.length - 1].clone().setY(p.y - 2.2))
  }
  const dirt = new THREE.Mesh(ribbon(inT, outT, 1 / 6), toon(0xffffff, { map: dirtTexture(), side: THREE.DoubleSide }))
  dirt.receiveShadow = true
  const slabMat = toon(0x8e6a44, { side: THREE.DoubleSide })
  scene.add(dirt, new THREE.Mesh(ribbon(outT, outB), slabMat), new THREE.Mesh(ribbon(outB, inB), slabMat))

  // white fence along the drop, with gaps
  const postGeo = new THREE.BoxGeometry(0.16, 1.1, 0.16)
  const posts: THREE.Vector3[] = []
  const railMat = toon(0xf1ead8, { side: THREE.DoubleSide })
  let run: THREE.Vector3[] = []
  const flush = () => {
    if (run.length > 1)
      for (const h of [0.5, 0.95]) {
        const top = run.map((p) => p.clone().setY(p.y + h + 0.08))
        const bot = run.map((p) => p.clone().setY(p.y + h - 0.08))
        scene.add(new THREE.Mesh(ribbon(top, bot), railMat))
      }
    run = []
  }
  for (let s = 0; s <= road.length; s += 2.5) {
    if (!road.fence(s)) {
      flush()
      continue
    }
    const p = road.at(s, ROAD_W / 2 - 0.12)
    posts.push(p)
    run.push(p)
  }
  flush()
  const postMesh = new THREE.InstancedMesh(postGeo, railMat, posts.length)
  const dm = new THREE.Object3D()
  posts.forEach((p, i) => {
    dm.position.copy(p).setY(p.y + 0.55)
    dm.updateMatrix()
    postMesh.setMatrixAt(i, dm.matrix)
  })
  postMesh.castShadow = true
  scene.add(postMesh)

  // rocks fallen onto the road
  const rocks: Rock[] = []
  const rockMat = toon(0x9a8466)
  for (let k = 0; k < 10; k++) {
    const s = LEAD + 40 + ((road.length - LEAD - 80) * (k + 0.5)) / 10 + (rand() - 0.5) * 20
    if (road.gaps.some(([a, b]) => s > a - 6 && s < b + 6)) continue
    const d = [-1.3, 0, 1.3][Math.floor(rand() * 3)]
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55), rockMat)
    mesh.position.copy(road.at(s, d)).setY(road.at(s).y + 0.3)
    mesh.rotation.set(rand() * 3, rand() * 3, 0)
    mesh.scale.set(1, 0.7, 1)
    mesh.castShadow = true
    scene.add(mesh)
    rocks.push({ s, d, mesh })
  }

  // a waterfall pouring off the rock across the road
  const waterS = LEAD + (road.length - LEAD) * 0.18
  const [wc, wctx] = makeCanvas(64, 256)
  wctx.fillStyle = 'rgba(170,215,240,0.75)'
  wctx.fillRect(0, 0, 64, 256)
  for (let i = 0; i < 40; i++) {
    wctx.fillStyle = 'rgba(255,255,255,0.8)'
    wctx.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 3, 20 + Math.random() * 50)
  }
  const waterTex = toTexture(wc)
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping
  waterTex.repeat.set(1, 3)
  // a curtain across the road that you drive through
  const water = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 1, 60), new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
  const wp = road.at(waterS)
  water.position.copy(wp).setY(wp.y + 4)
  water.rotation.y = road.yawAt(waterS)
  scene.add(water)
  updaters.push((_t, dt) => (waterTex.offset.y += dt * 1.6))

  /* ---------- the railway crossing, halfway up ---------- */
  const crossS = LEAD + (road.length - LEAD) * 0.55
  const O = road.at(crossS)
  const dir = road.leftAt(crossS)
  const rail = new THREE.Group()
  rail.position.copy(O)
  rail.rotation.y = Math.atan2(-dir.z, dir.x)
  scene.add(rail)
  const steel = toon(0x4c4a48)
  const timber = toon(0x6a4a2c)
  const PILLAR_X = 70
  const pillarR = 10
  for (const z of [-0.72, 0.72]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(120, 0.14, 0.12), steel)
    r.position.set(20, 0.08, z)
    rail.add(r)
  }
  const plank = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 0.6, 0.06, 2.6), timber)
  plank.position.y = 0.02
  rail.add(plank)
  // a trestle out over the drop to a rock pillar, legs only where there's no road underneath
  const deck = new THREE.Mesh(new THREE.BoxGeometry(PILLAR_X - pillarR - ROAD_W / 2, 0.5, 3), timber)
  deck.position.set((ROAD_W / 2 + PILLAR_X - pillarR) / 2, -0.3, 0)
  deck.castShadow = deck.receiveShadow = true
  rail.add(deck)
  const rc = coneR(O.y) + 3
  const legGeo = new THREE.BoxGeometry(0.35, 1, 0.35)
  for (let x = ROAD_W / 2 + 3; x < PILLAR_X - pillarR; x += 5) {
    // no legs down through the lower laps of the road
    if (rc + x < RB + 16) continue
    for (const z of [-1.2, 1.2]) {
      const leg = new THREE.Mesh(legGeo, timber)
      leg.scale.y = O.y + 1
      leg.position.set(x, -(O.y + 1) / 2, z)
      leg.castShadow = true
      rail.add(leg)
    }
  }
  const sleeperXs: number[] = []
  for (let x = ROAD_W / 2 + 0.5; x < PILLAR_X - pillarR; x += 0.85) sleeperXs.push(x)
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.1, 2.2), timber, sleeperXs.length)
  sleeperXs.forEach((x, i) => sleepers.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, 0)))
  rail.add(sleepers)
  const pillarH = O.y + 26
  const pillar = new THREE.Mesh(faceted(new THREE.CylinderGeometry(pillarR - 1.5, pillarR + 4, pillarH, 12, 6)), toon(0xc68a4e))
  pillar.position.set(PILLAR_X, pillarH / 2 - O.y - 4, 0)
  pillar.castShadow = pillar.receiveShadow = true
  rail.add(pillar)
  // tunnel mouths: one in the rock wall, one in the pillar
  const arch = new THREE.Shape()
  arch.moveTo(-1.9, 0)
  arch.lineTo(1.9, 0)
  arch.lineTo(1.9, 2.6)
  arch.absarc(0, 2.6, 1.9, 0, Math.PI, false)
  arch.lineTo(-1.9, 0)
  const archGeo = new THREE.ShapeGeometry(arch, 12)
  const dark = new THREE.MeshBasicMaterial({ color: 0x0c0907 })
  const stone = toon(0x6f6a62)
  const mouth = (x: number, face: number) => {
    const m = new THREE.Mesh(archGeo, dark)
    m.rotation.y = face * Math.PI / 2
    m.position.set(x, 0, 0)
    const frame = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.35, 6, 14, Math.PI), stone)
    frame.rotation.y = face * Math.PI / 2
    frame.position.set(x + face * 0.05, 2.6, 0)
    rail.add(m, frame)
  }
  mouth(-(ROAD_W / 2 + 0.45), 1)
  // the pillar's radius where the track meets it
  const tFrac = (O.y + 4) / pillarH
  const pr = THREE.MathUtils.lerp(pillarR + 4, pillarR - 1.5, tFrac)
  mouth(PILLAR_X - pr - 0.1, -1)

  // crossbuck signs with two red lamps each, one on either side of the road before you reach the track
  const lamps: THREE.MeshBasicMaterial[] = []
  const crossTex = signTexture(['JÄRNVÄG'], '#fbf3df', '#1b1b1d')
  for (const [s, d] of [
    [crossS - 4.5, -(ROAD_W / 2 + 0.1)],
    [crossS + 4.5, ROAD_W / 2 - 0.1],
  ]) {
    const g = new THREE.Group()
    g.position.copy(road.at(s, d))
    g.rotation.y = road.yawAt(s) + (s < crossS ? 0 : Math.PI)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), toon(0xf1ead8))
    post.position.y = 1.6
    g.add(post)
    for (const r of [0.6, -0.6]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.04), toon(0xffffff, { map: crossTex }))
      board.position.set(0, 2.85, 0.06)
      board.rotation.z = r
      g.add(board)
    }
    for (const x of [-0.3, 0.3]) {
      const m = new THREE.MeshBasicMaterial({ color: 0x401010 })
      lamps.push(m)
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), m)
      lamp.position.set(x, 2.2, 0.1)
      g.add(lamp)
    }
    scene.add(g)
  }

  // the train itself: out of the mountain to the pillar, then back the other way
  const train = buildTrain()
  train.visible = false
  rail.add(train)
  const PERIOD = 15
  const TRAIN_V = 18
  const trainState = { warn: false, running: false, head: 0, out: true, cycle: -1 }
  const runs = {
    out: { from: -20, to: PILLAR_X + pr - 1.5 },
    in: { from: PILLAR_X - pr + 1, to: -40 },
  }
  /** Time into the trip; the train runs on its own clock. */
  let clock = 0
  updaters.push((_t, dt) => {
    clock += dt
    const cycle = Math.floor(clock / PERIOD)
    const k = clock - cycle * PERIOD
    const out = cycle % 2 === 0
    const r = out ? runs.out : runs.in
    const runFor = Math.abs(r.to - r.from) / TRAIN_V
    const START = 8
    trainState.out = out
    trainState.running = k > START && k < START + runFor
    trainState.warn = k > START - 3 && k < START + runFor
    trainState.head = r.from + Math.sign(r.to - r.from) * TRAIN_V * Math.max(0, k - START)
    train.visible = trainState.running
    train.position.x = trainState.head
    train.rotation.y = out ? 0 : Math.PI
    const blink = trainState.warn && Math.floor(clock * 3) % 2 === 0
    lamps.forEach((m, i) => m.color.setHex(trainState.warn && (i % 2 === 0) === blink ? 0xff3322 : 0x401010))
  })
  /** The stretch of track (metres out from the road centre) the train covers right now, if it's running. */
  const trainSpan = (): [number, number] | null => {
    if (!trainState.running) return null
    const tail = trainState.head + (trainState.out ? -TRAIN_LEN : TRAIN_LEN)
    return [Math.min(tail, trainState.head), Math.max(tail, trainState.head)]
  }

  /* ---------- the top: road closed ---------- */
  const endS = road.length - 2
  const bar = new THREE.Group()
  bar.position.copy(road.at(endS))
  bar.rotation.y = road.yawAt(endS)
  const [bc, bctx] = makeCanvas(256, 32)
  for (let x = 0; x < 256; x += 32) {
    bctx.fillStyle = (x / 32) % 2 ? '#fbf3df' : '#c21f2a'
    bctx.fillRect(x, 0, 32, 32)
  }
  const plankBar = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 1, 0.3, 0.12), toon(0xffffff, { map: toTexture(bc) }))
  plankBar.position.y = 1.0
  bar.add(plankBar)
  for (const x of [-(ROAD_W / 2 + 0.4), ROAD_W / 2 + 0.4]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), toon(0xf1ead8))
    p.position.set(x, 0.6, 0)
    bar.add(p)
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.06), toon(0xffffff, { map: signTexture(['VÄGEN', 'AVSTÄNGD']) }))
  // (the board's front, +z, faces back down the road at you)
  board.position.set(0, 2.1, 0.02)
  bar.add(board)
  const boardPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), toon(0xf1ead8))
  boardPost.position.y = 0.8
  bar.add(boardPost)
  bar.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
  scene.add(bar)

  // a lorry that comes up the road on the way back down
  const truck = buildTruck()
  truck.visible = false
  scene.add(truck)

  // a dust puff to throw up when things hit the ground
  const dustTex = glowTexture('rgba(190,170,130,0.9)', 'rgba(190,170,130,0)')

  return {
    scene,
    road,
    hemi,
    sun,
    /** The day-time direction of the sun; the trip turns it here from the village's moon. */
    sunDir,
    SUN_DAY: SUN_DIR,
    rocks,
    crossS,
    waterS,
    endS,
    trainSpan,
    get trainWarn() {
      return trainState.warn
    },
    get trainRunning() {
      return trainState.running
    },
    dustTex,
    truck,
    /** Set the train's timetable clock: 0 = just left, it reaches the crossing about 9 s later. */
    resetTrain: (at = 0) => (clock = at),
    update: (t: number, dt: number, focus: THREE.Vector3) => updaters.forEach((u) => u(t, dt, focus)),
  }
}

export type Mountain = ReturnType<typeof buildMountain>
