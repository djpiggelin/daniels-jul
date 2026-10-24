// The sleigh's corner of Leksaksfabriken's yard: on the 23rd the nissar carry the presents out through
// the tower door and fill the big sacks by the sleigh (and the sacks stand there through julafton). And on julafton Tomten is out all day: round
// and round over the village, and every couple of minutes down into the yard again, where the nissar
// heave another sack into the back before he's off. (Timed by the village clock, so everyone sees him
// in the same place.)
import * as THREE from 'three'
import { julafton } from './julkalender'
import { tomteVisit } from './hogtider'
import { wallClock } from './korsang'
import { Nisse } from './npc'
import { PARK, std, type Sleigh } from './sleigh'
import type { Circle } from './world'

/** The loop over the village: round its middle, this wide and this high. */
const LOOP = { r: 66, y: 34 }
const SPEED = 18
/** On the ground in the yard, being loaded. */
const STOP = 24
const LAPS = 2
/** Where he joins the loop after take-off and leaves it to come down (angles round the loop). */
const JOIN = -0.6
const LEAVE = -2.7 + Math.PI * 2 * (LAPS + 1)
/** The sacks, on the far side of the sleigh from the path (world space). */
const SACKS = [
  [7.6, -56.9],
  [9.5, -57.1],
  [11.4, -56.8],
] as const
/** The arched door at the foot of the clock tower, where the nissar come out. */
const DOOR = new THREE.Vector3(5.4, 0, -67)

const onLoop = (a: number, out = new THREE.Vector3()) => out.set(Math.cos(a) * LOOP.r, LOOP.y, Math.sin(a) * LOOP.r)
const along = (a: number) => new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))

export function buildSleighYard(scene: THREE.Scene, sleigh: Sleigh, sleighCircles: Circle[]) {
  const colliders: Circle[] = []
  const park = new THREE.Vector3(PARK.x, 0, PARK.z)
  const ahead = new THREE.Vector3(-Math.sin(PARK.yaw), 0, -Math.cos(PARK.yaw))

  /* ---------- the route: up off the snow, the loop, and down again along the yard ---------- */
  const join = onLoop(JOIN)
  const up = new THREE.CubicBezierCurve3(park.clone(), park.clone().addScaledVector(ahead, 16).setY(0.8), join.clone().addScaledVector(along(JOIN), -30), join)
  const leave = onLoop(LEAVE)
  const down = new THREE.CubicBezierCurve3(leave, leave.clone().addScaledVector(along(LEAVE), 30), park.clone().addScaledVector(ahead, -28).setY(8), park.clone())
  // accelerating off the ground (and slowing to land) at an even rate: up to speed by the end of the curve
  const T_UP = up.getLength() / (SPEED / 2)
  const T_LOOP = ((LEAVE - JOIN) * LOOP.r) / SPEED
  const T_DOWN = down.getLength() / (SPEED / 2)
  const CYCLE = STOP + T_UP + T_LOOP + T_DOWN

  /* ---------- the sacks ---------- */
  const sackMat = std(0x8a1424, 0.95)
  const tieMat = std(0xf6c453, 0.5, 0.4)
  const bigSack = () => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), sackMat)
    body.scale.set(1, 1.2, 0.9)
    body.position.y = 0.92
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.42, 12), sackMat)
    neck.position.y = 2.0
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 6, 16), tieMat)
    tie.rotation.x = Math.PI / 2
    tie.position.y = 1.9
    g.add(body, neck, tie)
    g.traverse((o) => (o.castShadow = true))
    return g
  }
  const sackCircles: Circle[] = []
  const sacks = SACKS.map(([x, z], i) => {
    const g = bigSack()
    g.position.set(x, 0, z)
    g.rotation.y = i * 1.9
    scene.add(g)
    sackCircles.push({ x, z, r: 0.85 })
    return g
  })
  // the one that goes into the sleigh at each stop (the others stand by for later)
  const loaded = sacks[1]
  const loadedHome = loaded.position.clone()
  const inSleigh = new THREE.Vector3(0, 1.4, 1.1)

  /* ---------- nissar carrying presents out from the factory ---------- */
  const giftCols = [0xe5383b, 0x2fa36b, 0x4a7bd0, 0xf6c453, 0xfff3dc, 0x8e3fb0]
  const carriers = [0, 1, 2].map((i) => {
    const n = new Nisse({ coat: [0x2fa36b, 0xc8102e, 0x2b5fa8][i], hat: [0xc8102e, 0x2fa36b, 0xc8102e][i], apron: 0x8a5a32, scale: 0.75, beard: i !== 1, ears: i === 1 })
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.3), std(giftCols[i], 0.6))
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.29, 0.06), std(0xf6c453, 0.5))
    box.add(ribbon)
    box.position.set(0, 0.62, 0.32)
    n.body.add(box)
    scene.add(n.group)
    const [sx, sz] = SACKS[i]
    // to the sack's far side (away from the sleigh)
    const to = new THREE.Vector3(sx + (i - 1) * 0.3, 0, sz - 1.05)
    return { n, box, to, phase: i * 6.3, colour: i }
  })
  const WALK = 1.3

  /* ---------- running it ---------- */
  const pos = new THREE.Vector3()
  const next = new THREE.Vector3()
  const lift = new THREE.Vector3()
  let wasAway = false

  /** Where the sleigh is s seconds into its cycle (and, in `next`, a moment later: which way it's going). */
  function at(s: number, out: THREE.Vector3) {
    s = ((s % CYCLE) + CYCLE) % CYCLE
    if (s < STOP) return out.copy(park)
    s -= STOP
    if (s < T_UP) return up.getPointAt(Math.min(1, (s / T_UP) ** 2), out)
    s -= T_UP
    if (s < T_LOOP) return onLoop(JOIN + (s / T_LOOP) * (LEAVE - JOIN), out)
    s -= T_LOOP
    return down.getPointAt(Math.min(1, 1 - (1 - s / T_DOWN) ** 2), out)
  }

  function update(t: number, flying: boolean) {
    // the packing is on the 23rd (and the sacks wait by the sleigh through julafton); before that,
    // the presents are still being made, and after it they've all been given out
    const d = new Date(wallClock())
    const packing = d.getUTCMonth() === 11 && (d.getUTCDate() === 23 || d.getUTCDate() === 24)
    for (const s of sacks) s.visible = packing
    for (const c of sackCircles) c.r = packing ? Math.abs(c.r) : -Math.abs(c.r)
    for (const c of carriers) c.n.group.visible = packing

    /* the nissar: out of the door with a present, over to the sacks, in it goes, back for another */
    for (const c of packing ? carriers : []) {
      const leg = DOOR.distanceTo(c.to) / WALK
      const k = (t + c.phase) % (leg * 2 + 2)
      const g = c.n.group
      if (k < leg) {
        g.position.lerpVectors(DOOR, c.to, k / leg)
        c.box.visible = true
        c.n.walkPose(t * 9, 1)
        g.rotation.y = Math.atan2(c.to.x - DOOR.x, c.to.z - DOOR.z)
      } else if (k < leg + 1) {
        // up and in: arms high, the present gone at the top
        g.position.copy(c.to)
        c.n.walkPose(0, 0)
        c.box.visible = k < leg + 0.5
        c.n.armL.rotation.x = c.n.armR.rotation.x = -2.6
        g.rotation.y = Math.atan2(SACKS[c.colour][0] - c.to.x, SACKS[c.colour][1] - c.to.z)
      } else if (k < leg * 2 + 1) {
        g.position.lerpVectors(c.to, DOOR, (k - leg - 1) / leg)
        c.box.visible = false
        c.n.walkPose(t * 9, 1)
        g.rotation.y = Math.atan2(DOOR.x - c.to.x, DOOR.z - c.to.z)
      } else {
        // a moment inside for the next one
        g.position.copy(DOOR)
        c.box.visible = true
      }
      // carrying: both arms out in front, holding it
      if (c.box.visible && k < leg) c.n.armL.rotation.x = c.n.armR.rotation.x = -1.3
    }

    /* Tomten's rounds, on julafton (unless you've just taken his sleigh for a spin) */
    // (from five to eight Tomten walks round the village on foot instead – julafton.ts – the sleigh resting)
    const out = julafton() && !flying && !tomteVisit()
    sleigh.busy = out
    if (!out) {
      if (wasAway) {
        sleigh.park()
        loaded.position.copy(loadedHome)
        loaded.visible = packing
        for (const c of sleighCircles) c.r = Math.abs(c.r)
      }
      wasAway = false
      return
    }
    wasAway = true
    const s = (((wallClock() / 1000) % CYCLE) + CYCLE) % CYCLE
    at(s, pos)
    at(s + 0.15, next)
    const g = sleigh.group
    g.position.copy(pos)
    const parked = s < STOP
    if (!parked) {
      const dx = next.x - pos.x
      const dz = next.z - pos.z
      const flat = Math.hypot(dx, dz)
      // banking round the loop, level on the ground
      const bank = s > STOP + T_UP && s < STOP + T_UP + T_LOOP ? -0.32 : 0
      g.rotation.set(Math.atan2(next.y - pos.y, flat), Math.atan2(-dx, -dz), bank, 'YXZ')
    } else g.rotation.set(0, PARK.yaw, 0, 'YXZ')
    sleigh.gallop = parked ? 0 : THREE.MathUtils.clamp(0.3 + pos.y / 2, 0, 1)
    // you can walk right through where it was while it's up there
    for (const c of sleighCircles) c.r = parked ? Math.abs(c.r) : -Math.abs(c.r)

    // loading: two seconds in, a sack swings up into the back; it's back by the others once he's gone
    const k = THREE.MathUtils.smoothstep(s, 6, 10)
    if (parked && k > 0 && k < 1) {
      g.updateMatrixWorld()
      lift.copy(inSleigh).applyMatrix4(g.matrixWorld)
      loaded.position.lerpVectors(loadedHome, lift, k)
      loaded.position.y += Math.sin(k * Math.PI) * 1.6
      loaded.visible = true
    } else if (parked && k >= 1) loaded.visible = false
    else {
      // (a fresh one, filled while he was away)
      loaded.position.copy(loadedHome)
      loaded.visible = s > STOP + T_UP
    }
  }

  // (these move: keep them out of the baking)
  const moving: THREE.Object3D[] = [...sacks, ...carriers.map((c) => c.n.group)]
  colliders.push(...sackCircles)
  return { colliders, update, moving, cycle: CYCLE }
}
