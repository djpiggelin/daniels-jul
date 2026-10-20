import type { Config } from '@netlify/functions'
import { contentStore, json } from '../lib/store.mts'

export default async () => {
  const content = await contentStore().get('content.json', { type: 'json' })
  if (!content) return json({ error: 'Inget innehåll uppladdat – kör npm run upload-content' }, 404)
  return new Response(JSON.stringify(content), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  })
}

export const config: Config = { path: '/api/content' }
