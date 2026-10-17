import type { Config } from '@netlify/functions'
import { cleanName, json, season, store, updateJSON } from '../lib/store.mts'

type Entry = { name: string; score: number; at: string }

const GAMES = new Set(['klappfangst', 'renflyg', 'tomtememory'])
const MAX_SCORE = 1_000_000
const KEEP = 50

const keyFor = (game: string) => `leaderboard-${season()}-${game}`

export default async (req: Request) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const game = url.searchParams.get('game') ?? ''
    if (!GAMES.has(game)) return json({ error: 'Okänt spel' }, 400)
    const list = ((await store().get(keyFor(game), { type: 'json' })) ?? []) as Entry[]
    return json(list.slice(0, 10))
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const game = String(body.game ?? '')
    const name = cleanName(body.name)
    const score = Math.floor(Number(body.score))
    if (!GAMES.has(game) || !name || !Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
      return json({ error: 'Ogiltig poäng' }, 400)
    }
    const list = await updateJSON<Entry[]>(keyFor(game), [], (l) =>
      [...l, { name, score, at: new Date().toISOString() }]
        .sort((a, b) => b.score - a.score)
        .slice(0, KEEP),
    )
    return json(list.slice(0, 10))
  }

  return json({ error: 'Method not allowed' }, 405)
}

export const config: Config = { path: '/api/leaderboard' }
