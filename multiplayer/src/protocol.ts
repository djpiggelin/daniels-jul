// What the village and the multiplayer server say to each other – shared by both sides.
// Everything is small JSON; positions are in metres on the village floor, yaw in radians.

/** Coat colours a player can get (picked from the name, so you keep yours). */
export const COLORS = [0xc8102e, 0x1d6e48, 0x1f4f8a, 0xc98a2b, 0x7a3fa0, 0x2a9d8f, 0xe76f51, 0x6b4226] as const

export const LIMITS = {
  name: 24,
  players: 30,
  /** Messages a second a player may send (bursts allowed up to twice that). */
  rate: 20,
  throwsPerSecond: 4,
  /** A chat line, in characters – and how often you may say something (one every 2 s, three in a row). */
  say: 120,
  saySeconds: 2,
  /** Largest message, in characters. */
  message: 400,
  /** Nobody stands further out than this. */
  radius: 40,
}

/** How often the server sends everyone where everyone is. */
export const TICK_MS = 100

export type PlayerInfo = { id: string; name: string; color: number; photo: string | null; hits: number }
/** [id, x, z, yaw, speed 0..1, feet above the snow (jumping)] – the last one may be missing from older villages. */
export type PlayerState = [string, number, number, number, number, number?]
export type V3 = [number, number, number]

export type ClientMessage =
  | { t: 'hi'; name: string; color: number; photo: string | null }
  | { t: 's'; x: number; z: number; y: number; m: number; h?: number }
  | { t: 'th'; f: V3; v: V3 }
  /** "I was hit by `by`" – the one who got hit decides, so nobody can score on others by cheating. */
  | { t: 'hit'; by: string }
  /** Something to say – a speech bubble over your nisse. */
  | { t: 'say'; text: string }

export type ServerMessage =
  | { t: 'welcome'; id: string; players: (PlayerInfo & { s: PlayerState | null })[] }
  | { t: 'join'; p: PlayerInfo }
  | { t: 'leave'; id: string }
  | { t: 's'; p: PlayerState[] }
  | { t: 'th'; id: string; f: V3; v: V3 }
  | { t: 'hit'; by: string; on: string; hits: number }
  | { t: 'say'; id: string; text: string }
  | { t: 'full' }

/** Control characters, zero-width characters and text-direction overrides (built from code points,
 *  so the source stays plain ASCII). */
const INVISIBLE = new RegExp(
  `[${[[0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]].map(([a, b]) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`).join('')}]`,
  'g',
)

/** One line of text the way the server keeps it: no control or invisible characters, not too long. */
export const cleanText = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(INVISIBLE, '').trim().replace(/\s+/g, ' ').slice(0, max).trim() : ''

/** Clean a name the way the server does. */
export const cleanName = (v: unknown) => cleanText(v, LIMITS.name)

/** A guest photo the village is allowed to show on a name tag. */
export const cleanPhoto = (v: unknown) => (typeof v === 'string' && /^\/(media|example)\/photos\/[\w%.\- ]{1,80}$/.test(v) ? v : null)
