import type { Config } from '@netlify/functions'
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

export default async (req: Request) => {
  const key = decodeURIComponent(new URL(req.url).pathname.replace(/^\/media\//, ''))
  const type = TYPES[key.split('.').pop()?.toLowerCase() ?? '']
  if (!type || key === 'content.json' || key.split('/').includes('..')) return notFound()

  const data = await contentStore().get(key, { type: 'arrayBuffer' })
  if (!data) return notFound()
  return new Response(data, { headers: { 'content-type': type, 'cache-control': 'public, max-age=3600' } })
}

export const config: Config = { path: '/media/*' }
