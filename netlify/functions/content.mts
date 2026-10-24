import type { Config, Context } from '@netlify/functions'
import { access } from '../lib/invite.mts'
import { json } from '../lib/store.mts'

export default async (req: Request, context: Context) => {
  const { content, invite, sees } = await access(req, context)
  if (!content) return json({ error: 'Inget innehåll uppladdat – kör npm run upload-content' }, 404)
  const { invites: _, ...rest } = content
  // (no-store: what you get depends on your invite, so no cache may hand it to someone else)
  return json({ ...rest, events: content.events.filter(sees), me: invite && { name: invite.name } })
}

export const config: Config = { path: '/api/content' }
