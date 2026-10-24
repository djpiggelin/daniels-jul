// Nyårsafton: fireworks over the village (hogtider.ts's toMidnight). Now and then all evening from six,
// more as midnight comes, the last ten seconds counted down on the screen – and at twelve the big show,
// for a quarter of an hour. Peonies, chrysanthemums, gold willows, rings and crackling ones, each boom
// heard a moment after the flash, as far off as it is. Which rockets go up when is worked out from the
// village clock's second, so everyone sees the same ones.
import * as THREE from 'three'
import { noise } from './sfx'
import { glowTexture, rng } from './tex'
import { toMidnight } from './hogtider'

const N = 6000
const G = 7
type Kind = 'peony' | 'chrysanthemum' | 'willow' | 'ring' | 'crackle'
const KINDS: Kind[] = ['peony', 'peony', 'chrysanthemum', 'willow', 'ring', 'crackle']
const COLORS = [0xff3b3b, 0x3bff7a, 0x4aa8ff, 0xffd84a, 0xff6af2, 0xffffff, 0xff9a2a, 0x9a6bff].map((c) => new THREE.Color(c))

/** How many rockets a second, `m` seconds before midnight (negative: after it). */
function rate(m: number) {
  if (m > 600) return 1 / 40
  if (m > 60) return 0.15
  if (m > 0) return 0.35
  if (m > -180) return 2.2
  if (m > -900) return 0.9
  return 0.06
}

type Rocket = { x: number; z: number; y: number; vx: number; vy: number; vz: number; top: number; kind: Kind; colors: THREE.Color[]; age: number; trail: number }

export type Fireworks = ReturnType<typeof buildFireworks>

export function buildFireworks(scene: THREE.Scene, say: (text: string) => void) {
  // all the sparks, in one pool
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const vel = new Float32Array(N * 3)
  const life = new Float32Array(N)
  const span = new Float32Array(N)
  const drag = new Float32Array(N)
  const base = Array.from({ length: N }, () => new THREE.Color())
  const flicker = new Uint8Array(N)
  let next = 0
  pos.fill(-1e4)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.5, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
  pts.frustumCulled = false
  pts.visible = false
  scene.add(pts)
  // a flash in the sky at each burst
  const flashMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,240,220,1)', 'rgba(255,200,150,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })
  const flashes = Array.from({ length: 8 }, () => {
    const s = new THREE.Sprite(flashMat.clone())
    s.visible = false
    scene.add(s)
    return { s, age: 9 }
  })
  let flashNext = 0

  const spark = (x: number, y: number, z: number, vx: number, vy: number, vz: number, c: THREE.Color, t: number, d = 0.6, f = 0) => {
    const i = next
    next = (next + 1) % N
    pos.set([x, y, z], i * 3)
    vel.set([vx, vy, vz], i * 3)
    base[i].copy(c)
    life[i] = t
    span[i] = t
    drag[i] = d
    flicker[i] = f
  }

  const rockets: Rocket[] = []
  let ear = new THREE.Vector3()

  function burst(r: Rocket) {
    const { x, y, z } = r
    const fl = flashes[flashNext]
    flashNext = (flashNext + 1) % flashes.length
    fl.s.position.set(x, y, z)
    fl.age = 0
    fl.s.visible = true
    ;(fl.s.material as THREE.SpriteMaterial).color.copy(r.colors[0]).lerp(new THREE.Color(1, 1, 1), 0.5)
    const n = r.kind === 'willow' ? 130 : r.kind === 'ring' ? 80 : 170
    const speed = 13 + Math.random() * 7
    // (a ring: tilted at random)
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 1.2, Math.random() * 6, 0))
    const v = new THREE.Vector3()
    for (let k = 0; k < n; k++) {
      if (r.kind === 'ring') {
        const a = (k / n) * Math.PI * 2
        v.set(Math.cos(a), 0, Math.sin(a)).applyQuaternion(tilt)
      } else {
        const u = Math.random() * 2 - 1
        const a = Math.random() * Math.PI * 2
        const s = Math.sqrt(1 - u * u)
        v.set(Math.cos(a) * s, u, Math.sin(a) * s)
      }
      const sp = speed * (r.kind === 'ring' ? 1 : 0.75 + Math.random() * 0.35)
      const c = r.colors[r.kind === 'chrysanthemum' ? k % 2 : 0]
      if (r.kind === 'willow') spark(x, y, z, v.x * sp * 0.8, v.y * sp * 0.8, v.z * sp * 0.8, c, 3.2 + Math.random(), 1.6)
      else spark(x, y, z, v.x * sp, v.y * sp, v.z * sp, c, 1.6 + Math.random() * 0.6, 0.7, r.kind === 'crackle' ? 1 : 0)
    }
    // the boom, when its sound gets here
    const d = ear.distanceTo(new THREE.Vector3(x, y, z))
    const vol = Math.min(0.5, 30 / (d + 20))
    setTimeout(() => {
      noise(1.1, 140, 40, vol, 0.5)
      if (r.kind === 'crackle') for (let k = 0; k < 9; k++) setTimeout(() => noise(0.05, 3000, 1500, vol * 0.4, 2), 500 + Math.random() * 900)
    }, (d / 340) * 1000)
  }

  function launch(rand: () => number) {
    // from out in the forest, round the village – up over the trees
    const a = rand() * Math.PI * 2
    const r = 45 + rand() * 40
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    const pick = Math.floor(rand() * KINDS.length)
    const c1 = COLORS[Math.floor(rand() * COLORS.length)]
    const c2 = COLORS[Math.floor(rand() * COLORS.length)]
    const kind = KINDS[pick]
    rockets.push({
      x,
      z,
      y: 2,
      vx: (rand() - 0.5) * 3,
      vz: (rand() - 0.5) * 3,
      vy: 26 + rand() * 8,
      top: 32 + rand() * 30,
      kind,
      colors: kind === 'willow' ? [new THREE.Color(0xffc45a), new THREE.Color(0xffc45a)] : [c1, c2],
      age: 0,
      trail: 0,
    })
    const d = ear.distanceTo(new THREE.Vector3(x, 2, z))
    if (d < 90) noise(0.9, 700, 2600, 0.04 * Math.max(0, 1 - d / 90), 4)
  }

  // the countdown, big in the middle of the screen
  const el = document.createElement('div')
  el.id = 'nyar'
  el.hidden = true
  document.getElementById('hud')!.appendChild(el)
  let lastSecond = 0
  /** How long since the last spark died (nothing to draw or move after a few seconds of it). */
  let quiet = 99
  let toldNewYear = false

  function update(dt: number, player: THREE.Vector3, clock: number) {
    ear = player
    const m = toMidnight(clock)
    quiet = m != null || rockets.length > 0 ? 0 : quiet + dt
    pts.visible = quiet < 6
    if (m != null) {
      // which rockets go up this second: the same for everyone (seeded by the second itself)
      const second = Math.floor(clock / 1000)
      if (second !== lastSecond) {
        if (lastSecond && second - lastSecond < 5) {
          for (let s = lastSecond + 1; s <= second; s++) {
            const rand = rng(s)
            let n = rate(m - (second - s))
            // (fractions: a chance of one)
            while (n > 0) {
              if (rand() < Math.min(1, n)) launch(rand)
              n -= 1
            }
          }
        }
        lastSecond = second
      }
      // the countdown, and the new year
      if (m > 0 && m <= 10.5) {
        el.hidden = false
        el.textContent = String(Math.ceil(m - 0.5))
        el.className = ''
      } else if (m <= 0 && m > -8) {
        el.hidden = false
        el.textContent = 'Gott nytt år!'
        el.className = 'gott'
        if (!toldNewYear) {
          toldNewYear = true
          say(`🎆 Gott nytt år ${new Date(clock).getUTCFullYear()}! Klockorna i kapellet ringer in det nya året.`)
        }
      } else el.hidden = true
    } else el.hidden = true
    if (!pts.visible) return

    // the rockets: up, a trail of sparks, and pop
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]
      r.age += dt
      r.vy -= G * 0.4 * dt
      r.x += r.vx * dt
      r.y += r.vy * dt
      r.z += r.vz * dt
      r.trail += dt
      while (r.trail > 0.02) {
        r.trail -= 0.02
        spark(r.x, r.y, r.z, (Math.random() - 0.5) * 0.6, -1 - Math.random(), (Math.random() - 0.5) * 0.6, new THREE.Color(1, 0.75, 0.4), 0.5, 2)
      }
      if (r.y >= r.top || r.vy < 4) {
        burst(r)
        rockets.splice(i, 1)
      }
    }
    // the sparks: fly out, slow, fall, fade
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue
      life[i] -= dt
      const j = i * 3
      const k = Math.exp(-drag[i] * dt)
      vel[j] *= k
      vel[j + 1] = vel[j + 1] * k - G * 0.35 * dt
      vel[j + 2] *= k
      pos[j] += vel[j] * dt
      pos[j + 1] += vel[j + 1] * dt
      pos[j + 2] += vel[j + 2] * dt
      let b = Math.max(0, life[i] / span[i]) ** 0.6
      if (flicker[i]) b *= Math.random() < 0.5 ? 0.2 : 1.6
      if (life[i] <= 0) {
        pos[j + 1] = -1e4
        b = 0
      }
      col[j] = base[i].r * b
      col[j + 1] = base[i].g * b
      col[j + 2] = base[i].b * b
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    for (const f of flashes) {
      if (!f.s.visible) continue
      f.age += dt
      const k = Math.max(0, 1 - f.age / 0.35)
      f.s.visible = k > 0
      f.s.scale.setScalar(30 + f.age * 40)
      ;(f.s.material as THREE.SpriteMaterial).opacity = k * 0.5
    }
  }

  return { update }
}
