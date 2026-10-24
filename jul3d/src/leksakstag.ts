// A toy train going round the big julgran on the square: a ring of track just outside the gifts,
// a little red engine puffing smoke and three wagons (presents, kola, a nisse waving from the last).
import * as THREE from 'three'
import { Nisse } from './npc'
import { blip, noise } from './sfx'
import { std } from './sleigh'
import { glowTexture } from './tex'

/** Radius of the track (the tree's gifts stand at 3.3 m). */
export const TRACK_R = 4.0
const GAUGE = 0.22
const SPEED = 0.9 // m/s
const GAP = 0.62 // between cars, along the track

export function buildToyTrain(scene: THREE.Scene) {
  /* ---------- the track (stands still, so it's baked with the rest) ---------- */
  const track = new THREE.Group()
  const steel = std(0x9aa0aa, 0.35, 0.8)
  for (const r of [TRACK_R - GAUGE / 2, TRACK_R + GAUGE / 2]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 6, 128), steel)
    rail.rotation.x = -Math.PI / 2
    rail.position.y = 0.06
    track.add(rail)
  }
  const SLEEPERS = 84
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.03, GAUGE + 0.14), std(0x5a3a22, 0.9), SLEEPERS)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  for (let i = 0; i < SLEEPERS; i++) {
    const a = (i / SLEEPERS) * Math.PI * 2
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)
    m4.compose(new THREE.Vector3(Math.cos(a) * TRACK_R, 0.03, Math.sin(a) * TRACK_R), q, new THREE.Vector3(1, 1, 1))
    sleepers.setMatrixAt(i, m4)
  }
  track.add(sleepers)
  scene.add(track)

  /* ---------- the train (built facing +x) ---------- */
  const red = std(0xc8242c, 0.45, 0.1)
  const black = std(0x1c1c22, 0.5, 0.3)
  const gold = std(0xe2b23a, 0.3, 0.8)
  const wheelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14)
  const wheels = (g: THREE.Group, xs: number[], mat: THREE.Material) => {
    for (const x of xs)
      for (const z of [-GAUGE / 2, GAUGE / 2]) {
        const w = new THREE.Mesh(wheelGeo, mat)
        w.rotation.x = Math.PI / 2
        w.position.set(x, 0.12, z)
        g.add(w)
      }
  }

  const engine = new THREE.Group()
  engine.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.26), black).translateY(0.17))
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 18), red)
  boiler.rotation.z = Math.PI / 2
  boiler.position.set(0.08, 0.3, 0)
  engine.add(boiler)
  for (const x of [-0.04, 0.12]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.104, 0.025, 18), gold)
    band.rotation.z = Math.PI / 2
    band.position.set(x, 0.3, 0)
    engine.add(band)
  }
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), black)
  face.rotation.z = Math.PI / 2
  face.position.set(0.26, 0.3, 0)
  engine.add(face)
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c0, toneMapped: false }))
  lamp.position.set(0.27, 0.42, 0)
  engine.add(lamp)
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.14, 12), black)
  chimney.position.set(0.18, 0.46, 0)
  engine.add(chimney)
  engine.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), gold).translateX(0.02).translateY(0.41))
  // the cab, with a roof
  engine.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.24), red).translateX(-0.17).translateY(0.31))
  engine.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.3), black).translateX(-0.17).translateY(0.435))
  for (const z of [-0.121, 0.121]) engine.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.005), new THREE.MeshBasicMaterial({ color: 0xffd98a, toneMapped: false })).translateX(-0.17).translateY(0.35).translateZ(z))
  // cowcatcher
  const catcher = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 4), gold)
  catcher.rotation.set(0, Math.PI / 4, -Math.PI / 2)
  catcher.scale.set(1, 1, 1.4)
  catcher.position.set(0.31, 0.14, 0)
  engine.add(catcher)
  wheels(engine, [-0.17, 0.0, 0.17], red)

  const wagon = (body: number, load: (g: THREE.Group) => void) => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.24), black).translateY(0.17))
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.22), std(body, 0.5)).translateY(0.26))
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.23), gold).translateY(0.33))
    wheels(g, [-0.13, 0.13], black)
    load(g)
    return g
  }
  const giftCols = [0xe5383b, 0xf6c453, 0x4a7bd0, 0xfff3dc, 0x2fa36b]
  const presents = wagon(0x2a8a54, (g) => {
    for (let i = 0; i < 4; i++) {
      const s = 0.09 + (i % 2) * 0.03
      const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), std(giftCols[i], 0.6))
      b.position.set(-0.12 + i * 0.08, 0.34 + s / 2 + (i === 2 ? 0.07 : 0), (i % 2 ? 1 : -1) * 0.04)
      b.rotation.y = i * 0.7
      g.add(b)
    }
  })
  const candy = wagon(0x2f5fb0, (g) => {
    // a load of kola and polkagrisar
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), std(i % 2 ? 0xf2f0ea : 0xd22a35, 0.4))
      c.rotation.set(Math.PI / 2, 0, (i - 3) * 0.25)
      c.position.set(-0.15 + i * 0.05, 0.37, 0)
      g.add(c)
    }
  })
  const rider = new Nisse({ coat: 0xc8242c, hat: 0xc8242c, scale: 0.36 })
  const last = wagon(0xd8a32a, (g) => {
    rider.group.position.set(0, 0.2, 0)
    rider.setYaw(Math.PI / 2)
    g.add(rider.group)
  })

  const train = new THREE.Group()
  const cars = [engine, presents, candy, last]
  train.add(...cars)
  for (const c of cars) c.traverse((o) => (o.castShadow = true))
  scene.add(train)

  // puffs of smoke from the chimney
  const smokeMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(235,238,245,0.9)', 'rgba(235,238,245,0)'), transparent: true, depthWrite: false })
  const puffs = Array.from({ length: 10 }, () => {
    const s = new THREE.Sprite(smokeMat.clone())
    s.visible = false
    scene.add(s)
    return { s, age: 9 }
  })
  let puffAt = 0
  let next = 0
  const chim = new THREE.Vector3()

  let angle = 0.6
  let chuff = 0
  let whistled = -99
  const place = (car: THREE.Object3D, a: number) => {
    car.position.set(Math.cos(a) * TRACK_R, 0, Math.sin(a) * TRACK_R)
    // moving with growing a: forward is (-sin a, cos a); the cars are built facing +x
    car.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a))
  }

  function update(t: number, dt: number, player: THREE.Vector3) {
    angle += (SPEED / TRACK_R) * dt
    cars.forEach((c, i) => place(c, angle - (i * GAP) / TRACK_R))
    // the nisse at the back waves at whoever's close
    const d = Math.hypot(engine.position.x - player.x, engine.position.z - player.z)
    rider.armR.rotation.z = d < 5 ? -2.5 + Math.sin(t * 7) * 0.4 : -0.2

    // smoke
    if (t > next) {
      next = t + 0.35
      const p = puffs[puffAt++ % puffs.length]
      engine.updateMatrixWorld()
      chim.set(0.18, 0.55, 0).applyMatrix4(engine.matrixWorld)
      p.s.position.copy(chim)
      p.age = 0
      p.s.visible = true
    }
    for (const p of puffs) {
      if (!p.s.visible) continue
      p.age += dt
      if (p.age > 2) {
        p.s.visible = false
        continue
      }
      p.s.position.y += dt * 0.35
      p.s.scale.setScalar(0.12 + p.age * 0.22)
      p.s.material.opacity = 0.8 * (1 - p.age / 2)
    }

    // tuff-tuff when you're near, and a whistle now and then
    if (d < 7) {
      chuff -= dt
      if (chuff <= 0) {
        chuff = 0.3
        noise(0.07, 1400, 500, 0.02 * (1 - d / 7))
      }
      if (t - whistled > 18 && d < 4) {
        whistled = t
        blip(880, 0.16, 'sine', 0.035)
        setTimeout(() => blip(1046, 0.3, 'sine', 0.035), 180)
      }
    }
  }

  return { train, update }
}
