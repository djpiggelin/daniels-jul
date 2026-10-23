// Leksaksfabriken: Tomtens big toy workshop, in the spirit of the old Christmas cartoons – a
// conveyor belt of toys, a nisse up a ladder painting a rocking horse, one hammering at the
// bench, tin soldiers marching, a train going round its track, shelves of bears and drums, a big
// workshop clock and the wish list unrolling down the wall and across the floor. And Lasse
// Långnisse, the grown-up raised by the nissar, twice the height of everyone else.
//
// It is the biggest house in the village – a tall timber hall with a clock tower on the ridge, big
// red doors standing open, lit windows and a smoking chimney – at the far end of the square,
// behind the tree (see buildLeksaksfabriken).
import * as THREE from 'three'
import { EVENTS } from './data'
import { keepApart } from './batch'
import { Nisse } from './npc'
import { Shop, sheet } from './shop'
import { drawBoard, glowTexture, makeCanvas, planksTexture, toTexture } from './tex'
import { html, type Talk } from './ui'
import type { BuiltShop } from './shops'


const JULAFTON = EVENTS.find((e) => e.santa) ?? EVENTS[EVENTS.length - 1]

// the hall: much bigger than the other houses, with a door in the front wall instead of an open front
const W = 16
const D = 10.5
const H = 5.2
const RIDGE = 4
const DOOR_W = 4.4
const DOOR_H = 3.8
const COLORS = { wall: '#2b5fa8', trim: 0xf6c453, roof: 0x7a1d1d, inner: '#d9b88a' }

/* ---------- shared materials (merged by batch.ts) ---------- */

const mats = new Map<string, THREE.MeshStandardMaterial>()
const mat = (color: number, roughness = 0.7, metalness = 0) => {
  const k = `${color}|${roughness}|${metalness}`
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness }))
  return mats.get(k)!
}
const C = { wood: 0x8a5a32, dark: 0x4a2c1c, red: 0xc8102e, green: 0x1d6e48, blue: 0x2b5fa8, gold: 0xd4a64a, white: 0xfbf8f2, black: 0x1a1a1f, skin: 0xf1c7a5, yellow: 0xf2c94c, brown: 0x7a4a24 }

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, n = 14) => new THREE.CylinderGeometry(rt, rb, h, n)
const ball = (r: number, n = 12) => new THREE.SphereGeometry(r, n, Math.max(6, n - 4))

/* ---------- little toys ---------- */

function present(color: number, ribbon: number, s = 0.16) {
  const g = new THREE.Group()
  add(g, box(s, s * 0.85, s), mat(color, 0.6), 0, (s * 0.85) / 2, 0)
  add(g, box(s + 0.004, s * 0.86, s * 0.18), mat(ribbon, 0.4), 0, (s * 0.85) / 2, 0)
  add(g, box(s * 0.18, s * 0.86, s + 0.004), mat(ribbon, 0.4), 0, (s * 0.85) / 2, 0)
  return g
}

function teddy(color = C.brown, s = 1) {
  const g = new THREE.Group()
  const fur = mat(color, 0.95)
  add(g, ball(0.07 * s), fur, 0, 0.07 * s, 0).scale.set(1, 1.15, 0.9)
  add(g, ball(0.05 * s), fur, 0, 0.18 * s, 0)
  for (const x of [-1, 1]) add(g, ball(0.018 * s, 8), fur, x * 0.035 * s, 0.225 * s, 0)
  add(g, ball(0.02 * s, 8), mat(0xe8c9a0, 0.9), 0, 0.17 * s, 0.04 * s)
  for (const x of [-1, 1]) add(g, ball(0.024 * s, 8), fur, x * 0.07 * s, 0.09 * s, 0.02 * s)
  return g
}

function drum(color = C.red) {
  const g = new THREE.Group()
  add(g, cyl(0.07, 0.07, 0.09, 16), mat(color, 0.5), 0, 0.045, 0)
  for (const y of [0.003, 0.087]) add(g, cyl(0.072, 0.072, 0.01, 16), mat(C.gold, 0.3, 0.7), 0, y, 0)
  add(g, cyl(0.066, 0.066, 0.002, 16), mat(C.white, 0.6), 0, 0.091, 0)
  return g
}

function doll(dress = C.blue) {
  const g = new THREE.Group()
  add(g, new THREE.ConeGeometry(0.05, 0.12, 12), mat(dress, 0.7), 0, 0.06, 0)
  add(g, ball(0.03), mat(C.skin, 0.6), 0, 0.15, 0)
  add(g, ball(0.032), mat(0xc98a2b, 0.9), 0, 0.165, -0.008).scale.set(1, 0.8, 1)
  return g
}

function soldier() {
  const g = new THREE.Group()
  const body = new THREE.Group()
  for (const x of [-1, 1]) add(body, box(0.025, 0.09, 0.03), mat(C.black, 0.5), x * 0.018, 0.045, 0)
  add(body, box(0.07, 0.08, 0.045), mat(C.red, 0.5), 0, 0.13, 0)
  add(body, box(0.072, 0.012, 0.047), mat(C.white, 0.5), 0, 0.12, 0)
  add(body, ball(0.024, 10), mat(C.skin, 0.6), 0, 0.2, 0)
  add(body, cyl(0.026, 0.026, 0.07, 10), mat(C.black, 0.4), 0, 0.25, 0)
  add(body, cyl(0.004, 0.004, 0.14, 6), mat(C.dark, 0.6), 0.045, 0.16, 0.01)
  g.add(body)
  g.userData.body = body
  return g
}

function rockingHorse() {
  const g = new THREE.Group()
  const wood = mat(0xf2e6d0, 0.6)
  const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 6, 24, 1.1), mat(C.red, 0.5))
  rocker.rotation.set(0, Math.PI / 2, -Math.PI / 2 - 0.55)
  for (const x of [-0.09, 0.09]) {
    const r = rocker.clone()
    r.position.set(x, 0.43, 0)
    g.add(r)
  }
  add(g, box(0.16, 0.14, 0.42), wood, 0, 0.36, 0)
  for (const [x, z] of [[-0.06, -0.15], [0.06, -0.15], [-0.06, 0.15], [0.06, 0.15]]) add(g, cyl(0.02, 0.02, 0.26, 8), wood, x, 0.2, z).rotation.x = z * 0.9
  const neck = add(g, box(0.1, 0.24, 0.1), wood, 0, 0.5, 0.2)
  neck.rotation.x = 0.4
  add(g, box(0.1, 0.1, 0.2), wood, 0, 0.62, 0.3)
  add(g, box(0.03, 0.2, 0.12), mat(C.dark, 0.9), 0, 0.55, 0.15).rotation.x = 0.4
  add(g, box(0.17, 0.03, 0.14), mat(C.red, 0.6), 0, 0.445, -0.02)
  return g
}

/* ---------- the room ---------- */

/** Where the foreman stands, behind his counter on the left as you come in. */
const SPOT = { x: -7.05, z: 1.4, yaw: Math.PI / 2 }

function counter(shop: Shop) {
  const g = new THREE.Group()
  add(g, box(0.8, 0.78, 2.6), mat(C.wood, 0.7), 0, 0.39, 0)
  add(g, box(0.95, 0.07, 2.75), mat(C.dark, 0.5), 0, 0.815, 0)
  add(g, box(0.04, 0.5, 2.2), mat(C.green, 0.6), 0.42, 0.42, 0)
  // a few finished toys waiting on the counter
  const t = teddy(C.brown)
  t.position.set(0, 0.85, -0.7)
  g.add(t)
  const p = present(C.red, C.gold, 0.18)
  p.position.set(0.05, 0.85, 0.6)
  g.add(p)
  g.position.set(SPOT.x + 0.85, 0, SPOT.z)
  shop.group.add(g)
  shop.block(SPOT.x + 0.85, SPOT.z, 0.5, 1.4)
}

/** The belt along the back wall, toys riding from hatch to hatch. */
function conveyor(shop: Shop) {
  const g = new THREE.Group()
  const len = 10
  const z = -D / 2 + 0.75
  add(g, box(len, 0.08, 0.6), mat(C.dark, 0.6), 0, 0.82, 0)
  for (const x of [-len / 2 + 0.2, -len / 6, len / 6, len / 2 - 0.2]) for (const dz of [-0.25, 0.25]) add(g, box(0.07, 0.8, 0.07), mat(C.dark, 0.6), x, 0.4, dz)
  // the belt itself: a striped texture that scrolls
  const [c, ctx] = makeCanvas(256, 32)
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = '#2b2b30'
    ctx.fillRect(x, 0, 16, 32)
    ctx.fillStyle = '#3a3a42'
    ctx.fillRect(x + 16, 0, 16, 32)
  }
  const tex = toTexture(c, { live: true })
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(len * 3, 1)
  const belt = keepApart(add(g, new THREE.PlaneGeometry(len, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), 0, 0.865, 0))
  belt.rotation.x = -Math.PI / 2
  // hatches at both ends, where toys come in and go out
  for (const s of [-1, 1]) {
    add(g, box(0.5, 0.55, 0.7), mat(C.red, 0.6), s * (len / 2 + 0.05), 1.1, 0)
    add(g, box(0.36, 0.3, 0.02), mat(0x120a06, 1), s * (len / 2 + 0.05) - s * 0.26, 1.02, 0).rotation.y = Math.PI / 2
  }
  g.position.set(0.3, 0, z)
  shop.group.add(g)
  shop.block(0.3, z, len / 2 + 0.35, 0.4)

  const makers = [() => present(C.red, C.gold), () => teddy(C.brown, 0.9), () => drum(C.blue), () => present(C.green, C.red, 0.14), () => doll(C.red), () => present(C.blue, C.white), () => teddy(0xc98a2b, 0.9), () => drum(C.red), () => doll(C.green), () => present(C.gold, C.red), () => teddy(0xf2e6d0, 0.9), () => drum(C.green)]
  const toys = makers.map((make) => {
    const t = keepApart(make())
    shop.group.add(t)
    return t
  })
  const inner = len - 0.4
  shop.updaters.push((t) => {
    tex.offset.x = -(t * 0.35 * 3) % 1
    toys.forEach((toy, i) => {
      const k = (t * 0.35 / inner + i / toys.length) % 1
      toy.position.set(0.3 - inner / 2 + k * inner, 0.87, z)
      toy.rotation.y = i
    })
  })
}

/** A nisse up a ladder, painting a rocking horse. */
function paintingCorner(shop: Shop) {
  const x = 5.6
  const z = -2.3
  const horse = keepApart(rockingHorse())
  horse.position.set(x, 0, z)
  horse.rotation.y = -0.6
  shop.group.add(horse)
  // the ladder
  const ladder = new THREE.Group()
  for (const s of [-1, 1]) add(ladder, box(0.04, 1.3, 0.04), mat(C.wood, 0.7), s * 0.18, 0.65, 0)
  for (let i = 0; i < 5; i++) add(ladder, box(0.36, 0.03, 0.03), mat(C.wood, 0.7), 0, 0.2 + i * 0.25, 0)
  ladder.position.set(x + 0.55, 0, z + 0.35)
  ladder.rotation.set(-0.12, -0.9, 0)
  shop.group.add(ladder)
  const painter = new Nisse({ coat: C.green, hat: C.red, beard: false, ears: true, scale: 0.62, apron: C.white })
  keepApart(painter.group)
  painter.group.position.set(x + 0.5, 0.45, z + 0.28)
  painter.setYaw(-2.2)
  const brush = new THREE.Group()
  add(brush, cyl(0.012, 0.012, 0.28, 6), mat(C.wood, 0.6), 0, -0.14, 0)
  add(brush, cyl(0.022, 0.016, 0.06, 8), mat(C.red, 0.5), 0, -0.3, 0)
  painter.armR.add(brush)
  brush.position.set(0, -0.5, 0.05)
  shop.group.add(painter.group)
  // a pot of red paint on a step
  add(shop.group, cyl(0.06, 0.05, 0.08, 12), mat(C.red, 0.3), x + 0.4, 0.08, z + 0.6)
  shop.block(x + 0.2, z + 0.2, 0.7, 0.6)
  shop.updaters.push((t) => {
    painter.armR.rotation.x = -1.2 + Math.sin(t * 3) * 0.35
    painter.armR.rotation.z = 0.3 + Math.sin(t * 1.5) * 0.15
    horse.rotation.z = Math.sin(t * 1.2) * 0.04
  })
}

/** A nisse at the bench, hammering away at a wooden train. */
function workbench(shop: Shop, x: number, z: number, coat: number, hat: number, beat = 0) {
  const g = new THREE.Group()
  add(g, box(1.4, 0.06, 0.7), mat(C.wood, 0.7), 0, 0.72, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.07, 0.72, 0.07), mat(C.dark, 0.7), sx * 0.6, 0.36, sz * 0.28)
  // wooden bits and a half-built engine
  add(g, box(0.24, 0.12, 0.12), mat(C.red, 0.6), -0.2, 0.81, 0)
  add(g, cyl(0.045, 0.045, 0.14, 12), mat(C.blue, 0.5), -0.06, 0.83, 0).rotation.z = Math.PI / 2
  for (const wx of [-0.28, -0.12]) add(g, cyl(0.035, 0.035, 0.03, 12), mat(C.black, 0.5), wx, 0.77, 0.07).rotation.x = Math.PI / 2
  for (let i = 0; i < 6; i++) add(g, box(0.12, 0.025, 0.04), mat(0xc98a5a, 0.8), 0.3 + (i % 3) * 0.13, 0.765 + Math.floor(i / 3) * 0.026, -0.1)
  g.position.set(x, 0, z)
  shop.group.add(g)
  shop.block(x, z, 0.75, 0.4)
  const maker = new Nisse({ coat, hat, beard: false, ears: true, scale: 0.7, apron: 0x8a6a4a })
  keepApart(maker.group)
  maker.group.position.set(x, 0, z - 0.6)
  maker.setYaw(0)
  const hammer = new THREE.Group()
  add(hammer, cyl(0.012, 0.012, 0.26, 6), mat(C.wood, 0.6), 0, -0.13, 0)
  add(hammer, box(0.1, 0.05, 0.05), mat(0x8a8f98, 0.4, 0.7), 0, -0.27, 0)
  maker.armR.add(hammer)
  hammer.position.set(0, -0.5, 0.05)
  shop.group.add(maker.group)
  shop.updaters.push((t) => {
    // up slowly, down hard
    const k = (t * 1.6 + beat) % 1
    maker.armR.rotation.x = -1.6 + (k < 0.75 ? (k / 0.75) * 1.0 : 1.0 - ((k - 0.75) / 0.25) * 1.0)
  })
}

/** A train going round its track on the floor. */
function train(shop: Shop) {
  const cx = 3.4
  const cz = 1.3
  const R = 1.25
  const track = new THREE.Mesh(new THREE.TorusGeometry(R, 0.025, 6, 64), mat(0x8a8f98, 0.4, 0.6))
  track.rotation.x = -Math.PI / 2
  track.position.set(cx, 0.03, cz)
  shop.group.add(track)
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2
    const s = add(shop.group, box(0.05, 0.015, 0.16), mat(C.dark, 0.8), cx + Math.cos(a) * R, 0.012, cz + Math.sin(a) * R)
    s.rotation.y = -a
  }
  const cars = [C.red, C.blue, C.green, C.yellow].map((col, i) => {
    const g = keepApart(new THREE.Group())
    add(g, box(0.12, 0.08, 0.2), mat(col, 0.5), 0, 0.09, 0)
    if (i === 0) {
      add(g, cyl(0.04, 0.04, 0.14, 12), mat(C.black, 0.5), 0, 0.12, 0.04).rotation.x = Math.PI / 2
      add(g, cyl(0.018, 0.024, 0.08, 10), mat(C.black, 0.5), 0, 0.2, 0.08)
      add(g, box(0.12, 0.1, 0.07), mat(C.red, 0.5), 0, 0.16, -0.07)
    } else add(g, box(0.1, 0.04, 0.16), mat(C.gold, 0.5), 0, 0.15, 0)
    for (const wz of [-0.06, 0.06]) for (const wx of [-0.065, 0.065]) add(g, cyl(0.025, 0.025, 0.015, 10), mat(C.black, 0.5), wx, 0.04, wz).rotation.z = Math.PI / 2
    shop.group.add(g)
    return g
  })
  shop.updaters.push((t) => {
    cars.forEach((car, i) => {
      const a = t * 0.5 - i * 0.19
      car.position.set(cx + Math.cos(a) * R, 0.02, cz + Math.sin(a) * R)
      car.rotation.y = -a
    })
  })
}

/** Tin soldiers marching up and down in front of the shelves. */
function soldiers(shop: Shop) {
  const troop = Array.from({ length: 7 }, () => {
    const s = keepApart(soldier())
    shop.group.add(s)
    return s
  })
  shop.updaters.push((t) => {
    const p = Math.sin(t * 0.35) // -1 … 1 along the march
    const dir = Math.cos(t * 0.35) >= 0 ? 1 : -1
    troop.forEach((s, i) => {
      s.position.set(-3.6 + p * 1.7 - dir * i * 0.17, 0, 3.7)
      s.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2
      const body = s.userData.body as THREE.Group
      body.position.y = Math.abs(Math.sin(t * 6 + i)) * 0.02
      body.rotation.z = Math.sin(t * 6 + i) * 0.06
    })
  })
}

/** Shelves full of finished toys along the left wall. */
function shelves(shop: Shop) {
  const g = new THREE.Group()
  const w = 2.6
  for (const sx of [-1, 1]) add(g, box(0.05, 2.0, 0.4), mat(C.dark, 0.7), sx * (w / 2), 1.0, 0.2)
  for (const y of [0.35, 0.95, 1.55]) add(g, box(w, 0.04, 0.4), mat(C.wood, 0.7), 0, y, 0.2)
  const rows: (() => THREE.Object3D)[][] = [
    [() => teddy(), () => teddy(0xc98a2b), () => present(C.red, C.gold), () => teddy(0xf2e6d0), () => present(C.green, C.red)],
    [() => doll(C.blue), () => drum(C.red), () => doll(C.red), () => drum(C.green), () => doll(C.green), () => drum(C.blue)],
    [() => present(C.blue, C.white, 0.2), () => teddy(C.brown, 1.2), () => present(C.gold, C.red, 0.2), () => present(C.red, C.green, 0.18)],
  ]
  rows.forEach((row, ri) => {
    const y = [0.37, 0.97, 1.57][ri]
    row.forEach((make, i) => {
      const toy = make()
      toy.position.set(-w / 2 + 0.25 + (i * (w - 0.5)) / (row.length - 1), y, 0.2)
      toy.rotation.y = (i % 2 ? 0.3 : -0.2)
      g.add(toy)
    })
  })
  shop.hang(g, 'left', 2.4, 0)
  shop.block(-W / 2 + 0.4, -2.4, 0.35, 1.4)
  const g2 = g.clone()
  g2.rotation.y = 0
  shop.hang(g2, 'left', -3.6, 0)
  shop.block(-W / 2 + 0.4, 3.6, 0.35, 1.4)
}

/** The big workshop clock above the belt, its hands going round. */
function clock(shop: Shop) {
  const g = clockFace(0.38, shop.updaters)
  g.scale.setScalar(1.7)
  shop.hang(g, 'back', 0, 3.6)
}

/** The wish list, unrolling from high on the right wall down onto the floor. */
function wishList(shop: Shop) {
  const items = ['En röd cykel', 'Skridskor', 'En valp (helst två)', 'Legobitar – alla', 'Ett pepparkakshus utan spricka', 'Snö till julafton', 'Pyjamas med fötter', 'En trumma (förlåt, grannar)', 'En docka med riktigt hår', 'Ett tåg som tutar', 'Godis. Mycket godis.', 'Att Lasse slutar växa']
  const list = drawBoard({ style: 'parchment', title: 'Önskelistan', subtitle: 'Kontrollerad två gånger', items, marker: 'check', w: 512, h: 1400, seed: 21 })
  const top = sheet(list, 0.7)
  shop.hang(top, 'right', -0.4, 1.9)
  // the end of it, rolled out across the floor
  const [c, ctx] = makeCanvas(256, 512)
  ctx.fillStyle = '#f3e6c4'
  ctx.fillRect(0, 0, 256, 512)
  ctx.strokeStyle = 'rgba(60,35,15,0.35)'
  ctx.lineWidth = 3
  for (let y = 30; y < 512; y += 34) {
    ctx.beginPath()
    ctx.moveTo(30, y)
    ctx.lineTo(60 + ((y * 37) % 150), y)
    ctx.stroke()
  }
  const floor = add(shop.group, new THREE.PlaneGeometry(0.7, 1.5), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.9 }), W / 2 - 0.75, 0.012, 0.55)
  floor.rotation.set(-Math.PI / 2, 0, 0.25)
  floor.castShadow = false
  const roll = add(shop.group, cyl(0.06, 0.06, 0.72, 14), mat(0xf3e6c4, 0.9), W / 2 - 1.0, 0.06, 1.25)
  roll.rotation.set(0, 0.25, Math.PI / 2)
  shop.exhibit(top, { title: 'Önskelistan', caption: 'Kontrollerad två gånger – och den tar aldrig slut.', image: () => list.toDataURL('image/jpeg', 0.9) })
}

/* ---------- the two you can talk to ---------- */

function foreman(): { npc: Nisse; talk: Talk } {
  const npc = new Nisse({ coat: C.red, hat: C.green, apron: 0x8a6a4a, trim: true })
  const talk: Talk = {
    name: 'Verkmästarnissen',
    avatar: '🧸',
    avatarBg: '#1d6e48',
    greeting: () => [html.p('Välkommen till Leksaksfabriken! Här blir varenda julklapp till – från första spik till sista rosett.') + html.p('Se dig omkring, men akta tåget. Det har förtur.')],
    topics: [
      {
        label: '🧸 Vad tillverkar ni här?',
        pages: () => [html.p('Nallar, dockor, trummor, tåg, gunghästar och tennsoldater. Bandet där bak går dygnet runt från oktober.') + html.p('Allt kontrolleras två gånger innan det slås in – det är tradition.')],
      },
      {
        label: '📜 Vad står på önskelistan?',
        pages: () => [html.p('Den hänger på väggen där borta – och fortsätter ut över golvet. Den blir längre varje år.') + html.p('Någon har önskat sig ett pepparkakshus utan spricka. Vi gör vårt bästa.')],
      },
      {
        label: '🚂 Får jag köra tåget?',
        pages: () => [html.p('Tåget kör sig självt. Det har det gjort sedan 1932 och vi vågar inte röra det.')],
      },
      {
        label: '🙋 Vem är den där långa?',
        pages: () => [html.p('Det är Lasse. Han kom hit som liten och växte… och växte. Han är vår bästa leksakstestare.') + html.p('Säg hej till honom, han blir jätteglad. Han blir alltid jätteglad.')],
      },
    ],
    bye: 'Tack för besöket – och lämna tåget ifred!',
  }
  return { npc, talk }
}

function lasse(): { npc: Nisse; talk: Talk } {
  // a grown-up among nissar: twice their size – green tunic, red apron, white trousers, a red hat
  const npc = new Nisse({ coat: 0x2f8a3a, hat: C.red, pants: 0xfbf8f2, trim: true, beard: false, ears: true, scale: 1.75, apron: 0xc8102e })
  const talk: Talk = {
    name: 'Lasse Långnisse',
    avatar: '🤩',
    avatarBg: '#2f8a3a',
    greeting: () => [html.p('HEJ!! Är du ny här? Jag ÄLSKAR nya! Jag heter Lasse!') + html.p('Jag är leksakstestare. Det är världens bästa jobb. Kanske världens bästa allt.')],
    topics: [
      {
        label: '🙋 Vem är du?',
        pages: () => [
          html.p('Jag kom hit när jag var liten. Nissarna tog hand om mig, och sen växte jag lite. Och lite till.') +
            html.p('Alla säger att jag är lång för att vara nisse. Jag tror bara att dörrarna är för låga.'),
        ],
      },
      {
        label: '🔨 Vad gör en leksakstestare?',
        pages: () => [
          html.p('Jag testar ALLT! I morse testade jag 312 skallror. Alla skallrade. Fantastiskt.') +
            html.p('Igår satt jag fast i en gunghäst i två timmar. Den var också godkänd.'),
        ],
      },
      {
        label: '🍬 Vad äter du?',
        pages: () => [html.p('Frukost: pannkakor med polkagrisar. Lunch: knäck. Mellanmål: knäck. Middag: pannkakor med knäck.') + html.p('Grönsaker? Jo – det finns ju gröna kolor!')],
      },
      {
        label: '❄️ Gillar du snö?',
        pages: () => [html.p('SNÖ! Har du sett snön idag?! Den kommer från HIMLEN! Gratis!') + html.p('Jag har gjort 40 snöänglar sedan frukost. Två av dem var jag själv.')],
      },
    ],
    bye: 'Hejdå! Ha en riktigt glittrig dag!!',
  }
  return { npc, talk }
}

/* ---------- the outside ---------- */

/** A clock face with hands that go round; `speed` 1 is the workshop's own (very fast) time. */
function clockFace(r: number, updaters: Shop['updaters'], speed = 1) {
  const [c, ctx] = makeCanvas(256, 256)
  ctx.fillStyle = '#fbf3e4'
  ctx.beginPath()
  ctx.arc(128, 128, 120, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#7a4c2a'
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.fillStyle = '#3a2410'
  ctx.font = '700 30px Fraunces, Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    ctx.fillText(String(i), 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92)
  }
  const g = new THREE.Group()
  add(g, cyl(r * 1.1, r * 1.1, 0.06, 32), mat(C.gold, 0.35, 0.7), 0, 0, -0.03).rotation.x = Math.PI / 2
  const face = add(g, new THREE.CircleGeometry(r, 32), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.6, emissive: 0xffe2b0, emissiveIntensity: 0.25 }), 0, 0, 0.005)
  face.castShadow = false
  const hand = (len: number, w: number) => {
    const h = keepApart(new THREE.Group())
    add(h, box(w, len, 0.01), mat(C.black, 0.4), 0, len / 2, 0)
    h.position.z = 0.015
    g.add(h)
    return h
  }
  const hour = hand(r * 0.52, r * 0.08)
  const minute = hand(r * 0.78, r * 0.05)
  updaters.push((t) => {
    minute.rotation.z = -t * 0.6 * speed
    hour.rotation.z = -t * 0.05 * speed
  })
  return g
}

/** A lit window: warm glass, white frame, a cross of glazing bars and snow on the sill. */
function windowPane(w: number, h: number) {
  const g = new THREE.Group()
  add(g, new THREE.PlaneGeometry(w, h), litGlass, 0, 0, 0.02).castShadow = false
  const frame = mat(C.white, 0.6)
  for (const y of [-1, 1]) add(g, box(w + 0.16, 0.1, 0.08), frame, 0, (y * h) / 2, 0.04)
  for (const x of [-1, 1]) add(g, box(0.1, h + 0.1, 0.08), frame, (x * w) / 2, 0, 0.04)
  add(g, box(w, 0.05, 0.05), frame, 0, 0.08 * h, 0.04)
  add(g, box(0.05, h, 0.05), frame, 0, 0, 0.04)
  add(g, box(w + 0.3, 0.08, 0.22), mat(0xf4f8ff, 0.9), 0, -h / 2 - 0.06, 0.1)
  return g
}
const litGlass = new THREE.MeshStandardMaterial({ color: 0x3a2410, emissive: 0xffb35a, emissiveIntensity: 1.1, roughness: 0.3 })

/** Red and white stripes for the candy-cane pillars by the door. */
function stripes() {
  const [c, ctx] = makeCanvas(64, 256)
  ctx.fillStyle = '#fbf8f2'
  ctx.fillRect(0, 0, 64, 256)
  ctx.fillStyle = '#c8102e'
  for (let y = -64; y < 256; y += 48) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(64, y + 32)
    ctx.lineTo(64, y + 52)
    ctx.lineTo(0, y + 20)
    ctx.fill()
  }
  const tex = toTexture(c)
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 3)
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })
}

/** What makes it a workshop and not a shop: the front wall with its big doors, the windows, the
 *  clock tower and the chimney. */
function hall(shop: Shop) {
  const g = shop.group
  const front = D / 2
  const planks = (base: string, w: number, h: number) => {
    const t = planksTexture(base, { boards: 7, seed: base.length * 13 })
    t.repeat.set(w / 1.6, h / 1.6)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })
  }
  const trim = mat(COLORS.trim, 0.6)
  const wallBox = (w: number, h: number, x: number, y: number) => {
    const o = planks(COLORS.wall, w, h)
    // box faces: +x, -x, +y, -y, +z (outside), -z (inside)
    const m = new THREE.Mesh(box(w, h, 0.25), [o, o, trim, trim, o, planks(COLORS.inner, w, h)])
    m.position.set(x, y, front)
    m.castShadow = m.receiveShadow = true
    g.add(m)
  }

  // the front wall either side of the door, and above it
  const side = (W - DOOR_W) / 2
  for (const sx of [-1, 1]) {
    wallBox(side, H, sx * (DOOR_W / 2 + side / 2), H / 2)
    shop.block(sx * (DOOR_W / 2 + side / 2), front, side / 2 + 0.1, 0.25)
  }
  wallBox(DOOR_W, H - DOOR_H, 0, DOOR_H + (H - DOOR_H) / 2)

  // the door frame, and the two big red doors standing wide open
  for (const sx of [-1, 1]) add(g, box(0.26, DOOR_H + 0.13, 0.4), trim, sx * (DOOR_W / 2 + 0.06), (DOOR_H + 0.13) / 2, front)
  add(g, box(DOOR_W + 0.4, 0.26, 0.4), trim, 0, DOOR_H + 0.06, front)
  const open = 1.3
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group()
    hinge.position.set(sx * (DOOR_W / 2 - 0.05), 0, front + 0.2)
    hinge.rotation.y = sx * open
    const leaf = new THREE.Group()
    leaf.position.x = (-sx * DOOR_W) / 4
    add(leaf, box(DOOR_W / 2 - 0.05, DOOR_H - 0.05, 0.12), mat(0xa0132a, 0.6), 0, DOOR_H / 2, 0)
    // gold bands and studs, a little window up top and a big ring to pull
    for (const y of [0.6, DOOR_H - 0.7]) {
      add(leaf, box(DOOR_W / 2 - 0.05, 0.12, 0.16), mat(C.gold, 0.35, 0.7), 0, y, 0)
      for (let i = 0; i < 4; i++) add(leaf, ball(0.035, 8), mat(C.gold, 0.35, 0.7), -DOOR_W / 4 + 0.3 + i * ((DOOR_W / 2 - 0.6) / 3), y, 0.09)
    }
    for (const face of [1, -1]) {
      const pane = windowPane(0.7, 0.55)
      pane.position.set(0, DOOR_H - 1.35, face * 0.07)
      pane.rotation.y = face > 0 ? 0 : Math.PI
      leaf.add(pane)
    }
    add(leaf, new THREE.TorusGeometry(0.1, 0.02, 6, 16), mat(C.gold, 0.3, 0.8), sx * (DOOR_W / 4 - 0.3), 1.5, 0.1)
    hinge.add(leaf)
    g.add(hinge)
    // the open doors are in the way
    shop.block(sx * (DOOR_W / 2 - (DOOR_W / 4) * Math.cos(open)), front + 0.2 + (DOOR_W / 4) * Math.sin(open), 0.25, 1.05)
  }
  // a step of packed snow in, and a wreath over the door
  add(g, box(DOOR_W + 0.8, 0.05, 1.1), mat(0xe8eef8, 0.95), 0, 0.025, front + 0.6).castShadow = false
  add(g, new THREE.TorusGeometry(0.42, 0.14, 10, 28), mat(0x1d5e3a, 0.8), 0, DOOR_H + 0.75, front + 0.2)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    add(g, ball(0.05, 8), mat(C.red, 0.4), Math.cos(a) * 0.42, DOOR_H + 0.75 + Math.sin(a) * 0.42, front + 0.34)
  }
  add(g, box(0.34, 0.16, 0.08), mat(C.red, 0.5), 0, DOOR_H + 0.38, front + 0.34)

  // candy-cane pillars with a lantern each, either side of the door
  const cane = stripes()
  const lamp = new THREE.MeshStandardMaterial({ color: 0x3a2410, emissive: 0xffc070, emissiveIntensity: 1.6 })
  for (const sx of [-1, 1]) {
    const x = sx * (DOOR_W / 2 + 0.75)
    add(g, cyl(0.17, 0.17, DOOR_H + 0.2, 16), cane, x, (DOOR_H + 0.2) / 2, front + 0.35)
    add(g, box(0.3, 0.42, 0.3), mat(C.black, 0.5, 0.4), x, DOOR_H + 0.42, front + 0.35)
    add(g, box(0.22, 0.32, 0.31), lamp, x, DOOR_H + 0.42, front + 0.35).castShadow = false
    add(g, new THREE.ConeGeometry(0.24, 0.22, 4), mat(C.black, 0.5, 0.4), x, DOOR_H + 0.74, front + 0.35).rotation.y = Math.PI / 4
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,140,0.8)', 'rgba(255,170,80,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.position.set(x, DOOR_H + 0.42, front + 0.5)
    glow.scale.setScalar(1.3)
    g.add(glow)
    shop.block(x, front + 0.35, 0.2, 0.2)
  }

  // windows: two either side of the door and three down each side
  for (const sx of [-1, 1]) {
    for (const x of [DOOR_W / 2 + 1.6, W / 2 - 1.5]) {
      const w = windowPane(1.3, 1.5)
      w.position.set(sx * x, 2.5, front + 0.13)
      g.add(w)
    }
    for (const z of [-3, 0, 3]) {
      const w = windowPane(1.4, 1.6)
      w.position.set(sx * (W / 2 + 0.11), 2.6, z)
      w.rotation.y = (sx * Math.PI) / 2
      g.add(w)
    }
  }

  // presents piled up outside, waiting for the sleigh: [side, offset, size, colour, ribbon]
  const piles: [number, number, number, number, number][] = [
    [-1, 0, 0.55, C.red, C.gold], [-1, 0.6, 0.4, C.green, C.white], [-1, 0.1, 0.3, C.blue, C.red],
    [1, 0, 0.5, C.gold, C.red], [1, -0.55, 0.36, C.white, C.green], [1, -0.05, 0.28, C.red, C.white],
  ]
  for (const [sx, dx, size, col, rib] of piles) {
    const p = present(col, rib, size)
    const stacked = size < 0.34
    p.position.set(sx * (DOOR_W / 2 + 2.1) + dx, stacked ? 0.47 : 0, front + 0.9)
    p.rotation.y = dx * 1.7 + sx
    g.add(p)
  }
  for (const sx of [-1, 1]) shop.block(sx * (DOOR_W / 2 + 2.1), front + 0.9, 0.75, 0.4)

  // the clock tower on the ridge, over the door
  const tower = new THREE.Group()
  tower.position.set(0, H + RIDGE, front - 1.6)
  add(tower, box(2.2, 3.0, 2.2), planks(COLORS.wall, 2.2, 3), 0, 0.6, 0)
  add(tower, box(2.4, 0.16, 2.4), trim, 0, 2.1, 0)
  for (const [x, z, ry] of [[0, 1.11, 0], [1.11, 0, Math.PI / 2], [-1.11, 0, -Math.PI / 2]] as const) {
    const f = clockFace(0.72, shop.updaters, 0.4)
    f.position.set(x, 0.85, z)
    f.rotation.y = ry
    tower.add(f)
  }
  add(tower, new THREE.ConeGeometry(1.85, 2.4, 4), mat(COLORS.roof, 0.8), 0, 3.38, 0).rotation.y = Math.PI / 4
  add(tower, new THREE.ConeGeometry(0.95, 1.0, 4), mat(0xf4f8ff, 0.9), 0, 4.1, 0).rotation.y = Math.PI / 4
  add(tower, cyl(0.03, 0.03, 0.7, 6), mat(C.gold, 0.3, 0.8), 0, 4.9, 0)
  const star = keepApart(add(tower, new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({ color: C.gold, emissive: 0xffc040, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 }), 0, 5.35, 0))
  g.add(tower)
  shop.updaters.push((t) => (star.rotation.y = t * 0.8))

  // the chimney, puffing away
  const cx = -W / 4
  const cz = -1.5
  const roofAt = H + RIDGE * (1 - Math.abs(cx) / (W / 2))
  add(g, box(0.9, 2.6, 0.9), mat(0x8a3a2a, 0.9), cx, roofAt + 0.6, cz)
  add(g, box(1.05, 0.16, 1.05), mat(0x5a2418, 0.9), cx, roofAt + 1.95, cz)
  add(g, box(1.0, 0.12, 1.0), mat(0xf4f8ff, 0.9), cx, roofAt + 2.08, cz)
  const smoke = glowTexture('rgba(235,235,240,0.55)', 'rgba(220,220,230,0)')
  const puffs = Array.from({ length: 6 }, () => {
    const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: smoke, depthWrite: false, transparent: true }))
    g.add(p)
    return p
  })
  shop.updaters.push((t) => {
    puffs.forEach((p, i) => {
      const k = (t * 0.25 + i / puffs.length) % 1
      p.position.set(cx + k * 1.2 + Math.sin(t + i) * 0.15, roofAt + 2.2 + k * 3.2, cz + k * 0.4)
      p.scale.setScalar(0.6 + k * 1.8)
      p.material.opacity = (1 - k) * 0.85
    })
  })
}

/** Inside: lamps hanging from the ceiling and paper bunting across the hall. */
function ceiling(shop: Shop) {
  const g = shop.group
  const bulb = new THREE.MeshBasicMaterial({ color: 0xffe0a0 })
  for (const x of [-4.5, 0, 4.5]) {
    add(g, cyl(0.012, 0.012, 1.2, 4), mat(C.black, 0.5), x, H - 0.6, -0.4)
    add(g, new THREE.ConeGeometry(0.38, 0.32, 16, 1, true), mat(C.green, 0.5), x, H - 1.3, -0.4).castShadow = false
    add(g, ball(0.12), bulb, x, H - 1.4, -0.4).castShadow = false
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,140,0.5)', 'rgba(255,170,80,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.position.set(x, H - 1.45, -0.4)
    glow.scale.setScalar(1.6)
    g.add(glow)
  }
  const flags = [C.red, C.green, C.gold, C.blue, C.white]
  for (const z of [-2.2, 2.0]) {
    const n = 22
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n
      const x = -W / 2 + 0.2 + k * (W - 0.4)
      const y = H - 0.35 - Math.sin(k * Math.PI) * 0.9
      const flag = add(g, new THREE.ConeGeometry(0.13, 0.3, 3), mat(flags[i % flags.length], 0.7), x, y - 0.15, z)
      flag.rotation.x = Math.PI
      flag.castShadow = false
    }
  }
}

/* ---------- the building ---------- */

export async function buildLeksaksfabriken(): Promise<BuiltShop> {
  const shop = new Shop('Leksaksfabriken', COLORS, { w: W, d: D, h: H, ridge: RIDGE })
  // at the far end of the square, behind the tree – between Tomtens destilleri and Julbordet,
  // its back against the edge of the forest
  shop.place(0, 28.6)
  hall(shop)
  ceiling(shop)
  counter(shop)
  conveyor(shop)
  paintingCorner(shop)
  workbench(shop, -3.0, -2.5, C.blue, C.green)
  workbench(shop, 0.9, -2.5, C.red, C.white, 0.5)
  train(shop)
  soldiers(shop)
  shelves(shop)
  clock(shop)
  wishList(shop)
  // finished presents piling up in the corner by the door
  const cols = [C.red, C.green, C.gold, C.blue, C.white]
  for (let i = 0; i < 14; i++) {
    const p = present(cols[i % 5], cols[(i + 2) % 5], 0.22 + ((i * 7) % 5) * 0.05)
    const layer = i < 8 ? 0 : i < 12 ? 1 : 2
    const k = layer === 0 ? i : layer === 1 ? i - 8 : i - 12
    p.position.set(W / 2 - 0.5 - (k % 3) * 0.45 - layer * 0.2, layer * 0.3, D / 2 - 0.5 - Math.floor(k / 3) * 0.45 - layer * 0.2)
    p.rotation.y = i * 0.7
    shop.group.add(p)
  }
  shop.block(W / 2 - 0.9, D / 2 - 0.9, 0.75, 0.75)
  // a warm glow over the belt
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,140,0.6)', 'rgba(255,170,80,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.position.set(0.3, 2.6, -D / 2 + 0.8)
  glow.scale.set(8, 2, 1)
  shop.group.add(glow)

  const { npc, talk } = foreman()
  const l = lasse()
  // Lasse stands by the train, out of the way of the door
  const lx = 5.9
  const lz = 3.1
  shop.block(lx, lz, 0.35, 0.35)
  return { shop, event: JULAFTON, npc, talk, emoji: '🧸', spot: SPOT, extras: [{ ...l, x: lx, z: lz, yaw: -0.9 }] }
}
