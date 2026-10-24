import type { Config, Context } from '@netlify/functions'
import { access } from '../lib/invite.mts'
import { contentStore } from '../lib/store.mts'

// No SVG – it can carry scripts.
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
}

const notFound = () => new Response('Not found', { status: 404 })

export default async (req: Request, context: Context) => {
  const key = decodeURIComponent(new URL(req.url).pathname.replace(/^\/media\//, ''))
  const type = TYPES[key.split('.').pop()?.toLowerCase() ?? '']
  if (!type || key === 'content.json' || key.split('/').includes('..')) return notFound()

  // the picture of an event you're not invited to isn't there either
  const { content, sees } = await access(req, context)
  const event = content?.events.find((e) => e.image === key)
  if (event && !sees(event)) return notFound()

  const data = await contentStore().get(key, { type: 'arrayBuffer' })
  if (!data) return notFound()
  const cache = event?.private ? 'private, max-age=3600' : 'public, max-age=3600'
  return new Response(data, { headers: { 'content-type': type, 'cache-control': cache } })
}

export const config: Config = { path: '/media/*' }
