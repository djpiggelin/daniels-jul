import type { Config } from '@netlify/functions'
import { cleanName, json, season, store, updateJSON } from '../lib/store.mts'

// The gingerbread houses in the window by Tomtens bageri (jul3d/src/husvitrin.ts): built by visitors at
// Bagar-Berit's table, voted for with a heart. The window shows the most loved ones.

export type House = { id: string; by: string; size: number; roof: string; icing: string; candy: string; chimney: boolean; votes: number; at: string }

const ROOFS = ['sadel', 'brant', 'platt']
const ICINGS = ['kanter', 'istappar', 'snirklar']
const CANDIES = ['godis', 'polkagris', 'inga']
/** As many as are kept: when it's full, the least loved of the oldest go first. */
const KEEP = 60

const keyFor = () => `husvitrin-${season()}`

export default async (req: Request) => {
  if (req.method === 'GET') {
    const list = ((await store().get(keyFor(), { type: 'json' })) ?? []) as House[]
    return json(list)
  }
  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}))
    // a heart for a house
    if (typeof b.vote === 'string') {
      let found = false
      const list = await updateJSON<House[]>(keyFor(), [], (l) =>
        l.map((h) => {
          if (h.id !== b.vote) return h
          found = true
          return { ...h, votes: h.votes + 1 }
        }),
      )
      return found ? json(list) : json({ error: 'Okänt hus' }, 404)
    }
    // a new house
    const by = cleanName(b.by)
    const size = Number(b.size)
    if (!by || ![0, 1, 2].includes(size) || !ROOFS.includes(b.roof) || !ICINGS.includes(b.icing) || !CANDIES.includes(b.candy) || typeof b.chimney !== 'boolean') {
      return json({ error: 'Ogiltigt pepparkakshus' }, 400)
    }
    const house: House = { id: crypto.randomUUID(), by, size, roof: b.roof, icing: b.icing, candy: b.candy, chimney: b.chimney, votes: 0, at: new Date().toISOString() }
    const list = await updateJSON<House[]>(keyFor(), [], (l) => {
      const all = [...l, house]
      if (all.length <= KEEP) return all
      // (the one to go: of the older half, the one with fewest hearts)
      const older = [...all].sort((a, c) => a.at.localeCompare(c.at)).slice(0, Math.ceil(all.length / 2))
      const out = older.reduce((a, c) => (c.votes < a.votes ? c : a))
      return all.filter((h) => h !== out)
    })
    return json(list)
  }
  return json({ error: 'Method not allowed' }, 405)
}

export const config: Config = { path: '/api/husvitrin' }
