import type { Config } from '@netlify/functions'
import { cleanName, json, season, store, updateJSON } from '../lib/store.mts'

// Affischtavlan (src/pages/Affischtavla.tsx): guests pin up posters – PNG, JPG or PDF, shown as they are –
// and write notes on the board. The list is one JSON blob; each file is a blob of its own beside it.

export type Poster = {
  id: string
  by: string
  at: string
  text?: string
  file?: { url: string; type: string; name: string }
}

/** The file types we take – checked against the file's first bytes, not what the browser says it is. */
const KINDS: { type: string; magic: number[] }[] = [
  { type: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { type: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
]
/** Netlify functions take at most 6 MB a request – leave room for the form around the file. */
export const MAX_BYTES = 4.5 * 1024 * 1024
const MAX_TEXT = 1000
/** As many as are kept on the board: when it's full, the oldest come down first. */
const KEEP = 200

const listKey = () => `affischer-${season()}`
const fileKey = (id: string) => `affischer-${season()}/${id}`

const sniff = (bytes: Uint8Array) => KINDS.find((k) => k.magic.every((b, i) => bytes[i] === b))?.type

export default async (req: Request) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    // one poster's file
    const id = url.searchParams.get('fil')
    if (id !== null) {
      if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 })
      const found = await store().getWithMetadata(fileKey(id), { type: 'arrayBuffer' })
      if (!found) return new Response('Not found', { status: 404 })
      const type = String(found.metadata.type ?? '')
      if (!KINDS.some((k) => k.type === type)) return new Response('Not found', { status: 404 })
      return new Response(found.data, {
        headers: {
          'content-type': type,
          'content-disposition': `inline; filename="${String(found.metadata.name ?? 'affisch').replace(/[^\w.\- åäöÅÄÖ]/g, '_')}"`,
          'x-content-type-options': 'nosniff',
          // a poster never changes once it's up
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    }
    const list = ((await store().get(listKey(), { type: 'json' })) ?? []) as Poster[]
    return json(list)
  }

  if (req.method === 'POST') {
    const form = await req.formData().catch(() => null)
    if (!form) return json({ error: 'Ogiltig affisch' }, 400)
    const by = cleanName(form.get('name'))
    const text = String(form.get('text') ?? '').trim().slice(0, MAX_TEXT)
    const upload = form.get('file')
    const file = upload instanceof File && upload.size > 0 ? upload : null
    if (!by) return json({ error: 'Skriv ditt namn' }, 400)
    if (!text && !file) return json({ error: 'Välj en fil eller skriv något' }, 400)

    const poster: Poster = { id: crypto.randomUUID(), by, at: new Date().toISOString() }
    if (text) poster.text = text
    if (file) {
      if (file.size > MAX_BYTES) return json({ error: 'Filen är för stor (max 4,5 MB)' }, 413)
      const data = await file.arrayBuffer()
      const type = sniff(new Uint8Array(data, 0, Math.min(8, data.byteLength)))
      if (!type) return json({ error: 'Bara PNG, JPG och PDF går att sätta upp' }, 415)
      const name = file.name.slice(0, 80) || 'affisch'
      await store().set(fileKey(poster.id), data, { metadata: { type, name } })
      poster.file = { url: `/api/affischer?fil=${poster.id}`, type, name }
    }

    let down: Poster[] = []
    const list = await updateJSON<Poster[]>(listKey(), [], (l) => {
      const all = [poster, ...l]
      down = all.slice(KEEP)
      return all.slice(0, KEEP)
    })
    await Promise.all(down.filter((p) => p.file).map((p) => store().delete(fileKey(p.id)).catch(() => {})))
    return json(list)
  }

  return json({ error: 'Method not allowed' }, 405)
}

export const config: Config = { path: '/api/affischer' }
