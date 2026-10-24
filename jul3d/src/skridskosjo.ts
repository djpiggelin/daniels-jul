// Skridskosjön, west of the village down a path through the forest: a frozen lake you skate on (the
// player glides on ice, see player.ts), a snow bank round it, lanterns and benches on the shore – and a
// game of bandy going on out on the ice, three red nissar against three blue. Skate into the orange ball
// to take it along, or stand by it and hit it (E) the way you're looking; the board on the shore keeps
// the score. Two little nissar skate their rounds round the rink.
import * as THREE from 'three'
import { Nisse } from './npc'
import { FONT, glowTexture, makeCanvas, rng, toTexture } from './tex'
import { LAKE, WEST, type Circle } from './world'

const rand = rng(1912)
const std = (color: number, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness })
const ease = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt))

/** The bandy rink on the ice (lake space: x along the lake, z across): half its length and width, the goals. */
const RINK = { L: 13, W: 7.5, goal: 1.3 }
const BALL_R = 0.09

/** The ice, with skate scratches and the rink's lines painted under it. */
function iceTexture() {
  const W = 1024
  const H = Math.round((W * LAKE.rz) / LAKE.rx)
  const [c, ctx] = makeCanvas(W, H)
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2)
  g.addColorStop(0, '#dcecf7')
  g.addColorStop(0.75, '#c6e0f1')
  g.addColorStop(1, '#eef6fb')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // (metres in lake space → pixels)
  const px = (x: number) => (x / LAKE.rx / 2 + 0.5) * W
  const pz = (z: number) => (z / LAKE.rz / 2 + 0.5) * H
  const m = W / (LAKE.rx * 2)
  // scratches from a thousand skates
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  for (let i = 0; i < 260; i++) {
    const cx = rand() * W
    const cy = rand() * H
    const r = 20 + rand() * 120
    const a = rand() * Math.PI * 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, a, a + 0.3 + rand() * 1.2)
    ctx.stroke()
  }
  // the rink's lines: the edge, the middle line and circle, an arc in front of each goal
  ctx.strokeStyle = 'rgba(200,30,40,0.75)'
  ctx.lineWidth = 0.12 * m
  ctx.strokeRect(px(-RINK.L), pz(-RINK.W), 2 * RINK.L * m, 2 * RINK.W * m)
  ctx.beginPath()
  ctx.moveTo(px(0), pz(-RINK.W))
  ctx.lineTo(px(0), pz(RINK.W))
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(px(0), pz(0), 2 * m, 0, Math.PI * 2)
  ctx.stroke()
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(px(s * RINK.L), pz(0), 4.5 * m, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? (3 * Math.PI) / 2 : Math.PI / 2)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(200,30,40,0.8)'
  ctx.beginPath()
  ctx.arc(px(0), pz(0), 0.2 * m, 0, Math.PI * 2)
  ctx.fill()
  return toTexture(c)
}

/** A bandy stick: a shaft and the curved blade at the bottom, held in the nisse's right hand. */
function stick(color: number) {
  const g = new THREE.Group()
  const wood = std(0xc8a06a, 0.6)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.95, 6), wood)
  shaft.position.y = -0.45
  const blade = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 10, Math.PI * 0.6), std(color, 0.5))
  blade.position.set(0, -0.92, 0.1)
  blade.rotation.set(0, Math.PI / 2, Math.PI * 0.9)
  g.add(shaft, blade)
  g.position.set(0, -0.48, 0.12)
  g.rotation.x = -0.5
  return g
}

type Skater = { nisse: Nisse; x: number; z: number; vx: number; vz: number; phase: number; yaw: number; collider: Circle }

export type Lake = ReturnType<typeof buildLake>

export function buildLake(scene: THREE.Scene, say: (text: string) => void) {
  const group = new THREE.Group()
  group.position.set(LAKE.x, 0, LAKE.z)
  scene.add(group)
  const colliders: Circle[] = []
  const solids: THREE.Object3D[] = []
  const toWorld = (x: number, z: number) => ({ x: x + LAKE.x, z: z + LAKE.z })

  /* ---------- the lake ---------- */
  const ice = new THREE.Mesh(
    new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2).scale(LAKE.rx, 1, LAKE.rz),
    new THREE.MeshStandardMaterial({ map: iceTexture(), roughness: 0.22, metalness: 0 }),
  )
  ice.position.y = 0.03
  ice.receiveShadow = true
  group.add(ice)
  // a bank of snow all round, shovelled off the ice
  const bank = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 72).rotateX(Math.PI / 2).scale(LAKE.rx + 0.6, 1, LAKE.rz + 0.6), std(0xf6f9ff, 0.9))
  bank.scale.y = 9
  bank.position.y = 0.05
  bank.castShadow = bank.receiveShadow = true
  group.add(bank)
  // low boards along the rink's long sides, as bandy has
  const boardMat = std(0xf4f0e6, 0.6)
  const stripe = std(0xc8102e, 0.6)
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(RINK.L * 2, 0.15, 0.06), boardMat)
    b.position.set(0, 0.1, s * (RINK.W + 0.15))
    const r = new THREE.Mesh(new THREE.BoxGeometry(RINK.L * 2, 0.03, 0.065), stripe)
    r.position.set(0, 0.16, s * (RINK.W + 0.15))
    group.add(b, r)
  }
  // the goals: red frames, white nets
  const net = new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.6 })
  const frame = std(0xc8102e, 0.4)
  for (const s of [-1, 1]) {
    const g = new THREE.Group()
    g.position.set(s * RINK.L, 0, 0)
    g.rotation.y = s > 0 ? 0 : Math.PI
    for (const z of [-RINK.goal, RINK.goal]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), frame)
      post.position.set(0, 0.7, z)
      g.add(post)
      const c = toWorld(s * RINK.L, z)
      colliders.push({ x: c.x, z: c.z, r: 0.15 })
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, RINK.goal * 2, 8), frame)
    bar.rotation.x = Math.PI / 2
    bar.position.set(0, 1.4, 0)
    // the net: back, top and sides – open at the front
    const back = new THREE.Group()
    const side = (w: number, h: number, x: number, y: number, z: number, ry: number, rx = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, Math.round(w * 8), Math.round(h * 8)), net)
      m.position.set(x, y, z)
      m.rotation.set(rx, ry, 0)
      back.add(m)
    }
    side(RINK.goal * 2, 1.4, 0.8, 0.7, 0, Math.PI / 2)
    side(0.8, RINK.goal * 2, 0.4, 1.4, 0, 0, Math.PI / 2)
    for (const z of [-RINK.goal, RINK.goal]) side(0.8, 1.4, 0.4, 0.7, z, 0)
    g.add(bar, back)
    g.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh && o.parent !== back))
    group.add(g)
    solids.push(g)
  }

  /* ---------- the shore: the scoreboard, lanterns, benches, the sign by the village ---------- */
  const [sc, sctx] = makeCanvas(512, 256)
  const scoreTex = toTexture(sc, { live: true })
  const drawScore = (red: number, blue: number) => {
    sctx.fillStyle = '#0d1b2a'
    sctx.fillRect(0, 0, 512, 256)
    sctx.strokeStyle = '#f6c453'
    sctx.lineWidth = 8
    sctx.strokeRect(8, 8, 496, 240)
    sctx.fillStyle = '#fff3dc'
    sctx.textAlign = 'center'
    sctx.font = `600 40px ${FONT.serif}`
    sctx.fillText('🏒 Bandy på sjön', 256, 62)
    sctx.font = `700 96px ${FONT.sans}`
    sctx.fillStyle = '#ff4a4a'
    sctx.fillText(String(red), 140, 190)
    sctx.fillStyle = '#fff3dc'
    sctx.fillText('–', 256, 186)
    sctx.fillStyle = '#5ab0ff'
    sctx.fillText(String(blue), 372, 190)
    sctx.font = `500 26px ${FONT.sans}`
    sctx.fillStyle = '#ff9a9a'
    sctx.fillText('Röda', 140, 232)
    sctx.fillStyle = '#9ad0ff'
    sctx.fillText('Blå', 372, 232)
    scoreTex.needsUpdate = true
  }
  drawScore(0, 0)
  {
    const board = new THREE.Group()
    board.position.set(0, 0, -LAKE.rz - 2.2)
    const wood = std(0x5a3a22)
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), wood)
      p.position.set(s * 1.4, 1.6, 0)
      board.add(p)
    }
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshStandardMaterial({ map: scoreTex, emissiveMap: scoreTex, emissive: 0xffffff, emissiveIntensity: 0.6 }))
    face.position.set(0, 2.5, 0.07)
    const backing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 0.1), wood)
    backing.position.set(0, 2.5, 0)
    board.add(backing, face)
    board.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
    group.add(board)
    const c = toWorld(0, -LAKE.rz - 2.2)
    colliders.push({ x: c.x - 1.4, z: c.z, r: 0.2 }, { x: c.x + 1.4, z: c.z, r: 0.2 })
    solids.push(board)
  }
  const lanternGlow = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,140,1)', 'rgba(255,150,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false })
  const lanterns: THREE.Sprite[] = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15
    const x = Math.cos(a) * (LAKE.rx + 1.8)
    const z = Math.sin(a) * (LAKE.rz + 1.8)
    // (not in front of the scoreboard, nor on the way in from the village)
    if (Math.abs(x) < 3 && z < 0) continue
    if (x > LAKE.rx && Math.abs(z - 4) < 4) continue
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), std(0x2b2b2b, 0.5))
    post.position.set(x, 1.1, z)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: 0xffd99a, toneMapped: false }))
    lamp.position.set(x, 2.35, z)
    const glow = new THREE.Sprite(lanternGlow)
    glow.position.set(x, 2.35, z)
    glow.scale.setScalar(1.6)
    group.add(post, lamp, glow)
    lanterns.push(glow)
    const c = toWorld(x, z)
    colliders.push({ x: c.x, z: c.z, r: 0.15 })
  }
  for (const [x, z, yaw] of [[-8, LAKE.rz + 2.4, Math.PI], [8, LAKE.rz + 2.4, Math.PI], [-LAKE.rx - 2.4, -3, Math.PI / 2]]) {
    const bench = new THREE.Group()
    bench.position.set(x, 0, z)
    bench.rotation.y = yaw
    const wood = std(0x7a5230, 0.7)
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.42), wood)
    seat.position.y = 0.45
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.06), wood)
    back.position.set(0, 0.72, -0.2)
    const snow = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.36), std(0xffffff, 0.9))
    snow.position.y = 0.51
    bench.add(seat, back, snow)
    for (const s of [-0.8, 0.8]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.4), std(0x2b2b2b, 0.5))
      leg.position.set(s, 0.22, 0)
      bench.add(leg)
    }
    bench.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh))
    group.add(bench)
    const c = toWorld(x, z)
    colliders.push({ x: c.x, z: c.z, r: 0.7 })
  }
  // the signpost by the village: this way to the lake
  {
    const [c, ctx] = makeCanvas(512, 128)
    ctx.fillStyle = '#6b4226'
    ctx.beginPath()
    ctx.moveTo(0, 14)
    ctx.lineTo(440, 14)
    ctx.lineTo(500, 64)
    ctx.lineTo(440, 114)
    ctx.lineTo(0, 114)
    ctx.fill()
    ctx.fillStyle = '#fff3dc'
    ctx.font = `600 52px ${FONT.serif}`
    ctx.textBaseline = 'middle'
    ctx.fillText('⛸️ Skridskosjön', 26, 66)
    const sign = new THREE.Group()
    sign.position.set(WEST.path.x1 - 0.6 - LAKE.x, 0, WEST.path.z1 + 0.5 - LAKE.z)
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), std(0x5a3a22))
    post.position.y = 1.1
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: toTexture(c), transparent: true, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: toTexture(c) }))
    arrow.position.set(-0.75, 1.9, 0.06)
    arrow.rotation.y = Math.PI
    sign.add(post, arrow)
    group.add(sign)
  }

  /* ---------- the skaters ---------- */
  const mkSkater = (coat: number, hat: number, x: number, z: number, scale = 1.05, withStick = true): Skater => {
    const nisse = new Nisse({ coat, hat, scale, trim: true })
    if (withStick) nisse.armR.add(stick(coat))
    group.add(nisse.group)
    solids.push(nisse.group)
    const collider = { x: 0, z: 0, r: 0.35 }
    colliders.push(collider)
    return { nisse, x, z, vx: 0, vz: 0, phase: rand() * 6, yaw: 0, collider }
  }
  type Player = Skater & { team: 1 | -1; role: 'gk' | 'go' | 'back'; cool: number; cheer: number }
  const players: Player[] = []
  for (const team of [1, -1] as const)
    for (const role of ['gk', 'go', 'back'] as const) {
      const red = team === 1
      const x = role === 'gk' ? -team * (RINK.L - 0.8) : -team * (role === 'go' ? 3 : 7)
      const p = mkSkater(red ? 0xc8102e : 0x1f4f8a, red ? 0xffffff : 0xf6c453, x, role === 'back' ? 2 : 0) as Player
      Object.assign(p, { team, role, cool: 0, cheer: 0 })
      players.push(p)
    }
  for (const p of players)
    p.nisse.group.userData.onSnowball = () => {
      p.nisse.flinch()
      say(p.team === 1 ? '🏒 Hörru! Vi är mitt i en match!' : '🏒 Snöboll på planen? Domare!')
    }
  const kids = [mkSkater(0x2a9d8f, 0xe76f51, 0, 11, 0.75, false), mkSkater(0xe9c46a, 0x7a3fa0, 0, -11, 0.72, false)]
  for (const k of kids) k.nisse.group.userData.onSnowball = () => k.nisse.flinch()

  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5, emissive: 0x401800 }))
  ballMesh.castShadow = true
  group.add(ballMesh)
  const ball = { x: 0, z: 0, vx: 0, vz: 0 }
  const score = { red: 0, blue: 0 }
  /** after a goal: the ball back on the spot in a moment */
  let resetIn = 0
  /** who touched the ball last: a team, or you */
  let lastTouch: 1 | -1 | 'you' = 1

  /** Move a skater towards (tx, tz): gliding, so it speeds up and slows down gradually. */
  const skate = (s: Skater, tx: number, tz: number, top: number, dt: number) => {
    const dx = tx - s.x
    const dz = tz - s.z
    const d = Math.hypot(dx, dz)
    const want = Math.min(top, d * 1.6)
    const wx = d > 0.01 ? (dx / d) * want : 0
    const wz = d > 0.01 ? (dz / d) * want : 0
    s.vx = ease(s.vx, wx, 2.2, dt)
    s.vz = ease(s.vz, wz, 2.2, dt)
    s.x += s.vx * dt
    s.z += s.vz * dt
  }
  const pose = (s: Skater, t: number, dt: number, look?: { x: number; z: number }) => {
    const sp = Math.hypot(s.vx, s.vz)
    // (long gliding strides: legs push out to the side in turn)
    s.phase += dt * (1.5 + sp * 0.6)
    s.nisse.walkPose(s.phase, Math.min(1, sp / 3) * 0.6)
    const face = look ? Math.atan2(look.x - s.x, look.z - s.z) : sp > 0.3 ? Math.atan2(s.vx, s.vz) : s.yaw
    s.yaw += Math.atan2(Math.sin(face - s.yaw), Math.cos(face - s.yaw)) * Math.min(1, dt * 5)
    s.nisse.group.position.set(s.x, 0.03, s.z)
    s.nisse.group.rotation.y = s.yaw
    s.nisse.group.rotation.z = Math.sin(s.phase) * 0.08 * Math.min(1, sp / 3)
    const w = toWorld(s.x, s.z)
    s.collider.x = w.x
    s.collider.z = w.z
  }
  const hit = (from: { x: number; z: number }, dirX: number, dirZ: number, power: number) => {
    const d = Math.hypot(dirX, dirZ) || 1
    ball.vx = (dirX / d) * power
    ball.vz = (dirZ / d) * power
    ball.x = from.x + (dirX / d) * 0.45
    ball.z = from.z + (dirZ / d) * 0.45
  }

  /** `you`: where you are and how you're moving (null when you're not about – up in the sleigh, in the mine). */
  function update(t: number, dt: number, you: { pos: THREE.Vector3; vel: THREE.Vector3 } | null) {
    dt = Math.min(dt, 0.05)
    const me = you ? { x: you.pos.x - LAKE.x, z: you.pos.z - LAKE.z } : null
    const atLake = !!me && Math.abs(me.x) < LAKE.rx + 8 && Math.abs(me.z) < LAKE.rz + 8

    // the ball: slides, slows a little, bounces off the boards; into a goal is a goal
    if (resetIn > 0) {
      resetIn -= dt
      if (resetIn <= 0) Object.assign(ball, { x: 0, z: 0, vx: 0, vz: 0 })
    } else {
      ball.x += ball.vx * dt
      ball.z += ball.vz * dt
      const f = Math.exp(-0.45 * dt)
      ball.vx *= f
      ball.vz *= f
      if (Math.abs(ball.z) > RINK.W) {
        ball.z = Math.sign(ball.z) * RINK.W
        ball.vz *= -0.6
      }
      if (Math.abs(ball.x) > RINK.L) {
        if (Math.abs(ball.z) < RINK.goal - BALL_R) {
          // red shoots at the +x goal, blue at the −x one
          const red = ball.x > 0
          if (red) score.red++
          else score.blue++
          drawScore(score.red, score.blue)
          for (const p of players) if ((p.team === 1) === red) p.cheer = 2.5
          if (atLake) {
            const lead = score.red === score.blue ? `Det står ${score.red}–${score.blue}.` : `${score.red > score.blue ? 'Röda' : 'Blå'} leder ${Math.max(score.red, score.blue)}–${Math.min(score.red, score.blue)}.`
            say(lastTouch === 'you' ? `🏒 MÅL! Ditt mål – för ${red ? 'röda' : 'blå'}! ${lead}` : `🏒 MÅL för ${red ? 'röda' : 'blå'}! ${lead}`)
          }
          ball.x = Math.sign(ball.x) * (RINK.L + 0.4)
          ball.vx = ball.vz = 0
          resetIn = 2.5
        } else {
          ball.x = Math.sign(ball.x) * RINK.L
          ball.vx *= -0.6
        }
      }
    }
    // you: skate into the ball and it goes with you
    if (me && resetIn <= 0) {
      const dx = ball.x - me.x
      const dz = ball.z - me.z
      const d = Math.hypot(dx, dz)
      const sp = Math.hypot(you!.vel.x, you!.vel.z)
      if (d < 0.55 && sp > 0.5) {
        ball.vx = you!.vel.x * 1.35 + (dx / d) * 0.8
        ball.vz = you!.vel.z * 1.35 + (dz / d) * 0.8
        lastTouch = 'you'
      }
    }

    // the bandy players: the keeper keeps goal, one goes for the ball, one hangs back
    for (const p of players) {
      p.cool = Math.max(0, p.cool - dt)
      const own = -p.team * RINK.L
      const attack = p.team
      if (p.cheer > 0) {
        p.cheer -= dt
        skate(p, p.x, p.z, 0, dt)
        p.nisse.armL.rotation.z = -2.6
        pose(p, t, dt)
        p.nisse.armR.rotation.z = 2.6 + Math.sin(t * 10) * 0.3
        continue
      }
      p.nisse.armL.rotation.z = 0
      let tx: number
      let tz: number
      if (p.role === 'gk') {
        tx = own + attack * 0.7
        tz = THREE.MathUtils.clamp(ball.z, -RINK.goal + 0.2, RINK.goal - 0.2)
      } else if (p.role === 'go') {
        // come at the ball from behind, so the shot goes the right way
        tx = ball.x - attack * 0.4
        tz = ball.z
      } else {
        // between the ball and our own goal, a little to the side
        tx = (ball.x + own) / 2
        tz = ball.z * 0.5 + (p.team === 1 ? 2 : -2)
      }
      skate(p, THREE.MathUtils.clamp(tx, -RINK.L, RINK.L), THREE.MathUtils.clamp(tz, -RINK.W, RINK.W), p.role === 'gk' ? 3.6 : 4.2, dt)
      // at the ball (the keeper reaches further, diving for it)
      if (resetIn <= 0 && p.cool <= 0 && Math.hypot(ball.x - p.x, ball.z - p.z) < (p.role === 'gk' ? 0.85 : 0.5)) {
        const goalX = attack * RINK.L
        // the keeper clears it up the ice
        if (p.role === 'gk') hit(p, goalX - p.x, (rand() - 0.5) * 8 - p.z, 8 + rand() * 3)
        // close enough: a shot somewhere at the goal, not always on it
        else if (Math.abs(goalX - p.x) < 8) hit(p, goalX - p.x, (rand() - 0.5) * 4.4 - p.z, 7 + rand() * 4)
        // further out: drive it on up the ice
        else hit(p, attack * 3, (rand() - 0.5) * 2.5 - p.z * 0.15, 3.5 + rand() * 1.5)
        p.cool = p.role === 'gk' ? 0.6 : 0.5
        lastTouch = p.team
      }
      pose(p, t, dt, p.role === 'gk' ? ball : undefined)
      // (the stick swings as they skate)
      p.nisse.armR.rotation.x = -0.3 + Math.sin(p.phase) * 0.25
    }
    // the little ones skate their rounds round the rink
    for (const [i, k] of kids.entries()) {
      const a = t * 0.18 * (i ? -1 : 1) + i * Math.PI
      skate(k, Math.cos(a) * (RINK.L + 3.2), Math.sin(a) * (RINK.W + 3), 2.2, dt)
      pose(k, t, dt)
    }

    ballMesh.position.set(ball.x, 0.03 + BALL_R, ball.z)
    ballMesh.rotation.x += ball.vz * dt * 8
    ballMesh.rotation.z -= ball.vx * dt * 8
    for (const [i, l] of lanterns.entries()) l.scale.setScalar(1.55 + Math.sin(t * 5 + i * 1.7) * 0.05)
  }

  const api = {
    group,
    colliders,
    solids,
    update,
    /** Standing by the ball, facing it: you can hit it. */
    nearBall(pos: THREE.Vector3, fwd: THREE.Vector3) {
      if (resetIn > 0) return false
      const dx = ball.x + LAKE.x - pos.x
      const dz = ball.z + LAKE.z - pos.z
      const d = Math.hypot(dx, dz)
      return d < 1.8 && (dx * fwd.x + dz * fwd.z) / Math.max(d, 0.01) > 0.3
    },
    /** A hit, the way you're looking. */
    shoot(fwd: THREE.Vector3) {
      hit({ x: ball.x - fwd.x * 0.45, z: ball.z - fwd.z * 0.45 }, fwd.x, fwd.z, 12)
      lastTouch = 'you'
    },
    get score() {
      return { ...score }
    },
  }
  return api
}
