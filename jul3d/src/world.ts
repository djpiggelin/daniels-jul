// The village square: night sky, aurora, falling snow, the big julgran, a forest ring and lamp posts.
// The weather is Stockholm's, right now (vader.ts): snow or rain, wind, clouds and fog.
import * as THREE from 'three'
import { keepApart } from './batch'
import { glowTexture, makeCanvas, rng, toTexture } from './tex'
import type { Weather } from './vader'

export type Circle = { x: number; z: number; r: number }

export const VILLAGE_RADIUS = 44

/** Footprints (centre, rotation, half size, roof height) where snow shouldn't fall. */
export type Roof = { x: number; z: number; cos: number; sin: number; hw: number; hd: number; h: number }

type Rect = { x0: number; x1: number; z0: number; z1: number }
/**
 * North of the village, through the forest: the path, the yard Leksaksfabriken stands in (the hall included),
 * and the clearing east of the path where Tomten and Tomtemor live (Tomtegården, see tomtegarden.ts).
 */
export const NORTH: { path: Rect; yard: Rect; garden: Rect } = {
  path: { x0: -3.5, x1: 3.5, z0: -54, z1: -40 },
  yard: { x0: -26, x1: 26, z0: -100, z1: -52 },
  garden: { x0: 3.5, x1: 60, z0: -67, z1: -26 },
}
/**
 * Where the forest's animals are (djur.ts): the bird feeder at the south-east edge of the village and the
 * birch beside it, where the roe deer come out to eat and the way back to their spot in the forest, and
 * the moose's way through the forest to the path north. The ways are kept clear of firs.
 */
export const WILD = {
  feeder: { x: 27.3, z: 32.6 },
  birch: { x: 30.3, z: 30.4 },
  deerFeed: [
    { x: 29.4, z: 35.1 },
    { x: 26.9, z: 37.1 },
  ],
  deerHome: { x: 37.3, z: 44.4 },
  moose: [
    { x: -75, z: -54 },
    { x: -0.5, z: -47 },
  ],
}
const segDist = (a: { x: number; z: number }, b: { x: number; z: number }, x: number, z: number) => {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const u = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1)
  return Math.hypot(x - a.x - u * dx, z - a.z - u * dz)
}
/** How far (x, z) is from the animals' ways. */
function wildWay(x: number, z: number) {
  return Math.min(...WILD.deerFeed.map((f) => segDist(WILD.deerHome, f, x, z)), segDist(WILD.moose[0], WILD.moose[1], x, z) - 0.8)
}

const rectDist = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1))

/** How far (x, z) is from the ground you can walk on: the village circle, the path north and the yard. */
export function outside(x: number, z: number) {
  return Math.min(Math.max(0, Math.hypot(x, z) - VILLAGE_RADIUS), rectDist(NORTH.path, x, z), rectDist(NORTH.yard, x, z), rectDist(NORTH.garden, x, z))
}

/** Back onto that ground, the shortest way. */
export function keepInside(p: THREE.Vector3) {
  if (outside(p.x, p.z) === 0) return
  const r = Math.hypot(p.x, p.z)
  const options = [{ x: (p.x / r) * VILLAGE_RADIUS, z: (p.z / r) * VILLAGE_RADIUS }]
  for (const b of [NORTH.path, NORTH.yard, NORTH.garden]) options.push({ x: THREE.MathUtils.clamp(p.x, b.x0, b.x1), z: THREE.MathUtils.clamp(p.z, b.z0, b.z1) })
  let best = options[0]
  for (const o of options) if (Math.hypot(o.x - p.x, o.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z)) best = o
  p.x = best.x
  p.z = best.z
}

/** Height of the snow at (x, z): flat where you can walk, rolling drifts outside it. */
export function groundHeight(x: number, z: number) {
  const k = THREE.MathUtils.smoothstep(outside(x, z), 0, 12)
  return k * ((Math.sin(x * 0.17) * Math.cos(z * 0.13) + Math.sin(x * 0.06 + z * 0.08)) * 0.7 + 0.6)
}

export function buildWorld(scene: THREE.Scene, opts: { lowPower: boolean }) {
  const roofs: Roof[] = []
  /** Things a snowball can hit. */
  const solids: THREE.Object3D[] = []
  const updaters: ((t: number, dt: number, player: THREE.Vector3, walking: boolean) => void)[] = []
  const colliders: Circle[] = []
  const rand = rng(42)

  scene.background = new THREE.Color(0x070b1d)
  scene.fog = new THREE.FogExp2(0x1f2b5e, 0.016)

  /* ---------- sky ---------- */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTop: { value: new THREE.Color(0.02, 0.03, 0.09) }, uHor: { value: new THREE.Color(0.122, 0.169, 0.369) } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP; void main(){
        float h = clamp(vP.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(uHor, uTop, pow(h, 0.45)), 1.0);
      }`,
    }),
  )
  sky.renderOrder = -10
  scene.add(sky)

  // stars
  const starPos: number[] = []
  for (let i = 0; i < 2200; i++) {
    const u = rand() * Math.PI * 2
    const v = 0.08 + rand() * 0.92
    const r = 360
    starPos.push(Math.cos(u) * Math.sqrt(1 - v * v) * r, v * r, Math.sin(u) * Math.sqrt(1 - v * v) * r)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false }))
  scene.add(stars)

  // moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false }))
  moon.position.set(-110, 120, -230)
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,246,220,0.9)', 'rgba(160,180,255,0)'), fog: false, blending: THREE.AdditiveBlending, depthWrite: false }))
  moonGlow.scale.setScalar(80)
  moonGlow.position.copy(moon.position)
  scene.add(moon, moonGlow)

  // aurora ribbons
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `uniform float uTime; varying vec2 vUv;
      void main(){ vUv = uv; vec3 p = position;
        p.z += sin(p.x * 0.018 + uTime * 0.15) * 22.0 + sin(p.x * 0.05 - uTime * 0.3) * 6.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uFade; varying vec2 vUv;
      void main(){
        float x = vUv.x; float y = vUv.y;
        float band = smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.3, 1.0, y));
        float rays = 0.55 + 0.45 * sin(x * 140.0 + sin(x * 9.0 + uTime * 0.4) * 5.0);
        float wave = 0.4 + 0.6 * (0.5 + 0.5 * sin(x * 10.0 - uTime * 0.25));
        float edge = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(0.88, 1.0, x));
        float a = band * rays * wave * edge * uFade;
        vec3 col = mix(vec3(0.15, 1.0, 0.55), vec3(0.55, 0.3, 1.0), smoothstep(0.25, 0.9, y));
        gl_FragColor = vec4(col * a * 0.5, a * 0.5);
      }`,
  })
  for (const [i, cfg] of [
    { y: 70, z: -230, rot: 0.1, w: 420, h: 90 },
    { y: 95, z: -260, rot: -0.35, w: 360, h: 70 },
  ].entries()) {
    const geo = new THREE.PlaneGeometry(cfg.w, cfg.h, 96, 1)
    const aur = new THREE.Mesh(geo, auroraMat)
    aur.position.set(i * 60 - 20, cfg.y, cfg.z)
    aur.rotation.y = cfg.rot
    aur.rotation.x = -0.25
    scene.add(aur)
  }

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0x9fb2ff, 0x2a3260, 0.9)
  scene.add(hemi)
  const moonLight = new THREE.DirectionalLight(0xbfd0ff, 1.1)
  moonLight.position.set(-30, 45, -40)
  moonLight.castShadow = !opts.lowPower
  moonLight.shadow.mapSize.set(2048, 2048)
  const sc = moonLight.shadow.camera
  sc.left = sc.bottom = -46
  sc.right = sc.top = 46
  sc.near = 1
  sc.far = 140
  moonLight.shadow.bias = -0.0004
  moonLight.shadow.normalBias = 0.03
  scene.add(moonLight)

  /* ---------- ground ---------- */
  const groundGeo = new THREE.PlaneGeometry(1000, 1000, 250, 250)
  groundGeo.rotateX(-Math.PI / 2)
  const gp = groundGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i)
    const z = gp.getZ(i)
    gp.setY(i, groundHeight(x, z))
  }
  groundGeo.computeVertexNormals()
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef3fb, roughness: 0.95 })
  const ground = new THREE.Mesh(groundGeo, snowMat)
  ground.receiveShadow = true
  scene.add(ground)

  // trampled plaza + a ring path round the tree
  const [pc, pctx] = makeCanvas(512, 512)
  pctx.fillStyle = '#d6dde9'
  pctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 1400; i++) {
    pctx.fillStyle = rand() > 0.5 ? 'rgba(160,170,190,0.18)' : 'rgba(255,255,255,0.35)'
    const [x, y, rx, ry, rot] = [rand() * 512, rand() * 512, 3 + rand() * 9, 2 + rand() * 5, rand() * 3]
    for (const ox of [-512, 0, 512])
      for (const oy of [-512, 0, 512]) {
        pctx.beginPath()
        pctx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2)
        pctx.fill()
      }
  }
  const plazaTex = toTexture(pc)
  plazaTex.wrapS = plazaTex.wrapT = THREE.RepeatWrapping
  plazaTex.repeat.set(10, 10)
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(30, 72), new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 1 }))
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.01
  plaza.receiveShadow = true
  scene.add(plaza)

  /* ---------- julgran ---------- */
  const tree = new THREE.Group()
  const needle = new THREE.MeshStandardMaterial({ color: 0x1d5236, roughness: 0.9 })
  const snowTip = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.9 })
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0x4a2c1c }))
  trunk.position.y = 0.8
  tree.add(trunk)
  const tiers = [
    { r: 2.9, h: 3.2, y: 2.6 },
    { r: 2.3, h: 2.8, y: 4.3 },
    { r: 1.65, h: 2.4, y: 5.8 },
    { r: 1.0, h: 1.9, y: 7.1 },
  ]
  for (const t of tiers) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 24), needle)
    c.position.y = t.y
    c.castShadow = true
    const cap = new THREE.Mesh(new THREE.ConeGeometry(t.r * 0.42, t.h * 0.3, 24), snowTip)
    cap.position.y = t.y + t.h * 0.36
    tree.add(c, cap)
  }
  // spiral of bulbs
  const BULBS = 190
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), BULBS)
  // (they stay faintly lit through the dark of the Lucia procession – see korsang.ts)
  bulbs.material.userData.glimmer = 0.22
  const bulbColors = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff, 0xff8de1, 0xfff4d6].map((c) => new THREE.Color(c))
  const base: THREE.Color[] = []
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < BULBS; i++) {
    const k = i / BULBS
    const y = 1.3 + k * 6.6
    const rr = THREE.MathUtils.lerp(2.75, 0.25, (y - 1.3) / 6.8) + 0.05
    const a = k * Math.PI * 2 * 7.5
    m4.makeTranslation(Math.cos(a) * rr, y, Math.sin(a) * rr)
    bulbs.setMatrixAt(i, m4)
    base.push(bulbColors[i % bulbColors.length])
    bulbs.setColorAt(i, base[i])
  }
  tree.add(bulbs)
  // star
  const starShape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.25 : 0.6
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  const star = keepApart(new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.15, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false })))
  star.geometry.center()
  star.position.y = 8.55
  const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,220,120,1)', 'rgba(255,180,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  starGlow.scale.setScalar(4.5)
  starGlow.position.y = 8.55
  tree.add(star, starGlow)
  const treeLight = new THREE.PointLight(0xffc77a, 40, 22, 1.6)
  treeLight.position.y = 3.5
  tree.add(treeLight)
  // gifts
  const giftCols = [0xe5383b, 0x2fa36b, 0xf6c453, 0x4a7bd0, 0xfff3dc]
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3
    const s = 0.35 + rand() * 0.35
    const g = new THREE.Group()
    const box = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), new THREE.MeshStandardMaterial({ color: giftCols[i % 5], roughness: 0.6 }))
    box.position.y = s * 0.4
    const rib = new THREE.MeshStandardMaterial({ color: giftCols[(i + 2) % 5], roughness: 0.4 })
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 0.82, s * 0.18), rib)
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(s * 0.18, s * 0.82, s * 1.02), rib)
    r1.position.y = r2.position.y = s * 0.4
    g.add(box, r1, r2)
    g.position.set(Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3)
    g.rotation.y = rand() * Math.PI
    g.traverse((o) => (o.castShadow = true))
    tree.add(g)
  }
  scene.add(tree)
  solids.push(tree)
  // (out past the toy train's track, see leksakstag.ts)
  colliders.push({ x: 0, z: 0, r: 4.3 })
  updaters.push((t) => {
    for (let i = 0; i < BULBS; i++) {
      const k = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + i * 1.37))
      bulbs.setColorAt(i, base[i].clone().multiplyScalar(k))
    }
    bulbs.instanceColor!.needsUpdate = true
    star.rotation.y = t * 0.6
    treeLight.intensity = 36 + Math.sin(t * 3) * 3
  })

  /* ---------- forest ring ---------- */
  const firs: { x: number; z: number; s: number }[] = []
  while (firs.length < (opts.lowPower ? 140 : 220)) {
    const a = rand() * Math.PI * 2
    const r = VILLAGE_RADIUS + 2 + Math.pow(rand(), 0.7) * 60
    const s = 0.9 + rand() * 1.1
    // the way north to Leksaksfabriken stays clear
    if (outside(Math.cos(a) * r, Math.sin(a) * r) < 2 + s * 1.7) continue
    // nor do the deer's and the moose's
    if (wildWay(Math.cos(a) * r, Math.sin(a) * r) < 1 + s * 1.8) continue
    firs.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s })
  }
  // and far out, for flying over in Tomtens släde (hidden in the fog while you walk, so only drawn when flying)
  const farFirs: typeof firs = []
  for (let i = 0; i < (opts.lowPower ? 260 : 520); i++) {
    const a = rand() * Math.PI * 2
    const r = 100 + rand() * 330
    farFirs.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1 + rand() * 1.6 })
  }
  // a few inside the village too, for depth
  for (const [x, z] of [[-31, 18], [31, 17], [-35, 4], [35, 3], [-16, 34], [16, 35], [-38, -12], [38, -13]]) firs.push({ x, z, s: 0.8 + rand() * 0.4 })
  const coneGeos = [
    { g: new THREE.ConeGeometry(1.7, 2.6, 9), y: 1.9 },
    { g: new THREE.ConeGeometry(1.3, 2.2, 9), y: 3.1 },
    { g: new THREE.ConeGeometry(0.85, 1.8, 9), y: 4.2 },
  ]
  const firMat = new THREE.MeshStandardMaterial({ color: 0x1a4430, roughness: 0.95 })
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.2, 6)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2516 })
  const capGeos = coneGeos.map((c) => new THREE.ConeGeometry((c.g.parameters as { radius: number }).radius * 0.45, 0.75, 9))
  const tmp = new THREE.Object3D()
  /** One batch of instanced firs. Only the ones the moon's shadow map reaches cast shadows. */
  const plant = (list: typeof firs, shadow: boolean) => {
    const group = new THREE.Group()
    const firTrunk = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length)
    const firCones = coneGeos.map((c) => new THREE.InstancedMesh(c.g, firMat, list.length))
    const firCaps = capGeos.map((g) => new THREE.InstancedMesh(g, snowTip, list.length))
    list.forEach((f, i) => {
      const gy = groundHeight(f.x, f.z) - 0.1
      tmp.rotation.set(0, rand() * 6, 0)
      tmp.scale.setScalar(f.s)
      tmp.position.set(f.x, gy + 0.6 * f.s, f.z)
      tmp.updateMatrix()
      firTrunk.setMatrixAt(i, tmp.matrix)
      coneGeos.forEach((c, j) => {
        tmp.position.set(f.x, gy + c.y * f.s, f.z)
        tmp.updateMatrix()
        firCones[j].setMatrixAt(i, tmp.matrix)
        tmp.position.y = gy + (c.y + 0.75) * f.s
        tmp.updateMatrix()
        firCaps[j].setMatrixAt(i, tmp.matrix)
      })
    })
    for (const m of [firTrunk, ...firCones, ...firCaps]) {
      m.castShadow = shadow
      m.computeBoundingSphere()
      group.add(m)
    }
    scene.add(group)
    return { group, cones: firCones }
  }
  for (const f of firs) if (outside(f.x, f.z) < 3) colliders.push({ x: f.x, z: f.z, r: 1.2 * f.s })
  const inShadow = (f: (typeof firs)[number]) => Math.abs(f.x) < 52 && Math.abs(f.z) < 52
  const near = plant(firs.filter(inShadow), true)
  plant(firs.filter((f) => !inShadow(f)), false)
  const far = plant(farFirs, false)
  far.group.visible = false
  solids.push(...near.cones)

  /* ---------- the path north ---------- */
  // Cobblestones from the tree, between the shops, out under the gate and up to Leksaksfabriken's
  // yard – with little lanterns along it.
  {
    const [c, ctx] = makeCanvas(256, 256)
    ctx.fillStyle = '#4a4f5e'
    ctx.fillRect(0, 0, 256, 256)
    const rows = 6
    for (let r = 0; r < rows; r++)
      for (let k = -1; k < 6; k++) {
        const w = 256 / 5
        const h = 256 / rows
        const x = k * w + (r % 2 ? w / 2 : 0) + (rand() - 0.5) * 6
        const y = r * h + (rand() - 0.5) * 4
        const shade = 0.85 + rand() * 0.3
        ctx.fillStyle = `rgb(${Math.round(128 * shade)},${Math.round(132 * shade)},${Math.round(146 * shade)})`
        ctx.beginPath()
        ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 12)
        ctx.fill()
        // a dusting of snow on each stone
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath()
        ctx.roundRect(x + 8, y + 6, (w - 16) * (0.3 + rand() * 0.5), 6, 3)
        ctx.fill()
      }
    const tex = toTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    const z0 = -5.6
    const z1 = NORTH.yard.z1 - 2
    const len = z0 - z1
    const width = 3.4
    tex.repeat.set(width / 1.3, len / 1.3)
    const path = new THREE.Mesh(new THREE.PlaneGeometry(width, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }))
    path.rotation.x = -Math.PI / 2
    path.position.set(0, 0.016, (z0 + z1) / 2)
    path.receiveShadow = true
    scene.add(path)
    const lanterns = new THREE.Group()
    const iron = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.6 })
    const edge = new THREE.MeshStandardMaterial({ color: 0x3a3e4a, roughness: 0.9 })
    const glass = new THREE.MeshStandardMaterial({ color: 0x3a2410, emissive: 0xffc070, emissiveIntensity: 1.6 })
    const glowTex = glowTexture('rgba(255,210,140,0.8)', 'rgba(255,170,80,0)')
    for (const sx of [-1, 1]) {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, len), edge)
      kerb.position.set(sx * (width / 2 + 0.05), 0.04, (z0 + z1) / 2)
      kerb.receiveShadow = true
      lanterns.add(kerb)
    }
    for (let z = -10; z > z1 + 1; z -= 5.5) {
      for (const sx of [-1, 1]) {
        const x = sx * (width / 2 + 0.45)
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.1, 6), iron)
        post.position.set(x, 0.55, z)
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), glass)
        lamp.position.set(x, 1.25, z)
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 4), iron)
        cap.position.set(x, 1.47, z)
        cap.rotation.y = Math.PI / 4
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.08, 4), snowTip)
        cone.position.set(x, 1.56, z)
        cone.rotation.y = Math.PI / 4
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
        glow.position.set(x, 1.25, z)
        glow.scale.setScalar(1.6)
        post.castShadow = true
        lanterns.add(post, lamp, cap, cone, glow)
        colliders.push({ x, z, r: 0.15 })
      }
    }
    scene.add(lanterns)
  }

  /* ---------- lamp posts ---------- */
  const lampGlow = glowTexture('rgba(255,214,140,1)', 'rgba(255,170,70,0)')
  const iron = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.6 })
  const flame = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })
  // (still glowing a little through the dark of the Lucia procession, so you can find your way – see korsang.ts)
  flame.userData.glimmer = 0.45
  const addLamp = (x: number, z: number) => {
    const g = new THREE.Group()
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.2, 8), iron)
    post.position.y = 1.6
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.5, 6, 1, true), iron)
    head.position.y = 3.45
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 6), iron)
    cap.position.y = 3.85
    const capSnow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.14, 6), snowTip)
    capSnow.position.y = 3.98
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), flame)
    bulb.position.y = 3.45
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    glow.scale.setScalar(2.6)
    glow.position.y = 3.45
    g.add(post, head, cap, capSnow, bulb, glow)
    g.position.set(x, 0, z)
    post.castShadow = true
    scene.add(g)
    solids.push(post, cap)
    colliders.push({ x, z, r: 0.25 })
  }
  // (none straight north: that way you look out through the gap at Leksaksfabriken)
  for (const deg of [-50, -17, 17, 50, -112, 112, -150, 150]) {
    const a = THREE.MathUtils.degToRad(deg)
    const r = Math.abs(deg) <= 50 ? 12.5 : 15.5
    addLamp(Math.sin(a) * r, -Math.cos(a) * r)
  }

  /* ---------- falling snow, and rain – as much as Stockholm has right now ---------- */
  const N = opts.lowPower ? 3000 : 6000
  const BOX = { x: 50, y: 22, z: 50 }
  const flakes = new Float32Array(N * 3)
  const drift = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    flakes[i * 3] = (rand() - 0.5) * BOX.x
    flakes[i * 3 + 1] = rand() * BOX.y
    flakes[i * 3 + 2] = (rand() - 0.5) * BOX.z
    drift[i] = rand() * Math.PI * 2
  }
  const snowGeo = new THREE.BufferGeometry()
  snowGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3))
  const [fc, fctx] = makeCanvas(64, 64)
  const fg = fctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  fg.addColorStop(0, 'rgba(255,255,255,1)')
  fg.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  fg.addColorStop(1, 'rgba(255,255,255,0)')
  fctx.fillStyle = fg
  fctx.fillRect(0, 0, 64, 64)
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.11, map: toTexture(fc), transparent: true, depthWrite: false, opacity: 0.9 }))
  snow.frustumCulled = false
  scene.add(snow)
  // rain: short streaks, slanting with the wind
  const NR = opts.lowPower ? 1200 : 2500
  const RAIN = 9
  const drops = new Float32Array(NR * 6)
  for (let i = 0; i < NR; i++) {
    const x = (rand() - 0.5) * BOX.x
    const y = rand() * BOX.y
    const z = (rand() - 0.5) * BOX.z
    drops.set([x, y, z, x, y + 0.45, z], i * 6)
  }
  const rainGeo = new THREE.BufferGeometry()
  rainGeo.setAttribute('position', new THREE.BufferAttribute(drops, 3))
  rainGeo.setDrawRange(0, 0)
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xb8c8e8, transparent: true, opacity: 0.4, depthWrite: false }))
  rain.frustumCulled = false
  rain.visible = false
  scene.add(rain)

  /** The weather as the village has it now – eased towards what Stockholm says, so it turns gradually. */
  const wx = { snow: 0.6, rain: 0, cloud: 0.6, fog: 1, aurora: 1, wind: 2, windX: 0, windZ: 1 }
  let want: Weather | null = null
  let skyAgain = 0
  const ease = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt))
  /** Under a roof? (flakes and drops that reach one disappear, and come back from the sky) */
  const underRoof = (x: number, y: number, z: number) => {
    for (const r of roofs) {
      if (y > r.h) continue
      const dx = x - r.x
      const dz = z - r.z
      if (Math.abs(dx * r.cos - dz * r.sin) < r.hw && Math.abs(dx * r.sin + dz * r.cos) < r.hd) return true
    }
    return false
  }
  updaters.push((t, dt, player, walking) => {
    if (want) {
      for (const k of ['snow', 'rain', 'cloud', 'fog', 'aurora', 'wind'] as const) wx[k] = ease(wx[k], want[k], 0.08, dt)
      wx.windX = ease(wx.windX, want.windX, 0.2, dt)
      wx.windZ = ease(wx.windZ, want.windZ, 0.2, dt)
      // (the sky follows the clouds every second or so)
      if ((skyAgain -= dt) <= 0) {
        skyAgain = 1
        daylight(lastK, lastSun)
      }
    }
    // the haze thickens with fog and heavy snow (from up in the sleigh, flight.ts sees further)
    const fog = scene.fog as THREE.FogExp2
    if (walking) fog.density = ease(fog.density, 0.016 * wx.fog, 0.5, dt)
    const blow = Math.min(wx.wind, 16) * 0.45
    const bx = wx.windX * blow
    const bz = wx.windZ * blow
    const n = Math.round(N * wx.snow)
    snowGeo.setDrawRange(0, n)
    snow.visible = n > 0
    // (thick snow comes in bigger flakes)
    ;(snow.material as THREE.PointsMaterial).size = 0.11 + 0.07 * Math.max(0, wx.snow - 0.4)
    for (let i = 0; i < n; i++) {
      const j = i * 3
      flakes[j + 1] -= dt * (0.8 + (i % 7) * 0.08)
      flakes[j] += (Math.sin(t * 0.6 + drift[i]) * 0.3 + bx) * dt
      flakes[j + 2] += bz * dt
      if (flakes[j + 1] < 0) flakes[j + 1] += BOX.y
      // flakes that reach a roof disappear (and come back from the sky)
      if (underRoof(flakes[j], flakes[j + 1], flakes[j + 2])) flakes[j + 1] = -0.5
      // keep the box centred on the player
      const dx = flakes[j] - player.x
      if (dx > BOX.x / 2) flakes[j] -= BOX.x
      else if (dx < -BOX.x / 2) flakes[j] += BOX.x
      const dz = flakes[j + 2] - player.z
      if (dz > BOX.z / 2) flakes[j + 2] -= BOX.z
      else if (dz < -BOX.z / 2) flakes[j + 2] += BOX.z
    }
    if (n) snowGeo.attributes.position.needsUpdate = true
    const nr = Math.round(NR * wx.rain)
    rainGeo.setDrawRange(0, nr * 2)
    rain.visible = nr > 0
    for (let i = 0; i < nr; i++) {
      const j = i * 6
      let x = drops[j] + bx * 1.6 * dt
      let y = drops[j + 1] - RAIN * dt
      let z = drops[j + 2] + bz * 1.6 * dt
      if (y < 0) y += BOX.y
      else if (underRoof(x, y, z)) y = BOX.y
      const dx = x - player.x
      if (dx > BOX.x / 2) x -= BOX.x
      else if (dx < -BOX.x / 2) x += BOX.x
      const dz = z - player.z
      if (dz > BOX.z / 2) z -= BOX.z
      else if (dz < -BOX.z / 2) z += BOX.z
      // the streak trails back the way it came
      drops[j] = x
      drops[j + 1] = y
      drops[j + 2] = z
      drops[j + 3] = x - bx * 0.08
      drops[j + 4] = y + 0.45
      drops[j + 5] = z - bz * 0.08
    }
    if (nr) rainGeo.attributes.position.needsUpdate = true
    sky.position.copy(player)
    stars.position.copy(player)
    auroraMat.uniforms.uTime.value = t
  })

  /* ---------- day and night ---------- */
  const NIGHT = { top: new THREE.Color(0.02, 0.03, 0.09), hor: new THREE.Color(0.122, 0.169, 0.369), fog: new THREE.Color(0x1f2b5e), sky: new THREE.Color(0x9fb2ff), ground: new THREE.Color(0x2a3260), light: new THREE.Color(0xbfd0ff) }
  const DAY = { top: new THREE.Color(0.28, 0.48, 0.8), hor: new THREE.Color(0.74, 0.81, 0.9), fog: new THREE.Color(0xb4c6dc), sky: new THREE.Color(0xffffff), ground: new THREE.Color(0x98a4b8), light: new THREE.Color(0xfff0dc) }
  const DUSK = new THREE.Color(0.9, 0.52, 0.42)
  const skyU = (sky.material as THREE.ShaderMaterial).uniforms
  const moonAt = moonLight.position.clone()
  // under a grey sky: pale by day, a dull dark at night
  const OVERCAST = { night: { top: new THREE.Color(0.045, 0.045, 0.06), hor: new THREE.Color(0.15, 0.14, 0.19) }, day: { top: new THREE.Color(0.52, 0.56, 0.62), hor: new THREE.Color(0.7, 0.72, 0.76) } }
  const grey = new THREE.Color()
  let lastSun = new THREE.Vector3(0, -1, 0)
  /** How strong the aurora is beyond the usual (the calendar's door 20 turns it up). */
  let auroraBoost = 1
  let lastK = 0
  /**
   * How light it is: `k` 0 at night … 1 in daylight, with the sun's direction for its light. The
   * horizon blushes at dawn and dusk; stars, moon and aurora fade out as the day comes.
   */
  function daylight(k: number, sun: THREE.Vector3) {
    lastK = k
    lastSun = sun
    const oc = wx.cloud * 0.85
    const dusk = Math.max(0, 1 - Math.abs(k - 0.35) / 0.3) * 0.55 * (1 - wx.cloud * 0.7)
    skyU.uTop.value.lerpColors(NIGHT.top, DAY.top, k).lerp(grey.lerpColors(OVERCAST.night.top, OVERCAST.day.top, k), oc)
    skyU.uHor.value.lerpColors(NIGHT.hor, DAY.hor, k).lerp(grey.lerpColors(OVERCAST.night.hor, OVERCAST.day.hor, k), oc).lerp(DUSK, dusk)
    const fog = scene.fog as THREE.FogExp2
    fog.color.lerpColors(NIGHT.fog, DAY.fog, k).lerp(grey, oc * 0.7).lerp(DUSK, dusk * 0.4)
    ;(scene.background as THREE.Color).copy(fog.color)
    hemi.color.lerpColors(NIGHT.sky, DAY.sky, k)
    hemi.groundColor.lerpColors(NIGHT.ground, DAY.ground, k)
    hemi.intensity = 0.9 + 0.6 * k
    moonLight.color.lerpColors(NIGHT.light, DAY.light, k)
    moonLight.intensity = (1.1 + 1.3 * k) * (1 - 0.5 * wx.cloud)
    // by day the light comes from the sun (never quite on the horizon, or the shadows run off forever)
    if (k > 0.5) moonLight.position.set(sun.x, Math.max(sun.y, 0.25), sun.z).normalize().multiplyScalar(60)
    else moonLight.position.copy(moonAt)
    ;(stars.material as THREE.PointsMaterial).opacity = 0.9 * (1 - k) ** 2 * (1 - wx.cloud) ** 2
    moon.visible = moonGlow.visible = k < 0.6 && wx.cloud < 0.85
    auroraMat.uniforms.uFade.value = auroraFade()
  }
  /** The northern lights: only at night, brighter when the Kp index is up, hidden by clouds. */
  const auroraFade = () => (1 - lastK) ** 2 * auroraBoost * wx.aurora * (1 - wx.cloud) ** 2
  function aurora(boost: number) {
    if (boost === auroraBoost) return
    auroraBoost = boost
    auroraMat.uniforms.uFade.value = auroraFade()
  }
  /** Stockholm's weather (vader.ts). The first time it is as it is; after that it turns gradually. */
  function weather(w: Weather) {
    if (!want) Object.assign(wx, { snow: w.snow, rain: w.rain, cloud: w.cloud, fog: w.fog, aurora: w.aurora, wind: w.wind, windX: w.windX, windZ: w.windZ })
    want = w
    daylight(lastK, lastSun)
  }

  return {
    colliders,
    roofs,
    solids,
    daylight,
    aurora,
    weather,
    /** (`walking`: not up in the sleigh, where flight.ts has the haze) */
    update: (t: number, dt: number, player: THREE.Vector3, walking = true) => updaters.forEach((u) => u(t, dt, player, walking)),
    /** The far forest is only worth drawing from up in the air. */
    showFar: (on: boolean) => (far.group.visible = on),
    /** Moon shadows on/off (the economy graphics setting). */
    shadows: (on: boolean) => (moonLight.castShadow = on && !opts.lowPower),
  }
}
