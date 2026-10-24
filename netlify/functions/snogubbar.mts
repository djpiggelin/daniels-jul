import type { Config } from '@netlify/functions'
import { cleanName, json, season, store, updateJSON } from '../lib/store.mts'

// The snowmen in Snögubbsbacken (jul3d/src/snogubbar.ts): built by visitors, standing for everyone for
// the rest of the season. Each is where it stands, its three snowballs and what it's wearing.

/** Snögubbsbacken on the square, as jul3d/src/world.ts has it (SNOWFIELD) – a snowman stands inside it. */
const FIELD = { x0: -14, x1: -3, z0: 25, z1: 37 }
const HATS = ['hatt', 'luva', 'mossa', 'kastrull']
const ARMS = ['pinnar', 'kvast', 'inga']
const SCARVES = 6
/** As many as the field holds; the oldest melt away first. */
const KEEP = 40

export type Snowman = { id: string; x: number; z: number; yaw: number; r: [number, number, number]; hat: string; scarf: number; arms: string; name: string; at: string }

const keyFor = () => `snogubbar-${season()}`
const num = (v: unknown, lo: number, hi: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

export default async (req: Request) => {
  if (req.method === 'GET') {
    const list = ((await store().get(keyFor(), { type: 'json' })) ?? []) as Snowman[]
    return json(list)
  }
  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}))
    const x = num(b.x, FIELD.x0, FIELD.x1)
    const z = num(b.z, FIELD.z0, FIELD.z1)
    const yaw = num(b.yaw, -10, 10)
    const r = Array.isArray(b.r) && b.r.length === 3 ? b.r.map((v: unknown) => num(v, 0.15, 0.8)) : null
    const name = cleanName(b.name)
    if (x == null || z == null || yaw == null || !r || r.some((v: number | null) => v == null) || !(r[0] >= r[1] && r[1] >= r[2]) || !HATS.includes(b.hat) || !ARMS.includes(b.arms) || num(b.scarf, 0, SCARVES - 1) == null || !name) {
      return json({ error: 'Ogiltig snögubbe' }, 400)
    }
    const man: Snowman = { id: crypto.randomUUID(), x, z, yaw, r: r as Snowman['r'], hat: b.hat, scarf: Math.floor(b.scarf), arms: b.arms, name, at: new Date().toISOString() }
    let crowded = false
    const list = await updateJSON<Snowman[]>(keyFor(), [], (l) => {
      // (not on top of one that's already there)
      crowded = l.some((o) => Math.hypot(o.x - x, o.z - z) < o.r[0] + r[0] + 0.15)
      return crowded ? l : [...l, man].slice(-KEEP)
    })
    if (crowded) return json({ error: 'Här står redan en snögubbe' }, 409)
    return json(list)
  }
  return json({ error: 'Method not allowed' }, 405)
}

export const config: Config = { path: '/api/snogubbar' }
