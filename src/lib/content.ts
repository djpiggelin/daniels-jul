// Guests, photos and event details aren't part of the repo – they live in Netlify Blobs
// (see scripts/upload-content.mjs) and are served by /api/content and /media/*.
// When running plain `npm run dev` (no functions available) the made-up example
// content in public/example/ is used instead.

import type { JulEvent } from '../data'
import { rememberedName } from './api'

export type Guest = { name: string; photo?: string }

/** A photo from an earlier year, pinned on the wall in the 3D village. */
export type Memory = { image: string; label: string }

/** A personal invite link, /?inbjudan=<code> – it lets you see the private events (the julbord). */
export type Invite = { name: string; events: string[] }

/**
 * Shape of content.json. `image` and `photo` are paths relative to the content folder.
 * `invites` never leaves the server: /api/content leaves out the private events you're not invited
 * to and says who you are (`me`) instead.
 */
export type Content = { year: number; events: JulEvent[]; guests: Guest[]; memories?: Memory[]; invites?: Record<string, Invite>; me?: { name: string } | null }

const withBase = (c: Content, base: string): Content => ({
  ...c,
  events: c.events.map((e) => ({ ...e, image: base + e.image })),
  guests: c.guests.map((g) => (g.photo ? { ...g, photo: base + g.photo } : g)),
  memories: c.memories?.map((m) => ({ ...m, image: base + m.image })),
})

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new Error('no api')
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? 'Kunde inte ladda innehållet')
  return data as T
}

/** The code from an invite link, taken out of the address bar (so it isn't shared on by accident). */
function inviteFromLink() {
  const url = new URL(location.href)
  const code = url.searchParams.get('inbjudan')?.trim()
  if (code) {
    url.searchParams.delete('inbjudan')
    history.replaceState(history.state, '', url)
  }
  return code || null
}

/** Opening your invite link puts your name in (and with it your photo, from the guest list). */
const welcome = (c: Content, fromLink: boolean) => {
  if (fromLink && c.me) rememberedName.set(c.me.name)
  return c
}

export async function loadContent(): Promise<Content> {
  const code = inviteFromLink()
  try {
    // the server keeps the code in a cookie from here on
    return welcome(withBase(await fetchJSON<Content>(code ? `/api/content?inbjudan=${encodeURIComponent(code)}` : '/api/content'), '/media/'), !!code)
  } catch (err) {
    if (!import.meta.env.DEV) throw err
    console.info('Inget riktigt innehåll – använder exempelinnehållet i public/example/')
    // (does what /api/content does with the invite, with the code in localStorage instead of a cookie)
    if (code) localStorage.setItem('dev-inbjudan', code)
    const { invites, ...example } = await fetchJSON<Content>('/example/content.json')
    const invite = invites?.[localStorage.getItem('dev-inbjudan') ?? ''] ?? null
    const events = example.events.filter((e) => !e.private || invite?.events.includes(e.id))
    return welcome(withBase({ ...example, events, me: invite && { name: invite.name } }, '/example/'), !!code)
  }
}
