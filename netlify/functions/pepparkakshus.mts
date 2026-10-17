import type { Config } from '@netlify/functions'
import { cleanName, json, season, store } from '../lib/store.mts'

// A team's gingerbread house plan from Pepparkaksarkitekten: measurements and
// facade sketches as small vector ops. Shared by link, so anyone in the team
// with the link can keep working on the same plan.

const MAX_BYTES = 400_000
const ID = /^[a-z0-9-]{4,48}$/

const key = (id: string) => `pepparkakshus-${season()}-${id}`

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'lag'

export default async (req: Request) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const id = url.searchParams.get('id') ?? ''
    if (!ID.test(id)) return json({ error: 'Ogiltig länk' }, 400)
    const house = await store().get(key(id), { type: 'json' })
    return house ? json(house) : json({ error: 'Hittade ingen ritning med den länken' }, 404)
  }

  if (req.method === 'POST') {
    const raw = await req.text()
    if (raw.length > MAX_BYTES) return json({ error: 'Ritningen är för stor – sudda lite och försök igen' }, 413)
    let body: Record<string, unknown>
    try {
      body = JSON.parse(raw)
    } catch {
      return json({ error: 'Trasig ritning' }, 400)
    }
    const team = cleanName(body.team)
    if (!team) return json({ error: 'Ange ett lagnamn' }, 400)
    if (typeof body.params !== 'object' || body.params === null) return json({ error: 'Måtten saknas' }, 400)
    const sketches = typeof body.sketches === 'object' && body.sketches !== null ? body.sketches : {}

    const id = typeof body.id === 'string' && ID.test(body.id) ? body.id : `${slug(team)}-${Math.random().toString(36).slice(2, 7)}`
    const house = {
      id,
      team,
      params: body.params,
      sketches,
      thickness: typeof body.thickness === 'number' ? body.thickness : undefined,
      pack: typeof body.pack === 'number' ? body.pack : undefined,
      updatedAt: new Date().toISOString(),
    }
    await store().setJSON(key(id), house)
    return json(house)
  }

  return json({ error: 'Method not allowed' }, 405)
}

export const config: Config = { path: '/api/pepparkakshus' }
