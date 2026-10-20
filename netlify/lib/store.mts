import { getStore } from '@netlify/blobs'

export const store = () => getStore({ name: 'daniels-jul', consistency: 'strong' })

/** This year's content.json, guest photos and event images – uploaded with `npm run upload-content`. */
export const CONTENT_STORE = 'daniels-jul-content'
export const contentStore = () => getStore({ name: CONTENT_STORE })

/**
 * Read-modify-write a JSON blob with optimistic locking so two guests
 * claiming dishes at the same moment don't overwrite each other.
 */
export async function updateJSON<T>(key: string, initial: T, fn: (current: T) => T): Promise<T> {
  const s = store()
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await s.getWithMetadata(key, { type: 'json' })
    const current: T = existing?.data ?? initial
    const next = fn(structuredClone(current))
    const result = existing?.etag
      ? await s.setJSON(key, next, { onlyIfMatch: existing.etag })
      : await s.setJSON(key, next, { onlyIfNew: true })
    if (result.modified) return next
  }
  throw new Error('Too much contention, try again')
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export const cleanName = (v: unknown) =>
  typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, 24) : ''

/** Christmas season the data belongs to – Jan–Jun still counts as last year's season. */
export const season = () => {
  const d = new Date()
  return d.getMonth() < 6 ? d.getFullYear() - 1 : d.getFullYear()
}
