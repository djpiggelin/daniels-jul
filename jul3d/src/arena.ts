// Madrid at noon: the bullring and the dusty road out to it. The ring is in the middle (sand, a red barrier
// with the bulls' gate at -z and yours at +z), the stands rise all round it with the crowd painted on – three
// pictures swapped back and forth when they cheer, so a full arena costs nothing to draw. The road comes in
// from +z past white houses, olive trees and one cork tree with a bull sitting under it, smelling flowers.
import * as THREE from 'three'
import { Bull } from './bull'
import { Matador } from './matadors'
import { rod, std } from './sleigh'
import { glowTexture, makeCanvas, rng, toTexture } from './tex'

/** The sand: radius of the ring inside the barrier. */
export const RING_R = 16
const BARRIER_H = 1.45
const CALLEJON = 1.6
const STANDS = { r0: RING_R + CALLEJON, y0: 2.1, r1: RING_R + 19, y1: 14 }
const WALL_R = STANDS.r1 + 1.6
/** Where the carriage sets out, and where it stops in front of the main gate. */
export const ROAD = { from: 152, to: WALL_R + 5 }
/** The cork tree by the road, with Ferdinand under it (seen through the blindfold on the way in). */
export const CORK = new THREE.Vector3(10, 0, 88)
/** Ferdinand himself, sitting in front of it. */
export const CAMEO = new THREE.Vector3(CORK.x - 1.2, 0, CORK.z + 2.4)
const TAU = Math.PI * 2

/* ---------- the crowd, painted ---------- */

/** One frame of the crowd. `mode` 0 = sitting, 1 = arms up, 2 = waving white handkerchiefs. */
function crowdFrame(mode: number, seed: number) {
  const W = 1024
  const H = 512
  const [c, ctx] = makeCanvas(W, H)
  const rand = rng(seed)
  const shirts = ['#d8202c', '#f7f4ee', '#2f6fc6', '#f2c230', '#1d6e48', '#e86aa6', '#6b3a8a', '#f29a1d', '#222', '#7ab8e0']
  const skins = ['#f1c7a5', '#d9a27a', '#b9805a', '#8a5a3a', '#f3d2b0']
  // concrete steps
  ctx.fillStyle = '#b8a590'
  ctx.fillRect(0, 0, W, H)
  const rows = 14
  const rh = H / rows
  for (let r = 0; r < rows; r++) {
    // row 0 is the top of the picture = the top of the stands (v = 1 is drawn at y = 0)
    const y = r * rh
    ctx.fillStyle = r % 2 ? '#a8957f' : '#b49f88'
    ctx.fillRect(0, y, W, rh)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(0, y + rh - 3, W, 3)
    const n = 34
    for (let i = 0; i < n; i++) {
      if (rand() < 0.06) continue
      const x = (i + 0.5) * (W / n) + (rand() - 0.5) * 10
      const by = y + rh - 4
      const shirt = shirts[Math.floor(rand() * shirts.length)]
      const skin = skins[Math.floor(rand() * skins.length)]
      const up = mode > 0 && rand() < (mode === 1 ? 0.75 : 0.55)
      const hop = up ? 3 : 0
      // body
      ctx.fillStyle = shirt
      ctx.beginPath()
      ctx.roundRect(x - 9, by - 20 - hop, 18, 20, 5)
      ctx.fill()
      // arms
      ctx.strokeStyle = shirt
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.beginPath()
      if (up) {
        ctx.moveTo(x - 7, by - 16 - hop)
        ctx.lineTo(x - 12, by - 33 - hop)
        ctx.moveTo(x + 7, by - 16 - hop)
        ctx.lineTo(x + 12, by - 33 - hop)
      } else {
        ctx.moveTo(x - 8, by - 15)
        ctx.lineTo(x - 10, by - 4)
        ctx.moveTo(x + 8, by - 15)
        ctx.lineTo(x + 10, by - 4)
      }
      ctx.stroke()
      // head, sometimes a hat
      ctx.fillStyle = skin
      ctx.beginPath()
      ctx.arc(x, by - 25 - hop, 6, 0, TAU)
      ctx.fill()
      const hat = rand()
      if (hat < 0.2) {
        ctx.fillStyle = '#111'
        ctx.fillRect(x - 10, by - 30 - hop, 20, 3)
        ctx.fillRect(x - 5, by - 36 - hop, 10, 6)
      } else if (hat < 0.3) {
        ctx.fillStyle = '#e8d08a'
        ctx.fillRect(x - 10, by - 30 - hop, 20, 3)
        ctx.fillRect(x - 5, by - 35 - hop, 10, 5)
      } else if (hat < 0.45) {
        ctx.fillStyle = '#2a1a10'
        ctx.beginPath()
        ctx.arc(x, by - 27 - hop, 6.5, Math.PI, TAU)
        ctx.fill()
      }
      // fans and handkerchiefs
      if (up && mode === 2) {
        ctx.fillStyle = '#fff'
        const s = rand() < 0.5 ? -1 : 1
        ctx.fillRect(x + s * 12 - 5, by - 42 - hop + rand() * 4, 10, 8)
      } else if (!up && rand() < 0.12) {
        ctx.fillStyle = rand() < 0.5 ? '#d8202c' : '#111'
        ctx.beginPath()
        ctx.moveTo(x + 9, by - 12)
        ctx.arc(x + 9, by - 12, 9, -Math.PI * 0.9, -Math.PI * 0.3)
        ctx.fill()
      }
    }
  }
  const t = toTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.x = 12
  return t
}

/** Sand, raked, with the two red rings painted on it. */
function sandTexture() {
  const S = 1024
  const [c, ctx] = makeCanvas(S, S)
  const rand = rng(7)
  ctx.fillStyle = '#c98f4e'
  ctx.fillRect(0, 0, S, S)
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(160,100,50,0.18)' : 'rgba(255,220,160,0.18)'
    const s = 1 + rand() * 3
    ctx.fillRect(rand() * S, rand() * S, s, s)
  }
  // rake marks, round and round
  ctx.strokeStyle = 'rgba(150,95,45,0.12)'
  ctx.lineWidth = 2
  for (let r = 20; r < S / 2; r += 9) {
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, r + rand() * 3, 0, TAU)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(190,40,30,0.7)'
  ctx.lineWidth = 5
  for (const m of [7, 9]) {
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, ((RING_R - m) / RING_R) * (S / 2), 0, TAU)
    ctx.stroke()
  }
  return toTexture(c)
}

/** Red boards with a yellow band along the top: the barrera. */
function barrierTexture() {
  const [c, ctx] = makeCanvas(512, 128)
  ctx.fillStyle = '#9e1f1f'
  ctx.fillRect(0, 0, 512, 128)
  for (let x = 0; x < 512; x += 32) {
    ctx.fillStyle = x % 64 ? '#a82424' : '#931c1c'
    ctx.fillRect(x, 14, 30, 100)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(x + 30, 14, 2, 100)
  }
  ctx.fillStyle = '#e8b830'
  ctx.fillRect(0, 0, 512, 12)
  ctx.fillStyle = '#5a1010'
  ctx.fillRect(0, 114, 512, 14)
  const t = toTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.x = 24
  return t
}

/** The outside: red brick with horseshoe arches, two storeys of them. */
function wallTexture() {
  const [c, ctx] = makeCanvas(512, 256)
  ctx.fillStyle = '#b8553a'
  ctx.fillRect(0, 0, 512, 256)
  for (let y = 0; y < 256; y += 8)
    for (let x = (y / 8) % 2 ? 0 : 12; x < 512; x += 24) {
      ctx.fillStyle = `rgba(${120 + ((x * 7 + y) % 40)},50,30,0.35)`
      ctx.fillRect(x, y, 22, 6)
    }
  const arch = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = '#f1e2c0'
    ctx.beginPath()
    ctx.ellipse(x, y, w / 2 + 6, w / 2 + 6, 0, Math.PI, TAU)
    ctx.lineTo(x + w / 2 + 6, y + h)
    ctx.lineTo(x - w / 2 - 6, y + h)
    ctx.fill()
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.ellipse(x, y, w / 2, w / 2 + 3, 0, Math.PI * 0.9, Math.PI * 2.1)
    ctx.lineTo(x + w / 2, y + h)
    ctx.lineTo(x - w / 2, y + h)
    ctx.fill()
  }
  for (let i = 0; i < 4; i++) {
    arch(64 + i * 128, 60, 56, 50, '#3a2218')
    arch(64 + i * 128, 160, 64, 96, '#2a1a12')
  }
  ctx.fillStyle = '#f1e2c0'
  ctx.fillRect(0, 118, 512, 8)
  ctx.fillRect(0, 0, 512, 6)
  const t = toTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.x = 18
  return t
}

/* ---------- people and animals ---------- */

/** A white Andalusian horse with red tassels, trotting (horse space: facing +z). */
export class Horse {
  readonly group = new THREE.Group()
  private legs: { hip: THREE.Group; front: boolean; side: number }[] = []
  private neck = new THREE.Group()
  private tail = new THREE.Group()

  constructor() {
    const coat = std(0xe9e2d4, 0.7)
    const mane = std(0x8a8478, 0.9)
    const red = std(0xd8202c, 0.6)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.95, 6, 12), coat)
    body.rotation.x = Math.PI / 2
    body.position.y = 1.3
    this.group.add(body)
    this.neck.position.set(0, 1.45, 0.6)
    this.neck.rotation.x = -0.6
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.8, 10), coat)
    n.position.y = 0.35
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.55), coat)
    head.position.set(0, 0.78, 0.2)
    head.rotation.x = 0.9
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.12), mane)
    crest.position.set(0, 0.38, -0.14)
    this.neck.add(n, head, crest)
    // tassels on the bridle and the browband
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), red)
      t.position.set(s * 0.13, 0.75, 0.15)
      this.neck.add(t)
    }
    this.group.add(this.neck)
    for (const [z, front] of [
      [0.5, true],
      [-0.55, false],
    ] as const)
      for (const side of [-1, 1]) {
        const hip = new THREE.Group()
        hip.position.set(side * 0.18, 1.15, z)
        hip.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.08, 0), 0.06, coat))
        const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 8), std(0x2a2220, 0.5))
        hoof.position.y = -1.1
        hip.add(hoof)
        this.group.add(hip)
        this.legs.push({ hip, front, side })
      }
    this.tail.position.set(0, 1.4, -0.75)
    this.tail.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.7, -0.2), 0.07, mane))
    this.group.add(this.tail)
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
  }

  /** A trot: diagonal pairs together. */
  trot(phase: number, amt = 1) {
    for (const l of this.legs) {
      const diag = l.front === l.side > 0
      l.hip.rotation.x = Math.sin(phase + (diag ? 0 : Math.PI)) * 0.4 * amt
    }
    this.group.children[0].position.y = 1.3 + Math.abs(Math.sin(phase)) * 0.05 * amt
    this.neck.rotation.x = -0.6 + Math.sin(phase * 2) * 0.05 * amt
    this.tail.rotation.x = -0.3 + Math.sin(phase) * 0.1
  }
}

/** The bumblebee (humla) that Ferdinand sits on. */
export function buildBee() {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), std(0xf2c230, 0.5))
  body.scale.set(1, 0.9, 1.4)
  g.add(body)
  for (const z of [-0.03, 0.03]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.015, 6, 14), std(0x15110d, 0.5))
    band.position.z = z
    g.add(band)
  }
  const wings: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }))
    w.position.set(s * 0.06, 0.06, 0)
    w.rotation.x = -Math.PI / 2
    g.add(w)
    wings.push(w)
  }
  g.userData.wings = wings
  return g
}

/** A bouquet of red and white carnations (thrown from the stands). */
export function buildBouquet() {
  const g = new THREE.Group()
  const rand = rng(3)
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU
    const r = rand() * 0.08
    const top = new THREE.Vector3(Math.cos(a) * r, 0.32 + rand() * 0.06, Math.sin(a) * r)
    g.add(rod(new THREE.Vector3(0, 0, 0), top, 0.008, std(0x3d8b3d)))
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(i % 3 ? 0xd8202c : 0xffffff, 0.7))
    f.position.copy(top)
    g.add(f)
  }
  const paper = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xf7f4ee, side: THREE.DoubleSide }))
  paper.position.y = 0.11
  paper.rotation.x = Math.PI
  g.add(paper)
  return g
}

/**
 * The crowd showering the ring with flowers when you win: carnations and roses thrown from every side of the
 * stands, arcing in and lying where they land, plus a few whole bouquets. Instanced, so hundreds cost one draw.
 */
export function buildFlowerRain(scene: THREE.Scene) {
  const N = 700
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.7 }), N)
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4)
  stemGeo.translate(0, -0.16, 0)
  const stems = new THREE.InstancedMesh(stemGeo, std(0x3d8b3d), N)
  const colors = [0xd8202c, 0xd8202c, 0xb3102a, 0xffffff, 0xe86aa6, 0xf2c230, 0xf7a8c0]
  const c = new THREE.Color()
  for (let i = 0; i < N; i++) heads.setColorAt(i, c.setHex(colors[i % colors.length]))
  heads.count = stems.count = 0
  heads.frustumCulled = stems.frustumCulled = false
  heads.castShadow = true
  scene.add(heads, stems)
  const bouquets = Array.from({ length: 14 }, () => {
    const b = buildBouquet()
    b.scale.setScalar(1.5)
    b.visible = false
    scene.add(b)
    return b
  })
  type Fly = { p: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3; rot: THREE.Euler; down: boolean; obj?: THREE.Object3D }
  const flying: Fly[] = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const one = new THREE.Vector3(1, 1, 1)
  let rate = 0
  let acc = 0
  let thrown = 0
  let bq = 0
  /** From a random seat to a random spot on the sand (`near`, if given, gets a good share). */
  const launch = (near: THREE.Vector3 | null, obj?: THREE.Object3D) => {
    const a = Math.random() * TAU
    const r = STANDS.r0 + 1 + Math.random() * 12
    const p = new THREE.Vector3(Math.sin(a) * r, STANDS.y0 + ((r - STANDS.r0) / (STANDS.r1 - STANDS.r0)) * (STANDS.y1 - STANDS.y0) + 1, Math.cos(a) * r)
    const to = near && Math.random() < 0.35 ? near.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)) : new THREE.Vector3()
    if (!near || to.lengthSq() === 0) {
      const b = Math.random() * TAU
      const rr = Math.sqrt(Math.random()) * (RING_R - 1)
      to.set(Math.sin(b) * rr, 0, Math.cos(b) * rr)
    }
    to.y = 0.05
    const T = 1.3 + Math.random() * 0.9
    const v = to.clone().sub(p).divideScalar(T)
    v.y += 0.5 * 9.8 * T
    const s = () => (Math.random() - 0.5) * 14
    flying.push({ p, v, spin: new THREE.Vector3(s(), s(), s()), rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), down: false, obj })
  }
  let near: THREE.Vector3 | null = null
  return {
    /** Start throwing: `perSecond` flowers, aimed partly at `around`. */
    start(perSecond = 90, around: THREE.Vector3 | null = null) {
      rate = perSecond
      near = around
    },
    stop() {
      rate = 0
    },
    reset() {
      rate = acc = thrown = bq = 0
      flying.length = 0
      heads.count = stems.count = 0
      for (const b of bouquets) b.visible = false
    },
    update(dt: number) {
      if (rate > 0) {
        acc += rate * dt
        while (acc >= 1 && thrown < N) {
          acc -= 1
          thrown++
          launch(near)
          // a whole bouquet every so often
          if (thrown % 40 === 0 && bq < bouquets.length) {
            const b = bouquets[bq++]
            b.visible = true
            launch(near, b)
          }
        }
      }
      let n = 0
      for (const f of flying) {
        if (!f.down) {
          f.v.y -= 9.8 * dt
          f.p.addScaledVector(f.v, dt)
          f.rot.x += f.spin.x * dt
          f.rot.y += f.spin.y * dt
          f.rot.z += f.spin.z * dt
          // keep inside the barrier, and lie down where it lands
          const r = Math.hypot(f.p.x, f.p.z)
          if (r > RING_R - 0.3 && f.p.y < BARRIER_H + 0.2 && f.v.y < 0) f.p.multiplyScalar((RING_R - 0.3) / r)
          if (f.p.y <= 0.05) {
            f.p.y = 0.05
            f.down = true
            f.rot.set(Math.PI / 2, Math.random() * TAU, 0, 'YXZ')
          }
        }
        if (f.obj) {
          f.obj.position.copy(f.p)
          f.obj.rotation.copy(f.rot)
          continue
        }
        q.setFromEuler(f.rot)
        m.compose(f.p, q, one)
        heads.setMatrixAt(n, m)
        stems.setMatrixAt(n, m)
        n++
      }
      heads.count = stems.count = n
      heads.instanceMatrix.needsUpdate = stems.instanceMatrix.needsUpdate = true
    },
  }
}

/* ---------- the whole place ---------- */

export function buildArena() {
  const scene = new THREE.Scene()
  const rand = rng(1936)
  const updaters: ((t: number, dt: number, focus: THREE.Vector3) => void)[] = []
  scene.background = new THREE.Color(0xcfe0f0)
  scene.fog = new THREE.FogExp2(0xe6d9bc, 0.0028)

  /* sky + sun */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vP; void main(){
        float h = clamp(vP.y, 0.0, 1.0);
        vec3 hor = vec3(0.93, 0.9, 0.82);
        vec3 top = vec3(0.22, 0.5, 0.92);
        gl_FragColor = vec4(mix(hor, top, smoothstep(0.0, 0.5, h)), 1.0);
      }`,
    }),
  )
  sky.renderOrder = -10
  scene.add(sky)
  const SUN_DIR = new THREE.Vector3(-25, 70, -20).normalize()
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,240,1)', 'rgba(255,240,200,0)'), fog: false, depthWrite: false, blending: THREE.AdditiveBlending }))
  sunDisc.scale.setScalar(140)
  sunDisc.renderOrder = -9
  scene.add(sunDisc)
  const hemi = new THREE.HemisphereLight(0xd8ecff, 0xc9a26a, 1.25)
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = sun.shadow.camera
  sc.left = sc.bottom = -26
  sc.right = sc.top = 26
  sc.near = 1
  sc.far = 200
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.04
  scene.add(hemi, sun, sun.target)
  updaters.push((_t, _dt, focus) => {
    sun.target.position.copy(focus)
    sun.position.copy(focus).addScaledVector(SUN_DIR, 90)
    sunDisc.position.copy(focus).addScaledVector(SUN_DIR, 500)
  })

  /* the land round about: dry grass, a road, hills */
  const groundGeo = new THREE.PlaneGeometry(1400, 1400, 70, 70)
  groundGeo.rotateX(-Math.PI / 2)
  const gp = groundGeo.attributes.position as THREE.BufferAttribute
  const gcol: number[] = []
  const tones = [new THREE.Color(0xcdb37c), new THREE.Color(0xc2a86a), new THREE.Color(0xd6c08a), new THREE.Color(0xb59a5e)]
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i)
    const z = gp.getZ(i)
    const far = THREE.MathUtils.smoothstep(Math.hypot(x, z), 120, 400)
    gp.setY(i, (Math.sin(x * 0.02) * Math.cos(z * 0.017) * 6 + 4) * far - 0.05)
    const c = tones[Math.floor(rand() * tones.length)]
    gcol.push(c.r, c.g, c.b)
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3))
  groundGeo.computeVertexNormals()
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }))
  ground.receiveShadow = true
  scene.add(ground)
  const road = new THREE.Mesh(new THREE.PlaneGeometry(6, ROAD.from + 80 - WALL_R), std(0xb89868, 0.95))
  road.rotation.x = -Math.PI / 2
  road.position.set(0, 0.01, (ROAD.from + 80 + WALL_R) / 2)
  road.receiveShadow = true
  scene.add(road)

  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]) => {
    const m = new THREE.InstancedMesh(geo, mat, mats.length)
    mats.forEach((x, i) => m.setMatrixAt(i, x))
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
    return m
  }
  const d = new THREE.Object3D()
  const at = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) => {
    d.position.set(x, y, z)
    d.rotation.set(0, ry, 0)
    d.scale.set(sx, sy, sz)
    d.updateMatrix()
    return d.matrix.clone()
  }
  // hills on the horizon
  const hills: THREE.Matrix4[] = []
  for (let i = 0; i < 30; i++) {
    const a = rand() * TAU
    const r = 260 + rand() * 260
    hills.push(at(Math.cos(a) * r, -6, Math.sin(a) * r, 50 + rand() * 60, 16 + rand() * 20, 50 + rand() * 60))
  }
  inst(new THREE.SphereGeometry(1, 14, 8), std(0xb39560, 0.95), hills)
  // olive trees: grey-green puffs on crooked trunks, mostly along the road
  const trunks: THREE.Matrix4[] = []
  const tops: THREE.Matrix4[] = []
  for (let i = 0; i < 110; i++) {
    const side = rand() < 0.5 ? -1 : 1
    const x = side * (6 + Math.pow(rand(), 1.5) * 90)
    const z = WALL_R + 12 + rand() * 230
    if (Math.hypot(x - CORK.x, z - CORK.z) < 8) continue
    const s = 0.8 + rand() * 0.6
    trunks.push(at(x, 0.9 * s, z, s, s, s, rand() * TAU))
    tops.push(at(x, 2.3 * s, z, 1.8 * s, 1.2 * s, 1.8 * s))
  }
  inst(new THREE.CylinderGeometry(0.14, 0.22, 1.8, 6), std(0x6a5038, 0.9), trunks)
  inst(new THREE.SphereGeometry(1, 9, 7), std(0x8a9a6a, 0.9), tops)
  // cypresses
  const cyp: THREE.Matrix4[] = []
  for (let i = 0; i < 26; i++) {
    const side = rand() < 0.5 ? -1 : 1
    cyp.push(at(side * (9 + rand() * 40), 3, WALL_R + 20 + rand() * 200, 0.9, 1, 0.9))
  }
  inst(new THREE.ConeGeometry(1, 7, 8), std(0x2f4a2a, 0.9), cyp)
  // white houses with terracotta roofs along the road
  const walls: THREE.Matrix4[] = []
  const roofs: THREE.Matrix4[] = []
  for (let z = WALL_R + 40; z < ROAD.from + 60; z += 9 + rand() * 10) {
    for (const side of [-1, 1]) {
      if (rand() < 0.35) continue
      const w = 4 + rand() * 4
      const h = 3 + rand() * 3
      const dd = 4 + rand() * 3
      const x = side * (6.5 + w / 2 + rand() * 4)
      if (Math.hypot(x - CORK.x, z - CORK.z) < 12) continue
      walls.push(at(x, h / 2, z, w, h, dd))
      roofs.push(at(x, h + 0.7, z, w * 0.75, 1.4, dd * 0.75, Math.PI / 4))
    }
  }
  inst(new THREE.BoxGeometry(1, 1, 1), std(0xf4efe4, 0.8), walls)
  inst(new THREE.ConeGeometry(1, 1, 4), std(0xb5502e, 0.8), roofs)

  // the cork tree, and Ferdinand under it smelling the flowers
  const cork = new THREE.Group()
  cork.position.copy(CORK)
  cork.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 3.0, 0), 0.45, std(0x5a3e2a, 0.95)))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    const b = new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 8), std(0x4f6b34, 0.9))
    b.position.set(Math.cos(a) * 2.0, 4.2 + rand() * 0.8, Math.sin(a) * 2.0)
    b.scale.y = 0.7
    cork.add(b)
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), std(0x587a3a, 0.9))
  crown.position.y = 5
  cork.add(crown)
  for (let i = 0; i < 20; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), std([0xffffff, 0xf2c230, 0xe86aa6][i % 3], 0.6))
    f.position.set((rand() - 0.5) * 5, 0.1, 1 + rand() * 3)
    cork.add(f)
  }
  cork.traverse((o) => (o.castShadow = true))
  scene.add(cork)
  const cameo = new Bull({ coat: 0x8a8090, belly: 0xc8bcc0, scale: 1.25, ferdinand: true })
  cameo.group.position.copy(CAMEO)
  cameo.group.rotation.y = -2.2
  cameo.sit(1)
  scene.add(cameo.group)

  /* the bullring */
  // outside wall, with the main gate facing the road
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(WALL_R, WALL_R, 16.5, 72, 1, true), new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9 }))
  wall.position.y = 8.25
  wall.castShadow = wall.receiveShadow = true
  scene.add(wall)
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(5, 6.5), std(0x1a1210, 0.9))
  gate.position.set(0, 3.25, WALL_R + 0.05)
  scene.add(gate)
  const gateTop = new THREE.Mesh(new THREE.CircleGeometry(2.5, 20, 0, Math.PI), std(0x1a1210, 0.9))
  gateTop.position.set(0, 6.5, WALL_R + 0.05)
  scene.add(gateTop)
  // flags round the top
  const flagMats = [0xd8202c, 0xf2c230].map((c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.8 }))
  const flags: THREE.Mesh[] = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU
    const p = new THREE.Vector3(Math.sin(a) * WALL_R, 16.5, Math.cos(a) * WALL_R)
    scene.add(rod(p, p.clone().setY(20.5), 0.06, std(0xeeeeee, 0.4)))
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 6, 1), flagMats[i % 2])
    f.geometry.translate(0.9, 0, 0)
    f.position.copy(p).setY(19.9)
    f.userData.phase = i
    scene.add(f)
    flags.push(f)
  }
  updaters.push((t) => {
    for (const f of flags) {
      const pos = f.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 2.5 - t * 6 + f.userData.phase) * 0.15 * pos.getX(i))
      pos.needsUpdate = true
      f.rotation.y = 0.6
    }
  })

  // the stands, with the crowd painted on
  const frames = [crowdFrame(0, 11), crowdFrame(1, 11), crowdFrame(2, 11)]
  const standsMat = new THREE.MeshBasicMaterial({ map: frames[0], side: THREE.DoubleSide })
  const stands = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(STANDS.r0, STANDS.y0), new THREE.Vector2(STANDS.r1, STANDS.y1)], 96), standsMat)
  scene.add(stands)
  // the gallery round the top, in the shade
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(STANDS.r1 + 0.3, STANDS.r1 + 0.3, 3, 72, 1, true), new THREE.MeshBasicMaterial({ map: (() => {
    const t = wallTexture()
    t.repeat.x = 16
    return t
  })(), side: THREE.BackSide, color: 0xb8b0a0 }))
  gallery.position.y = STANDS.y1 + 1.4
  scene.add(gallery)
  // the wall at the front of the stands, on the far side of the passage behind the barrier
  const front = new THREE.Mesh(new THREE.CylinderGeometry(STANDS.r0, STANDS.r0, STANDS.y0, 72, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.9, side: THREE.BackSide }))
  front.position.y = STANDS.y0 / 2
  scene.add(front)

  // the sand
  const sand = new THREE.Mesh(new THREE.CircleGeometry(RING_R + CALLEJON, 72), new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }))
  sand.rotation.x = -Math.PI / 2
  sand.position.y = 0.02
  sand.receiveShadow = true
  scene.add(sand)
  // the barrier, with two gates in it
  const barrier = new THREE.Mesh(new THREE.CylinderGeometry(RING_R, RING_R, BARRIER_H, 96, 1, true), new THREE.MeshStandardMaterial({ map: barrierTexture(), roughness: 0.75, side: THREE.DoubleSide }))
  barrier.position.y = BARRIER_H / 2
  barrier.receiveShadow = barrier.castShadow = true
  scene.add(barrier)
  const doorMat = std(0x6b1414, 0.7)
  /** The bulls' gate (toril) at -z: two leaves that swing out onto the sand. */
  const toril = [-1, 1].map((s) => {
    const hinge = new THREE.Group()
    hinge.position.set(s * 1.5, 0, -RING_R + 0.05)
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.5, BARRIER_H + 0.3, 0.1), doorMat)
    leaf.position.set(-s * 0.75, (BARRIER_H + 0.3) / 2, 0)
    leaf.castShadow = true
    hinge.add(leaf)
    hinge.userData.side = s
    scene.add(hinge)
    return hinge
  })
  // a dark tunnel behind the gate
  const tunnel = new THREE.Mesh(new THREE.PlaneGeometry(3, BARRIER_H + 0.3), std(0x120c0a, 1))
  tunnel.position.set(0, (BARRIER_H + 0.3) / 2, -RING_R - 0.3)
  scene.add(tunnel)
  // the gate you come in by, at +z (shut)
  const yours = new THREE.Mesh(new THREE.BoxGeometry(2.6, BARRIER_H + 0.2, 0.1), doorMat)
  yours.position.set(0, (BARRIER_H + 0.2) / 2, RING_R - 0.05)
  scene.add(yours)
  // the president's box over the toril, hung with a flag
  const palco = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), new THREE.MeshBasicMaterial({ map: (() => {
    const [c, ctx] = makeCanvas(256, 64)
    ctx.fillStyle = '#d8202c'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = '#f2c230'
    ctx.fillRect(0, 18, 256, 28)
    return toTexture(c)
  })() }))
  palco.position.set(0, STANDS.y0 + 2.2, -(STANDS.r0 + 3.2))
  palco.rotation.x = -0.6
  scene.add(palco)

  /* the carriage (hästvagn) with a matador up front, and the horse */
  const carriage = new THREE.Group()
  const wood = std(0x6b3a1e, 0.8)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    carriage.add(m)
    return m
  }
  add(new THREE.BoxGeometry(1.5, 0.12, 2.6), wood, 0, 0.95, 0)
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.45, 2.6), std(0xb3202a, 0.6), s * 0.75, 1.2, 0)
  add(new THREE.BoxGeometry(1.5, 0.45, 0.08), std(0xb3202a, 0.6), 0, 1.2, -1.3)
  // your bench at the back, the driver's bench up front
  add(new THREE.BoxGeometry(1.3, 0.12, 0.5), std(0x3a2a1a, 0.8), 0, 1.35, 0.8)
  add(new THREE.BoxGeometry(1.3, 0.5, 0.1), std(0x3a2a1a, 0.8), 0, 1.65, 1.08)
  add(new THREE.BoxGeometry(1.2, 0.12, 0.45), std(0x3a2a1a, 0.8), 0, 1.6, -0.9)
  const wheels: THREE.Group[] = []
  for (const z of [-0.8, 0.8])
    for (const s of [-1, 1]) {
      const w = new THREE.Group()
      w.position.set(s * 0.85, 0.62, z)
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 20), std(0x2a1a10, 0.6))
      tyre.rotation.y = Math.PI / 2
      w.add(tyre)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU
        w.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, Math.cos(a) * 0.54, Math.sin(a) * 0.54), 0.025, std(0xf2c230, 0.5)))
      }
      carriage.add(w)
      wheels.push(w)
    }
  // shafts out to the horse
  for (const s of [-1, 1]) carriage.add(rod(new THREE.Vector3(s * 0.4, 1.0, -1.3), new THREE.Vector3(s * 0.35, 1.3, -3.6), 0.04, wood))
  const horse = new Horse()
  horse.group.position.set(0, 0, -3.2)
  horse.group.rotation.y = Math.PI
  carriage.add(horse.group)
  const driver = new Matador({ suit: 0x1f3a8a, pose: 'arms', mustache: true })
  driver.group.position.set(0, 0.78, -0.95)
  driver.group.rotation.y = Math.PI
  for (const l of driver.legs) l.rotation.x = -Math.PI / 2 + 0.2
  driver.legs.forEach((l) => (l.userData.knee.rotation.x = 1.4))
  driver.body.rotation.x = 0
  driver.armL.rotation.set(-1.0, 0, -0.2)
  driver.armR.rotation.set(-1.0, 0, 0.2)
  driver.armL.userData.elbow.rotation.set(-0.4, 0, 0)
  driver.armR.userData.elbow.rotation.set(-0.4, 0, 0)
  carriage.add(driver.group)
  // reins from his hands to the bridle
  for (const s of [-1, 1]) carriage.add(rod(new THREE.Vector3(s * 0.15, 2.0, -1.4), new THREE.Vector3(s * 0.12, 2.1, -4.4), 0.008, std(0x2a1a10)))
  carriage.visible = false
  scene.add(carriage)

  /* the crowd's mood: 0 sitting, 1 on their feet, 2 going wild */
  let mood = 0
  let moodT = 0
  updaters.push((_t, dt) => {
    moodT += dt
    const want = mood <= 0 ? 0 : mood < 1.5 ? (Math.floor(moodT * 4) % 2 ? 1 : 0) : Math.floor(moodT * 6) % 2 ? 2 : 1
    if (standsMat.map !== frames[want]) {
      standsMat.map = frames[want]
      standsMat.needsUpdate = true
    }
  })

  return {
    scene,
    sun,
    carriage,
    horse,
    driver,
    /** Spin the carriage wheels along by `dist` metres. */
    roll(dist: number) {
      for (const w of wheels) w.rotation.x -= dist / 0.6
    },
    /** 0 = shut … 1 = wide open. */
    openToril(k: number) {
      for (const h of toril) h.rotation.y = h.userData.side * k * 1.6
    },
    setMood(m: number) {
      mood = m
    },
    update: (t: number, dt: number, focus: THREE.Vector3) => updaters.forEach((u) => u(t, dt, focus)),
  }
}

export type Arena = ReturnType<typeof buildArena>
