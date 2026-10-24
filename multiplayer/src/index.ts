// The multiplayer server for the 3D village: one Durable Object holds the village ("byn"),
// keeps track of who is there and where, and passes snowballs and hits between players.
//
// The repo is public, so it trusts nobody: names, photos, positions and the pace of
// messages are all checked here, and only the site's own pages may connect.

import { COLORS, LIMITS, TICK_MS, cleanName, cleanPhoto, cleanText, type ClientMessage, type PlayerInfo, type PlayerState, type ServerMessage, type V3 } from './protocol'

export interface Env {
  BYN: DurableObjectNamespace
  /** Comma-separated origins allowed to connect, e.g. "https://hasslon.se,https://danielsjulkalender.netlify.app". */
  ALLOWED_ORIGINS?: string
}

const DEFAULT_ORIGINS = ['https://hasslon.se', 'https://www.hasslon.se', 'https://danielsjulkalender.netlify.app']

function originAllowed(origin: string | null, env: Env) {
  if (!origin) return false
  const allowed = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : DEFAULT_ORIGINS
  if (allowed.includes(origin)) return true
  // the site's own domain and any subdomain of it (jul.hasslon.se, …)
  if (/^https:\/\/([a-z0-9-]+\.)*hasslon\.se$/.test(origin)) return true
  // Netlify deploy previews and drafts: https://<anything>--danielsjulkalender.netlify.app
  if (/^https:\/\/[a-z0-9-]+--danielsjulkalender\.netlify\.app$/.test(origin)) return true
  // local development
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/') return new Response('Daniels Jul – byn 🎄', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    if (url.pathname !== '/byn') return new Response('Not found', { status: 404 })
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    if (!originAllowed(req.headers.get('Origin'), env)) return new Response('Forbidden', { status: 403 })
    // one village for everyone
    return env.BYN.get(env.BYN.idFromName('byn')).fetch(req)
  },
}

type Player = {
  ws: WebSocket
  info: PlayerInfo | null
  state: PlayerState | null
  changed: boolean
  /** token bucket for messages, and a separate one for throws */
  tokens: number
  throwTokens: number
  sayTokens: number
  last: number
}

const finite = (n: unknown, max: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(-max, Math.min(max, n)) : 0)
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const vec = (v: unknown, max: number): V3 | null => (Array.isArray(v) && v.length === 3 ? [round(finite(v[0], max)), round(finite(v[1], max)), round(finite(v[2], max))] : null)

export class Byn implements DurableObject {
  private players = new Map<string, Player>()
  private timer: ReturnType<typeof setInterval> | null = null
  private nextId = 1

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(): Promise<Response> {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()
    if (this.players.size >= LIMITS.players) {
      server.send(JSON.stringify({ t: 'full' } satisfies ServerMessage))
      server.close(1013, 'full')
      return new Response(null, { status: 101, webSocket: client })
    }
    const id = (this.nextId++).toString(36) + Math.random().toString(36).slice(2, 6)
    const p: Player = { ws: server, info: null, state: null, changed: false, tokens: LIMITS.rate * 2, throwTokens: LIMITS.throwsPerSecond, sayTokens: 3, last: Date.now() }
    this.players.set(id, p)
    server.addEventListener('message', (e) => this.onMessage(id, p, e.data))
    const gone = () => this.leave(id)
    server.addEventListener('close', gone)
    server.addEventListener('error', gone)
    return new Response(null, { status: 101, webSocket: client })
  }

  private send(p: Player, msg: ServerMessage) {
    try {
      p.ws.send(JSON.stringify(msg))
    } catch {
      /* closing – the close handler cleans up */
    }
  }

  private broadcast(msg: ServerMessage, except?: string) {
    const data = JSON.stringify(msg)
    for (const [id, p] of this.players) {
      if (id === except || !p.info) continue
      try {
        p.ws.send(data)
      } catch {
        /* closing */
      }
    }
  }

  /** Refill the buckets; false when this player is sending too much. */
  private allow(p: Player, kind: string) {
    const now = Date.now()
    const dt = (now - p.last) / 1000
    p.last = now
    p.tokens = Math.min(LIMITS.rate * 2, p.tokens + dt * LIMITS.rate)
    p.throwTokens = Math.min(LIMITS.throwsPerSecond, p.throwTokens + dt * LIMITS.throwsPerSecond)
    p.sayTokens = Math.min(3, p.sayTokens + dt / LIMITS.saySeconds)
    if (p.tokens < 1 || (kind === 'th' && p.throwTokens < 1) || (kind === 'say' && p.sayTokens < 1)) return false
    p.tokens--
    if (kind === 'th') p.throwTokens--
    if (kind === 'say') p.sayTokens--
    return true
  }

  private onMessage(id: string, p: Player, raw: unknown) {
    if (typeof raw !== 'string' || raw.length > LIMITS.message) return
    let m: ClientMessage
    try {
      m = JSON.parse(raw)
    } catch {
      return
    }
    if (!m || typeof m !== 'object' || !this.allow(p, m.t)) return

    if (m.t === 'hi') {
      if (p.info) return
      const name = cleanName(m.name) || 'Nisse'
      const color = COLORS.includes(m.color as (typeof COLORS)[number]) ? m.color : COLORS[0]
      p.info = { id, name, color, photo: cleanPhoto(m.photo), hits: 0 }
      const others = [...this.players.entries()].filter(([k, o]) => k !== id && o.info).map(([, o]) => ({ ...o.info!, s: o.state }))
      this.send(p, { t: 'welcome', id, players: others })
      this.broadcast({ t: 'join', p: p.info }, id)
      this.start()
      return
    }
    if (!p.info) return

    if (m.t === 's') {
      const r = LIMITS.radius
      p.state = [id, round(finite(m.x, r)), round(finite(m.z, r)), round(finite(m.y, 1e4), 3), round(Math.max(0, Math.min(1, finite(m.m, 1)))), round(Math.max(0, finite(m.h, 8)))]
      p.changed = true
    } else if (m.t === 'th') {
      const f = vec(m.f, LIMITS.radius + 5)
      const v = vec(m.v, 40)
      if (f && v) this.broadcast({ t: 'th', id, f, v }, id)
    } else if (m.t === 'say') {
      const text = cleanText(m.text, LIMITS.say)
      if (text) this.broadcast({ t: 'say', id, text }, id)
    } else if (m.t === 'hit') {
      const by = typeof m.by === 'string' ? this.players.get(m.by) : undefined
      if (!by?.info || m.by === id) return
      by.info.hits++
      this.broadcast({ t: 'hit', by: m.by, on: id, hits: by.info.hits })
    }
  }

  private leave(id: string) {
    const p = this.players.get(id)
    if (!p) return
    this.players.delete(id)
    if (p.info) this.broadcast({ t: 'leave', id })
    if (!this.players.size) this.stop()
  }

  /** Everyone's latest position, ten times a second – only while somebody is here. */
  private start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      const changed: PlayerState[] = []
      for (const p of this.players.values()) {
        if (p.changed && p.state) changed.push(p.state)
        p.changed = false
      }
      if (changed.length) this.broadcast({ t: 's', p: changed })
    }, TICK_MS)
  }

  private stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
