import * as THREE from 'three'
import { Arcade, type Cabinet } from './arcade'
import { EVENTS } from './data'
import { buildElves, type Elf } from './elves'
import { Flight } from './flight'
import type { Nisse } from './npc'
import { Player } from './player'
import { Sleigh } from './sleigh'
import { NPC_SPOT, buildShops, buildSquare, type BuiltShop } from './shops'
import { loadFonts } from './tex'
import { clockText, eventStatus, formatShortDate } from './time'
import { Snowballs } from './snowballs'
import { Thrower } from './throw'
import { Dialog, PauseMenu, Viewer, VirtualCursor, type Talk } from './ui'
import { KnytisPanel } from './knytis'
import { RitbordPanel } from './ritbord'
import { refreshTeamHouse } from './teamhouse'
import { Viewmodel } from './viewmodel'
import { VILLAGE_RADIUS, buildWorld } from './world'

const $ = (id: string) => document.getElementById(id)!
const touch = matchMedia('(pointer: coarse)').matches
document.body.classList.toggle('touch', touch)

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
// 1.5 is sharp enough on a retina screen and draws ~45% fewer pixels than 2
const SHARP = Math.min(devicePixelRatio, 1.5)
renderer.setPixelRatio(SHARP)
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
renderer.shadowMap.enabled = !touch
renderer.shadowMap.type = THREE.PCFSoftShadowMap
// the world and then your own arms on top (see viewmodel.ts)
renderer.autoClear = false
$('app').appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 800)
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
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

const world = buildWorld(scene, { lowPower: touch })
camera.position.set(0, 1.62, 25)
const vm = new Viewmodel()
// Tomtens släde, parked behind you – push him out and fly it (see flight.ts)
const sleigh = new Sleigh(scene)
const flight = new Flight(scene, camera, player, sleigh)
flight.onDone = () => resume()

/* ---------- build the village ---------- */
type Target =
  | { kind: 'npc'; npc: Nisse; talk: Talk }
  | { kind: 'exhibit'; title: string; caption?: string; image: () => string; open?: () => void; prompt?: string }
  | { kind: 'arcade'; cab: Cabinet }
  | { kind: 'sleigh' }
const exhibitOf = new Map<THREE.Object3D, Target>()
const rayRoots: THREE.Object3D[] = []
let shops: BuiltShop[] = []
/** Everyone you can talk to: the shopkeepers and the arcade hosts. */
const talkers: { npc: Nisse; talk: Talk }[] = []
const circles = [...world.colliders, ...sleigh.colliders()]
let arcade: Arcade | null = null
let elves: Elf[] = []
/** What snowballs can hit. */
const solids: THREE.Object3D[] = [...world.solids, sleigh.group, sleigh.santa.group]
const flinchOnHit = (n: Nisse) => (n.group.userData.onSnowball = () => n.flinch())

async function build() {
  await loadFonts()
  shops = await buildShops()
  for (const s of shops) {
    scene.add(s.shop.group)
    s.shop.group.updateMatrixWorld(true)
    const p = s.shop.group.localToWorld(new THREE.Vector3(NPC_SPOT.x, 0, NPC_SPOT.z))
    s.npc.group.position.copy(p)
    s.npc.setYaw(s.shop.group.rotation.y + NPC_SPOT.yaw)
    scene.add(s.npc.group)
    const g = s.shop.group
    world.roofs.push({ x: g.position.x, z: g.position.z, cos: Math.cos(g.rotation.y), sin: Math.sin(g.rotation.y), hw: 5.9, hd: 4.7, h: 6.2 })
    rayRoots.push(s.shop.group)
    for (const ex of s.shop.exhibits) exhibitOf.set(ex.target, { kind: 'exhibit', ...ex })
    talkers.push({ npc: s.npc, talk: s.talk })
    solids.push(s.shop.group, s.npc.group)
    flinchOnHit(s.npc)
  }
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
    touch ? 5 : 8,
  )
  for (const e of elves) solids.push(e.group)

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
function collide(p: THREE.Vector3, RADIUS = 0.35) {
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
  for (const s of shops) {
    const g = s.shop.group
    const phi = g.rotation.y
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    const dx = p.x - g.position.x
    const dz = p.z - g.position.z
    let lx = dx * cos - dz * sin
    let lz = dx * sin + dz * cos
    for (const b of s.shop.boxes) {
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
  const r = Math.hypot(p.x, p.z)
  if (r > VILLAGE_RADIUS) p.multiplyScalar(VILLAGE_RADIUS / r)
}
/** You also bump into elves. */
function collidePlayer(p: THREE.Vector3) {
  collide(p, RADIUS)
  for (const e of elves) {
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
snowballs.onPlayerHit = () => {
  if (!player.enabled) return // not while you're reading or playing
  const el = $('splat')
  el.hidden = true
  void el.offsetWidth // restart the animation
  el.style.setProperty('--x', `${35 + Math.random() * 30}%`)
  el.hidden = false
  clearTimeout(splatTimer)
  splatTimer = setTimeout(() => (el.hidden = true), 1800)
  thrower.knock()
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
  // walk up to Tomten in his sleigh
  if (sleigh.ready) {
    const sp = sleigh.seatWorld()
    const dx = sp.x - player.pos.x
    const dz = sp.z - player.pos.z
    const d = Math.hypot(dx, dz)
    if (d < 3.4 && (dx * fwd.x + dz * fwd.z) / d > 0.5) return { kind: 'sleigh' }
  }
  return aimed
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
          ? 'Knuffa ut tomten och ta släden'
          : t.prompt ?? `Titta på ${t.title.replace(/^\S+\s(?=[A-ZÅÄÖ])/u, '')}`
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
  $('hud').classList.remove('busy', 'arcade', 'flight')
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
function openKnytisPanel() {
  if (knytis.open || !started) return
  pause(false)
  cursor.hide()
  menu.hide()
  void knytis.show()
  if (player.locked) {
    selfUnlock = true
    document.exitPointerLock()
  }
}
addEventListener('jul:knytis', openKnytisPanel)

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
  if (ritbord.open) return ritbord.close()
  if (knytis.open) return knytis.close()
  if (dialog.open) return dialog.close()
  if (viewer.open) return viewer.close()
  if (arcade?.active) return arcade.leave()
  if (flight.active) return flight.leave()
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
$('m-music').addEventListener('click', () => {
  toggleMusic()
  syncMenu()
})
// the 2D site lives next to the village – knytis, topplistor, ritningar
$('m-knytis').addEventListener('click', openKnytisPanel)
$('m-web').addEventListener('click', () => location.assign('/handelser'))

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
  $('m-music').textContent = music.paused ? '♪ Musik: av' : '♪ Musik: på'
  $('m-music').classList.toggle('on', !music.paused)
  $('m-full').textContent = document.fullscreenElement ? '⛶ Lämna helskärm' : '⛶ Helskärm'
}

function interact() {
  if (!target || !player.enabled) return
  const t = target
  pause()
  if (t.kind === 'npc') {
    talking = t.npc
    dialog.start(t.talk)
  } else if (t.kind === 'arcade') playArcade(t.cab)
  else if (t.kind === 'sleigh') {
    // shove Tomten out and jump in
    cursor.hide()
    $('hud').classList.add('flight')
    sleigh.push(player.pos)
    sleigh.say('🎅 Hallå!? Det där är MIN släde!')
    flight.start()
  }
  else if (t.open) t.open()
  else viewer.show(t.image(), t.title, t.caption)
}
promptEl.addEventListener('click', interact)
// clicking the scene talks to / looks at whatever you aim at, otherwise grabs the mouse
renderer.domElement.addEventListener('mousedown', (e) => {
  if (!player.enabled || e.button !== 0) return
  if (target) interact()
  else player.lock()
})
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || dialog.open || viewer.open || menu.open || knytis.open || ritbord.open || arcade?.active || flight.active || !started) return
  if (e.code === 'KeyE' || e.code === 'Enter') interact()
  if (e.code === 'KeyM') toggleMusic()
})

/* ---------- music ---------- */
const music = new Audio('/sounds/game-background-music.mp3')
music.loop = true
music.volume = 0.25
function toggleMusic(force?: boolean) {
  const on = force ?? music.paused
  if (on) music.play().catch(() => {})
  else music.pause()
  $('music').classList.toggle('on', on)
}
$('music').addEventListener('click', () => toggleMusic())

/* ---------- HUD ---------- */
function updateHud() {
  const now = Date.now()
  const next = EVENTS.find((e) => eventStatus(e, now) !== 'past')
  $('next-event').innerHTML = next
    ? `Nästa: <b>${next.emoji} ${next.name}</b> · ${formatShortDate(next.start)}<br><span class="clock">${clockText(next, now)}</span>`
    : 'God jul! Vi ses nästa år 🎄'
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
// "Snål" (thrifty) draws fewer pixels and no moon shadows, for laptops that get hot.
const QUALITY_KEY = 'jul3d.quality'
let thrifty = false
try {
  thrifty = localStorage.getItem(QUALITY_KEY) === 'snål'
} catch {
  /* no storage – fine */
}
function applyQuality() {
  renderer.setPixelRatio(thrifty ? Math.min(devicePixelRatio, 1) : SHARP)
  world.shadows(!thrifty)
  sizeSpray()
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
  if (now - lastFrame < (idle ? 1000 / 15 : 1000 / 90)) return
  lastFrame = now
  frameNo++
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime
  player.update(dt, collidePlayer)
  thrower.update(dt, t)
  arcade?.update(dt, t)
  flight.update(dt, t)
  sleigh.update(t, dt, player.pos)
  world.update(t, dt, flight.active ? flight.pos : player.pos)
  for (const s of shops) s.shop.update(t, dt)
  for (const s of talkers) s.npc.update(t, dt, player.pos, dialog.open && talking === s.npc)
  for (const e of elves) e.update(dt, t)
  snowballs.update(dt, camera.position)
  if (player.enabled && frameNo % 2 === 0) setTarget(findTarget())
  if ((hudTimer -= dt) <= 0) {
    hudTimer = 0.5
    updateHud()
  }
  world.showFar(flight.active)
  if (frameNo % 4 === 0) cullSmall()
  if (frameNo % 2 === 0) renderer.shadowMap.needsUpdate = true
  renderer.clear()
  renderer.render(scene, camera)
  vm.render(renderer, camera)
}

/* ---------- start ---------- */
const go = $('go') as HTMLButtonElement
build()
  .then(() => {
    updateHud()
    go.disabled = false
    go.textContent = 'Gå in i byn'
    if (new URLSearchParams(location.search).has('direkt')) go.click()
  })
  .catch((err) => {
    console.error(err)
    go.textContent = 'Något gick fel – ladda om sidan'
  })
requestAnimationFrame(frame)

go.addEventListener('click', () => {
  started = true
  $('start').hidden = true
  $('hud').hidden = false
  player.enabled = true
  player.lock()
  toggleMusic(true)
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
Object.assign(window, { jul: { renderer, vm, player, camera, scene, dialog, viewer, menu, snowballs, thrower, sleigh, flight, world, talkers, get arcade() { return arcade }, get elves() { return elves }, goto, get shops() { return shops } } })
