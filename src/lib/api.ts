// Talks to the Netlify Functions in /netlify/functions.
// When running plain `npm run dev` (no functions available) it falls back to
// localStorage so everything can be tried locally.

import type { HouseParams } from './gingerbread'
import type { Sketches } from './icing'

export type Claim = { name: string; picture?: string | null }
export type Claims = Record<string, Claim[]>
export type ScoreEntry = { name: string; score: number; at: string }

const local = {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  write(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  },
}

async function call<T>(url: string, init: RequestInit | undefined, fallback: () => T): Promise<T> {
  try {
    const res = await fetch(url, init)
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('application/json')) throw new Error('no api')
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? 'Något gick fel')
    return data as T
  } catch (err) {
    if (import.meta.env.DEV) return fallback()
    throw err
  }
}

export const getClaims = () => call<Claims>('/api/potluck', undefined, () => local.read('dev-claims', {}))

export const setClaim = (itemId: string, name: string, picture: string | null, action: 'claim' | 'unclaim') =>
  call<Claims>(
    '/api/potluck',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId, name, picture, action }) },
    () => {
      const c = local.read<Claims>('dev-claims', {})
      const list = (c[itemId] ?? []).filter((p) => p.name.toLowerCase() !== name.toLowerCase())
      if (action === 'claim') list.push({ name, picture })
      if (list.length) c[itemId] = list
      else delete c[itemId]
      local.write('dev-claims', c)
      return c
    },
  )

export const getScores = (game: string) =>
  call<ScoreEntry[]>(`/api/leaderboard?game=${encodeURIComponent(game)}`, undefined, () =>
    local.read<ScoreEntry[]>(`dev-lb-${game}`, []).slice(0, 10),
  )

export const postScore = (game: string, name: string, score: number) =>
  call<ScoreEntry[]>(
    '/api/leaderboard',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game, name, score }) },
    () => {
      const list = [...local.read<ScoreEntry[]>(`dev-lb-${game}`, []), { name, score, at: new Date().toISOString() }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
      local.write(`dev-lb-${game}`, list)
      return list.slice(0, 10)
    },
  )

export const rememberedName = {
  get: () => local.read<string>('jul-name', ''),
  set: (n: string) => local.write('jul-name', n),
}

/* ---------- Pepparkaksarkitekten ---------- */

export type SavedHouse = {
  id?: string
  team: string
  params: HouseParams
  sketches: Sketches
  thickness?: number
  pack?: number
  updatedAt?: string
}

export const getHouse = (id: string) =>
  call<SavedHouse>(`/api/pepparkakshus?id=${encodeURIComponent(id)}`, undefined, () => {
    const h = local.read<SavedHouse | null>(`dev-hus-${id}`, null)
    if (!h) throw new Error('Hittade ingen ritning med den länken')
    return h
  })

export const shareHouse = (house: SavedHouse) =>
  call<SavedHouse>(
    '/api/pepparkakshus',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(house) },
    () => {
      const id = house.id ?? `${house.team.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'lag'}-${Math.random().toString(36).slice(2, 7)}`
      const saved = { ...house, id, updatedAt: new Date().toISOString() }
      local.write(`dev-hus-${id}`, saved)
      return saved
    },
  )
