// Leksaksfabriken: Tomtens big toy workshop, in the spirit of the old Christmas cartoons – a
// conveyor belt of toys, a nisse up a ladder painting a rocking horse, one hammering at the
// bench, tin soldiers marching, a train going round its track, shelves of bears and drums, a big
// workshop clock and the wish list unrolling down the wall and across the floor. And Lasse
// Långnisse, the grown-up raised by the nissar, twice the height of everyone else.
//
// It stands at the far end of the square, behind the tree (see buildLeksaksfabriken).
import * as THREE from 'three'
import { EVENTS } from './data'
import { keepApart } from './batch'
import { Nisse } from './npc'
import { Shop, sheet } from './shop'
import { drawBoard, glowTexture, makeCanvas, toTexture } from './tex'
import { html, type Talk } from './ui'
import type { BuiltShop } from './shops'


const JULAFTON = EVENTS.find((e) => e.santa) ?? EVENTS[EVENTS.length - 1]

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
  g.position.set(-3.5, 0, 1.2)
  shop.group.add(g)
  shop.block(-3.5, 1.2, 0.5, 1.4)
}

/** The belt along the back wall, toys riding from hatch to hatch. */
function conveyor(shop: Shop) {
  const g = new THREE.Group()
  const len = 6.4
  const z = -3.25
  add(g, box(len, 0.08, 0.6), mat(C.dark, 0.6), 0, 0.82, 0)
  for (const x of [-len / 2 + 0.2, -1, 1, len / 2 - 0.2]) for (const dz of [-0.25, 0.25]) add(g, box(0.07, 0.8, 0.07), mat(C.dark, 0.6), x, 0.4, dz)
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

  const makers = [() => present(C.red, C.gold), () => teddy(C.brown, 0.9), () => drum(C.blue), () => present(C.green, C.red, 0.14), () => doll(C.red), () => present(C.blue, C.white), () => teddy(0xc98a2b, 0.9), () => drum(C.red)]
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
  const x = 3.3
  const z = -1.5
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
function workbench(shop: Shop) {
  const x = -1.3
  const z = -1.7
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
  const maker = new Nisse({ coat: C.blue, hat: C.green, beard: false, ears: true, scale: 0.7, apron: 0x8a6a4a })
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
    const k = (t * 1.6) % 1
    maker.armR.rotation.x = -1.6 + (k < 0.75 ? (k / 0.75) * 1.0 : 1.0 - ((k - 0.75) / 0.25) * 1.0)
  })
}

/** A train going round its track on the floor. */
function train(shop: Shop) {
  const cx = 1.4
  const cz = 0.9
  const R = 0.85
  const track = new THREE.Mesh(new THREE.TorusGeometry(R, 0.025, 6, 48), mat(0x8a8f98, 0.4, 0.6))
  track.rotation.x = -Math.PI / 2
  track.position.set(cx, 0.03, cz)
  shop.group.add(track)
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const s = add(shop.group, box(0.05, 0.015, 0.16), mat(C.dark, 0.8), cx + Math.cos(a) * R, 0.012, cz + Math.sin(a) * R)
    s.rotation.y = -a
  }
  const cars = [C.red, C.blue, C.green].map((col, i) => {
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
      const a = t * 0.7 - i * 0.27
      car.position.set(cx + Math.cos(a) * R, 0.02, cz + Math.sin(a) * R)
      car.rotation.y = -a
    })
  })
}

/** Tin soldiers marching up and down in front of the shelves. */
function soldiers(shop: Shop) {
  const troop = Array.from({ length: 5 }, () => {
    const s = keepApart(soldier())
    shop.group.add(s)
    return s
  })
  shop.updaters.push((t) => {
    const p = Math.sin(t * 0.35) // -1 … 1 along the march
    const dir = Math.cos(t * 0.35) >= 0 ? 1 : -1
    troop.forEach((s, i) => {
      s.position.set(-1.4 + p * 1.3 - dir * i * 0.17, 0, 2.7)
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
  shop.hang(g, 'left', 2.0, 0)
  shop.block(-4.6, -2.0, 0.35, 1.4)
}

/** The big workshop clock above the belt, its hands going round. */
function clock(shop: Shop) {
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
  add(g, cyl(0.42, 0.42, 0.06, 32), mat(C.dark, 0.6), 0, 0, -0.03).rotation.x = Math.PI / 2
  const face = add(g, new THREE.CircleGeometry(0.38, 32), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.6 }), 0, 0, 0.005)
  face.castShadow = false
  const hand = (len: number, w: number) => {
    const h = keepApart(new THREE.Group())
    add(h, box(w, len, 0.01), mat(C.black, 0.4), 0, len / 2, 0)
    h.position.z = 0.015
    g.add(h)
    return h
  }
  const hour = hand(0.2, 0.03)
  const minute = hand(0.3, 0.018)
  shop.hang(g, 'back', 0.3, 2.75)
  shop.updaters.push((t) => {
    minute.rotation.z = -t * 0.6
    hour.rotation.z = -t * 0.05
  })
}

/** The wish list, unrolling from high on the right wall down onto the floor. */
function wishList(shop: Shop) {
  const items = ['En röd cykel', 'Skridskor', 'En valp (helst två)', 'Legobitar – alla', 'Ett pepparkakshus utan spricka', 'Snö till julafton', 'Pyjamas med fötter', 'En trumma (förlåt, grannar)', 'En docka med riktigt hår', 'Ett tåg som tutar', 'Godis. Mycket godis.', 'Att Lasse slutar växa']
  const list = drawBoard({ style: 'parchment', title: 'Önskelistan', subtitle: 'Kontrollerad två gånger', items, marker: 'check', w: 512, h: 1400, seed: 21 })
  const top = sheet(list, 0.7)
  shop.hang(top, 'right', 1.6, 1.75)
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
  const floor = add(shop.group, new THREE.PlaneGeometry(0.7, 1.5), new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.9 }), 4.2, 0.012, 2.45)
  floor.rotation.set(-Math.PI / 2, 0, 0.25)
  floor.castShadow = false
  const roll = add(shop.group, cyl(0.06, 0.06, 0.72, 14), mat(0xf3e6c4, 0.9), 3.95, 0.06, 3.15)
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

/* ---------- the building ---------- */

export async function buildLeksaksfabriken(): Promise<BuiltShop> {
  const shop = new Shop('Leksaksfabriken', { wall: '#2b5fa8', trim: 0xf6c453, roof: 0x7a1d1d, inner: '#d9b88a' })
  // at the far end of the square, behind the tree – between Tomtens destilleri and Julbordet
  shop.place(0, 29.5)
  counter(shop)
  conveyor(shop)
  paintingCorner(shop)
  workbench(shop)
  train(shop)
  soldiers(shop)
  shelves(shop)
  clock(shop)
  wishList(shop)
  // a warm glow over the belt
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,140,0.6)', 'rgba(255,170,80,0)'), blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.position.set(0.3, 2.3, -3.2)
  glow.scale.set(5, 1.6, 1)
  shop.group.add(glow)

  const { npc, talk } = foreman()
  const l = lasse()
  // Lasse stands by the train, a step from the counter – out of the way of the door
  shop.block(2.9, 1.9, 0.35, 0.35)
  return { shop, event: JULAFTON, npc, talk, emoji: '🧸', extras: [{ ...l, x: 2.9, z: 1.9, yaw: -0.9 }] }
}
