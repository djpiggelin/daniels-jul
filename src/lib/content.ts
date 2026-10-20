// Guests, photos and event details aren't part of the repo – they live in Netlify Blobs
// (see scripts/upload-content.mjs) and are served by /api/content and /media/*.
// When running plain `npm run dev` (no functions available) the made-up example
// content in public/example/ is used instead.

import type { JulEvent } from '../data'

export type Guest = { name: string; photo?: string }

/** Shape of content.json. `image` and `photo` are paths relative to the content folder. */
export type Content = { year: number; events: JulEvent[]; guests: Guest[] }

const withBase = (c: Content, base: string): Content => ({
  ...c,
  events: c.events.map((e) => ({ ...e, image: base + e.image })),
  guests: c.guests.map((g) => (g.photo ? { ...g, photo: base + g.photo } : g)),
})

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new Error('no api')
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? 'Kunde inte ladda innehållet')
  return data as T
}

export async function loadContent(): Promise<Content> {
  try {
    return withBase(await fetchJSON<Content>('/api/content'), '/media/')
  } catch (err) {
    if (!import.meta.env.DEV) throw err
    console.info('Inget riktigt innehåll – använder exempelinnehållet i public/example/')
    return withBase(await fetchJSON<Content>('/example/content.json'), '/example/')
  }
}
