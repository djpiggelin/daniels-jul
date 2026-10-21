// Other people in the village: each one a nisse in their own colour with a name tag, walking
// where they walk and throwing what they throw. Talks to the server in multiplayer/ – without
// one (or when it can't be reached) the village simply stays a one-player village.
import * as THREE from 'three'
import { COLORS, LIMITS, cleanName, cleanText, type ClientMessage, type PlayerInfo, type PlayerState, type ServerMessage, type V3 } from '../../multiplayer/src/protocol'
import { Nisse } from './npc'
import { mergeRigid } from './batch'
import { loadImage, makeCanvas, toTexture } from './tex'

export type Me = { name: string; photo: string | null }

/** Same name → same colour, so you're recognisable from one visit to the next. */
export function colorFor(name: string) {
  let h = 0
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`
const SEND_MS = 125
const SCALE = 1.3
const FAR = new THREE.Vector3(1e6, 0, 1e6)

async function nameTag(name: string, color: number, photo: string | null) {
  const [c, ctx] = makeCanvas(512, 128)
  const img = photo ? await loadImage(photo).catch(() => null) : null
  ctx.font = '700 54px "DM Sans", system-ui, sans-serif'
  const textW = Math.min(ctx.measureText(name).width, img ? 330 : 440)
  const w = textW + (img ? 140 : 64)
  const x0 = (512 - w) / 2
  ctx.fillStyle = 'rgba(7, 11, 29, 0.72)'
  ctx.beginPath()
  ctx.roundRect(x0, 14, w, 100, 50)
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = hex(color)
  ctx.stroke()
  let tx = x0 + 32
  if (img) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x0 + 64, 64, 40, 0, Math.PI * 2)
    ctx.clip()
    const s = Math.max(80 / img.width, 80 / img.height)
    ctx.drawImage(img, x0 + 64 - (img.width * s) / 2, 64 - (img.height * s) / 2, img.width * s, img.height * s)
    ctx.restore()
    tx = x0 + 118
  }
  ctx.fillStyle = '#fff3dc'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, tx, 66, textW)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(c), transparent: true, depthWrite: false }))
  sprite.scale.set(1.6, 0.4, 1)
  return sprite
}

/** White rounded bubble with a little tail, the text wrapped over up to three lines. */
function speechBubble(text: string) {
  const W = 640
  const [m, mctx] = makeCanvas(1, 1)
  mctx.font = '600 40px "DM Sans", system-ui, sans-serif'
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (mctx.measureText(test).width > W - 80 && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  if (lines.length > 3) lines.splice(3, lines.length - 3, `${lines[2].slice(0, -1)}…`)
  m.width = m.height = 0
  const H = 40 + lines.length * 50 + 30
  const [c, ctx] = makeCanvas(W, H)
  ctx.font = '600 40px "DM Sans", system-ui, sans-serif'
  const w = Math.min(W - 8, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 64)
  const x0 = (W - w) / 2
  ctx.fillStyle = 'rgba(255, 252, 244, 0.96)'
  ctx.strokeStyle = 'rgba(122, 76, 42, 0.5)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(x0, 4, w, H - 34, 28)
  ctx.moveTo(W / 2 - 18, H - 31)
  ctx.lineTo(W / 2, H - 4)
  ctx.lineTo(W / 2 + 18, H - 31)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#2a1a10'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 4 + 32 + i * 50, w - 40))
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(c, { live: true }), transparent: true, depthWrite: false }))
  sprite.scale.set(2.2, (2.2 * H) / W, 1)
  sprite.center.set(0.5, 0)
  return sprite
}

class Avatar {
  readonly nisse: Nisse
  readonly target = new THREE.Vector3()
  targetYaw = 0
  speed = 0
  private phase = Math.random() * 6
  private placed = false

  constructor(
    readonly info: PlayerInfo,
    scene: THREE.Scene,
  ) {
    this.nisse = new Nisse({ coat: info.color, hat: info.color, pants: 0x2b2b33, trim: true, scale: SCALE })
    this.nisse.group.userData.mpId = info.id
    // a snowball from you: they flinch here, and their own village decides whether it counts
    this.nisse.group.userData.onSnowball = () => this.nisse.flinch()
    this.nisse.group.visible = false
    mergeRigid(this.nisse.group)
    scene.add(this.nisse.group)
    void nameTag(info.name, info.color, info.photo).then((tag) => {
      tag.position.y = 2.35 / SCALE
      this.nisse.group.add(tag)
    })
  }

  get group() {
    return this.nisse.group
  }

  private bubble: { sprite: THREE.Sprite; left: number } | null = null

  /** A speech bubble over their head for a few seconds. */
  say(text: string) {
    this.clearBubble()
    const sprite = speechBubble(text)
    sprite.position.y = 2.72 / SCALE
    this.group.add(sprite)
    this.bubble = { sprite, left: 4 + Math.min(6, text.length / 12) }
  }

  private clearBubble() {
    if (!this.bubble) return
    this.group.remove(this.bubble.sprite)
    this.bubble.sprite.material.map?.dispose()
    this.bubble.sprite.material.dispose()
    this.bubble = null
  }

  set(s: PlayerState) {
    this.target.set(s[1], 0, s[2])
    // the camera looks down -z at yaw 0, a nisse's face points down +z: turn it round
    this.targetYaw = s[3] + Math.PI
    this.speed = s[4]
    if (!this.placed) {
      this.group.position.copy(this.target)
      this.nisse.setYaw(this.targetYaw)
      this.placed = true
      this.group.visible = true
    }
  }

  update(t: number, dt: number) {
    if (!this.placed) return
    // glide between the server's updates (ten a second) instead of jumping
    const g = this.group
    g.position.lerp(this.target, 1 - Math.exp(-10 * dt))
    const d = Math.atan2(Math.sin(this.targetYaw - g.rotation.y), Math.cos(this.targetYaw - g.rotation.y))
    g.rotation.y += d * (1 - Math.exp(-10 * dt))
    // breathing and flinching – with a point far away to look at, so they face where they walk
    // instead of turning to you like a shopkeeper; then the walk on top
    this.nisse.setYaw(g.rotation.y)
    this.nisse.update(t, dt, FAR, false)
    this.phase += dt * (4 + this.speed * 8) * Math.min(1, this.speed * 3)
    if (this.speed > 0.02) this.nisse.walkPose(this.phase, Math.min(1, this.speed * 1.4))
    if (this.bubble) {
      this.bubble.left -= dt
      this.bubble.sprite.material.opacity = Math.min(1, this.bubble.left)
      if (this.bubble.left <= 0) this.clearBubble()
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) {
        ;(x as THREE.SpriteMaterial).map?.dispose()
        x.dispose()
      }
    })
  }
}

export class Multiplayer {
  private ws: WebSocket | null = null
  private me: Me | null = null
  private myId = ''
  private avatars = new Map<string, Avatar>()
  private retry = 1000
  private stopped = false
  private lastSent = 0
  private sent: { x: number; z: number; y: number; m: number } | null = null

  /** Someone came or went, a snowball found its mark – for toasts and the menu. */
  onChange: () => void = () => {}
  onJoin: (name: string) => void = () => {}
  onLeave: (name: string) => void = () => {}
  onHit: (by: string, on: string, mine: { by: boolean; on: boolean }) => void = () => {}
  /** Someone said something (or you did) – for the chat log in the corner. */
  onSay: (name: string, text: string, mine: boolean) => void = () => {}
  /** A snowball someone else threw – fly it here too (owned by their nisse, so it can hit you). */
  onThrow: (from: THREE.Vector3, vel: THREE.Vector3, owner: THREE.Object3D) => void = () => {}
  /** Their nisse appeared or disappeared – snowballs need to know what they can hit. */
  onAvatar: (group: THREE.Object3D, added: boolean) => void = () => {}

  constructor(
    private url: string,
    private scene: THREE.Scene,
  ) {}

  get online() {
    return this.ws?.readyState === WebSocket.OPEN && !!this.myId
  }

  /** Everyone here (you first), with how many hits they've landed. */
  get players(): { name: string; hits: number; me: boolean }[] {
    const others = [...this.avatars.values()].map((a) => ({ name: a.info.name, hits: a.info.hits, me: false }))
    return this.me && this.online ? [{ name: this.me.name, hits: this.myHits, me: true }, ...others] : others
  }
  private myHits = 0

  join(me: Me) {
    this.me = { name: cleanName(me.name) || 'Nisse', photo: me.photo }
    this.stopped = false
    this.connect()
  }

  private connect() {
    if (this.stopped || !this.me) return
    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch {
      return this.later()
    }
    this.ws = ws
    ws.onopen = () => {
      this.retry = 1000
      this.sent = null
      this.send({ t: 'hi', name: this.me!.name, color: colorFor(this.me!.name), photo: this.me!.photo })
    }
    ws.onmessage = (e) => {
      try {
        this.receive(JSON.parse(e.data) as ServerMessage)
      } catch {
        /* not for us */
      }
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.myId = ''
      for (const id of [...this.avatars.keys()]) this.drop(id)
      this.onChange()
      this.later()
    }
  }

  /** Try again a little later – a dropped phone connection shouldn't end the party. */
  private later() {
    if (this.stopped) return
    setTimeout(() => this.connect(), this.retry)
    this.retry = Math.min(this.retry * 2, 15000)
  }

  private send(m: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m))
  }

  private add(info: PlayerInfo, s: PlayerState | null) {
    if (this.avatars.has(info.id)) return
    const a = new Avatar(info, this.scene)
    if (s) a.set(s)
    this.avatars.set(info.id, a)
    this.onAvatar(a.group, true)
  }

  private drop(id: string) {
    const a = this.avatars.get(id)
    if (!a) return
    this.avatars.delete(id)
    this.onAvatar(a.group, false)
    a.dispose(this.scene)
  }

  private nameOf = (id: string) => (id === this.myId ? (this.me?.name ?? '') : (this.avatars.get(id)?.info.name ?? 'Någon'))

  private receive(m: ServerMessage) {
    if (m.t === 'welcome') {
      this.myId = m.id
      this.myHits = 0
      for (const p of m.players) this.add(p, p.s)
      this.onChange()
    } else if (m.t === 'join') {
      this.add(m.p, null)
      this.onJoin(m.p.name)
      this.onChange()
    } else if (m.t === 'leave') {
      const name = this.nameOf(m.id)
      this.drop(m.id)
      this.onLeave(name)
      this.onChange()
    } else if (m.t === 's') {
      for (const s of m.p) if (s[0] !== this.myId) this.avatars.get(s[0])?.set(s)
    } else if (m.t === 'th') {
      const a = this.avatars.get(m.id)
      if (a) this.onThrow(new THREE.Vector3(...m.f), new THREE.Vector3(...m.v), a.group)
    } else if (m.t === 'hit') {
      if (m.by === this.myId) this.myHits = m.hits
      else {
        const a = this.avatars.get(m.by)
        if (a) a.info.hits = m.hits
      }
      if (m.on !== this.myId) this.avatars.get(m.on)?.nisse.flinch()
      this.onHit(this.nameOf(m.by), this.nameOf(m.on), { by: m.by === this.myId, on: m.on === this.myId })
      this.onChange()
    } else if (m.t === 'say') {
      const a = this.avatars.get(m.id)
      if (!a) return
      a.say(m.text)
      this.onSay(a.info.name, m.text, false)
    } else if (m.t === 'full') {
      this.stopped = true
    }
  }

  /** Where you are – a few times a second, and only when it changed (or now and then, to stay seen). */
  sendState(pos: THREE.Vector3, yaw: number, speed: number) {
    if (!this.online) return
    const now = performance.now()
    if (now - this.lastSent < SEND_MS) return
    const s = { x: pos.x, z: pos.z, y: Math.atan2(Math.sin(yaw), Math.cos(yaw)), m: Math.min(1, speed) }
    const p = this.sent
    const moved = !p || Math.hypot(s.x - p.x, s.z - p.z) > 0.03 || Math.abs(s.y - p.y) > 0.03 || Math.abs(s.m - p.m) > 0.05
    if (!moved && now - this.lastSent < 2000) return
    this.lastSent = now
    this.sent = s
    this.send({ t: 's', ...s })
  }

  /** Say something to everyone here. */
  say(text: string) {
    const t = cleanText(text, LIMITS.say)
    if (!t || !this.online || !this.me) return false
    this.send({ t: 'say', text: t })
    this.onSay(this.me.name, t, true)
    return true
  }

  sendThrow(from: THREE.Vector3, vel: THREE.Vector3) {
    const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z]
    this.send({ t: 'th', f: v3(from), v: v3(vel) })
  }

  /** A snowball from `owner` reached you – if it was a player's, tell everyone. */
  hitBy(owner: THREE.Object3D | null) {
    for (let o: THREE.Object3D | null = owner; o; o = o.parent) {
      const id = o.userData.mpId as string | undefined
      if (id) return this.send({ t: 'hit', by: id })
    }
  }

  update(t: number, dt: number) {
    for (const a of this.avatars.values()) a.update(t, dt)
  }
}
