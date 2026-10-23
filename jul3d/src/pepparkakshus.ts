// The gingerbread house on the table in Tomtens bageri – "Santa's crackhouse" from the Julbak
// photo: a long house on a bigger base, a deep roof under thick powdered sugar, NO JUSTICE · NO
// JINGLE piped on the front beside two plank shutters, an iced sleigh in a frame – and a crack
// from a hole in the roof all the way down the front wall, through which you can see Tomten
// asleep on the floor, a bit green round the mouth.
import * as THREE from 'three'
import { makeCanvas, toTexture } from './tex'
import { Nisse } from './npc'

const DOUGH = '#9a5a2a'

function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** Baked dough: warm brown with a little grain, darker towards the edges – and powdered sugar on top. */
function dough(ctx: CanvasRenderingContext2D, w: number, h: number, sugar: number, seed: number) {
  const r = rng(seed)
  ctx.fillStyle = DOUGH
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < (w * h) / 60; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(60,25,8,0.10)' : 'rgba(200,130,70,0.10)'
    ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3)
  }
  const edge = ctx.createLinearGradient(0, 0, 0, h)
  edge.addColorStop(0, 'rgba(50,20,5,0.35)')
  edge.addColorStop(0.08, 'rgba(50,20,5,0)')
  edge.addColorStop(0.92, 'rgba(50,20,5,0)')
  edge.addColorStop(1, 'rgba(50,20,5,0.35)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < sugar * ((w * h) / 90); i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.55 + r() * 0.45})`
    ctx.beginPath()
    ctx.arc(r() * w, r() * h, 0.8 + r() * 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Piped icing: a fat line with a soft shadow. */
function pipe(ctx: CanvasRenderingContext2D, color: string, width: number, draw: () => void) {
  ctx.save()
  ctx.lineCap = ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(40,15,5,0.35)'
  ctx.lineWidth = width + 3
  ctx.translate(2, 3)
  ctx.beginPath()
  draw()
  ctx.stroke()
  ctx.translate(-2, -3)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  draw()
  ctx.stroke()
  ctx.restore()
}

function pipedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.font = `800 ${size}px "DM Sans", system-ui, sans-serif`
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.13
  ctx.strokeStyle = 'rgba(40,15,5,0.35)'
  ctx.strokeText(text, x + 2, y + 3)
  ctx.strokeStyle = color
  ctx.strokeText(text, x, y)
  // measured with the piping font (after restore() it would be the 10 px default – and the next word would sit on top)
  const w = ctx.measureText(text).width
  ctx.restore()
  return w
}

function shutter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#b07a45'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(70,35,12,0.55)'
  ctx.lineWidth = 2
  for (let k = 1; k < 7; k++) {
    ctx.beginPath()
    const yy = y + (k * h) / 7
    ctx.moveTo(x + 4, yy)
    ctx.bezierCurveTo(x + w * 0.3, yy + 3, x + w * 0.7, yy - 3, x + w - 4, yy)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(50,20,5,0.6)'
  ctx.lineWidth = 3
  ctx.strokeRect(x, y, w, h)
}

/* ---------- the crack: from the roof down through the front wall to the base ---------- */

// on the 1024 × 360 front-wall canvas: y 0 is the top of the wall. It runs between the two slogans.
const FRONT = { w: 1024, h: 360 }
const CRACK_LEFT: [number, number][] = [[575, 0], [558, 40], [584, 82], [546, 122], [562, 166], [520, 206], [536, 250], [490, 290], [506, 330], [474, 360]]
const CRACK_RIGHT: [number, number][] = [[690, 0], [662, 46], [678, 90], [640, 130], [652, 176], [608, 216], [622, 256], [580, 296], [592, 336], [560, 360]]

/** The front wall: NO JUSTICE top left, NO JINGLE bottom right, the shutters – and icing round the crack. */
function frontTexture() {
  const [c, ctx] = makeCanvas(FRONT.w, FRONT.h)
  dough(ctx, FRONT.w, FRONT.h, 0, 3)
  shutter(ctx, 230, 140, 230, 100)
  shutter(ctx, 700, 205, 230, 100)
  const s = 86
  let x = 34
  x += pipedText(ctx, 'NO', x, 150, s, '#fdfaf3')
  pipedText(ctx, 'JUSTICE', x + 18, 152, s, '#d1202a')
  x = 612
  x += pipedText(ctx, 'NO', x, 322, s, '#fdfaf3')
  pipedText(ctx, 'JINGLE', x + 18, 324, s, '#2fa33b')
  // broken edges: crumbs of dough and a lick of icing along the crack
  for (const edge of [CRACK_LEFT, CRACK_RIGHT]) {
    pipe(ctx, 'rgba(255,250,240,0.85)', 4, () => edge.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))))
  }
  return c
}

// the hole in the front roof, on its 1024 × 512 canvas: y 0 is the ridge, y 512 the eaves. It opens at the eaves, right above the crack.
const ROOF_HOLE: [number, number][] = [[560, 512], [548, 450], [575, 400], [560, 330], [600, 280], [640, 235], [668, 290], [700, 255], [722, 330], [706, 390], [734, 450], [712, 512]]

/** The front roof: powdered sugar and the iced sleigh in its frame (the hole is a real hole – see julbakHouse). */
function frontRoofTexture() {
  const [c, ctx] = makeCanvas(1024, 512)
  dough(ctx, 1024, 512, 1.4, 11)
  pipe(ctx, 'rgba(255,250,240,0.9)', 5, () => ROOF_HOLE.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))))
  // the frame and the sleigh, off to the right of the hole
  const ox = 760
  pipe(ctx, '#fdfaf3', 7, () => ctx.rect(ox, 150, 230, 200))
  pipe(ctx, '#fdfaf3', 7, () => {
    ctx.moveTo(ox + 30, 195)
    ctx.lineTo(ox + 55, 190)
    ctx.quadraticCurveTo(ox + 75, 240, ox + 110, 245)
    ctx.lineTo(ox + 135, 222)
    ctx.quadraticCurveTo(ox + 158, 218, ox + 153, 250)
    ctx.lineTo(ox + 140, 278)
    ctx.lineTo(ox + 55, 278)
    ctx.quadraticCurveTo(ox + 30, 250, ox + 30, 195)
    ctx.moveTo(ox + 42, 305)
    ctx.lineTo(ox + 170, 305)
    ctx.quadraticCurveTo(ox + 192, 303, ox + 188, 282)
    ctx.moveTo(ox + 72, 278)
    ctx.lineTo(ox + 72, 305)
    ctx.moveTo(ox + 132, 278)
    ctx.lineTo(ox + 132, 305)
  })
  return c
}

function plainTexture(sugar: number, seed: number, w = 512, h = 256) {
  const [c, ctx] = makeCanvas(w, h)
  dough(ctx, w, h, sugar, seed)
  return c
}

/** Red and white stripes for the candy cane inside. */
function stripes() {
  const [c, ctx] = makeCanvas(64, 256)
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = '#fdfaf3'
    ctx.fillRect(0, y, 64, 16)
    ctx.fillStyle = '#d1202a'
    ctx.fillRect(0, y + 16, 64, 16)
  }
  return c
}

/** "Z z z" drifting up out of the crack. */
function zzz() {
  const [c, ctx] = makeCanvas(256, 256)
  ctx.font = '700 64px "DM Sans", system-ui, sans-serif'
  ctx.fillStyle = '#fdfaf3'
  ctx.strokeStyle = 'rgba(20,30,70,0.6)'
  ctx.lineWidth = 6
  for (const [t, x, y, s] of [['Z', 40, 220, 1], ['z', 110, 150, 0.8], ['z', 170, 90, 0.6]] as const) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.strokeText(t, 0, 0)
    ctx.fillText(t, 0, 0)
    ctx.restore()
  }
  return c
}

/** A flat shape whose UVs map its own bounding box onto the texture (u along x, v along y). */
function shapeGeo(outline: [number, number][], u0: number, u1: number, v0: number, v1: number) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))))
  const pos = geo.attributes.position
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - u0) / (u1 - u0), (pos.getY(i) - v0) / (v1 - v0))
  uv.needsUpdate = true
  return geo
}

export function julbakHouse() {
  const g = new THREE.Group()
  // a little self-glow: the shop light barely reaches under the eaves, and the slogans must be readable
  const m = (c: HTMLCanvasElement, glow = 0.22, side: THREE.Side = THREE.FrontSide) => {
    const map = toTexture(c)
    return new THREE.MeshStandardMaterial({ map, roughness: 0.85, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: glow, side })
  }
  const sugared = m(plainTexture(1.2, 5))
  const plain = m(plainTexture(0, 7), 0.22, THREE.DoubleSide)
  const L = 0.82 // length of the house
  const Dp = 0.4 // depth
  const Hw = 0.3 // wall height
  const base = 0.025
  const pitch = 0.62 // roof angle
  const slab = 0.32 // each roof half, ridge to eaves
  const thick = 0.012
  const wall = 0.016

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    g.add(mesh)
    return mesh
  }

  // the base board, dusted with sugar
  add(new THREE.BoxGeometry(L + 0.26, base, Dp + 0.24), sugared, 0, base / 2, 0.03)
  // back and end walls (thin, so you can see in through the crack)
  add(new THREE.BoxGeometry(L, Hw, wall), plain, 0, base + Hw / 2, -Dp / 2 + wall / 2)
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(wall, Hw, Dp), plain, s * (L / 2 - wall / 2), base + Hw / 2, 0)

  // the front wall in two pieces either side of the crack, which runs all the way down to the base
  const wx = (px: number) => (px / FRONT.w) * L - L / 2
  const wy = (py: number) => (1 - py / FRONT.h) * Hw
  const leftPiece: [number, number][] = [[-L / 2, 0], ...[...CRACK_LEFT].reverse().map(([px, py]): [number, number] => [wx(px), wy(py)]), [-L / 2, Hw]]
  const rightPiece: [number, number][] = [...CRACK_RIGHT.map(([px, py]): [number, number] => [wx(px), wy(py)]), [L / 2, 0], [L / 2, Hw]]
  const front = m(frontTexture(), 0.5, THREE.DoubleSide)
  for (const piece of [leftPiece, rightPiece]) add(shapeGeo(piece, -L / 2, L / 2, 0, Hw), front, 0, base, Dp / 2)

  // the gable ends: triangles of dough
  const tri = new THREE.Shape([new THREE.Vector2(-Dp / 2, 0), new THREE.Vector2(Dp / 2, 0), new THREE.Vector2(0, Math.tan(pitch) * (Dp / 2))])
  for (const s of [-1, 1]) {
    const gable = add(new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false }), plain, s * (L / 2 - 0.01) - 0.01, base + Hw, 0)
    gable.rotation.y = Math.PI / 2
  }

  // the roof: two slabs meeting at the ridge, overhanging all round
  const ridgeY = base + Hw + Math.tan(pitch) * (Dp / 2)
  const Lr = L + 0.12
  // back half: a plain sugared slab
  const back = new THREE.Group()
  const bslab = new THREE.Mesh(new THREE.BoxGeometry(Lr, thick * 2, slab), [plain, plain, sugared, plain, plain, plain])
  bslab.castShadow = bslab.receiveShadow = true
  bslab.position.z = -slab / 2
  back.add(bslab)
  back.rotation.x = -pitch
  back.position.set(0, ridgeY, 0)
  g.add(back)
  // front half: a real hole above the crack. Built flat in x/y (y = how far down the slope), then laid along the roof.
  const rx = (px: number) => (px / 1024) * Lr - Lr / 2
  const rs = (py: number) => (py / 512) * slab
  const outline: [number, number][] = [[-Lr / 2, 0], [Lr / 2, 0], [Lr / 2, slab], ...[...ROOF_HOLE].reverse().map(([px, py]): [number, number] => [rx(px), rs(py)]), [-Lr / 2, slab]]
  const roofTop = shapeGeo(outline.map(([x, y]) => [x, -y]), -Lr / 2, Lr / 2, -slab, 0)
  roofTop.rotateX(-Math.PI / 2) // -y (down the slope) → +z, facing up
  const frontHalf = new THREE.Group()
  const topMesh = new THREE.Mesh(roofTop, m(frontRoofTexture(), 0.22, THREE.DoubleSide))
  topMesh.castShadow = topMesh.receiveShadow = true
  frontHalf.add(topMesh)
  frontHalf.rotation.x = pitch
  frontHalf.position.set(0, ridgeY, 0)
  g.add(frontHalf)
  // a cookie piece on the back of the roof, like the photo
  const piece = add(new THREE.BoxGeometry(0.2, 0.018, 0.09), plain, -0.12, ridgeY - 0.03, -0.1)
  piece.rotation.set(-pitch, 0.4, 0)

  // inside: Tomten fast asleep on the floor, a bit of green round his mouth, his candy cane beside him
  const crackX = wx(560)
  const santa = new Nisse({ coat: 0xc8102e, hat: 0xc8102e, pants: 0xc8102e, trim: true, longBeard: true, scale: 0.11 })
  santa.group.rotation.set(-Math.PI / 2, 0, 0.35) // on his back, face up, head towards the back wall
  santa.group.position.set(crackX + 0.02, base + 0.03, 0.09)
  santa.armR.rotation.z = 1.2 // one arm flung out
  g.add(santa.group)
  const green = new THREE.MeshStandardMaterial({ color: 0x5fbf3a, roughness: 0.3, emissive: 0x1f5a12, emissiveIntensity: 0.4 })
  const head = new THREE.Vector3(0, 1.0, 0.16).applyEuler(santa.group.rotation).multiplyScalar(0.11).add(santa.group.position)
  for (const [dx, dz, r] of [[0, 0, 0.012], [0.014, 0.008, 0.008], [-0.012, 0.01, 0.007], [0.004, 0.022, 0.006]]) {
    const blob = add(new THREE.SphereGeometry(r, 8, 6), green, head.x + dx, head.y + 0.012, head.z + dz)
    blob.scale.y = 0.5
  }
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0, 0), new THREE.Vector3(0.15, 0, -0.03), new THREE.Vector3(0.13, 0, -0.06)]
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 8), new THREE.MeshStandardMaterial({ map: toTexture(stripes()), roughness: 0.4 }), crackX - 0.17, base + 0.014, 0.06)
  const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(zzz()), transparent: true, depthWrite: false }))
  z.scale.setScalar(0.16)
  z.position.set(crackX + 0.06, ridgeY + 0.08, Dp / 2 + 0.05)
  g.add(z)
  return g
}
