import type { Config, Context } from '@netlify/functions'
import { access } from '../lib/invite.mts'
import { cleanName, json, season, store, updateJSON } from '../lib/store.mts'

// itemId -> list of people who claimed it
type Claims = Record<string, { name: string; picture?: string | null }[]>

const key = () => `potluck-${season()}`

export default async (req: Request, context: Context) => {
  // who brings what is for those invited to the julbord
  const { content, sees } = await access(req, context)
  const julbord = content?.events.find((e) => e.potluck)
  if (julbord && !sees(julbord)) return json({ error: 'Not found' }, 404)

  if (req.method === 'GET') {
    const claims = ((await store().get(key(), { type: 'json' })) ?? {}) as Claims
    return json(claims)
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const itemId = typeof body.itemId === 'string' ? body.itemId.slice(0, 60) : ''
    const name = cleanName(body.name)
    const picture = typeof body.picture === 'string' && body.picture.startsWith('/media/photos/') ? body.picture : null
    if (!itemId || !name) return json({ error: 'itemId och name krävs' }, 400)

    const claims = await updateJSON<Claims>(key(), {}, (c) => {
      const list = (c[itemId] ?? []).filter((p) => p.name.toLowerCase() !== name.toLowerCase())
      if (body.action !== 'unclaim') list.push({ name, picture })
      if (list.length) c[itemId] = list
      else delete c[itemId]
      return c
    })
    return json(claims)
  }

  return json({ error: 'Method not allowed' }, 405)
}

export const config: Config = { path: '/api/potluck' }
