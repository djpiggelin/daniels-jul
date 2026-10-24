// Julafton in the village (hogtider.ts has the times):
// - at three, everyone sits down in front of the big screen on the square for Kalle Anka. (Not the real
//   film – the village's own little cartoon: our Kalle and Musse, built like the ones by the camper,
//   trimming a tree in a cosy room, filmed live into the screen.) Nissar fill the benches and laugh.
// - from five to eight, Tomten himself walks round the village with his sack, knocking on every door:
//   "Finns det några snälla barn här?" Talk to him, and there's a present with your name on it – one
//   each, every year. (His sleigh rests by Leksaksfabriken meanwhile; see julaftonsrunda.ts.)
// Both by the village clock, so everyone sees the same thing.
import * as THREE from 'three'
import { Nisse } from './npc'
import { Kalle, Musse } from './toons'
import { noise } from './sfx'
import { FONT, makeCanvas, toTexture } from './tex'
import { kalleAnka, screenUp, tomteVisit } from './hogtider'
import { html, type Talk } from './ui'
import type { Circle } from './world'

const std = (color: number, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness })
const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}

/** Where the big screen stands, facing the julgran. */
const SCREEN = { x: -13.5, z: -8.5 }
const SCREEN_YAW = Math.atan2(0 - SCREEN.x, 2 - SCREEN.z)

/* ---------- the cartoon: a little room, a tree, Kalle and Musse ---------- */
function cartoon() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x2a1a14)
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x40302a, 1.2))
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.4)
  sun.position.set(2, 4, 3)
  scene.add(sun)
  // the room: a wall with a window full of snow, a floor, a fire in the corner
  add(scene, new THREE.PlaneGeometry(8, 4), std(0x8a3a2a, 0.9), 0, 2, -1.5)
  add(scene, new THREE.PlaneGeometry(8, 4).rotateX(-Math.PI / 2), std(0x6a4426, 0.8), 0, 0, 0.5)
  const win = add(scene, new THREE.PlaneGeometry(1.2, 1.0), new THREE.MeshBasicMaterial({ color: 0x9ab8e8 }), 1.6, 1.9, -1.48)
  win.castShadow = false
  add(scene, new THREE.BoxGeometry(1.3, 0.06, 0.08), std(0xf2f2f2), 1.6, 1.4, -1.45)
  const fire = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff9a2a }))
  fire.position.set(-2.4, 0.3, -1.2)
  scene.add(fire)
  add(scene, new THREE.BoxGeometry(1.0, 1.2, 0.4), std(0x7a6a5a), -2.4, 0.6, -1.35)
  // the tree, and the star Kalle is trying to get on top of it
  const tree = new THREE.Group()
  tree.position.set(0.4, 0, -0.6)
  for (const [r, h, y] of [[0.7, 0.9, 0.6], [0.55, 0.8, 1.1], [0.38, 0.7, 1.55]]) add(tree, new THREE.ConeGeometry(r, h, 12), std(0x1d6e48, 0.8), 0, y, 0)
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: [0xff4d4d, 0xffd34d, 0x5db8ff][i % 3] }))
    const a = i * 2.3
    const y = 0.4 + (i / 12) * 1.3
    const r = 0.65 - (i / 12) * 0.45
    b.position.set(Math.cos(a) * r, y, Math.sin(a) * r)
    tree.add(b)
  }
  scene.add(tree)
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffe066 }))
  scene.add(star)
  const kalle = new Kalle()
  const musse = new Musse()
  scene.add(kalle.group, musse.group)
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 30)
  camera.position.set(0, 1.4, 4.6)
  camera.lookAt(0, 1.0, 0)
  const far = new THREE.Vector3(0, 1.4, 6)
  /** A short story, round and round: Kalle carries the star over, jumps for the top, misses, tries again,
   *  gets it on; Musse claps; they wave at us. */
  function play(t: number) {
    const k = t % 24
    let kx = -1.6
    let jump = 0
    let holding = true
    if (k < 5) kx = -1.6 + (k / 5) * 1.6
    else if (k < 8) {
      kx = 0
      jump = Math.max(0, Math.sin(((k - 5) / 1.5) * Math.PI)) * 0.45
    } else if (k < 10) {
      // (a tumble!)
      kx = -0.2 - (k - 8) * 0.2
      kalle.group.rotation.z = Math.sin((k - 8) * Math.PI) * 0.5
    } else if (k < 14) {
      kx = -0.6 + ((k - 10) / 4) * 0.6
      kalle.group.rotation.z = 0
      jump = k > 12.5 ? Math.max(0, Math.sin(((k - 12.5) / 1.5) * Math.PI)) * 0.7 : 0
      holding = k < 13.4
    } else {
      kx = 0.0 - Math.min(1, (k - 14) / 2) * 1.0
      holding = false
    }
    kalle.group.position.set(kx, jump, 0.3)
    kalle.group.rotation.y = k < 14 ? Math.PI / 2 - 0.3 : 0
    kalle.walkPose(t * 10, k < 5 || (k > 10 && k < 12.5) || (k > 14 && k < 16) ? 1 : 0)
    kalle.armR.rotation.x = holding ? -2.4 : k > 16 ? 0 : -0.3
    kalle.armR.rotation.z = k > 16 ? 2.2 + Math.sin(t * 9) * 0.4 : 0.25
    if (holding) {
      kalle.armR.updateMatrixWorld()
      star.position.copy(kalle.armR.localToWorld(new THREE.Vector3(0, -0.35, 0)))
    } else star.position.set(0.4, 2.05, -0.6)
    star.rotation.y = t * 2
    musse.group.position.set(1.5, 0, 0.5)
    musse.group.rotation.y = -0.5
    musse.walkPose(0, 0)
    const cheer = k > 13.5
    musse.armL.rotation.z = cheer ? -2.4 + Math.sin(t * 12) * 0.3 : -0.25
    musse.armR.rotation.z = cheer ? 2.4 - Math.sin(t * 12) * 0.3 : 0.25
    musse.update(t, 0, k > 16 ? camera.position : far)
    fire.scale.setScalar(1 + Math.sin(t * 13) * 0.08)
  }
  return { scene, camera, play }
}

/** The title cards: before it starts, at the start, and at the end. */
function card(lines: string[], sub = '') {
  const [c, ctx] = makeCanvas(640, 480)
  ctx.fillStyle = '#14100c'
  ctx.fillRect(0, 0, 640, 480)
  ctx.strokeStyle = '#d9c39a'
  ctx.lineWidth = 6
  ctx.strokeRect(30, 30, 580, 420)
  ctx.fillStyle = '#f2e6c8'
  ctx.textAlign = 'center'
  ctx.font = `italic 600 46px ${FONT.serif}`
  lines.forEach((l, i) => ctx.fillText(l, 320, 200 + i * 60 - (lines.length - 1) * 30))
  if (sub) {
    ctx.font = `400 28px ${FONT.sans}`
    ctx.fillText(sub, 320, 400)
  }
  return toTexture(c)
}

export type Julafton = ReturnType<typeof buildJulafton>

export function buildJulafton(scene: THREE.Scene, renderer: THREE.WebGLRenderer, doors: { x: number; z: number }[], ctx: { say: (text: string) => void; name: () => string }) {
  const group = new THREE.Group()
  scene.add(group)
  const colliders: Circle[] = []

  /* ---------- the big screen and the benches ---------- */
  const stand = new THREE.Group()
  stand.position.set(SCREEN.x, 0, SCREEN.z)
  stand.rotation.y = SCREEN_YAW
  group.add(stand)
  const black = std(0x15151a, 0.5)
  for (const s of [-1, 1]) add(stand, new THREE.BoxGeometry(0.18, 5.0, 0.18), black, s * 2.7, 2.5, -0.1)
  add(stand, new THREE.BoxGeometry(5.6, 3.4, 0.16), black, 0, 3.3, -0.12)
  const rt = new THREE.WebGLRenderTarget(400, 300)
  rt.texture.colorSpace = THREE.SRGBColorSpace
  const show = new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false })
  const picture = add(stand, new THREE.PlaneGeometry(5.2, 3.0), show, 0, 3.3, -0.03)
  picture.castShadow = false
  // a garland over it
  add(stand, new THREE.TorusGeometry(2.9, 0.09, 6, 30, Math.PI), std(0x1d6e48, 0.9), 0, 3.6, 0)
  for (const s of [-1, 1]) colliders.push({ x: SCREEN.x + Math.cos(SCREEN_YAW) * s * 2.7, z: SCREEN.z - Math.sin(SCREEN_YAW) * s * 2.7, r: 0.2 })
  const benches = new THREE.Group()
  stand.add(benches)
  stand.updateMatrixWorld(true)
  const viewers: Nisse[] = []
  const wood = std(0x7a5230)
  for (let row = 0; row < 3; row++) {
    const z = 4.5 + row * 1.6
    const w = 3.6 + row * 0.8
    add(benches, new THREE.BoxGeometry(w, 0.07, 0.42), wood, 0, 0.45, z)
    for (const s of [-1, 1]) add(benches, new THREE.BoxGeometry(0.07, 0.45, 0.4), black, (s * w) / 2.2, 0.22, z)
    const n = 3 + row
    for (let i = 0; i < n; i++) {
      const v = new Nisse({ coat: [0xc8102e, 0x1d6e48, 0x1f4f8a, 0x7a3fa0, 0xc98a2b][(row * 3 + i) % 5], hat: [0xc8102e, 0xf2f2f2, 0x1d6e48][(i + row) % 3], trim: true, beard: (i + row) % 2 === 0, ears: (i + row) % 2 === 1, scale: 0.95 })
      v.sit(true)
      v.group.position.set(-w / 2 + ((i + 0.5) / n) * w, 0.42, z + 0.05)
      v.group.rotation.y = Math.PI
      benches.add(v.group)
      viewers.push(v)
    }
    // (a bench is in the way, walking there)
    for (const dx of [-w / 3, 0, w / 3]) {
      const p = stand.localToWorld(new THREE.Vector3(dx, 0, z))
      colliders.push({ x: p.x, z: p.z, r: 0.45 })
    }
  }
  const film = cartoon()
  const cards = {
    soon: card(['Kalle Anka och', 'hans vänner', 'önskar God Jul'], 'Klockan 15.00'),
    title: card(['Kalle Anka och', 'hans vänner', 'önskar God Jul']),
    end: card(['God Jul', 'önskar', 'Kalle och Musse'], '– och alla i byn'),
  }
  const cardMat = new THREE.MeshBasicMaterial({ map: cards.soon, toneMapped: false })
  let filmAt = 0

  /* ---------- Tomten, door to door ---------- */
  const tomte = new Nisse({ coat: 0xc8102e, hat: 0xc8102e, pants: 0xc8102e, trim: true, longBeard: true, scale: 1.32 })
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), std(0xb08a5e, 0.95))
  sack.scale.set(1, 1.2, 0.85)
  sack.position.set(0.15, 0.95, -0.35)
  sack.castShadow = true
  tomte.body.add(sack)
  tomte.group.visible = false
  group.add(tomte.group)
  const tomteCircle = { x: 0, z: 0, r: -1 }
  colliders.push(tomteCircle)
  // his round: from the ring round the julgran out to each door and back, all the way round
  const RING = 9.5
  const legs: { from: THREE.Vector3; to: THREE.Vector3; knock: boolean }[] = []
  {
    const sorted = [...doors].sort((a, b) => Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z))
    const ring = (p: { x: number; z: number }) => {
      const r = Math.hypot(p.x, p.z)
      return new THREE.Vector3((p.x / r) * RING, 0, (p.z / r) * RING)
    }
    for (let i = 0; i < sorted.length; i++) {
      const d = sorted[i]
      const door = new THREE.Vector3(d.x, 0, d.z)
      const r0 = ring(d)
      legs.push({ from: r0, to: door, knock: true })
      legs.push({ from: door, to: r0, knock: false })
      // round the ring to the next door, in a few steps
      const next = ring(sorted[(i + 1) % sorted.length])
      const a0 = Math.atan2(r0.x, r0.z)
      let a1 = Math.atan2(next.x, next.z)
      if (a1 <= a0) a1 += Math.PI * 2
      const steps = Math.max(1, Math.round((a1 - a0) / 0.4))
      for (let k = 0; k < steps; k++) {
        const u0 = a0 + ((a1 - a0) * k) / steps
        const u1 = a0 + ((a1 - a0) * (k + 1)) / steps
        legs.push({ from: new THREE.Vector3(Math.sin(u0) * RING, 0, Math.cos(u0) * RING), to: new THREE.Vector3(Math.sin(u1) * RING, 0, Math.cos(u1) * RING), knock: false })
      }
    }
  }
  const SPEED = 1.1
  const KNOCK = 9
  const durations = legs.map((l) => l.from.distanceTo(l.to) / SPEED + (l.knock ? KNOCK : 0))
  const loop = durations.reduce((a, b) => a + b, 0)
  let knocked = -1
  let told = -1
  const giftKey = () => `tomtepaket-${new Date().getFullYear()}`
  const GIFTS = ['ett par tjocka raggsockor, stickade av Tomtemor', 'en bok med en riktig drake i', 'en burk hembakade pepparkakor', 'en liten trähäst, målad i rött', 'en kortlek med nissar på', 'en snöglob med byn inuti – titta, där är du!', 'en ask med marsipangrisar', 'ett pussel med tusen bitar, alla blå', 'en vante. Den andra kommer nästa år, ho ho!']
  const talk: Talk = {
    name: 'Tomten',
    avatar: '🎅',
    greeting: () => [html.p('Ho ho ho! God jul! Finns det några snälla barn här?')],
    topics: [
      {
        label: '🙋 Ja! Jag har varit jättesnäll i år',
        pages: () => {
          let got = false
          try {
            got = !!localStorage.getItem(giftKey())
          } catch {
            /* fine */
          }
          if (got) return [html.p('Ho ho! Du har redan fått ditt paket i år – jag minns alla, ska du veta. Jag har en hel säck kvar att dela ut, så nu måste jag vidare!')]
          try {
            localStorage.setItem(giftKey(), '1')
          } catch {
            /* fine */
          }
          const name = ctx.name()
          const gift = GIFTS[Math.floor(Math.random() * GIFTS.length)]
          return [html.p(`Tomten letar länge i säcken, och så räcker han dig ett paket med rött snöre. På etiketten står det: ${name ? `"Till ${name}"` : '"Till dig"'}.`) + html.p(`Du öppnar det. Det är ${gift}!`) + html.p('– Ho ho ho! God jul, och var snäll nästa år också!')]
        },
      },
      {
        label: '🦌 Var är renarna?',
        pages: () => [html.p('De vilar borta vid Leksaksfabriken. Här i byn går jag till fots – det har jag alltid gjort på julaftonskvällen. Man ska knacka på, det hör till.')],
      },
    ],
    bye: 'Ho ho ho! God jul!',
  }

  function update(t: number, dt: number, player: THREE.Vector3 | null, clock: number) {
    const me = player ?? new THREE.Vector3(1e4, 0, 1e4)
    /* the screen */
    const up = screenUp(clock)
    stand.visible = up
    for (const c of colliders) if (c !== tomteCircle) c.r = up ? Math.abs(c.r) : -Math.abs(c.r)
    if (up) {
      const d = new Date(clock)
      const min = d.getUTCHours() * 60 + d.getUTCMinutes()
      const on = kalleAnka(clock)
      const sec = (min - 15 * 60) * 60 + d.getUTCSeconds()
      // the cartoon itself, drawn into the screen (now and then, and only if you can see it)
      if (on && sec > 40 && sec < 3540) {
        picture.material = show
        if (Math.hypot(me.x - SCREEN.x, me.z - SCREEN.z) < 60 && t - filmAt > 1 / 20) {
          filmAt = t
          film.play(t)
          const was = renderer.getRenderTarget()
          renderer.setRenderTarget(rt)
          renderer.render(film.scene, film.camera)
          renderer.setRenderTarget(was)
        }
      } else {
        cardMat.map = !on && min < 15 * 60 ? cards.soon : on && sec <= 40 ? cards.title : cards.end
        picture.material = cardMat
      }
      // the audience: watching, and laughing now and then all together
      const laugh = on && Math.sin(t * 0.7) > 0.8
      for (const [i, v] of viewers.entries()) {
        v.body.position.y = laugh ? Math.abs(Math.sin(t * 14 + i)) * 0.05 : 0
        v.head.rotation.x = laugh ? -0.2 : 0
      }
    }

    /* Tomten */
    const visiting = tomteVisit(clock)
    tomte.group.visible = visiting
    tomteCircle.r = visiting ? 0.5 : -1
    if (!visiting) return
    const d = new Date(clock)
    let s = (((d.getUTCHours() - 17) * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() + d.getUTCMilliseconds() / 1000) % loop + loop) % loop
    let i = 0
    while (s > durations[i]) s -= durations[i++]
    const leg = legs[i]
    const walk = leg.from.distanceTo(leg.to) / SPEED
    const dir = leg.to.clone().sub(leg.from)
    if (s < walk) {
      tomte.group.position.lerpVectors(leg.from, leg.to, s / walk)
      tomte.group.rotation.y = Math.atan2(dir.x, dir.z)
      tomte.walkPose(t * 6, 0.8)
      tomte.armR.rotation.x = 0
    } else {
      // at the door: knock, knock, knock – and wait
      tomte.group.position.copy(leg.to)
      tomte.walkPose(0, 0)
      const k = s - walk
      const knocking = k < 2.4
      tomte.armR.rotation.x = knocking ? -1.6 + Math.abs(Math.sin(k * 8)) * 0.4 : 0
      tomte.group.rotation.y = Math.atan2(dir.x, dir.z)
      if (k < 0.2 && knocked !== i) {
        knocked = i
        const near = me.distanceTo(tomte.group.position)
        if (near < 40) {
          const vol = 0.5 * Math.max(0, 1 - near / 40)
          ;[0, 0.35, 0.7].forEach((when) => setTimeout(() => noise(0.08, 220, 120, vol, 3), when * 1000))
        }
        if (near < 14 && told !== i) {
          told = i
          ctx.say('🎅 Knack, knack! – Finns det några snälla barn här?')
        }
      }
    }
    tomteCircle.x = tomte.group.position.x
    tomteCircle.z = tomte.group.position.z
  }

  return {
    group,
    colliders,
    update,
    talker: { npc: tomte, talk },
  }
}
