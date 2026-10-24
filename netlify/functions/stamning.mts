import type { Config } from '@netlify/functions'
import { json, season, store, updateJSON } from '../lib/store.mts'

// Byns julstämning (jul3d/src/julstamning.ts): one count for the whole village, for the day. Everything
// visitors do (a sip of glögg, a snowball that lands, a door in the calendar…) adds a little, sent in
// small batches; at midnight it starts again from nothing.

/** As much as one batch may add (a browser sends at most every fifteen seconds). */
const MAX_ADD = 40

type Mood = { points: number }

/** Today in Stockholm, as YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
const keyFor = (day: string) => `stamning-${season()}-${day}`

export default async (req: Request) => {
  const day = today()
  if (req.method === 'GET') {
    const mood = ((await store().get(keyFor(day), { type: 'json' })) ?? { points: 0 }) as Mood
    return json({ day, points: mood.points })
  }
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const add = Math.floor(Number(body.add))
    if (!Number.isFinite(add) || add < 1) return json({ error: 'Ogiltigt' }, 400)
    const mood = await updateJSON<Mood>(keyFor(day), { points: 0 }, (m) => ({ points: m.points + Math.min(add, MAX_ADD) }))
    return json({ day, points: mood.points })
  }
  return json({ error: 'Method not allowed' }, 405)
}

export const config: Config = { path: '/api/stamning' }
