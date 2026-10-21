// The gingerbread house on the table in Tomtens verkstad – the one in the Julbak photo: a long
// house on a bigger base, a deep roof under thick powdered sugar with a jagged hole (a candy cane
// peeking out of it, painted into the roof) and an iced sleigh in a frame, and "NO JUSTICE · NO JINGLE" piped on the front
// beside two plank shutters.
import * as THREE from 'three'
import { makeCanvas, toTexture } from './tex'

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
  ctx.restore()
  return ctx.measureText(text).width
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

/** The front wall: the two slogans and the shutters. */
function frontTexture() {
  // (the top ~15 % sits under the eaves, so the slogans start lower)
  const [c, ctx] = makeCanvas(1024, 360)
  dough(ctx, 1024, 360, 0, 3)
  shutter(ctx, 250, 140, 230, 100)
  shutter(ctx, 640, 215, 230, 100)
  const s = 86
  let x = 40
  x += pipedText(ctx, 'NO', x, 160, s, '#fdfaf3')
  pipedText(ctx, 'JUSTICE', x + 6, 162, s, '#d1202a')
  x = 520
  x += pipedText(ctx, 'NO', x, 330, s, '#fdfaf3')
  pipedText(ctx, 'JINGLE', x + 6, 332, s, '#2fa33b')
  return c
}

const HOLE: [number, number][] = [[230, 300], [255, 250], [280, 270], [310, 170], [340, 195], [390, 120], [430, 170], [470, 160], [455, 230], [490, 300], [430, 330], [380, 380], [330, 350], [280, 395], [255, 345]]

/** The front roof: powdered sugar, the jagged hole, and the iced sleigh in its frame. */
function frontRoofTexture() {
  const [c, ctx] = makeCanvas(1024, 512)
  dough(ctx, 1024, 512, 1.4, 11)
  // the hole – dark inside, a bit of the candy cane showing
  ctx.fillStyle = '#2a1408'
  ctx.beginPath()
  HOLE.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
  ctx.save()
  ctx.clip()
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = k % 2 ? '#fdfaf3' : '#d1202a'
    ctx.beginPath()
    ctx.ellipse(330 + k * 22, 300 - k * 14, 16, 26, -0.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  // the frame and the sleigh
  pipe(ctx, '#fdfaf3', 7, () => ctx.rect(640, 150, 300, 220))
  pipe(ctx, '#fdfaf3', 7, () => {
    ctx.moveTo(690, 200)
    ctx.lineTo(720, 195)
    ctx.quadraticCurveTo(745, 250, 790, 255)
    ctx.lineTo(820, 230)
    ctx.quadraticCurveTo(845, 225, 840, 260)
    ctx.lineTo(825, 290)
    ctx.lineTo(720, 290)
    ctx.quadraticCurveTo(690, 260, 690, 200)
    ctx.moveTo(705, 320)
    ctx.lineTo(860, 320)
    ctx.quadraticCurveTo(885, 318, 880, 295)
    ctx.moveTo(740, 290)
    ctx.lineTo(740, 320)
    ctx.moveTo(810, 290)
    ctx.lineTo(810, 320)
  })
  return c
}

function plainTexture(sugar: number, seed: number, w = 512, h = 256) {
  const [c, ctx] = makeCanvas(w, h)
  dough(ctx, w, h, sugar, seed)
  return c
}

export function julbakHouse() {
  const g = new THREE.Group()
  // a little self-glow: the shop light barely reaches under the eaves, and the slogans must be readable
  const m = (c: HTMLCanvasElement, glow = 0.22) => {
    const map = toTexture(c)
    return new THREE.MeshStandardMaterial({ map, roughness: 0.85, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: glow })
  }
  const sugared = m(plainTexture(1.2, 5))
  const plain = m(plainTexture(0, 7))
  const L = 0.82 // length of the house
  const Dp = 0.4 // depth
  const Hw = 0.3 // wall height
  const pitch = 0.62 // roof angle
  const slab = 0.32 // each roof half, eaves to ridge
  const thick = 0.024

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    g.add(mesh)
    return mesh
  }

  // the base board, dusted with sugar
  add(new THREE.BoxGeometry(L + 0.26, 0.025, Dp + 0.24), sugared, 0, 0.0125, 0.03)
  // the walls, with the slogans on the front
  add(new THREE.BoxGeometry(L, Hw, Dp), plain, 0, 0.025 + Hw / 2, 0)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(L, Hw), m(frontTexture(), 0.5))
  front.position.set(0, 0.025 + Hw / 2, Dp / 2 + 0.002)
  g.add(front)
  // the gable ends: triangles of dough
  const tri = new THREE.Shape([new THREE.Vector2(-Dp / 2, 0), new THREE.Vector2(Dp / 2, 0), new THREE.Vector2(0, Math.tan(pitch) * (Dp / 2))])
  for (const s of [-1, 1]) {
    const gable = add(new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false }), plain, s * (L / 2 - 0.01) - 0.01, 0.025 + Hw, 0)
    gable.rotation.y = Math.PI / 2
  }
  // the roof: two slabs meeting at the ridge, overhanging all round – sugar on top, the front one decorated
  const ridgeY = 0.025 + Hw + Math.tan(pitch) * (Dp / 2)
  for (const s of [-1, 1]) {
    const half = new THREE.Group()
    const decorated = s > 0
    const top = decorated ? m(frontRoofTexture()) : sugared
    const body = new THREE.Mesh(new THREE.BoxGeometry(L + 0.12, thick, slab), [plain, plain, top, plain, plain, plain])
    body.castShadow = body.receiveShadow = true
    body.position.z = s * (slab / 2)
    half.add(body)
    half.rotation.x = s * pitch
    half.position.set(0, ridgeY, 0)
    g.add(half)
  }
  // a cookie piece on the back of the roof, like the photo
  const piece = add(new THREE.BoxGeometry(0.2, 0.018, 0.09), plain, -0.12, ridgeY - 0.03, -0.1)
  piece.rotation.set(-pitch, 0.4, 0)
  return g
}
