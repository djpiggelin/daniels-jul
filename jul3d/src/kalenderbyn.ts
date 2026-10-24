// What the calendar's doors bring to the village (and the mine): from each door's day on, until the
// calendar comes down after tjugondag Knut, it's there for everyone – string lights over the square,
// a snowman, sooty footprints, reindeer, fires, a Christmas market, a stronger aurora, a julbord in
// Leksaksfabriken, the miners up on the square on julafton – and the things to do: finds to pick up,
// things to carry where they belong, lanterns to light, a riddle, records to beat. What you've done is
// kept in this browser; each door's chapter says how it's going.
import * as THREE from 'three'
import { keepApart, mergeRigid } from './batch'
import { BEST_M_KEY } from './gruvvagn'
import { today } from './julkalender'
import { STUMP } from './kolgruvan'
import { yardTree } from './leksaksfabriken'
import { Nisse } from './npc'
import { Playlist, blip, noise } from './sfx'
import { glowTexture, makeCanvas, toTexture } from './tex'
import type { Circle } from './world'

const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

/** Something you can do right where you are: what the prompt says, and doing it (what to say after). */
export type Act = { prompt: string; act: () => string | null }

/** The gingerbread biscuits for door 6: behind the poster column, by two firs, up on the factory's gallery, and in its yard. */
const BISCUITS = [
  new THREE.Vector3(-7.9, 0, 19.7),
  new THREE.Vector3(17.5, 0, 33.9),
  new THREE.Vector3(-36.6, 0, 5.2),
  new THREE.Vector3(-16.2, 5.675, -88),
  new THREE.Vector3(23.5, 0, -60.5),
]
/** Door 5: sooty footprints from Leksaksfabriken's door, out of the yard and off to the west – and then nothing. */
// (out of the yard by the gate, down the side of the path and off west along the edge of the village)
const TRAIL = [-2.6, -65.6, -3.0, -60, -3.0, -53, -3.0, -46, -3.0, -40.8, -6.5, -39.2, -11, -38.5, -16, -37, -20, -35.5]
/** Door 18: three little tomtenissar hiding – behind the calendar house, up on the factory's gallery, by the camper. */
const HIDERS = [new THREE.Vector3(16.2, 0, -1.3), new THREE.Vector3(16.4, 5.675, -96), new THREE.Vector3(-24.6, 0, 24.6)]
/** Door 21: lanterns to light from the stump's thicket to the square – the way the miners will come up. */
const LANTERNS = [[-36, -11.8], [-31, -11.6], [-26, -11.6], [-21, -12.3], [-16, -12.5], [-11, -11.6]] as const
/** Under the big tree on the square: where the dropped present goes, and where your own is on julafton. */
const UNDER_TREE = new THREE.Vector3(2.8, 0, 3.0)
const GIFT_AT = new THREE.Vector3(-2.9, 0, 3.4)

export function buildCalendarVillage(scene: THREE.Scene, myName: () => string) {
  const colliders: Circle[] = []
  /** Which door each collider comes with. */
  const colliderDay = new Map<Circle, number>()
  const collide = (day: number, c: Circle) => {
    colliders.push(c)
    colliderDay.set(c, day)
  }
  const byDay = new Map<number, THREE.Object3D[]>()
  const add = (day: number, o: THREE.Object3D, parent: THREE.Object3D = scene) => {
    parent.add(o)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(o)
    return o
  }
  const updaters: ((t: number, dt: number, player: THREE.Vector3) => void)[] = []
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

  /* ---------- what you've done (kept in the browser) ---------- */
  const key = () => `jul3d.kalender.${today().year}.hittat`
  let done = new Set<string>()
  const load = () => {
    try {
      done = new Set(JSON.parse(localStorage.getItem(key()) ?? '[]'))
    } catch {
      done = new Set()
    }
  }
  load()
  const has = (id: string) => done.has(id)
  const mark = (id: string) => {
    done.add(id)
    try {
      localStorage.setItem(key(), JSON.stringify([...done]))
    } catch {
      /* fine */
    }
    show()
  }
  const count = (prefix: string) => [...done].filter((id) => id.startsWith(prefix)).length
  const chime = () => [988, 1319, 1568].forEach((h, i) => setTimeout(() => blip(h, 0.1, 'triangle', 0.05), i * 80))
  const best = (k: string) => {
    try {
      return Number(localStorage.getItem(k)) || 0
    } catch {
      return 0
    }
  }

  /* ---------- the things to pick up, carry, light ---------- */
  type Spot = { id: string; day: number; at: THREE.Vector3; reach: number; prompt: string; mine?: boolean; mesh?: THREE.Object3D; spark?: THREE.Sprite; when?: () => boolean; act: () => string | null }
  const spots: Spot[] = []
  const sparkle = glowTexture('rgba(255,245,210,0.85)', 'rgba(255,220,140,0)')
  const twinkle = (o: THREE.Object3D, y: number) => {
    const s = keepApart(new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkle, blending: THREE.AdditiveBlending, depthWrite: false })))
    s.position.y = y
    s.scale.setScalar(0.35)
    o.add(s)
    return s
  }
  /** Something lying about to pick up: gone once you have it. */
  const find = (id: string, day: number, mesh: THREE.Object3D, prompt: string, said: () => string, sparkY = 0.25) => {
    const spark = twinkle(mesh, sparkY)
    add(day, mesh)
    spots.push({ id, day, at: mesh.position.clone(), reach: 1.3, prompt, mesh, spark, when: () => !has(id), act: () => (mark(id), chime(), said()) })
  }

  /* ---------- door 1: string lights strung between the lamp posts round the square ---------- */
  {
    const posts = [-150, -112, -50, -17, 17, 50, 112, 150].map((deg) => {
      const a = THREE.MathUtils.degToRad(deg)
      const r = Math.abs(deg) <= 50 ? 12.5 : 15.5
      return new THREE.Vector3(Math.sin(a) * r, 3.0, -Math.cos(a) * r)
    })
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < posts.length - 1; i++) {
      const n = Math.round(posts[i].distanceTo(posts[i + 1]) / 0.45)
      for (let k = 1; k < n; k++) pts.push(posts[i].clone().lerp(posts[i + 1], k / n).setY(3.0 - Math.sin((k / n) * Math.PI) * 0.7))
    }
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false })
    // (they glimmer on through the Lucia procession's dark, like the trees – korsang.ts)
    mat.userData.glimmer = 0.3
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), mat, pts.length)
    const cols = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff, 0xfff1cf].map((c) => new THREE.Color(c))
    const m4 = new THREE.Matrix4()
    pts.forEach((p, i) => {
      bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z))
      bulbs.setColorAt(i, cols[i % cols.length])
    })
    bulbs.computeBoundingSphere()
    const g = keepApart(new THREE.Group())
    g.add(bulbs)
    for (let i = 0; i < posts.length - 1; i++) {
      const wire = Array.from({ length: 12 }, (_, k) => posts[i].clone().lerp(posts[i + 1], k / 11).setY(3.0 - Math.sin((k / 11) * Math.PI) * 0.7 + 0.04))
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wire), 24, 0.008, 3), std(0x1a1a1a, 0.6)))
    }
    add(1, g)
    const tint = new THREE.Color()
    let tw = 0
    updaters.push((t, dt) => {
      if (!g.visible || (tw -= dt) > 0) return
      tw = 0.15
      for (let i = 0; i < pts.length; i++) bulbs.setColorAt(i, tint.copy(cols[i % cols.length]).multiplyScalar(0.45 + 0.55 * Math.max(0, Math.sin(t * 1.3 + i * 2.1))))
      bulbs.instanceColor!.needsUpdate = true
    })
  }

  /* ---------- door 2: Tomtens mitten, dropped in the snow by his sleigh ---------- */
  {
    const g = new THREE.Group()
    g.position.set(1.4, 0, 40.2)
    const red = std(0xb3202a, 0.85)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), red)
    hand.scale.set(1, 0.45, 1.4)
    hand.position.y = 0.05
    g.add(hand)
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), red).translateX(0.08).translateY(0.05).translateZ(0.03))
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 14), std(0xfbf8f2, 0.9)).translateY(0.05).translateZ(-0.12))
    g.rotation.y = 0.7
    find('vante', 2, g, 'Plocka upp Tomtens vante', () => '🧤 Du hittade Tomtens borttappade vante!', 0.2)
  }

  /* ---------- door 3: a snowman – in what looks very like Tomtens own hat ---------- */
  {
    const g = new THREE.Group()
    g.position.set(-5.5, 0, -10.5)
    g.rotation.y = 0.6
    const snow = std(0xf4f8ff, 0.9)
    for (const [r, y] of [[0.55, 0.5], [0.42, 1.25], [0.3, 1.82]]) g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), snow).translateY(y))
    const coalMat = std(0x141416, 0.4)
    for (const x of [-0.1, 0.1]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), coalMat).translateX(x).translateY(1.9).translateZ(0.26))
    for (const y of [1.15, 1.3, 1.45]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), coalMat).translateY(y).translateZ(0.41))
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.24, 8), std(0xf07a20, 0.6))
    nose.rotation.x = Math.PI / 2
    nose.position.set(0, 1.82, 0.38)
    g.add(nose)
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.8, 5), std(0x5a3a22, 0.9))
      arm.position.set(s * 0.6, 1.4, 0)
      arm.rotation.z = s * 1.0
      g.add(arm)
    }
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 14), std(0xc8102e, 0.6))
    hat.position.set(0.03, 2.25, -0.02)
    hat.rotation.z = -0.25
    g.add(hat)
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 18), snow).translateY(2.02).rotateX(Math.PI / 2))
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), snow).translateX(0.16).translateY(2.5).translateZ(-0.02))
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.06, 8, 18), std(0x2f6fc6, 0.8)).translateY(1.58).rotateX(Math.PI / 2))
    add(3, g)
    collide(3, { x: g.position.x, z: g.position.z, r: 0.65 })
  }

  /* ---------- door 5: sooty footprints ---------- */
  {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: TRAIL.length / 2 }, (_, i) => new THREE.Vector3(TRAIL[i * 2], 0, TRAIL[i * 2 + 1])))
    const n = Math.round(curve.getLength() / 0.32)
    const prints = new THREE.InstancedMesh(new THREE.CircleGeometry(0.06, 10), new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, depthWrite: false, opacity: 0.85 }), n)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    for (let i = 0; i < n; i++) {
      const k = i / n
      const p = curve.getPointAt(k)
      const t = curve.getTangentAt(k)
      const side = i % 2 ? 1 : -1
      // (smaller and fainter as the snow covers them, out to the west)
      const s = Math.max(0.05, 1 - Math.max(0, k - 0.6) * 2.2)
      q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -Math.atan2(t.x, t.z), 'YXZ'))
      prints.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x + t.z * side * 0.09, 0.025, p.z - t.x * side * 0.09), q, new THREE.Vector3(s, s * 1.7, 1)))
    }
    add(5, keepApart(prints))
  }

  /* ---------- door 6: five gingerbread biscuits ---------- */
  const biscuit = () => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 14), std(0x9a5a2c, 0.75))
    body.rotation.x = Math.PI / 2 - 0.35
    body.position.y = 0.11
    g.add(body)
    const icing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 5, 18), std(0xfbf8f2, 0.5))
    icing.rotation.copy(body.rotation)
    icing.position.set(0, 0.11, 0.012)
    g.add(icing)
    return g
  }
  BISCUITS.forEach((p, i) => {
    const g = biscuit()
    g.position.copy(p)
    g.rotation.y = i * 1.3
    find(`pepparkaka${i}`, 6, g, 'Plocka upp pepparkakan', () => {
      const n = count('pepparkaka')
      return n >= BISCUITS.length ? '🍪 Alla fem pepparkakor! Bagarnissen blir glad.' : `🍪 En pepparkaka! (${n} av ${BISCUITS.length})`
    }, 0.28)
  })

  /* ---------- door 7: another rolled-up note, written in coal ---------- */
  {
    const g = new THREE.Group()
    g.position.set(-29.4, 0, 16.6)
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 10), std(0xe8d8b0, 0.9))
    roll.rotation.z = Math.PI / 2
    roll.position.y = 0.05
    g.add(roll)
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 5, 12), std(0x1a1612, 0.6)).translateY(0.05).rotateY(Math.PI / 2))
    find('lapp', 7, g, 'Rulla upp lappen', () => '✉️ ”Om ni vill hitta oss: lyssna där skogen tar slut i väster. Vi sjunger när vi jobbar.”', 0.2)
  }

  /* ---------- door 8: reindeer grazing in the meadow behind the shops ---------- */
  {
    const fur = std(0x7a5232, 0.85)
    const pale = std(0xe8dcc8, 0.9)
    const antler = std(0xd8c8a8, 0.7)
    const deer = (x: number, z: number, yaw: number, rudolf: boolean) => {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = yaw
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.8, 6, 10), fur)
      body.rotation.x = Math.PI / 2
      body.position.y = 0.95
      g.add(body)
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), pale).translateY(0.95).translateZ(-0.62))
      for (const lx of [-0.16, 0.16]) for (const lz of [-0.38, 0.38]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.75, 6), fur).translateX(lx).translateY(0.38).translateZ(lz))
      const neck = new THREE.Group()
      neck.position.set(0, 1.05, 0.5)
      const head = new THREE.Group()
      head.position.set(0, 0.35, 0.18)
      neck.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), fur).translateY(0.18).translateZ(0.08).rotateX(0.5))
      head.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), fur))
      head.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), fur).translateY(-0.05).translateZ(0.17))
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), rudolf ? new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }) : std(0x1a1210, 0.5))
      nose.position.set(0, -0.04, 0.27)
      head.add(nose)
      for (const s of [-1, 1]) {
        const a = new THREE.Group()
        a.position.set(s * 0.08, 0.13, -0.02)
        a.rotation.z = s * -0.5
        a.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 5), antler).translateY(0.2))
        a.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.2, 5), antler).translateY(0.28).translateZ(0.08).rotateX(0.8))
        a.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.18, 5), antler).translateY(0.15).translateZ(0.06).rotateX(1.0))
        head.add(a)
      }
      neck.add(head)
      g.add(keepApart(neck))
      add(8, g)
      collide(8, { x, z, r: 0.75 })
      let glowSprite: THREE.Sprite | null = null
      if (rudolf) {
        glowSprite = keepApart(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,60,60,0.9)', 'rgba(255,0,0,0)'), blending: THREE.AdditiveBlending, depthWrite: false })))
        glowSprite.scale.setScalar(0.5)
        glowSprite.position.set(0, -0.04, 0.3)
        head.add(glowSprite)
      }
      const phase = rnd() * 10
      updaters.push((t) => {
        if (!g.visible) return
        // grazing: head down to the snow, up to look round now and then
        const up = Math.max(0, Math.sin(t * 0.35 + phase)) ** 3
        neck.rotation.x = 1.25 * (1 - up) - 0.1
        head.rotation.y = up * Math.sin(t * 0.8 + phase) * 0.6
        if (glowSprite) glowSprite.material.opacity = 0.6 + Math.sin(t * 3) * 0.4
      })
    }
    deer(25, -26, 0.6, true)
    deer(28.5, -23.8, -2.2, false)
    deer(27, -30, 2.4, false)
  }

  /* ---------- door 10: deep voices, singing far under the ground at the west edge ---------- */
  const voices = new Playlist(3)

  /* ---------- door 11: the youngest toy nisse's dropped present, to go under the tree ---------- */
  const present = (c: number, r: number) => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.4), std(c, 0.6)).translateY(0.16))
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.33, 0.07), std(r, 0.4)).translateY(0.16))
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.33, 0.42), std(r, 0.4)).translateY(0.16))
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), std(r, 0.4)).translateY(0.34).rotateY(0.6))
    return g
  }
  const placed = present(0x2f6fc6, 0xf6c453)
  {
    const lost = present(0x2f6fc6, 0xf6c453)
    lost.position.set(15.9, 0, -3.4)
    lost.rotation.set(0.15, 0.5, 0.2)
    find('julklapp', 11, lost, 'Plocka upp julklappen', () => '🎁 Någon har tappat en julklapp! Lägg den under granen på torget.', 0.5)
    placed.position.copy(UNDER_TREE)
    placed.rotation.y = 0.4
    add(11, placed)
    spots.push({ id: 'julklapp-lagd', day: 11, at: UNDER_TREE, reach: 3, prompt: 'Lägg julklappen under granen', when: () => has('julklapp') && !has('julklapp-lagd'), act: () => (mark('julklapp-lagd'), chime(), '🎄 Julklappen ligger under granen. Leksaksnissen blir jätteglad!') })
  }

  /* ---------- door 12: fires on the square to warm yourself by ---------- */
  {
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    const fireGlow = glowTexture('rgba(255,170,70,0.9)', 'rgba(255,110,30,0)')
    for (const [x, z] of [[8.6, 9.2], [-8.8, 9.6]]) {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), std(0x6a625a, 0.9)).translateX(Math.cos(a) * 0.55).translateY(0.1).translateZ(Math.sin(a) * 0.55))
      }
      for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 7), std(0x4a3020, 0.9))
        log.rotation.set(Math.PI / 2 - 0.5, (i / 4) * Math.PI * 2, 0, 'YXZ')
        log.position.y = 0.22
        g.add(log)
      }
      const flames = keepApart(new THREE.Group())
      flames.position.y = 0.3
      const tongues = Array.from({ length: 5 }, (_, i) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.18 - i * 0.02, 0.7, 8), flameMat)
        f.position.set(Math.cos(i * 2.4) * 0.12, 0.3, Math.sin(i * 2.4) * 0.12)
        flames.add(f)
        return f
      })
      g.add(flames)
      const glow = keepApart(new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlow, blending: THREE.AdditiveBlending, depthWrite: false })))
      glow.position.y = 0.7
      glow.scale.setScalar(2.4)
      g.add(glow)
      const light = new THREE.PointLight(0xff9040, 6, 9, 1.6)
      light.position.y = 1.0
      g.add(light)
      add(12, g)
      collide(12, { x, z, r: 0.75 })
      let crackle = 0
      updaters.push((t, dt, player) => {
        if (!g.visible) return
        tongues.forEach((f, i) => {
          const k = 0.75 + Math.sin(t * (9 + i) + i * 1.7) * 0.18 + Math.sin(t * 23 + i) * 0.07
          f.scale.set(1, k, 1)
          f.position.y = 0.3 * k
        })
        light.intensity = 5.5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 29) * 0.5
        const d = Math.hypot(player.x - x, player.z - z)
        if (d < 6 && (crackle -= dt) <= 0) {
          crackle = 0.15 + Math.random() * 0.6
          noise(0.05, 2500 + Math.random() * 2000, 900, 0.05 * (1 - d / 6), 2.5)
        }
      })
    }
  }

  /* ---------- door 14: the yard tree's star is gone – found by the firs in the west, to go back ---------- */
  {
    // and by the yard tree, a broken bit of a sooty miner's lamp
    const bit = new THREE.Group()
    bit.position.set(-6.4, 0, -57.2)
    bit.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.07, 10, 1, true, 0, 4), std(0x2a2a2e, 0.5, 0.6)).translateY(0.04).rotateZ(1.2))
    bit.add(new THREE.Mesh(new THREE.CircleGeometry(0.05, 10, 0, 3), new THREE.MeshStandardMaterial({ color: 0xfff2c8, roughness: 0.2, transparent: true, opacity: 0.7, side: THREE.DoubleSide })).translateY(0.05).rotateX(-1.2))
    add(14, bit)
    const lost = new THREE.Group()
    lost.position.set(-36.2, 0, -10.6)
    const shape = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.1 : 0.24
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    const st = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false }))
    st.rotation.set(-1.2, 0, 0.4)
    st.position.y = 0.08
    lost.add(st)
    find('stjarna', 14, lost, 'Plocka upp stjärnan', () => '⭐ Gårdsgranens stjärna! Bär den tillbaka till granen på Leksaksfabrikens gård.', 0.3)
    spots.push({ id: 'stjarna-satt', day: 14, at: new THREE.Vector3(-13.5, 0, -59), reach: 8.5, prompt: 'Sätt tillbaka stjärnan i granen', when: () => has('stjarna') && !has('stjarna-satt'), act: () => (mark('stjarna-satt'), chime(), '🌟 Stjärnan lyser i granens topp igen!') })
  }

  /* ---------- door 16: a Christmas market, with a glögg stall ---------- */
  {
    const stalls: [string, number, number, number][] = [['GLÖGG', -10.9, 15.6, 0xb3202a], ['PEPPARKAKOR', -15.6, 10.9, 0x1d6e48], ['LJUS & KRANSAR', -18.4, 4.9, 0x1f3a8a]]
    for (const [name, x, z, c] of stalls) {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      g.rotation.y = Math.atan2(-x, -z)
      const wood = std(0x7a5232, 0.85)
      g.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.8), wood).translateY(0.45))
      g.add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 0.9), std(0xf4f8ff, 0.9)).translateY(0.93))
      for (const sx of [-1.05, 1.05]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), wood).translateX(sx).translateY(1.15).translateZ(-0.35))
      // a striped awning
      for (let i = 0; i < 6; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(2.4 / 6, 0.05, 1.2), std(i % 2 ? 0xfbf8f2 : c, 0.7))
        strip.position.set(-1.0 + i * 0.4, 2.3, 0)
        strip.rotation.x = 0.25
        g.add(strip)
      }
      const [sc, sctx] = makeCanvas(256, 64)
      sctx.fillStyle = '#3a2614'
      sctx.fillRect(0, 0, 256, 64)
      sctx.fillStyle = '#f6c453'
      sctx.font = 'bold 30px Georgia, serif'
      sctx.textAlign = 'center'
      sctx.fillText(name, 128, 42)
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: toTexture(sc), roughness: 0.8 })).translateY(1.95).translateZ(0.56))
      if (name === 'GLÖGG') {
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.3, 14), std(0x2a2a2e, 0.4, 0.6)).translateY(1.1))
        const steam = keepApart(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,0.35)', 'rgba(255,255,255,0)'), depthWrite: false, transparent: true })))
        steam.position.y = 1.5
        g.add(steam)
        updaters.push((t) => {
          const k = (t * 0.5) % 1
          steam.position.y = 1.35 + k * 0.6
          steam.scale.setScalar(0.4 + k * 0.5)
          steam.material.opacity = 0.8 * (1 - k)
        })
        for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 10), std(0xb3202a, 0.5)).translateX(0.4 + i * 0.12).translateY(1.0).translateZ(0.2))
      } else if (name === 'PEPPARKAKOR') {
        for (let i = 0; i < 7; i++) {
          const b = biscuit()
          b.position.set(-0.7 + i * 0.22, 0.86, 0.1)
          g.add(b)
        }
      } else {
        for (let i = 0; i < 5; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), std([0xfbf8f2, 0xb3202a, 0xf6c453][i % 3], 0.5)).translateX(-0.6 + i * 0.25).translateY(1.07).translateZ(0.1))
        g.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 18), std(0x1d5236, 0.9)).translateX(0.7).translateY(1.6).translateZ(0.2))
      }
      // the stallholder
      const n = new Nisse({ coat: c, hat: 0xc8102e, trim: true, scale: 0.85 })
      n.group.position.set(0, 0, -0.75)
      mergeRigid(n.group)
      g.add(n.group)
      add(16, g)
      collide(16, { x, z, r: 1.15 })
      if (name === 'GLÖGG') {
        g.updateMatrixWorld(true)
        spots.push({ id: 'glogg', day: 16, at: g.localToWorld(new THREE.Vector3(0, 0, 1.1)), reach: 1.8, prompt: 'Köp en kopp glögg', act: () => (noise(0.25, 400, 300, 0.1, 1), '☕ Mmm, varm glögg med russin och mandel!') })
      }
    }
  }

  /* ---------- door 17: something old Sixten has lost, deep in the mine (picked up there) ---------- */
  let pipe: THREE.Object3D | null = null
  function attachMine(mineScene: THREE.Scene) {
    // his old pipe, dropped among the crystals
    const g = new THREE.Group()
    g.position.set(2.2, 0, -67.8)
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 10), std(0x5a3a22, 0.7)).translateY(0.05))
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.18, 6), std(0x2a1a10, 0.6))
    stem.rotation.z = Math.PI / 2 - 0.3
    stem.position.set(0.1, 0.06, 0)
    g.add(stem)
    const spark = twinkle(g, 0.2)
    mineScene.add(g)
    pipe = g
    spots.push({ id: 'pipa', day: 17, at: g.position.clone(), reach: 1.4, prompt: 'Plocka upp den gamla pipan', mine: true, mesh: g, spark, when: () => !has('pipa'), act: () => (mark('pipa'), chime(), '🎣 En gammal pipa … är det inte Gamle Sot-Sixtens?') })
    show()
  }

  /* ---------- door 18: three little tomtenissar, hiding ---------- */
  HIDERS.forEach((p, i) => {
    const n = new Nisse({ coat: [0xb3202a, 0x1d6e48, 0x1f3a8a][i], hat: 0xc8102e, trim: true, scale: 0.32 })
    n.group.position.copy(p)
    n.setYaw(rnd() * 6)
    mergeRigid(n.group)
    find(`tomtenisse${i}`, 18, n.group, 'Där är en tomtenisse!', () => {
      const k = count('tomtenisse')
      return k >= HIDERS.length ? '🧑‍🎄 Alla tre tomtenissarna hittade!' : `🧑‍🎄 ”Hittad!” fnissar tomtenissen. (${k} av ${HIDERS.length})`
    }, 0.6)
  })

  /* ---------- door 20: a stronger aurora, and stars falling ---------- */
  const meteor = keepApart(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.0, 9, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, depthWrite: false, fog: false })))
  add(20, meteor)
  let meteorT = 0
  let meteorFrom = new THREE.Vector3()
  let meteorDir = new THREE.Vector3()
  updaters.push((_t, dt, player) => {
    if (!meteor.visible) return
    meteorT -= dt
    if (meteorT < -0.9) {
      meteorT = 4 + Math.random() * 6
      const a = Math.random() * Math.PI * 2
      meteorFrom = new THREE.Vector3(player.x + Math.cos(a) * 60, 55 + Math.random() * 20, player.z + Math.sin(a) * 60)
      meteorDir = new THREE.Vector3(-Math.cos(a) + (Math.random() - 0.5), -0.35, -Math.sin(a) + (Math.random() - 0.5)).normalize()
      meteor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), meteorDir.clone().negate())
    }
    const k = THREE.MathUtils.clamp(-meteorT / 0.9, 0, 1)
    meteor.position.copy(meteorFrom).addScaledVector(meteorDir, k * 45)
    ;(meteor.material as THREE.MeshBasicMaterial).opacity = meteorT < 0 ? Math.sin(k * Math.PI) : 0
  })

  /* ---------- door 21: lanterns to light, the way the miners will come ---------- */
  const lanternMats: THREE.MeshBasicMaterial[] = []
  const lanternGlow = glowTexture('rgba(255,200,120,0.85)', 'rgba(255,150,60,0)')
  const lanternSprites: THREE.Sprite[] = []
  LANTERNS.forEach(([x, z], i) => {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6), std(0x15151c, 0.5, 0.6)).translateY(0.6))
    const m = new THREE.MeshBasicMaterial({ color: 0x2a2014, toneMapped: false })
    m.userData.glimmer = 0.4
    lanternMats.push(m)
    g.add(keepApart(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), m)).translateY(1.33))
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.14, 4), std(0x15151c, 0.5, 0.6)).translateY(1.53).rotateY(Math.PI / 4))
    const s = keepApart(new THREE.Sprite(new THREE.SpriteMaterial({ map: lanternGlow, blending: THREE.AdditiveBlending, depthWrite: false })))
    s.position.y = 1.33
    s.scale.setScalar(1.3)
    g.add(s)
    lanternSprites.push(s)
    add(21, g)
    collide(21, { x, z, r: 0.15 })
    spots.push({
      id: `lykta${i}`, day: 21, at: g.position.clone(), reach: 1.6, prompt: 'Tänd lyktan', when: () => !has(`lykta${i}`),
      act: () => {
        mark(`lykta${i}`)
        noise(0.2, 2000, 600, 0.08, 1)
        const k = count('lykta')
        return k >= LANTERNS.length ? '🏮 Alla lyktor lyser! Nu hittar gruvnissarna vägen.' : `🏮 Lyktan lyser. (${k} av ${LANTERNS.length})`
      },
    })
  })

  /* ---------- door 23: a julbord in Leksaksfabriken's hall ---------- */
  {
    const g = new THREE.Group()
    g.position.set(0, 0, -79.8)
    g.add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.08, 1.4), std(0xfbf8f2, 0.8)).translateY(0.82))
    g.add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.02, 0.4), std(0xb3202a, 0.7)).translateY(0.87))
    for (const x of [-2.8, 2.8]) for (const z of [-0.6, 0.6]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), std(0x5a3a22, 0.8)).translateX(x).translateY(0.4).translateZ(z))
    // the ham in the middle, bowls of meatballs, herring, rice pudding and gingerbread, plates and candles
    const ham = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), std(0xc87a5a, 0.6))
    ham.scale.set(1.3, 0.7, 1)
    ham.position.set(0, 1.05, 0)
    g.add(ham)
    for (const [x, c] of [[-1.6, 0x8a4a2a], [-0.9, 0xe8d8b0], [0.9, 0xfbf8f2], [1.6, 0x9a5a2c]] as const) {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.06, 16), std(0xfbf8f2, 0.3)).translateX(x).translateY(0.9))
      for (let i = 0; i < 7; i++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std(c, 0.7)).translateX(x + Math.cos(i) * 0.12).translateY(0.96).translateZ(Math.sin(i) * 0.12))
    }
    const flame = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false })
    for (const x of [-2.4, -0.5, 0.5, 2.4]) {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8), std(0xfbf8f2, 0.5)).translateX(x).translateY(1.0).translateZ(0.45))
      g.add(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 6), flame).translateX(x).translateY(1.15).translateZ(0.45))
    }
    for (let i = 0; i < 12; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 14), std(0xfbf8f2, 0.3)).translateX(-2.5 + (i % 6) * 1.0).translateY(0.87).translateZ(i < 6 ? -0.5 : 0.5))
    add(23, g)
    collide(23, { x: -1.5, z: -79.8, r: 1.4 })
    collide(23, { x: 1.5, z: -79.8, r: 1.4 })
  }

  /* ---------- door 24: julafton – a present for you under the tree, and the miners up on the square ---------- */
  {
    const gift = present(0xb3202a, 0xf6c453)
    gift.scale.setScalar(1.5)
    gift.position.copy(GIFT_AT)
    gift.rotation.y = -0.4
    // a label with your name on it
    const [lc, lctx] = makeCanvas(256, 96)
    const labelTex = toTexture(lc, { live: true })
    const label = keepApart(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.8 })))
    label.position.set(0, 0.24, 0.215)
    gift.add(label)
    let labelled = ''
    updaters.push(() => {
      const name = myName() || 'dig'
      if (name === labelled) return
      labelled = name
      lctx.fillStyle = '#fbf3e0'
      lctx.fillRect(0, 0, 256, 96)
      lctx.fillStyle = '#8a1a1e'
      lctx.font = 'bold 34px Georgia, serif'
      lctx.textAlign = 'center'
      lctx.fillText(`Till ${name}`, 128, 60)
      labelTex.needsUpdate = true
    })
    find('julklapp24', 24, gift, 'Öppna din julklapp från Tomten', () => {
      for (let i = 0; i < 8; i++) setTimeout(() => blip(700 + Math.random() * 900, 0.08, 'triangle', 0.05), i * 70)
      return `🎁 God jul, ${myName() || 'du'}! I paketet ligger en liten bit guldkol 🪙 – gruvnissarnas allra första julklapp, och den ger de till dig.`
    }, 0.7)
    // the miners, up out of the stump for once, dancing round the tree
    for (let i = 0; i < 6; i++) {
      const a = THREE.MathUtils.degToRad(235 + i * 16)
      const x = Math.sin(a) * 5.0
      const z = -Math.cos(a) * 5.0
      const n = new Nisse({ coat: [0x2a2420, 0x34302c, 0x2b2f36][i % 3], hat: [0x3a1010, 0x1e2530, 0x2a2a2a][i % 3], pants: 0x1a1816, skin: 0xb59a86, beardColor: 0x2a2622, scale: 0.85, longBeard: i % 2 === 0, trim: false })
      n.group.position.set(x, 0, z)
      n.setYaw(Math.atan2(-x, -z) + Math.PI)
      mergeRigid(n.group)
      keepApart(n.armR)
      keepApart(n.armL)
      add(24, n.group)
      collide(24, { x, z, r: 0.4 })
      const phase = i * 1.3
      updaters.push((t) => {
        if (!n.group.visible) return
        n.armR.rotation.z = -2.4 + Math.sin(t * 4 + phase) * 0.4
        n.armL.rotation.z = 2.4 - Math.sin(t * 4 + phase + 1) * 0.4
        n.body.position.y = Math.abs(Math.sin(t * 4 + phase)) * 0.12
      })
    }
  }

  /* ---------- showing it all by the day ---------- */
  function show() {
    // (open is 0 outside the calendar's season, so nothing shows then)
    const { open } = today()
    for (const [day, objs] of byDay) for (const o of objs) o.visible = open >= day
    for (const c of colliders) c.r = open >= colliderDay.get(c)! ? Math.abs(c.r) : -Math.abs(c.r)
    for (const s of spots) if (s.mesh) s.mesh.visible = open >= s.day && (!s.when || s.when())
    placed.visible = open >= 11 && has('julklapp-lagd')
    if (pipe) pipe.visible = open >= 17 && !has('pipa')
    // the yard tree's star: away from door 14 until you've put it back
    if (yardTree.star) yardTree.star.visible = !(open >= 14 && !has('stjarna-satt'))
    lanternMats.forEach((m, i) => m.color.set(has(`lykta${i}`) ? 0xffc070 : 0x2a2014))
    lanternSprites.forEach((s, i) => (s.visible = has(`lykta${i}`)))
  }
  show()

  /** Something to do right by you (at about your height): up in the village, or down in the mine. */
  function near(pos: THREE.Vector3, feet: number, inMine = false): Act | null {
    const { open } = today()
    let found: Spot | null = null
    let bestD = Infinity
    for (const s of spots) {
      if (!!s.mine !== inMine || open < s.day || (s.when && !s.when())) continue
      const d = Math.hypot(s.at.x - pos.x, s.at.z - pos.z)
      if (d < s.reach && d < bestD && Math.abs(s.at.y - feet) < 1) {
        found = s
        bestD = d
      }
    }
    return found ? { prompt: found.prompt, act: found.act } : null
  }

  /** Talking to old Sixten with his pipe in your pocket: give it back (true if you did). */
  function givePipe() {
    if (!has('pipa') || has('pipa-tillbaka')) return false
    mark('pipa-tillbaka')
    chime()
    return true
  }

  /** How it's going with a door's task, for its chapter. */
  function status(day: number) {
    const k = (prefix: string, n: number, all: string) => (count(prefix) >= n ? all : `Hittills: ${count(prefix)} av ${n}`)
    switch (day) {
      case 2: return has('vante') ? '✅ Du har hittat vanten!' : ''
      case 4: return has('gata') ? '✅ Rätt svar!' : ''
      case 6: return k('pepparkaka', BISCUITS.length, '✅ Du har hittat alla fem!')
      case 7: return has('lapp') ? '✅ ”Lyssna där skogen tar slut i väster. Vi sjunger när vi jobbar.”' : ''
      case 9: return best('jul3d.stampla') >= 30 ? '✅ Klarat!' : `Ditt rekord: ${best('jul3d.stampla')}`
      case 11: return has('julklapp-lagd') ? '✅ Julklappen ligger under granen!' : has('julklapp') ? 'Lägg julklappen under granen på torget.' : ''
      case 14: return has('stjarna-satt') ? '✅ Stjärnan är tillbaka i granen!' : has('stjarna') ? 'Bär stjärnan till granen på fabriksgården.' : ''
      case 15: return has('forman') ? '✅ Du har pratat med förmannen.' : ''
      case 17: return has('pipa-tillbaka') ? '✅ Sixten har fått tillbaka sin pipa!' : has('pipa') ? 'Ge pipan till Gamle Sot-Sixten vid Svartsjön.' : ''
      case 18: return k('tomtenisse', HIDERS.length, '✅ Alla tre hittade!')
      case 19: return best(BEST_M_KEY) >= 500 ? '✅ Klarat!' : `Längst hittills: ${best(BEST_M_KEY)} m`
      case 21: return k('lykta', LANTERNS.length, '✅ Alla lyktor lyser!')
      case 22: return best('jul3d.best.kolhackning') >= 60 ? '✅ Klarat!' : `Ditt rekord: ${best('jul3d.best.kolhackning')} kol`
      case 24: return has('julklapp24') ? '✅ Du har öppnat din julklapp!' : ''
      default: return ''
    }
  }

  let check = 0
  function update(t: number, dt: number, player: THREE.Vector3, enabled: boolean, aurora: (boost: number) => void) {
    if ((check -= dt) <= 0) {
      check = 5
      load()
      show()
    }
    const { open } = today()
    aurora(open >= 20 ? 2.2 : 1)
    for (const u of updaters) u(t, dt, player)
    for (const s of spots) if (s.spark && s.mesh?.visible) s.spark.scale.setScalar(0.3 + Math.sin(t * 4 + s.at.x) * 0.08)
    // door 10: in the stump's corner of the village, if you stand and listen, deep voices below
    const d = Math.hypot(player.x - STUMP.x, player.z - STUMP.z)
    const vol = enabled && open >= 10 && d < 16 ? 0.2 * (1 - d / 16) ** 1.5 : 0
    if (vol > 0.003) {
      voices.start(['/sounds/kor/pramdragarna.mp3'])
      voices.level(vol)
    } else if (voices.playing) {
      voices.level(0.0001)
      if (d > 18 || !enabled) voices.stop()
    }
  }
  /** Quiet up here (down in the mine, or away on a ride). */
  const hush = () => {
    if (voices.playing) voices.stop()
  }

  return { colliders, update, near, status, has, mark, attachMine, givePipe, hush }
}
