// The village square: night sky, aurora, falling snow, the big julgran, a forest ring and lamp posts.
import * as THREE from 'three'
import { glowTexture, makeCanvas, rng, toTexture } from './tex'

export type Circle = { x: number; z: number; r: number }

export const VILLAGE_RADIUS = 34

/** Footprints (centre, rotation, half size, roof height) where snow shouldn't fall. */
export type Roof = { x: number; z: number; cos: number; sin: number; hw: number; hd: number; h: number }

/** Height of the snow at (x, z): flat in the village, rolling drifts outside it. */
export function groundHeight(x: number, z: number) {
  const k = THREE.MathUtils.smoothstep(Math.hypot(x, z), VILLAGE_RADIUS - 6, VILLAGE_RADIUS + 10)
  return k * ((Math.sin(x * 0.17) * Math.cos(z * 0.13) + Math.sin(x * 0.06 + z * 0.08)) * 0.7 + 0.6)
}

export function buildWorld(scene: THREE.Scene, opts: { lowPower: boolean }) {
  const roofs: Roof[] = []
  /** Things a snowball can hit. */
  const solids: THREE.Object3D[] = []
  const updaters: ((t: number, dt: number, player: THREE.Vector3) => void)[] = []
  const colliders: Circle[] = []
  const rand = rng(42)

  scene.background = new THREE.Color(0x070b1d)
  scene.fog = new THREE.FogExp2(0x1f2b5e, 0.021)

  /* ---------- sky ---------- */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vP; void main(){
        float h = clamp(vP.y, 0.0, 1.0);
        vec3 top = vec3(0.02, 0.03, 0.09);
        vec3 hor = vec3(0.122, 0.169, 0.369);
        gl_FragColor = vec4(mix(hor, top, pow(h, 0.45)), 1.0);
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
    uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying vec2 vUv;
      void main(){ vUv = uv; vec3 p = position;
        p.z += sin(p.x * 0.018 + uTime * 0.15) * 22.0 + sin(p.x * 0.05 - uTime * 0.3) * 6.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){
        float x = vUv.x; float y = vUv.y;
        float band = smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.3, 1.0, y));
        float rays = 0.55 + 0.45 * sin(x * 140.0 + sin(x * 9.0 + uTime * 0.4) * 5.0);
        float wave = 0.4 + 0.6 * (0.5 + 0.5 * sin(x * 10.0 - uTime * 0.25));
        float edge = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(0.88, 1.0, x));
        float a = band * rays * wave * edge;
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
  scene.add(new THREE.HemisphereLight(0x9fb2ff, 0x2a3260, 0.9))
  const moonLight = new THREE.DirectionalLight(0xbfd0ff, 1.1)
  moonLight.position.set(-30, 45, -40)
  moonLight.castShadow = !opts.lowPower
  moonLight.shadow.mapSize.set(2048, 2048)
  const sc = moonLight.shadow.camera
  sc.left = sc.bottom = -36
  sc.right = sc.top = 36
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
  plazaTex.repeat.set(8, 8)
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(23, 64), new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 1 }))
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
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.15, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false }))
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
  colliders.push({ x: 0, z: 0, r: 3.6 })
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
    firs.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.9 + rand() * 1.1 })
  }
  // and far out, for flying over in Tomtens släde (hidden in the fog while you walk, so only drawn when flying)
  const farFirs: typeof firs = []
  for (let i = 0; i < (opts.lowPower ? 260 : 520); i++) {
    const a = rand() * Math.PI * 2
    const r = 100 + rand() * 330
    farFirs.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1 + rand() * 1.6 })
  }
  // a few inside the village too, for depth
  for (const [x, z] of [[-24, 14], [24, 13], [-27, 3], [27, 2], [-12, 26], [12, 27], [-29, -9], [29, -10]]) firs.push({ x, z, s: 0.8 + rand() * 0.4 })
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
  for (const f of firs) if (Math.hypot(f.x, f.z) < VILLAGE_RADIUS + 2) colliders.push({ x: f.x, z: f.z, r: 1.2 * f.s })
  const inShadow = (f: (typeof firs)[number]) => Math.abs(f.x) < 42 && Math.abs(f.z) < 42
  const near = plant(firs.filter(inShadow), true)
  plant(firs.filter((f) => !inShadow(f)), false)
  const far = plant(farFirs, false)
  far.group.visible = false
  solids.push(...near.cones)

  /* ---------- lamp posts ---------- */
  const lampGlow = glowTexture('rgba(255,214,140,1)', 'rgba(255,170,70,0)')
  const iron = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.6 })
  const flame = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })
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
  for (const deg of [-50, 0, 50, -112, 112, -150, 150]) {
    const a = THREE.MathUtils.degToRad(deg)
    const r = deg === 0 || Math.abs(deg) === 50 ? 9.5 : 12
    addLamp(Math.sin(a) * r, -Math.cos(a) * r)
  }

  /* ---------- falling snow ---------- */
  const N = opts.lowPower ? 2500 : 5000
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
  updaters.push((t, dt, player) => {
    for (let i = 0; i < N; i++) {
      const j = i * 3
      flakes[j + 1] -= dt * (0.8 + (i % 7) * 0.08)
      flakes[j] += Math.sin(t * 0.6 + drift[i]) * dt * 0.3
      if (flakes[j + 1] < 0) flakes[j + 1] += BOX.y
      // flakes that reach a roof disappear (and come back from the sky)
      for (const r of roofs) {
        if (flakes[j + 1] > r.h) continue
        const dx = flakes[j] - r.x
        const dz = flakes[j + 2] - r.z
        if (Math.abs(dx * r.cos - dz * r.sin) < r.hw && Math.abs(dx * r.sin + dz * r.cos) < r.hd) flakes[j + 1] = -0.5
      }
      // keep the box centred on the player
      const dx = flakes[j] - player.x
      if (dx > BOX.x / 2) flakes[j] -= BOX.x
      else if (dx < -BOX.x / 2) flakes[j] += BOX.x
      const dz = flakes[j + 2] - player.z
      if (dz > BOX.z / 2) flakes[j + 2] -= BOX.z
      else if (dz < -BOX.z / 2) flakes[j + 2] += BOX.z
    }
    snowGeo.attributes.position.needsUpdate = true
    sky.position.copy(player)
    stars.position.copy(player)
    auroraMat.uniforms.uTime.value = t
  })

  return {
    colliders,
    roofs,
    solids,
    update: (t: number, dt: number, player: THREE.Vector3) => updaters.forEach((u) => u(t, dt, player)),
    /** The far forest is only worth drawing from up in the air. */
    showFar: (on: boolean) => (far.group.visible = on),
    /** Moon shadows on/off (the economy graphics setting). */
    shadows: (on: boolean) => (moonLight.castShadow = on && !opts.lowPower),
  }
}
