import * as THREE from 'three'
import { Arcade, type Cabinet } from './arcade'
import { Camper } from './camper'
import { Corrida } from './corrida'
import { EVENTS } from './data'
import { buildElves, type Elf } from './elves'
import { Flight } from './flight'
import { Matadors } from './matadors'
import type { Nisse } from './npc'
import { Player } from './player'
import { Slide } from './rutschkana'
import { ARRIVE, STUMP, buildMine, buildStump, type Mine } from './kolgruvan'
import { CartRun } from './gruvvagn'
import { Hacking } from './kolhackning'
import { buildCalendar, julafton, today } from './julkalender'
import { CentralPark } from './centralpark'
import { PARK, WORKSHOP } from './sleigh'
import { buildTomtegarden, tomtegardenToast } from './tomtegarden'
import { factoryDoors } from './leksaksfabriken'
import type { Claus } from './tomtefolk'
import type { Box, Floor } from './shop'
import { MINE_TALK } from './gruvfolk'
import { buildCalendarVillage, type Act } from './kalenderbyn'
import { buildToyTrain } from './leksakstag'
import { buildSleighYard } from './julaftonsrunda'
import { Sleigh } from './sleigh'
import { NPC_SPOT, buildShops, buildSquare, type BuiltShop } from './shops'
import { parade, stamping } from './verkstadslek'
import { buildChoir, choirMode, swedenNow, wallClock } from './korsang'
import { buildBuskers } from './gitarrister'
import { daylightAt } from './sol'
import { loadFonts } from './tex'
import { clockText, eventStatus, formatShortDate } from './time'
import { Snowballs } from './snowballs'
import { Thrower } from './throw'
import { Trip } from './trip'
import { Dialog, PauseMenu, Viewer, VirtualCursor, html, type Talk } from './ui'
import { KnytisPanel } from './knytis'
import { RitbordPanel } from './ritbord'
import { refreshTeamHouse } from './teamhouse'
import { Multiplayer } from './multiplayer'
import { bakeStatic, mergeRigid } from './batch'
import { PARTICIPANTS } from './data'
import { getClaims, rememberedName } from '../../src/lib/api'
import { Viewmodel } from './viewmodel'
import { buildWorld, keepInside } from './world'
import { watchWeather, weatherLine, type Weather } from './vader'
import { PROFILE, QUALITY, TOUCH, textureMB, walkFov } from './device'
import { noise } from './sfx'

const $ = (id: string) => document.getElementById(id)!
const touch = TOUCH
document.body.classList.toggle('touch', touch)
document.body.classList.add(`enhet-${PROFILE}`)
/** Opened from the home screen – already fullscreen. */
const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
// pinch-zoom (iOS ignores user-scalable=no), double-tap zoom and long-press menus would pull you out of the game
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
document.addEventListener('contextmenu', (e) => {
  if (!(e.target as HTMLElement).closest('input, textarea')) e.preventDefault()
})

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: QUALITY.antialias, powerPreference: 'high-performance' })
// 1.5 is sharp enough on a retina screen and draws ~45% fewer pixels than 2 (phones: 1.25, see device.ts)
const SHARP = QUALITY.pixelRatio
renderer.setPixelRatio(SHARP)
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
const EXPOSURE = 1.15
renderer.toneMappingExposure = EXPOSURE
renderer.shadowMap.enabled = QUALITY.shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap
// the world and then your own arms on top (see viewmodel.ts)
renderer.autoClear = false
// count a whole frame (world + arms) for ?diag, not just the last render call
renderer.info.autoReset = false
$('app').appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(walkFov(innerWidth / innerHeight), innerWidth / innerHeight, 0.05, 800)
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  if (!flight.active) camera.fov = walkFov(camera.aspect) / player.zoom
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  sizeSpray()
})

// UI first, so their key handlers run before the game's
const dialog = new Dialog()
const viewer = new Viewer()
const player = new Player(camera, renderer.domElement, $('stick'), $('knob'))
const cursor = new VirtualCursor(() => player.locked)
const menu = new PauseMenu()

const world = buildWorld(scene, { lowPower: QUALITY.lowPower })
// Stockholm's weather, right now, over the village
let weatherNow: Weather | null = null
watchWeather((w) => {
  weatherNow = w
  world.weather(w)
})
camera.position.set(0, 1.62, 32)
const vm = new Viewmodel()
// Tomtens släde, parked behind you – push him out and fly it (see flight.ts)
const sleigh = new Sleigh(scene)
const flight = new Flight(scene, camera, player, sleigh)
// down the spiral chute in Leksaksfabriken, from the gallery to the basket of presents
const slide = new Slide(player, camera)
slide.onDone = () => resume()
flight.onDone = () => resume()
// Husvagnen, with Musse and Kalle waving beside it – a trip up the mountain (see trip.ts)
const camper = new Camper(scene)
const trip = new Trip(scene, renderer, camera, player, camper)
trip.onDone = () => resume()
trip.say = (text) => toast(text)
// Three matadors leaning on the side of the verkstad – a bullfight in Madrid (see corrida.ts)
const matadors = new Matadors(scene)
const corrida = new Corrida(renderer, camera, player, vm, matadors)
corrida.onDone = () => resume()
corrida.say = (text) => toast(text)
// in the ring a band plays a paso doble
corrida.onMusic = (arena) => {
  if (arena) corrida.band.start()
  else if (corrida.band.playing) corrida.band.stop()
}
const matadorTalk: Talk = {
  name: 'Los Tres Matadores',
  avatar: '🐂',
  avatarBg: '#8e1b1b',
  greeting: () => [html.p('Psst… amigo. 🪙 Vill du ha en utmaning?'), html.p('Tre tjurar på Plaza de Toros i Madrid. Och sen… han. Vi säger inte vem.')],
  topics: [
    { label: '🐂 Ja! Jag antar utmaningen', pages: () => [], go: () => startCorrida() },
    {
      label: '🤔 Hur går det till?',
      pages: () => [
        html.p('Vi knyter för ögonen på dig – det är tradition, amigo – och så åker vi häst och vagn till Madrid.'),
        html.p('I arenan håller du ut skynket (håll musknappen) så springer tjuren på det röda i stället för på dig. Hoppa åt sidan med Shift, eller hoppa rakt upp med mellanslag.'),
        html.p('Men akta dig för Rayo och El Diablo. Precis innan de når skynket krokar de med hornen mot dig – kliv bort från skynket i sista stund, inte för tidigt. Och lyser ögonen rött går de rakt på dig.'),
        html.p('Efter en stund orkar tjuren inte mer. Klara tre tjurar, sen kommer… ja. Du får se. 🌸'),
      ],
    },
    { label: '🌾 Varför har ni strå i munnen?', pages: () => [html.p('Det ser coolt ut. Nästa fråga.')] },
  ],
  bye: 'Hasta luego… 🪙',
}

/* ---------- build the village ---------- */
type Target =
  | { kind: 'npc'; npc: Nisse; talk: Talk }
  | { kind: 'exhibit'; title: string; caption?: string; image: () => string; open?: () => void; prompt?: string }
  | { kind: 'arcade'; cab: Cabinet }
  | { kind: 'sleigh' }
  | { kind: 'singer'; who: NonNullable<ReturnType<CentralPark['nearPerson']>> }
  | { kind: 'claus'; who: Claus; talk: Talk }
  | { kind: 'camper' }
  | { kind: 'matadors' }
  | { kind: 'slide' }
  | { kind: 'stump' }
  | { kind: 'ladder' }
  | { kind: 'cart' }
  | { kind: 'hack' }
  | { kind: 'calendar' }
  | { kind: 'pickup'; item: Act }
const exhibitOf = new Map<THREE.Object3D, Target>()
const rayRoots: THREE.Object3D[] = []
let shops: BuiltShop[] = []
/** Everyone you can talk to: the shopkeepers and the arcade hosts. */
const talkers: { npc: Nisse; talk: Talk }[] = []
/** (switched off while Tomten is out on his rounds, see julaftonsrunda.ts) */
const sleighCircles = sleigh.colliders()
const circles = [...world.colliders, ...sleighCircles, ...camper.colliders()]
let arcade: Arcade | null = null
let choir: ReturnType<typeof buildChoir> | null = null
/** The hollow stump at the edge of the village, and the coal mine under it (built the first time you climb down). */
let stump: ReturnType<typeof buildStump> | null = null
let mine: Mine | null = null
let inMine = false
/** Central Park, from the 23rd: off to New York with Tomten (see centralpark.ts). */
let park: CentralPark | null = null
let inPark = false
/** On the 23rd, by the sleigh at the factory, Tomten asks if you're coming (after Christmas, ask him at home). */
const newYorkOn = () => sleigh.driver && today().open >= 23 && !julafton()
const santaTalk: Talk = {
  name: 'Tomten',
  avatar: '🎅',
  greeting: () => [
    html.p('Ho ho ho! I kväll smiter jag iväg till New York och delar ut lite klappar i smyg – en dag i förväg, så att ingen märker något.'),
    html.p('Vill du följa med? Det kan bli lite skumpigt. Julandan där borta är inte vad den har varit.'),
  ],
  topics: [
    { label: '🗽 Ja! Jag följer med till New York', pages: () => [], go: () => startPark() },
    { label: '🛷 Kan jag få låna släden en sväng i stället?', pages: () => [], go: () => takeSleigh() },
  ],
  bye: 'Ho ho ho! Säg till om du ångrar dig.',
}
/** Gruvexpressen: the mine cart ride (made the first time you get in). */
let cartRun: CartRun | null = null
/** Your turn at the coal face (made the first time you take the pick). */
let hacking: Hacking | null = null
/** Julkalendern on the square. */
let calendar: ReturnType<typeof buildCalendar> | null = null
/** …and what its doors bring to the village. */
let advent: ReturnType<typeof buildCalendarVillage> | null = null
/** The toy train round the julgran. */
let toyTrain: ReturnType<typeof buildToyTrain> | null = null
/** The guitar and the banjo on the bench by the path to Leksaksfabriken. */
let buskers: ReturnType<typeof buildBuskers> | null = null
let choirHasSquare = false
let choirCheckAt = 0
/** The sacks and the nissar by the sleigh, and Tomten's rounds on julafton. */
let sleighYard: ReturnType<typeof buildSleighYard> | null = null
/** Tomtegården: Tomten and Tomtemor's house, the stable, the slädverkstad (see tomtegarden.ts). */
let garden: ReturnType<typeof buildTomtegarden> | null = null
/** Everything with walls to bump into and floors to stand on: the shops, and Tomtegården's buildings. */
let blockers: { group: THREE.Object3D; boxes: Box[]; floors: Floor[] }[] = []
let skyTimer = 0
let elves: Elf[] = []
/** What snowballs can hit. */
const solids: THREE.Object3D[] = [...world.solids, sleigh.group, sleigh.santa.group, camper.car, camper.trailer, camper.musse.group, camper.kalle.group]
const flinchOnHit = (n: Nisse) => (n.group.userData.onSnowball = () => n.flinch())

async function build() {
  await loadFonts()
  shops = await buildShops()
  for (const s of shops) {
    scene.add(s.shop.group)
    s.shop.group.updateMatrixWorld(true)
    const spot = s.spot ?? NPC_SPOT
    const p = s.shop.group.localToWorld(new THREE.Vector3(spot.x, 0, spot.z))
    s.npc.group.position.copy(p)
    s.npc.setYaw(s.shop.group.rotation.y + spot.yaw)
    scene.add(s.npc.group)
    const g = s.shop.group
    world.roofs.push({ x: g.position.x, z: g.position.z, cos: Math.cos(g.rotation.y), sin: Math.sin(g.rotation.y), ...s.shop.roof })
    // a big building is aimed at and hit through a few simple boxes instead of its every triangle
    const hits = s.hitboxes ? [s.hitboxes, ...s.shop.exhibits.map((e) => e.target)] : [s.shop.group]
    rayRoots.push(...hits)
    for (const ex of s.shop.exhibits) exhibitOf.set(ex.target, { kind: 'exhibit', ...ex })
    talkers.push({ npc: s.npc, talk: s.talk })
    solids.push(...hits, s.npc.group)
    flinchOnHit(s.npc)
    // more people to talk to in some shops (Lasse Långnisse in Leksaksfabriken)
    for (const x of s.extras ?? []) {
      x.npc.group.position.copy(s.shop.group.localToWorld(new THREE.Vector3(x.x, 0, x.z)))
      x.npc.setYaw(s.shop.group.rotation.y + x.yaw)
      scene.add(x.npc.group)
      talkers.push({ npc: x.npc, talk: x.talk })
      solids.push(x.npc.group)
      flinchOnHit(x.npc)
    }
  }
  // the matadors lean on the outside of the verkstad's left wall
  matadors.place(shops[0].shop.group)
  circles.push(...matadors.colliders())
  for (const m of matadors.crew) {
    solids.push(m.group)
    m.group.userData.onSnowball = () => toast('🪙 ¡Oye! Inte på kostymen!')
  }
  // the gang singing carols by the tree
  choir = buildChoir(scene, shops[0].shop.group)
  circles.push(...choir.colliders)
  // the way down to Kolgruvan (hidden: see kolgruvan.ts)
  stump = buildStump(scene)
  circles.push(...stump.colliders)
  // the calendar house, with a door a day from the first of December
  calendar = buildCalendar(scene)
  circles.push(...calendar.colliders)
  advent = buildCalendarVillage(scene, () => ($('me-name') as HTMLInputElement).value.trim())
  circles.push(...advent.colliders)
  solids.push(...advent.solids)
  advent.voice.say = (text) => toast(text)
  advent.voice.glogg = () => {
    vm.glogg()
    $('sip').hidden = false
    setTimeout(() => toast(TOUCH ? '☕ Tryck på glaset för en klunk' : '☕ Tryck F för en klunk'), 2600)
  }
  calendar.status = advent.status
  calendar.done = { has: advent.has, mark: advent.mark }
  toyTrain = buildToyTrain(scene)
  buskers = buildBuskers(scene)
  circles.push(...buskers.colliders)
  for (const s of buskers.solids) {
    solids.push(s)
    s.userData.onSnowball = () => toast('🎸 Hörru! Inte på gitarren!')
  }
  sleighYard = buildSleighYard(scene, sleigh, sleighCircles)
  garden = buildTomtegarden(scene, { onNewYork: () => startPark() })
  garden.say = (text) => toast(text)
  tomtegardenToast((text) => toast(text))
  circles.push(...garden.colliders)
  world.roofs.push(...garden.roofs)
  solids.push(...garden.solids)
  for (const k of garden.talkers) k.who.group.userData.onSnowball = () => (k.who.laugh(), toast(k.who.kind === 'tomten' ? '🎅 Ho ho ho! Inte inomhus, min vän!' : '🤶 Men snälla du, det smälter ju på mattan!'))
  blockers = [...shops.map((s) => s.shop), ...garden.lots]
  circles.push(...sleighYard.colliders)
  // in the mine: old Sixten gets his pipe back (door 17); the foreman's word on the list (door 15)
  const sixten = MINE_TALK.fisher.greeting
  MINE_TALK.fisher.greeting = () =>
    advent?.givePipe() ? [html.p('Min pipa! Där var den ju! Jag har letat efter den i tre år.'), html.p('Tack. Du är snällare än du ser ut. Men säg inte det till någon här nere.')] : sixten()
  const kolbjorn = MINE_TALK.foreman.greeting
  MINE_TALK.foreman.greeting = () => {
    if (today().open >= 15) advent?.mark('forman')
    return kolbjorn()
  }
  solids.push(choir.group)
  const square = await buildSquare(scene, shops)
  circles.push(...square.colliders)
  solids.push(...square.solids)
  for (const ex of square.exhibits) {
    exhibitOf.set(ex.target, { kind: 'exhibit', ...ex })
    rayRoots.push(ex.target)
  }

  // the games round the tree
  arcade = new Arcade(scene, camera, player, vm, playArcade)
  arcade.onLeft = () => resume()
  for (const c of arcade.cabinets) {
    const p = c.group.position
    circles.push({ x: p.x, z: p.z, r: 0.62 }, { x: c.host.group.position.x, z: c.host.group.position.z, r: 0.32 })
    rayRoots.push(c.group)
    exhibitOf.set(c.group, { kind: 'arcade', cab: c })
    talkers.push({ npc: c.host, talk: c.talk })
    solids.push(c.group, c.host.group)
    flinchOnHit(c.host)
  }

  // elves running about
  elves = buildElves(
    scene,
    {
      player: player.pos,
      collide: (p, r) => {
        collide(p, r)
        // stay out on the square, not in the shops
        const d = Math.hypot(p.x, p.z)
        if (d > 13) p.multiplyScalar(13 / d)
        // and out of the way of someone playing a game
        if (arcade?.active) {
          const f = arcade.active.group.localToWorld(new THREE.Vector3(0, 0, 1))
          const dx = p.x - f.x
          const dz = p.z - f.z
          const k = Math.hypot(dx, dz)
          if (k < 1.3 && k > 1e-5) {
            p.x = f.x + (dx / k) * 1.3
            p.z = f.z + (dz / k) * 1.3
          }
        }
      },
      blocked: circles.filter((c) => Math.hypot(c.x, c.z) < 16),
      throwAt: (from, to, owner) => {
        // lob it at your head, leading you a little if you're walking
        const aim = to.clone().setY(1.5).addScaledVector(player.vel, 0.4)
        aim.x += (Math.random() - 0.5) * 0.8
        aim.z += (Math.random() - 0.5) * 0.8
        const d = aim.clone().sub(from)
        const T = THREE.MathUtils.clamp(Math.hypot(d.x, d.z) / 11, 0.45, 1.3)
        snowballs.throw(from, new THREE.Vector3(d.x / T, (d.y + 0.5 * 13 * T * T) / T, d.z / T), owner)
      },
    },
    QUALITY.elves,
  )
  for (const e of elves) solids.push(e.group)

  // fewer draw calls (batch.ts): each shop's still meshes merged, every nisse merged part by part
  for (const s of shops) bakeStatic(s.shop.group, new Set(s.shop.exhibits.map((e) => e.target)))
  for (const n of [...talkers.map((t) => t.npc), ...elves.map((e) => e.nisse), sleigh.santa]) mergeRigid(n.group)
  mergeRigid(sleigh.group)
  // and everything else on the square that stands still (the tree, lamps, gifts, the poster column…)
  const moving = new Set<THREE.Object3D>([
    ...shops.map((s) => s.shop.group),
    ...talkers.map((t) => t.npc.group),
    ...elves.map((e) => e.nisse.group),
    sleigh.group,
    sleigh.santa.group,
    ...(toyTrain ? [toyTrain.train] : []),
    ...(buskers ? [buskers.group] : []),
    ...(sleighYard?.moving ?? []),
    ...(garden?.moving ?? []),
    ...(arcade?.cabinets.map((c) => c.group) ?? []),
    // the camper and its crew drive off to the mountain; the matadors flip coins and walk over to you
    camper.car,
    camper.trailer,
    camper.musse.group,
    camper.kalle.group,
    ...matadors.crew.map((m) => m.group),
  ])
  const posters = new Set(square.exhibits.map((e) => e.target))
  for (const o of [...scene.children]) if ((o as THREE.Group).isGroup && !moving.has(o)) bakeStatic(o, posters)

  // tiny things barely show in the moon's shadow map (~3.5 cm a pixel): leave them out of the shadow pass
  const scale = new THREE.Vector3()
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.castShadow || (m as THREE.InstancedMesh).isInstancedMesh) return
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
    m.getWorldScale(scale)
    if (m.geometry.boundingSphere!.radius * Math.max(scale.x, scale.y, scale.z) < 0.12) m.castShadow = false
  })

  collectSmall()
  // compile shaders up front so the first look around doesn't stutter
  renderer.compile(scene, camera)
}

/* ---------- collision ---------- */
const RADIUS = 0.35
function collide(p: THREE.Vector3, RADIUS = 0.35, feet = 0) {
  const walled = blockers.length ? blockers : shops.map((s) => s.shop)
  for (const c of circles) {
    const dx = p.x - c.x
    const dz = p.z - c.z
    const d = Math.hypot(dx, dz)
    const min = c.r + RADIUS
    if (d < min && d > 1e-5) {
      p.x = c.x + (dx / d) * min
      p.z = c.z + (dz / d) * min
    }
  }
  for (const s of walled) {
    const g = s.group
    const phi = g.rotation.y
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    const dx = p.x - g.position.x
    const dz = p.z - g.position.z
    let lx = dx * cos - dz * sin
    let lz = dx * sin + dz * cos
    for (const b of s.boxes) {
      // (most things you only bump into down on the floor; walls and railings at their own heights)
      if (feet < (b.y0 ?? -Infinity) || feet >= (b.y1 ?? 2.5)) continue
      const cx = THREE.MathUtils.clamp(lx, b.x - b.hw, b.x + b.hw)
      const cz = THREE.MathUtils.clamp(lz, b.z - b.hd, b.z + b.hd)
      const ox = lx - cx
      const oz = lz - cz
      const d = Math.hypot(ox, oz)
      if (d < RADIUS) {
        if (d > 1e-5) {
          lx = cx + (ox / d) * RADIUS
          lz = cz + (oz / d) * RADIUS
        } else {
          // centre is inside the box: push out the shortest way
          const pushes = [b.x + b.hw + RADIUS - lx, lx - (b.x - b.hw - RADIUS), b.z + b.hd + RADIUS - lz, lz - (b.z - b.hd - RADIUS)]
          const i = pushes.indexOf(Math.min(...pushes))
          if (i === 0) lx = b.x + b.hw + RADIUS
          else if (i === 1) lx = b.x - b.hw - RADIUS
          else if (i === 2) lz = b.z + b.hd + RADIUS
          else lz = b.z - b.hd - RADIUS
        }
      }
    }
    p.x = g.position.x + lx * cos + lz * sin
    p.z = g.position.z - lx * sin + lz * cos
  }
  keepInside(p)
}
/** How high you can step up without jumping. */
const STEP = 0.45
/**
 * What there is to stand on at `p` for feet at `feet`: the highest floor you can step onto (0, the
 * ground, if none) – or null if something solid there is too high.
 */
function groundAt(p: THREE.Vector3, feet: number) {
  let top = 0
  for (const s of blockers.length ? blockers : shops.map((x) => x.shop)) {
    if (!s.floors.length) continue
    const g = s.group
    const cos = Math.cos(g.rotation.y)
    const sin = Math.sin(g.rotation.y)
    const dx = p.x - g.position.x
    const dz = p.z - g.position.z
    const lx = dx * cos - dz * sin
    const lz = dx * sin + dz * cos
    for (const f of s.floors) {
      if (Math.abs(lx - f.x) > f.hw || Math.abs(lz - f.z) > f.hd) continue
      if (f.top <= feet + STEP) top = Math.max(top, f.top)
      else if (f.solid) return null
    }
  }
  return top
}
/** You also bump into elves. */
function collidePlayer(p: THREE.Vector3, feet = 0) {
  collide(p, RADIUS, feet)
  for (const e of elves) {
    if (!e.group.visible) continue
    const dx = p.x - e.pos.x
    const dz = p.z - e.pos.z
    const d = Math.hypot(dx, dz)
    if (d < RADIUS + 0.28 && d > 1e-5) {
      p.x = e.pos.x + (dx / d) * (RADIUS + 0.28)
      p.z = e.pos.z + (dz / d) * (RADIUS + 0.28)
    }
  }
}

/* ---------- snowballs ---------- */
const snowballs = new Snowballs(scene, camera, () => solids)
function sizeSpray() {
  snowballs.setScale(renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))))
}
sizeSpray()
const thrower = new Thrower(player, camera, vm, snowballs, () => started && player.enabled)
sleigh.say = (text) => started && toast(text)
// an elf got you: snow on your face and a little knock back
let splatTimer = 0
snowballs.onPlayerHit = (owner) => {
  if (!player.enabled) return // not while you're reading or playing
  mp?.hitBy(owner)
  const el = $('splat')
  el.hidden = true
  void el.offsetWidth // restart the animation
  el.style.setProperty('--x', `${35 + Math.random() * 30}%`)
  el.hidden = false
  clearTimeout(splatTimer)
  splatTimer = setTimeout(() => (el.hidden = true), 1800)
  thrower.knock()
}

/* ---------- other people in the village ---------- */
// The server lives in multiplayer/ (Cloudflare). Without VITE_MP_URL the village stays one-player.
const MP_URL: string = import.meta.env.VITE_MP_URL ?? (import.meta.env.DEV ? 'ws://localhost:8787/byn' : '')
const mp = MP_URL ? new Multiplayer(MP_URL, scene) : null
if (mp) {
  mp.onAvatar = (group, added) => {
    if (added) solids.push(group)
    else if (solids.includes(group)) solids.splice(solids.indexOf(group), 1)
  }
  // a throw while you weren't looking (phone locked, other tab) never reaches you
  mp.onThrow = (from, vel, owner) => document.hidden || snowballs.throw(from, vel, owner)
  mp.onJoin = (name) => toast(`🎅 ${name} kom in i byn`)
  mp.onLeave = (name) => toast(`👋 ${name} gick hem`)
  mp.onHit = (by, on, mine) => toast(mine.by ? `❄️ Träff! Du prickade ${on}` : mine.on ? `❄️ ${by} träffade dig!` : `❄️ ${by} prickade ${on}`)
  mp.onChange = showOthers
  mp.onSay = (name, text, mine) => chatLine(name, text, mine)
  thrower.onThrow = (from, vel) => mp.sendThrow(from, vel)
  $('me').hidden = false
  ;($('me-name') as HTMLInputElement).value = rememberedName.get()
  $('me-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ($('go') as HTMLButtonElement).click()
  })
}
/** Step in with a name (the same one knytis remembers) – and your photo if you're on the guest list. */
function joinOthers() {
  if (!mp) return
  const typed = ($('me-name') as HTMLInputElement).value.trim()
  if (typed) rememberedName.set(typed)
  const name = typed || `Nisse ${10 + Math.floor(Math.random() * 90)}`
  const photo = PARTICIPANTS.find((p) => p.name.toLowerCase() === name.toLowerCase())?.image ?? null
  mp.join({ name, photo })
}
/** "👥 3 i byn" in the corner, and who's here (with their hits) in the menu. */
function showOthers() {
  const people = mp?.players ?? []
  $('online').hidden = !mp?.online
  $('chat-btn').hidden = !mp?.online
  $('online').textContent = `👥 ${people.length} i byn`
  const list = $('m-players')
  list.hidden = people.length < 2
  list.replaceChildren(
    Object.assign(document.createElement('div'), { className: 'kicker', textContent: 'I byn just nu' }),
    ...people.map((p) => Object.assign(document.createElement('div'), { textContent: `${p.me ? '⭐ ' : ''}${p.name}${p.hits ? ` · ❄️ ${p.hits}` : ''}` })),
  )
}

/* ---------- targeting + interaction ---------- */
const ray = new THREE.Raycaster()
ray.far = 7
ray.camera = camera
const promptEl = $('prompt')
const promptText = promptEl.querySelector('span')!
let target: Target | null = null
let talking: Nisse | null = null

function findTarget(): Target | null {
  // in Central Park: the people you could get singing
  if (inPark && park) {
    const who = park.nearPerson(player.pos, player.forward)
    return who ? { kind: 'singer', who } : null
  }
  // down in the mine: only the ladder back up (for now)
  if (inMine && mine) {
    const f = player.forward
    if (mine.nearLadder(player.pos, f)) return { kind: 'ladder' }
    const thing = advent?.near(player.pos, 0, true)
    if (thing) return { kind: 'pickup', item: thing }
    // (the people down there first: you'll want to talk to the foreman standing by things)
    const who = mine.nearPerson(player.pos, f)
    if (who) return { kind: 'npc', ...who }
    if (mine.nearCart(player.pos, f)) return { kind: 'cart' }
    if (mine.nearHack(player.pos, f)) return { kind: 'hack' }
    return null
  }
  ray.setFromCamera(new THREE.Vector2(0, 0), camera)
  const hit = ray.intersectObjects(rayRoots, true)[0]
  let aimed: Target | null = null
  for (let o: THREE.Object3D | null = hit?.object ?? null; o && !aimed; o = o.parent) aimed = exhibitOf.get(o) ?? null
  // looking straight at a game cabinet (up close) beats its host standing next to it
  if (aimed?.kind === 'arcade') {
    if (hit!.distance < 4) return aimed
    aimed = null
  }
  const fwd = player.forward
  let best: (typeof talkers)[number] | null = null
  let bestD = 3.4
  for (const s of talkers) {
    const np = s.npc.group.position
    const dx = np.x - player.pos.x
    const dz = np.z - player.pos.z
    const d = Math.hypot(dx, dz)
    if (d < bestD && (dx * fwd.x + dz * fwd.z) / d > 0.6) {
      best = s
      bestD = d
    }
  }
  if (best) return { kind: 'npc', ...best }
  // Tomten and Tomtemor in their chairs by the fire
  for (const k of garden?.talkers ?? []) {
    if (!k.present()) continue
    const e = k.who.eyes()
    const dx = e.x - player.pos.x
    const dz = e.z - player.pos.z
    const d = Math.hypot(dx, dz)
    if (d < 2.8 && (dx * fwd.x + dz * fwd.z) / d > 0.6) return { kind: 'claus', who: k.who, talk: k.talk }
  }
  // walk up to Musse and Kalle by the camper door
  if (camper.kalle.out) {
    const cp = camper.crewWorld()
    const dx = cp.x - player.pos.x
    const dz = cp.z - player.pos.z
    const d = Math.hypot(dx, dz)
    if (d < 5 && (dx * fwd.x + dz * fwd.z) / d > 0.5) return { kind: 'camper' }
  }
  // walk up to the matadors by the wall
  if (matadors.out) {
    const mp = matadors.middle()
    const dx = mp.x - player.pos.x
    const dz = mp.z - player.pos.z
    const d = Math.hypot(dx, dz)
    if (d < 4.5 && (dx * fwd.x + dz * fwd.z) / d > 0.5) return { kind: 'matadors' }
  }
  // walk up to Tomten in his sleigh
  if (sleigh.ready) {
    const sp = sleigh.seatWorld()
    const dx = sp.x - player.pos.x
    const dz = sp.z - player.pos.z
    const d = Math.hypot(dx, dz)
    if (d < 3.4 && (dx * fwd.x + dz * fwd.z) / d > 0.5) return { kind: 'sleigh' }
  }
  // up on the gallery at the top of Leksaksfabriken's chute
  if (slide.near(player.pos, player.floor, fwd)) return { kind: 'slide' }
  if (calendar?.near(player.pos, fwd)) return { kind: 'calendar' }
  const item = advent?.near(player.pos, player.floor + player.height)
  if (item) return { kind: 'pickup', item }
  // right at the old stump, looking down into it
  if (stump?.near(player.pos, player.pitch)) return { kind: 'stump' }
  return aimed
}

/** What's under a finger at (x, y): the thing you tapped, if it's close enough to reach. */
function targetAt(x: number, y: number): Target | null {
  const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const hit = ray.intersectObjects(rayRoots, true)[0]
  let aimed: Target | null = null
  for (let o: THREE.Object3D | null = hit?.object ?? null; o && !aimed; o = o.parent) aimed = exhibitOf.get(o) ?? null
  // people are thin – take the one whose middle is nearest the finger on screen. Right under the
  // finger (and in front of what the ray hit) they win; a near miss only counts when nothing else was hit.
  let best: Target | null = null
  let bestPx = aimed ? 45 : 90
  const head = new THREE.Vector3()
  const consider = (p: THREE.Vector3, t: Target) => {
    const d = p.distanceTo(camera.position)
    if (d > 5.5 || (aimed && hit && d > hit.distance + 0.3)) return
    head.copy(p).project(camera)
    if (head.z > 1) return
    const px = Math.hypot(((head.x + 1) / 2) * innerWidth - x, ((1 - head.y) / 2) * innerHeight - y)
    if (px < bestPx) {
      bestPx = px
      best = t
    }
  }
  for (const s of talkers) consider(s.npc.group.position.clone().setY(1.1), { kind: 'npc', ...s })
  if (sleigh.ready) consider(sleigh.seatWorld().setY(1.2), { kind: 'sleigh' })
  for (const k of garden?.talkers ?? []) if (k.present()) consider(k.who.eyes(), { kind: 'claus', who: k.who, talk: k.talk })
  if (camper.kalle.out) consider(camper.crewWorld(), { kind: 'camper' })
  if (matadors.out) consider(matadors.middle(), { kind: 'matadors' })
  return best ?? aimed
}
player.onTap = (x, y) => {
  if (!player.enabled || !started) return
  const t = targetAt(x, y)
  if (!t) return
  setTarget(t)
  interact()
}

function setTarget(t: Target | null) {
  if (t === target) return
  target = t
  $('crosshair').classList.toggle('on', !!t)
  promptEl.hidden = !t
  if (!t) return
  promptText.textContent =
    t.kind === 'npc'
      ? `Prata med ${t.talk.name}`
      : t.kind === 'arcade'
        ? `Spela ${t.cab.def.name}`
        : t.kind === 'sleigh'
          ? newYorkOn()
            ? 'Prata med Tomten'
            : sleigh.driver
              ? 'Knuffa ut tomten och ta släden'
              : 'Hoppa upp i släden'
          : t.kind === 'claus'
            ? `Prata med ${t.talk.name}`
          : t.kind === 'singer'
            ? 'Sjung för dem 🎶'
          : t.kind === 'camper'
            ? 'Hoppa in i husvagnen'
            : t.kind === 'matadors'
              ? 'Prata med matadorerna'
              : t.kind === 'slide'
                ? 'Åk ner för rutschkanan'
                : t.kind === 'stump'
                  ? 'Klättra ner i stubben'
                  : t.kind === 'ladder'
                    ? 'Klättra upp'
                    : t.kind === 'cart'
                      ? 'Åk Gruvexpressen'
                      : t.kind === 'hack'
                        ? 'Ta hackan och hacka kol'
                        : t.kind === 'calendar'
                          ? calendar!.prompt()
                          : t.kind === 'pickup'
                            ? t.item.prompt
                            : (t.prompt ?? `Titta på ${t.title.replace(/^\S+\s(?=[A-ZÅÄÖ])/u, '')}`)
}

// Popups keep the mouse grabbed (with a cursor of their own), so closing one goes straight back to looking around.
let started = false
function pause(withCursor = true) {
  player.enabled = false
  player.stop()
  thrower.cancel()
  setTarget(null)
  $('hud').classList.add('busy')
  if (withCursor) cursor.show()
}
function resume(onLockFail?: () => void) {
  cursor.hide()
  player.enabled = true
  $('hud').classList.remove('busy', 'arcade', 'flight', 'trip', 'corrida', 'stampla')
  player.lock(onLockFail)
}
dialog.onClose = () => resume()
viewer.onClose = () => resume()

let toastTimer = 0
function toast(text: string) {
  const el = $('toast')
  el.textContent = text
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (el.hidden = true), 2600)
}

function playArcade(cab: Cabinet) {
  pause(false)
  cursor.hide()
  $('hud').classList.add('arcade')
  arcade!.start(cab)
}

/* ---------- Esc menu ---------- */
// Opening it lets go of the mouse; "Fortsätt" (a click, so the browser allows it) grabs it again.
let selfUnlock = false
function openMenu() {
  if (menu.open || !started) return
  pause(false)
  syncMenu()
  menu.show()
  if (player.locked) {
    selfUnlock = true
    document.exitPointerLock()
  }
}
function closeMenu() {
  if (!menu.open) return
  menu.hide()
  // right after Esc the browser may refuse to grab the mouse again for a moment
  resume(() => toast('🖱️ Klicka i byn för att styra med musen'))
}
menu.onResume = closeMenu

/* ---------- knytis ---------- */
// A form you type in, so the mouse is let go while it's open (like the Esc menu).
const knytis = new KnytisPanel()
function openKnytisPanel(e?: Event) {
  if (knytis.open || !started) return
  const dish = e instanceof CustomEvent && typeof e.detail === 'string' ? e.detail : undefined
  pause(false)
  cursor.hide()
  menu.hide()
  void knytis.show(dish)
  if (player.locked) {
    selfUnlock = true
    document.exitPointerLock()
  }
}
addEventListener('jul:knytis', openKnytisPanel)
// who brings what: on the chalkboard and the buffet cards – fetched now and then (others claim too)
function refreshClaims() {
  // (no julbord in the village unless you're invited – and then nothing to ask for)
  if (document.hidden || !EVENTS.some((e) => e.potluck)) return
  getClaims()
    .then((claims) => dispatchEvent(new CustomEvent('jul:claims', { detail: claims })))
    .catch(() => {})
}
setInterval(refreshClaims, 30000)

/* ---------- ritbordet (Pepparkaksarkitekten) ---------- */
const ritbord = new RitbordPanel()
function openRitbordPanel() {
  if (ritbord.open || !started) return
  pause(false)
  cursor.hide()
  menu.hide()
  ritbord.show()
  if (player.locked) {
    selfUnlock = true
    document.exitPointerLock()
  }
}
addEventListener('jul:ritbord', openRitbordPanel)

/* ---------- Leksaksfabriken: stamping toys at Kvalitetskontrollen ---------- */
// You stand at the belt (still, looking down at the stamp) and press to stamp; Esc or the button stops.
addEventListener('jul:stampla', () => {
  if (stamping.active || !started) return
  pause(false)
  cursor.hide()
  $('hud').classList.add('stampla', 'busy')
  const v = stamping.viewpoint()
  player.pos.set(v.x, 0, v.z)
  player.yaw = v.yaw
  player.pitch = v.pitch
  stamping.start()
})
stamping.onLeft = () => resume(() => toast('🖱️ Klicka i byn för att styra med musen'))

/* ---------- chat: speech bubbles over your nisse ---------- */
// Typing lets go of the mouse and stands you still (like the other panels); Enter sends, Esc closes.
const chatForm = $('chat') as HTMLFormElement
const chatInput = $('chat-input') as HTMLInputElement
let chatting = false
function openChat() {
  if (chatting || !started || !mp?.online) return
  chatting = true
  pause(false)
  cursor.hide()
  chatForm.hidden = false
  chatInput.value = ''
  chatInput.focus()
  if (player.locked) {
    selfUnlock = true
    document.exitPointerLock()
  }
}
function closeChat() {
  if (!chatting) return
  chatting = false
  chatForm.hidden = true
  chatInput.blur()
  resume(() => toast('🖱️ Klicka i byn för att styra med musen'))
}
chatForm.addEventListener('submit', (e) => {
  e.preventDefault()
  mp?.say(chatInput.value)
  closeChat()
})
$('chat-btn').addEventListener('click', openChat)
$('jump').addEventListener('pointerdown', (e) => {
  e.preventDefault()
  player.jump()
})
/** The last few lines in the corner – bubbles behind your back aren't missed. */
function chatLine(name: string, text: string, mine: boolean) {
  const log = $('chat-log')
  const row = document.createElement('div')
  if (mine) row.className = 'mine'
  const who = document.createElement('b')
  who.textContent = mine ? 'Du' : name
  row.append(who, document.createTextNode(` ${text}`))
  log.append(row)
  while (log.children.length > 5) log.firstElementChild!.remove()
  setTimeout(() => row.classList.add('old'), 11000)
  setTimeout(() => row.remove(), 12000)
}
ritbord.onClose = () => {
  // whatever you drew is now standing on the table
  refreshTeamHouse()
  resume(() => toast('🖱️ Klicka i byn för att styra med musen'))
}
knytis.onClose = () => resume(() => toast('🖱️ Klicka i byn för att styra med musen'))
$('menu-btn').addEventListener('click', openMenu)

// One place decides what Esc means. It arrives either as a key press or – while the mouse is
// grabbed – as the browser letting go of it (some browsers swallow the key), so de-dupe the two.
let lastEsc = 0
function onEsc() {
  const now = performance.now()
  if (now - lastEsc < 300) return
  lastEsc = now
  if (menu.open) return closeMenu()
  if (chatting) return closeChat()
  if (ritbord.open) return ritbord.close()
  if (knytis.open) return knytis.close()
  if (dialog.open) return dialog.close()
  if (viewer.open) return viewer.close()
  if (stamping.active) return stamping.leave()
  if (arcade?.active) return arcade.leave()
  if (flight.active) return flight.leave()
  if (trip.active) return trip.leave()
  if (corrida.active) return corrida.leave()
  if (cartRun?.active) return cartRun.leave()
  if (hacking?.active) return hacking.leave()
  if (calendar?.open) return calendar.close()
  openMenu()
}
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return
  e.preventDefault()
  onEsc()
})
document.addEventListener('pointerlockchange', () => {
  if (player.locked) return
  cursor.hide()
  if (selfUnlock) {
    selfUnlock = false
    return
  }
  // switching window also lets go of the mouse: pause, but leave any open popup alone
  if (!document.hasFocus()) {
    if (player.enabled) openMenu()
    return
  }
  onEsc()
})

const SENS_KEY = 'jul3d.sens'
try {
  player.sens = Number(localStorage.getItem(SENS_KEY)) || 1
} catch {
  /* no storage – default sensitivity */
}
const sens = $('m-sens') as HTMLInputElement
sens.value = String(player.sens)
sens.addEventListener('input', () => {
  player.sens = Number(sens.value)
  try {
    localStorage.setItem(SENS_KEY, sens.value)
  } catch {
    /* fine */
  }
})
// the 2D site lives next to the village – knytis, topplistor, ritningar
$('m-knytis').addEventListener('click', openKnytisPanel)
$('m-web').addEventListener('click', () => location.assign('/handelser'))

// Fullscreen works on Android and iPad too, not just with a mouse
if (document.fullscreenEnabled) $('m-full').classList.remove('desk')

// "Lägg till på hemskärmen": Android asks the browser, an iPhone needs the share menu
type InstallPrompt = Event & { prompt: () => Promise<void> }
let installPrompt: InstallPrompt | null = null
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  installPrompt = e as InstallPrompt
})
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
$('m-install').hidden = !touch || standalone
$('m-install').addEventListener('click', async () => {
  if (installPrompt) {
    await installPrompt.prompt().catch(() => {})
    installPrompt = null
    return
  }
  $('install-help').hidden = false
  $('install-help').textContent = ios
    ? 'Tryck på Dela-knappen (fyrkanten med pilen ⬆️) i Safari och välj "Lägg till på hemskärmen". Då öppnas byn i helskärm därifrån.'
    : 'Öppna webbläsarens meny (⋮) och välj "Lägg till på startskärmen" eller "Installera app".'
})

$('m-full').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
  else {
    await document.documentElement.requestFullscreen?.().catch(() => {})
    // in fullscreen Chrome can hand Esc to the page, so it opens this menu instead of leaving fullscreen
    ;(navigator as { keyboard?: { lock?: (k: string[]) => Promise<void> } }).keyboard?.lock?.(['Escape']).catch(() => {})
  }
  syncMenu()
})
document.addEventListener('fullscreenchange', syncMenu)
function syncMenu() {
  $('m-full').textContent = document.fullscreenElement ? '⛶ Lämna helskärm' : '⛶ Helskärm'
}

function interact() {
  if (!target || !player.enabled) return
  const t = target
  if (t.kind === 'singer') {
    park?.convert(t.who, player.pos)
    setTarget(null)
    return
  }
  pause()
  if (t.kind === 'npc') {
    talking = t.npc
    dialog.start(t.talk)
  } else if (t.kind === 'claus') {
    t.who.laugh()
    dialog.start(t.talk)
  } else if (t.kind === 'arcade') playArcade(t.cab)
  else if (t.kind === 'sleigh') {
    if (newYorkOn()) dialog.start(santaTalk)
    else takeSleigh()
  } else if (t.kind === 'camper') startTrip()
  else if (t.kind === 'matadors') dialog.start(matadorTalk)
  else if (t.kind === 'slide') {
    cursor.hide()
    slide.start()
  } else if (t.kind === 'stump') goDown()
  else if (t.kind === 'ladder') goUp()
  else if (t.kind === 'cart') ride()
  else if (t.kind === 'hack') hack()
  else if (t.kind === 'calendar') calendar?.show(() => resume())
  else if (t.kind === 'pickup') {
    const said = t.item.act()
    if (said) toast(said)
    setTarget(null)
    resume()
  }
  else if (t.open) t.open()
  else viewer.show(t.image(), t.title, t.caption)
}
/** Down the ladder in the stump into Kolgruvan: black for a moment, the creak of the rungs, then the mine. */
function goDown() {
  cursor.hide()
  if (!mine) {
    mine = buildMine()
    advent?.attachMine(mine.scene)
  }
  const m = mine
  $('fade').classList.add('on')
  m.climb()
  setTimeout(() => {
    inMine = true
    player.pos.set(ARRIVE.x, 0, ARRIVE.z)
    player.yaw = ARRIVE.yaw
    player.pitch = 0
    player.floor = player.height = 0
    setTarget(null)
    renderer.compile(m.scene, camera)
    $('fade').classList.remove('on')
    resume()
  }, 1100)
}
/** Take up the pick at the free seam in Stora orten. */
function hack() {
  if (!mine) return
  cursor.hide()
  $('hud').classList.add('busy')
  if (!hacking) {
    hacking = new Hacking(mine.scene, camera)
    hacking.onLeft = () => {
      const s = mine!.hack
      // (stepping back from the seam)
      player.pos.set(s.x - Math.sin(s.yaw) * 0.8, 0, s.z - Math.cos(s.yaw) * 0.8)
      player.yaw = s.yaw + Math.PI
      player.pitch = 0
      resume()
    }
  }
  setTarget(null)
  hacking.start(mine.hack, mine.heave)
}
/** Into Gruvexpressen: off down the tunnels until you crash (or get out). */
function ride() {
  cursor.hide()
  $('hud').classList.add('busy')
  if (!cartRun) {
    cartRun = new CartRun(camera)
    cartRun.onDone = () => {
      $('fade').classList.add('on')
      setTimeout(() => {
        // (out on the platform, beside the cart)
        if (mine) player.pos.set(mine.station.x - 1.6, 0, mine.station.z + 0.9)
        player.yaw = -Math.PI / 2
        player.pitch = 0
        $('fade').classList.remove('on')
        resume()
      }, 500)
    }
  }
  const run = cartRun
  mine?.leave()
  $('fade').classList.add('on')
  setTimeout(() => {
    renderer.compile(run.scene, camera)
    run.start()
    $('fade').classList.remove('on')
  }, 500)
}
/** …and back up, out of the stump into the snow. */
function goUp() {
  cursor.hide()
  $('fade').classList.add('on')
  mine?.climb()
  setTimeout(() => {
    inMine = false
    mine?.leave()
    // (stepping out on the village side of it, facing the square)
    player.pos.set(STUMP.x + 1.1, 0, STUMP.z + 0.3)
    player.yaw = -Math.PI / 2
    player.pitch = 0
    player.floor = player.height = 0
    setTarget(null)
    $('fade').classList.remove('on')
    resume()
  }, 1100)
}
/** Shove Tomten out and jump in. */
function takeSleigh() {
  cursor.hide()
  $('hud').classList.add('flight')
  if (sleigh.driver) {
    sleigh.push(player.pos)
    sleigh.say('🎅 Hallå!? Det där är MIN släde!')
  } else {
    // in the slädverkstad: up into the empty seat – the team comes running from the stable, the doors fly open
    sleigh.team = true
    refreshSleighCircles()
    toast('🦌 Renarna kommer springande från stallet – och portarna flyger upp!')
  }
  flight.start()
}
/** The sleigh's circles to bump into, where it stands now (the team's only if it's harnessed). */
function refreshSleighCircles() {
  const fresh = sleigh.colliders()
  fresh.forEach((c, i) => {
    const r = i < 2 || sleigh.team ? c.r : -c.r
    Object.assign(sleighCircles[i], { x: c.x, z: c.z, r })
  })
}
/**
 * Where everyone is today (checked twice a second): the sleigh, the team and Tomten are out at
 * Leksaksfabriken on the 23rd and julafton; the rest of the time Tomten is at home, the team in the
 * stable and the sleigh in the slädverkstad, which is open from the 1st of December to tjugondag Knut.
 */
let seasonAt = 0
function season(t: number) {
  if (t < seasonAt) return
  seasonAt = t + 0.5
  const d = new Date(wallClock())
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const out = m === 12 && (day === 23 || day === 24)
  if (!flight.active) {
    const home = out ? PARK : WORKSHOP
    if (sleigh.home !== home) {
      sleigh.home = home
      sleigh.park()
    }
    sleigh.driver = out
    sleigh.team = out
    if (!julafton()) refreshSleighCircles()
  }
  garden?.setDay({
    tomteHome: !out,
    deerHome: !out,
    open: m === 12 || (m === 1 && day <= 13),
    sleighHome: !out && !flight.active,
    flyingOut: flight.active && sleigh.home === WORKSHOP,
  })
}
/** Off to New York with Tomten – and down in Central Park. */
/** Where to come back to from New York: wherever you set off from. */
let parkFrom = { at: new THREE.Vector3(), yaw: 0 }
function startPark() {
  cursor.hide()
  $('hud').classList.add('busy')
  parkFrom = { at: player.pos.clone(), yaw: player.yaw }
  if (!park) {
    const p = (park = new CentralPark())
    const place = (at: THREE.Vector3, yaw: number) => {
      player.pos.set(at.x, 0, at.z)
      player.yaw = yaw
      player.pitch = -0.05
      player.vel.set(0, 0, 0)
      player.floor = player.height = 0
    }
    p.say = (text) => toast(text)
    p.onPlay = (at, yaw) => {
      place(at, yaw)
      resume()
    }
    p.onCaught = place
    p.onDone = (r) => {
      pause(false)
      $('fade').classList.add('on')
      setTimeout(() => {
        inPark = false
        // home again, where you set off from (by the sleigh, or by the fire in Tomtens stuga)
        player.pos.set(parkFrom.at.x, 0, parkFrom.at.z)
        player.yaw = parkFrom.yaw
        player.pitch = 0
        player.floor = player.height = 0
        setTarget(null)
        $('fade').classList.remove('on')
        resume()
        const time = `${Math.floor(r.seconds / 60)}:${String(Math.floor(r.seconds % 60)).padStart(2, '0')}`
        // (after Tomten's hello by the sleigh, so it isn't lost under it)
        setTimeout(() => toast(r.won ? `🎉 Julandan räddad på ${time}!${r.best ? ' Nytt rekord!' : ''}` : '🎅 Ho ho ho … vi försöker igen en annan kväll!'), 1800)
      }, 700)
    }
  }
  const p = park
  $('fade').classList.add('on')
  setTimeout(() => {
    inPark = true
    setTarget(null)
    renderer.compile(p.scene, camera)
    p.start()
    $('fade').classList.remove('on')
  }, 700)
}
function startTrip() {
  cursor.hide()
  $('hud').classList.add('trip')
  trip.start()
}
function startCorrida() {
  pause(false)
  cursor.hide()
  $('hud').classList.add('corrida', 'busy')
  corrida.start()
}
promptEl.addEventListener('click', interact)
// clicking the scene talks to / looks at whatever you aim at, otherwise grabs the mouse
/* ---------- zoom: hold the right mouse button (or Z) – the 🔍 button on touch ---------- */
let zoomHeld = false
let zoomToggled = false
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 2) zoomHeld = true
})
addEventListener('mouseup', (e) => {
  if (e.button === 2) zoomHeld = false
})
addEventListener('keydown', (e) => {
  if (e.code === 'KeyZ' && !(e.target as HTMLElement | null)?.closest?.('input, textarea')) zoomHeld = true
})
addEventListener('keyup', (e) => {
  if (e.code === 'KeyZ') zoomHeld = false
})
addEventListener('blur', () => (zoomHeld = false))
/** A sip of glögg (F, or the glass button on a phone). */
function sip() {
  if (!player.enabled) return
  const left = vm.sip()
  if (left < 0) return
  setTimeout(() => noise(0.45, 700, 250, 0.05, 2), 350)
  if (left === 0) {
    $('sip').hidden = true
    setTimeout(() => toast('☕ Slut på glöggen! Ståndet på torget har mer.'), 1300)
  }
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && !e.repeat && !(e.target as HTMLElement | null)?.closest?.('input, textarea')) sip()
})
$('sip').addEventListener('pointerdown', (e) => {
  e.preventDefault()
  sip()
})
$('zoom').addEventListener('pointerdown', (e) => {
  e.preventDefault()
  zoomToggled = !zoomToggled
  $('zoom').classList.toggle('on', zoomToggled)
})
/** Ease towards ~2.8× while held, back to 1 otherwise – never in the sleigh, at a game or in a popup. */
function updateZoom(dt: number) {
  const want = (zoomHeld || zoomToggled) && player.enabled && !flight.active ? 2.8 : 1
  const z = player.zoom + (want - player.zoom) * (1 - Math.exp(-12 * dt))
  const next = Math.abs(z - want) < 0.002 ? want : z
  if (next === player.zoom) return
  player.zoom = next
  if (flight.active) return
  camera.fov = walkFov(camera.aspect) / player.zoom
  camera.updateProjectionMatrix()
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!player.enabled || e.button !== 0) return
  if (target) interact()
  else player.lock()
})
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || dialog.open || viewer.open || menu.open || knytis.open || ritbord.open || chatting || stamping.active || arcade?.active || flight.active || trip.active || corrida.active || cartRun?.active || hacking?.active || calendar?.open || !started) return
  if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return
  const talk = e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyT'
  if (talk && mp?.online) {
    e.preventDefault() // or the key ends up in the chat box
    openChat()
  } else if (e.code === 'KeyE' || e.code === 'Enter') interact()
})

/* ---------- HUD ---------- */
function updateHud() {
  const now = Date.now()
  const next = EVENTS.find((e) => eventStatus(e, now) !== 'past')
  $('next-event').innerHTML = next
    ? `Nästa: <b>${next.emoji} ${next.name}</b> · ${formatShortDate(next.start)}<br><span class="clock">${clockText(next, now)}</span>`
    : 'God jul! Vi ses nästa år 🎄'
  if (weatherNow) $('next-event').innerHTML += `<br><span class="weather">${weatherLine(weatherNow)}</span>`
  for (const s of shops) s.shop.setSignLine(`${formatShortDate(s.event.start)} · ${clockText(s.event, now)}`)
}

/* ---------- small things far away aren't drawn ---------- */
// Anything that would only be a few pixels tall (a candle across the square, a reindeer's bells) is
// moved to a layer the camera doesn't render. Layers rather than .visible, so it never fights the
// game's own showing and hiding.
const FAR_LAYER = 2
const CULL_K = 150 // hidden beyond 150 × its own radius
const small: { m: THREE.Mesh; r2: number; c: THREE.Vector3 }[] = []
function collectSmall() {
  const scale = new THREE.Vector3()
  scene.updateMatrixWorld(true)
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
    const bs = m.geometry.boundingSphere!
    m.getWorldScale(scale)
    const r = bs.radius * Math.max(scale.x, scale.y, scale.z)
    if (r < 1) small.push({ m, r2: (r * CULL_K) ** 2, c: bs.center })
  })
}
const cullAt = new THREE.Vector3()
function cullSmall() {
  for (const s of small) {
    cullAt.copy(s.c).applyMatrix4(s.m.matrixWorld)
    s.m.layers.set(cullAt.distanceToSquared(camera.position) > s.r2 ? FAR_LAYER : 0)
  }
}

/* ---------- graphics: fin / snål ---------- */
/* ---------- resolution ---------- */
// Phones vary wildly, so the resolution follows the frame rate: fewer pixels when it struggles,
// back up when there's room – never above the cap (the device's, or "snål").
let pixelCap = SHARP
let pixels = SHARP
function setPixels(pr: number) {
  pixels = Math.round(Math.min(pixelCap, Math.max(QUALITY.minPixelRatio, pr)) * 100) / 100
  renderer.setPixelRatio(pixels)
  sizeSpray()
}
const fpsWin = { frames: 0, since: 0, fps: 0 }
// Changing it clears the canvas, so it must not see-saw: going up takes three good windows in a row
// (6 s) and 10 s since the last step down, and once a step up had to be taken back it stays put.
const adapt = { good: 0, lastDown: 0, wentUp: false, settled: false }
function adaptResolution(now: number) {
  if (document.hidden) return void (fpsWin.since = 0)
  if (!fpsWin.since) return void Object.assign(fpsWin, { since: now, frames: 0 })
  fpsWin.frames++
  const span = now - fpsWin.since
  if (span < 2000) return
  fpsWin.fps = (fpsWin.frames * 1000) / span
  Object.assign(fpsWin, { since: now, frames: 0 })
  if (fpsWin.fps < 40 && pixels > QUALITY.minPixelRatio) {
    if (adapt.wentUp) adapt.settled = true
    Object.assign(adapt, { good: 0, lastDown: now, wentUp: false })
    setPixels(pixels - 0.15)
  } else if (fpsWin.fps > 56 && pixels < pixelCap && !adapt.settled) {
    if (++adapt.good >= 3 && now - adapt.lastDown > 10000) {
      Object.assign(adapt, { good: 0, wentUp: true })
      setPixels(pixels + 0.1)
    }
  } else adapt.good = 0
}

/* ---------- when the graphics give up ---------- */
// A phone that runs out of graphics memory drops the WebGL context: say so instead of freezing.
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault()
  $('lost').hidden = false
})

/* ---------- ?diag: numbers to read off a phone ---------- */
const diag = new URLSearchParams(location.search).has('diag') ? $('diag') : null
if (diag) diag.hidden = false
function updateDiag() {
  if (!diag) return
  const gl = renderer.getContext()
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '?'
  diag.textContent = [
    `${PROFILE} · ${touch ? 'touch' : 'mus'} · ${innerWidth}×${innerHeight} @${devicePixelRatio}`,
    `${fpsWin.fps.toFixed(0)} fps · upplösning ${pixels} (max ${pixelCap})`,
    `${renderer.info.render.calls} anrop · ${Math.round(renderer.info.render.triangles / 1000)}k trianglar`,
    `texturer ${renderer.info.memory.textures} st · ~${Math.round(textureMB())} MB · fov ${camera.fov.toFixed(0)}°`,
    gpu,
  ].join('\n')
}

// "Snål" (thrifty) draws fewer pixels and no moon shadows, for laptops that get hot.
const QUALITY_KEY = 'jul3d.quality'
let thrifty = false
try {
  thrifty = localStorage.getItem(QUALITY_KEY) === 'snål'
} catch {
  /* no storage – fine */
}
function applyQuality() {
  pixelCap = thrifty ? Math.min(devicePixelRatio, 1, SHARP) : SHARP
  setPixels(pixelCap)
  world.shadows(QUALITY.shadows && !thrifty)
  trip.shadows(QUALITY.shadows && !thrifty)
  corrida.shadows(QUALITY.shadows && !thrifty)
  $('m-quality').textContent = thrifty ? '🔋 Grafik: snål' : '✨ Grafik: fin'
}
$('m-quality').addEventListener('click', () => {
  thrifty = !thrifty
  try {
    localStorage.setItem(QUALITY_KEY, thrifty ? 'snål' : 'fin')
  } catch {
    /* fine */
  }
  applyQuality()
})
applyQuality()

/* ---------- loop ---------- */
// Kept light: at most ~60 frames a second (a 120 Hz screen would otherwise ask for twice that),
// a slow tick behind the start screen and the menu, and the moon's shadows redrawn every other frame.
const clock = new THREE.Clock()
let hudTimer = 0
let lastFrame = 0
let frameNo = 0
renderer.shadowMap.autoUpdate = false
renderer.shadowMap.needsUpdate = true
function frame(now: number) {
  requestAnimationFrame(frame)
  const idle = !started || menu.open
  // a computer draws every frame the screen asks for (144 Hz → 144); phones stop at 60 to spare the battery
  // (2 ms slack, or a 60 Hz screen would skip every other frame)
  const cap = idle ? 15 : PROFILE === 'dator' ? 0 : 60
  if (cap && now - lastFrame < 1000 / cap - 2) return
  lastFrame = now
  frameNo++
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime
  // the others in the village carry on (and still see you) while you're off on a trip
  mp?.update(t, dt)
  // off on the camper trip or in Madrid, the village stands still (it's only a painted backdrop, after all)
  if (cartRun?.active) {
    advent?.hush()
    buskers?.hush()
    cartRun.update(dt)
    renderer.toneMappingExposure = EXPOSURE
  } else if (inPark && park) {
    // New York: the park is its own world (and it waits while you're in the menu)
    advent?.hush()
    buskers?.hush()
    if (park.cinematic) park.camera(camera)
    else player.update(dt, park.collide, park.ground)
    if (park.cinematic || player.enabled) park.update(t, dt, player.pos)
    renderer.toneMappingExposure = EXPOSURE
    if (player.enabled && frameNo % 2 === 0) setTarget(findTarget())
  } else if (inMine && mine) {
    // down in the mine: just you, the miners and their song (the village waits up above)
    advent?.hush()
    buskers?.hush()
    if (hacking?.active) hacking.update(dt)
    else player.update(dt, mine.collide, mine.ground)
    mine.update(t, dt, player.pos, player.enabled)
    choir?.update(dt, player.pos, false)
    parade.near(player.pos, false)
    renderer.toneMappingExposure = EXPOSURE
    if (player.enabled && frameNo % 2 === 0) setTarget(findTarget())
  } else if (!trip.inWorld && !corrida.inWorld) {
    // (down the chute, the chute steers)
    if (slide.active) slide.update(dt)
    else player.update(dt, collidePlayer, groundAt)
    // (how high you are, the others see: up on a gallery or in mid-jump)
    mp?.sendState(player.pos, player.yaw, player.vel.length() / 6.8, player.floor + player.height)
    thrower.update(dt, t)
    arcade?.update(dt, t)
    flight.update(dt, t)
    season(t)
    sleighYard?.update(t, flight.active)
    garden?.update(t, dt, player.pos)
    sleigh.update(t, dt, player.pos)
    camper.update(t, dt, player.pos)
    matadors.update(t, dt, player.pos)
    world.update(t, dt, flight.active ? flight.pos : player.pos, !flight.active)
    for (const s of shops) s.shop.update(t, dt)
    for (const s of talkers) s.npc.update(t, dt, player.pos, dialog.open && talking === s.npc)
    // on Lucia morning the elves are all in the procession, and on the first Sunday of Advent at the concert
    const elvesOut = choir?.mode !== 'lucia' && choir?.mode !== 'advent'
    for (const e of elves) {
      e.group.visible = elvesOut
      if (elvesOut) e.update(dt, t)
    }
    // the tin soldiers' band plays as you come near (not from up in the sleigh)
    // (the band in Leksaksfabriken only plays while its doors are open)
    parade.near(player.pos, !flight.active && factoryDoors.open)
    choir?.update(dt, player.pos, !flight.active)
    calendar?.update(t, dt)
    advent?.update(t, dt, player.pos, !flight.active, world.aurora)
    toyTrain?.update(t, dt, player.pos)
    {
      const d = new Date(wallClock())
      // (they stop for the Lucia procession and the advent concert: checked now and then, not every frame)
      if (t >= choirCheckAt) {
        choirCheckAt = t + 0.5
        choirHasSquare = ['lucia', 'advent'].includes(choirMode())
      }
      buskers?.update(t, dt, player.pos, !flight.active, d.getTime(), choirHasSquare)
    }
    // day and night as they are in Sweden right now (checked now and then: the sun moves slowly)
    if ((skyTimer -= dt) <= 0) {
      skyTimer = 5
      const day = daylightAt(swedenNow())
      world.daylight(day.k, day.dir)
    }
    // Lucia morning: the village goes dark round the procession's candles
    renderer.toneMappingExposure = EXPOSURE * (choir?.exposure ?? 1)
    snowballs.update(dt, camera.position)
    if (player.enabled && frameNo % 2 === 0) setTarget(findTarget())
    world.showFar(flight.active)
    if (frameNo % 4 === 0) cullSmall()
  }
  if ((hudTimer -= dt) <= 0) {
    hudTimer = 0.5
    updateHud()
    updateDiag()
  }
  trip.update(dt, t)
  corrida.update(dt, t)
  if (frameNo % 2 === 0) renderer.shadowMap.needsUpdate = true
  updateZoom(dt)
  vm.cupPose(dt, t)
  // before drawing: a new resolution resizes (and clears) the canvas, which would otherwise show as a black flash
  if (!idle) adaptResolution(now)
  renderer.info.reset()
  renderer.clear()
  if (cartRun?.active) renderer.render(cartRun.scene, camera)
  else if (inPark && park) {
    renderer.render(park.scene, camera)
    vm.render(renderer, camera)
  } else if (inMine && mine) {
    renderer.render(mine.scene, camera)
    vm.render(renderer, camera)
  } else if (trip.inWorld) renderer.render(trip.world!.scene, camera)
  else if (corrida.inWorld) {
    renderer.render(corrida.world!.scene, camera)
    vm.render(renderer, camera)
  } else {
    renderer.render(scene, camera)
    vm.render(renderer, camera)
  }
}

/* ---------- start ---------- */
const go = $('go') as HTMLButtonElement
build()
  .then(() => {
    updateHud()
    refreshClaims()
    go.disabled = false
    go.textContent = 'Gå in i byn'
    const q = new URLSearchParams(location.search)
    if (q.has('direkt') || q.has('husvagn') || q.has('tjuren')) go.click()
    // ?husvagn: straight to the camper and off (for testing)
    if (q.has('husvagn')) {
      const p = camper.trailer.localToWorld(new THREE.Vector3(5.2, 0, 0.6))
      player.pos.set(p.x, 0, p.z)
      pause(false)
      startTrip()
    } else if (q.has('tjuren')) {
      // ?tjuren: straight to the matadors and off to Madrid (for testing)
      const spot = matadors.front()
      player.pos.copy(spot.pos)
      player.yaw = spot.yaw
      player.update(0, () => {})
      corrida.prepare()
      startCorrida()
    } else {
      setTimeout(() => trip.prepare(), 400)
      setTimeout(() => corrida.prepare(), 1500)
    }
  })
  .catch((err) => {
    console.error(err)
    go.textContent = 'Något gick fel – ladda om sidan'
  })
requestAnimationFrame(frame)

// Phones: fill the screen (Android – an iPhone only goes fullscreen from the home screen, see the menu)
function fillScreen() {
  if (!touch || standalone || !document.fullscreenEnabled || document.fullscreenElement) return
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
}
go.addEventListener('click', () => {
  fillScreen()
  joinOthers()
  started = true
  // a door waiting in the calendar today?
  if (calendar?.waiting()) setTimeout(() => toast('🎄 Dagens lucka väntar i julkalendern på torget!'), 2500)
  $('start').hidden = true
  $('hud').hidden = false
  player.enabled = true
  player.lock()
})

// handy for poking around from the console: jul.goto(0) walks you into the first shop
function goto(i: number, lx = 0.5, lz = 3.2, look: [number, number] = [0, -4]) {
  const g = shops[i].shop.group
  const p = g.localToWorld(new THREE.Vector3(lx, 0, lz))
  const t = g.localToWorld(new THREE.Vector3(look[0], 0, look[1]))
  player.pos.set(p.x, 0, p.z)
  player.yaw = Math.atan2(-(t.x - p.x), -(t.z - p.z))
  player.pitch = -0.05
}
Object.assign(window, { jul: { renderer, vm, player, camera, scene, dialog, viewer, menu, snowballs, thrower, sleigh, flight, camper, trip, matadors, corrida, world, talkers, mp, parade, stamping, slide, goDown, goUp, ride, hack, get hacking() { return hacking }, get calendar() { return calendar }, get mine() { return mine }, get cartRun() { return cartRun }, get arcade() { return arcade }, get choir() { return choir }, get elves() { return elves }, get sleighYard() { return sleighYard }, get park() { return park }, get garden() { return garden }, startPark, goto, get shops() { return shops } } })
