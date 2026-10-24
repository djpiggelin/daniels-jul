import type { Context } from '@netlify/functions'
import { contentStore } from './store.mts'

// Some events (the julbord) are only for those invited. Everyone invited gets a personal link,
// /?inbjudan=<code>; the code is listed in content.json under `invites` and kept in a cookie from
// then on. Without it, private events (and their image and knytis list) are left out on the server –
// hiding them in the page alone would still have them in /api/content for anyone who looks.

export type Invite = { name: string; events: string[] }
type Event = { id: string; image: string; private?: boolean; potluck?: boolean }
export type StoredContent = { events: Event[]; invites?: Record<string, Invite>; [key: string]: unknown }

const COOKIE = 'inbjudan'

export async function access(req: Request, context: Context) {
  const content = (await contentStore().get('content.json', { type: 'json' })) as StoredContent | null
  const fromLink = new URL(req.url).searchParams.get(COOKIE)?.trim()
  const code = fromLink || context.cookies.get(COOKIE)
  const invite = (code && content?.invites?.[code]) || null
  // the link was opened: remember it (set by the server so Safari doesn't drop it after a week)
  if (fromLink && invite)
    context.cookies.set({ name: COOKIE, value: fromLink, path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 365 * 86400 })
  const sees = (e: Event) => !e.private || !!invite?.events.includes(e.id)
  return { content, invite, sees }
}
