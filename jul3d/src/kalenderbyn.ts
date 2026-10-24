// What the calendar's doors bring to the village: from each door's day on (until the calendar comes
// down after tjugondag Knut) it's there for everyone – string lights over the square, a snowman,
// sooty footprints, fires to warm yourself by – and the things to find: Tomtens lost mitten, five
// gingerbread biscuits hidden about the place. What you've found is kept in this browser.
import * as THREE from 'three'
import { keepApart, mergeRigid } from './batch'
import { today } from './julkalender'
import { blip, noise } from './sfx'
import { glowTexture } from './tex'
import type { Circle } from './world'

const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

/** Something to pick up, from `day` on: where it lies (and how high – one is up on a gallery). */
type Find = { id: string; day: number; at: THREE.Vector3; prompt: string; found: string; mesh: THREE.Object3D; spark: THREE.Sprite }

/** The gingerbread biscuits for door 6: behind the poster column, by two firs, up on the factory's gallery, and in its yard. */
const BISCUITS = [
  new THREE.Vector3(-7.9, 0, 19.7),
  new THREE.Vector3(17.5, 0, 33.9),
  new THREE.Vector3(-36.6, 0, 5.2),
  new THREE.Vector3(-16.2, 5.675, -88),
  new THREE.Vector3(23.5, 0, -60.5),
]
/** Door 5: sooty footprints from Leksaksfabriken off across the yard to the west – and then nothing. */
const TRAIL = [new THREE.Vector3(-2.2, 0, -64.5), new THREE.Vector3(-6, 0, -62.5), new THREE.Vector3(-10, 0, -60.8), new THREE.Vector3(-14.5, 0, -58.2), new THREE.Vector3(-19, 0, -55.5), new THREE.Vector3(-23, 0, -53.6)]

export function buildCalendarVillage(scene: THREE.Scene) {
  const colliders: Circle[] = []
  /** Which door each collider comes with. */
  const colliderDay = new Map<Circle, number>()
  const collide = (day: number, c: Circle) => {
    colliders.push(c)
    colliderDay.set(c, day)
  }
  const byDay = new Map<number, THREE.Object3D[]>()
  const add = (day: number, o: THREE.Object3D) => {
    scene.add(o)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(o)
    return o
  }
  const updaters: ((t: number, dt: number, player: THREE.Vector3) => void)[] = []

  /* door 1: string lights strung between the lamp posts round the square */
  {
    const posts = [-150, -112, -50, -17, 17, 50, 112, 150].map((deg) => {
      const a = THREE.MathUtils.degToRad(deg)
      const r = Math.abs(deg) <= 50 ? 12.5 : 15.5
      return new THREE.Vector3(Math.sin(a) * r, 3.0, -Math.cos(a) * r)
    })
    const spots: THREE.Vector3[] = []
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i]
      const b = posts[i + 1]
      const n = Math.round(a.distanceTo(b) / 0.45)
      for (let k = 1; k < n; k++) {
        const f = k / n
        spots.push(a.clone().lerp(b, f).setY(3.0 - Math.sin(f * Math.PI) * 0.7))
      }
    }
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false })
    // (they glimmer on through the Lucia procession's dark, like the trees – korsang.ts)
    mat.userData.glimmer = 0.3
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), mat, spots.length)
    const cols = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff, 0xfff1cf].map((c) => new THREE.Color(c))
    const m4 = new THREE.Matrix4()
    spots.forEach((p, i) => {
      bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z))
      bulbs.setColorAt(i, cols[i % cols.length])
    })
    bulbs.computeBoundingSphere()
    const g = keepApart(new THREE.Group())
    g.add(bulbs)
    // the wire
    for (let i = 0; i < posts.length - 1; i++) {
      const pts = Array.from({ length: 12 }, (_, k) => posts[i].clone().lerp(posts[i + 1], k / 11).setY(3.0 - Math.sin((k / 11) * Math.PI) * 0.7 + 0.04))
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 3), std(0x1a1a1a, 0.6)))
    }
    add(1, g)
    const tint = new THREE.Color()
    let tw = 0
    updaters.push((t, dt) => {
      if ((tw -= dt) > 0) return
      tw = 0.15
      for (let i = 0; i < spots.length; i++) bulbs.setColorAt(i, tint.copy(cols[i % cols.length]).multiplyScalar(0.45 + 0.55 * Math.max(0, Math.sin(t * 1.3 + i * 2.1))))
      bulbs.instanceColor!.needsUpdate = true
    })
  }

  /* door 3: a snowman on the square – wearing what looks very like Tomtens own hat */
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
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.06, 8, 18), std(0x2f6fc6, 0.8))
    scarf.rotation.x = Math.PI / 2
    scarf.position.y = 1.58
    g.add(scarf)
    add(3, g)
    collide(3, { x: g.position.x, z: g.position.z, r: 0.65 })
  }

  /* door 5: sooty footprints */
  {
    const pts: { x: number; z: number; yaw: number; side: number; fade: number }[] = []
    const curve = new THREE.CatmullRomCurve3(TRAIL)
    const len = curve.getLength()
    const n = Math.round(len / 0.32)
    for (let i = 0; i < n; i++) {
      const k = i / n
      const p = curve.getPointAt(k)
      const t = curve.getTangentAt(k)
      const side = i % 2 ? 1 : -1
      pts.push({ x: p.x + t.z * side * 0.09, z: p.z - t.x * side * 0.09, yaw: Math.atan2(t.x, t.z), side, fade: k })
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, depthWrite: false, opacity: 0.85 })
    const prints = new THREE.InstancedMesh(new THREE.CircleGeometry(0.06, 10), mat, pts.length)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    pts.forEach((p, i) => {
      // (smaller and fainter as the snow covers them, out to the west)
      const s = 1 - Math.max(0, p.fade - 0.6) * 2.2
      q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -p.yaw, 'YXZ'))
      prints.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, 0.025, p.z), q, new THREE.Vector3(Math.max(0.05, s), Math.max(0.05, s) * 1.7, 1)))
    })
    add(5, keepApart(prints))
  }

  /* door 12: fires on the square to warm yourself by */
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
      mergeRigid(g)
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
        // the crackle, when you're close
        const d = Math.hypot(player.x - x, player.z - z)
        if (d < 6 && (crackle -= dt) <= 0) {
          crackle = 0.15 + Math.random() * 0.6
          noise(0.05, 2500 + Math.random() * 2000, 900, 0.05 * (1 - d / 6), 2.5)
        }
      })
    }
  }

  /* the things to find */
  const finds: Find[] = []
  const sparkle = glowTexture('rgba(255,245,210,0.85)', 'rgba(255,220,140,0)')
  const twinkle = (o: THREE.Object3D, y: number) => {
    const s = keepApart(new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkle, blending: THREE.AdditiveBlending, depthWrite: false })))
    s.position.y = y
    s.scale.setScalar(0.35)
    o.add(s)
    return s
  }
  // door 2: Tomtens mitten, dropped in the snow by his sleigh
  {
    const g = new THREE.Group()
    g.position.set(1.4, 0, 40.2)
    const red = std(0xb3202a, 0.85)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), red)
    hand.scale.set(1, 0.45, 1.4)
    hand.position.y = 0.05
    g.add(hand)
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), red)
    thumb.position.set(0.08, 0.05, 0.03)
    g.add(thumb)
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 14), std(0xfbf8f2, 0.9))
    cuff.position.set(0, 0.05, -0.12)
    g.add(cuff)
    g.rotation.y = 0.7
    const spark = twinkle(g, 0.2)
    add(2, g)
    finds.push({ id: 'vante', day: 2, at: g.position.clone(), prompt: 'Plocka upp Tomtens vante', found: '🧤 Du hittade Tomtens borttappade vante!', mesh: g, spark })
  }
  // door 6: five gingerbread biscuits
  BISCUITS.forEach((p, i) => {
    const g = new THREE.Group()
    g.position.copy(p)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 14), std(0x9a5a2c, 0.75))
    body.rotation.x = Math.PI / 2 - 0.35
    body.position.y = 0.11
    g.add(body)
    const icing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 5, 18), std(0xfbf8f2, 0.5))
    icing.rotation.copy(body.rotation)
    icing.position.set(0, 0.11, 0.012)
    g.add(icing)
    g.rotation.y = i * 1.3
    const spark = twinkle(g, 0.28)
    add(6, g)
    finds.push({ id: `pepparkaka${i}`, day: 6, at: p.clone(), prompt: 'Plocka upp pepparkakan', found: '', mesh: g, spark })
  })

  /* what you've found */
  const key = () => `jul3d.kalender.${today().year}.hittat`
  const found = (): Set<string> => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key()) ?? '[]'))
    } catch {
      return new Set()
    }
  }
  function show() {
    // (open is 0 outside the calendar's season, so nothing shows then)
    const { open } = today()
    for (const [day, objs] of byDay) for (const o of objs) o.visible = open >= day
    for (const c of colliders) c.r = open >= colliderDay.get(c)! ? Math.abs(c.r) : -Math.abs(c.r)
    const f = found()
    for (const x of finds) x.mesh.visible = open >= x.day && !f.has(x.id)
  }
  show()

  /** Something to pick up right by you (at about your height). */
  function near(pos: THREE.Vector3, feet: number) {
    for (const x of finds) {
      if (!x.mesh.visible) continue
      if (Math.hypot(x.at.x - pos.x, x.at.z - pos.z) < 1.3 && Math.abs(x.at.y - feet) < 1) return x
    }
    return null
  }
  /** Pick it up: what to say about it. */
  function take(x: Find) {
    const f = found()
    f.add(x.id)
    try {
      localStorage.setItem(key(), JSON.stringify([...f]))
    } catch {
      /* fine */
    }
    x.mesh.visible = false
    ;[988, 1319, 1568].forEach((h, i) => setTimeout(() => blip(h, 0.1, 'triangle', 0.05), i * 80))
    if (x.id.startsWith('pepparkaka')) {
      const n = [...f].filter((id) => id.startsWith('pepparkaka')).length
      return n >= BISCUITS.length ? '🍪 Alla fem pepparkakor! Bagarnissen blir glad.' : `🍪 En pepparkaka! (${n} av ${BISCUITS.length})`
    }
    return x.found
  }
  /** How it's going with a door's task, for its chapter. */
  function status(day: number) {
    const f = found()
    if (day === 2) return f.has('vante') ? '✅ Du har hittat vanten!' : ''
    if (day === 6) {
      const n = [...f].filter((id) => id.startsWith('pepparkaka')).length
      return n >= BISCUITS.length ? '✅ Du har hittat alla fem!' : `Hittade hittills: ${n} av ${BISCUITS.length}`
    }
    return ''
  }

  let check = 0
  function update(t: number, dt: number, player: THREE.Vector3) {
    if ((check -= dt) <= 0) {
      check = 5
      show()
    }
    for (const u of updaters) u(t, dt, player)
    for (const x of finds) if (x.mesh.visible) x.spark.scale.setScalar(0.3 + Math.sin(t * 4 + x.at.x) * 0.08)
  }

  return { colliders, update, near, take, status }
}
