// What we're running on, and how much the village may ask of it.
// One place decides – everything else reads PROFILE, TOUCH and QUALITY.
//
// Try another profile with ?enhet=telefon|surfplatta|dator (remembered until you pick another).

export type Profile = 'telefon' | 'surfplatta' | 'dator'

const PROFILES: Profile[] = ['telefon', 'surfplatta', 'dator']
const KEY = 'jul3d.enhet'

function forced(): Profile | null {
  try {
    const q = new URLSearchParams(location.search).get('enhet')
    if (q && PROFILES.includes(q as Profile)) {
      sessionStorage.setItem(KEY, q)
      return q as Profile
    }
    if (q === 'auto') sessionStorage.removeItem(KEY)
    const kept = sessionStorage.getItem(KEY) as Profile | null
    return kept && PROFILES.includes(kept) ? kept : null
  } catch {
    return null
  }
}

const coarse = matchMedia('(pointer: coarse)').matches
const shortSide = Math.min(screen.width, screen.height)
const uaMobile = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile ?? /iPhone|iPod|Android.+Mobile|Mobile Safari/i.test(navigator.userAgent)
const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8

function detect(): Profile {
  if (!coarse) return 'dator'
  // iPads say they're a Mac, so go by the screen: phones are under ~600 px on the short side
  return uaMobile || shortSide < 600 ? 'telefon' : 'surfplatta'
}

const FORCED = forced()
export const PROFILE: Profile = FORCED ?? detect()

/** Touch controls (joystick, buttons). Follows the screen, unless a profile is forced for testing. */
export const TOUCH = FORCED ? FORCED !== 'dator' : coarse

export type Quality = {
  /** Highest pixel ratio we draw at; the adaptive resolution may go lower. */
  pixelRatio: number
  minPixelRatio: number
  /** Static textures are shrunk to at most this many pixels on their long side. */
  maxTexture: number
  anisotropy: number
  antialias: boolean
  shadows: boolean
  /** Fewer firs far out, simpler sky. */
  lowPower: boolean
  elves: number
}

const TABLE: Record<Profile, Quality> = {
  telefon: { pixelRatio: 1.25, minPixelRatio: 0.85, maxTexture: 512, anisotropy: 2, antialias: true, shadows: false, lowPower: true, elves: 4 },
  surfplatta: { pixelRatio: 1.25, minPixelRatio: 0.75, maxTexture: 1024, anisotropy: 4, antialias: true, shadows: false, lowPower: true, elves: 5 },
  dator: { pixelRatio: 1.5, minPixelRatio: 1, maxTexture: Infinity, anisotropy: 8, antialias: true, shadows: true, lowPower: false, elves: 8 },
}

export const QUALITY: Quality = { ...TABLE[PROFILE] }
// a phone with little memory: smaller textures still
if (PROFILE === 'telefon' && memory <= 3) QUALITY.maxTexture = 384
QUALITY.pixelRatio = Math.min(devicePixelRatio, QUALITY.pixelRatio)
QUALITY.minPixelRatio = Math.min(QUALITY.minPixelRatio, QUALITY.pixelRatio)

/**
 * Vertical field of view for walking. 70° is right on a wide screen; a phone held upright would
 * then see only ~36° across – like looking through a tube – so keep at least ~55° across.
 */
export function walkFov(aspect: number) {
  const across = (2 * Math.atan(Math.tan((70 * Math.PI) / 360) * aspect) * 180) / Math.PI
  if (across >= 55) return 70
  const v = (2 * Math.atan(Math.tan((55 * Math.PI) / 360) / aspect) * 180) / Math.PI
  return Math.min(95, v)
}

/* ---------- texture budget ---------- */

let textureBytes = 0
/** Roughly how much texture memory we've handed the GPU (with mipmaps). */
export const textureMB = () => textureBytes / 1e6

/**
 * Make a static image fit the texture budget. On a phone this shrinks the canvas *in place* –
 * iOS Safari has a hard cap on the memory all canvases may use together, and the big boards
 * would blow it – so the same canvas still works for the picture viewer, just smaller.
 */
export function fitTexture<T extends HTMLCanvasElement | HTMLImageElement>(src: T, live = false): HTMLCanvasElement | T {
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height
  const k = live ? 1 : Math.min(1, QUALITY.maxTexture / Math.max(w, h, 1))
  if (k >= 1) {
    textureBytes += w * h * 4 * 1.33
    return src
  }
  const nw = Math.max(1, Math.round(w * k))
  const nh = Math.max(1, Math.round(h * k))
  const small = document.createElement('canvas')
  small.width = nw
  small.height = nh
  small.getContext('2d')!.drawImage(src, 0, 0, nw, nh)
  textureBytes += nw * nh * 4 * 1.33
  if (src instanceof HTMLImageElement) return small
  src.width = nw
  src.height = nh
  src.getContext('2d')!.drawImage(small, 0, 0)
  small.width = small.height = 0
  return src
}
