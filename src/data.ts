// Årets innehåll (datum, tema, texter, gäster och bilder) ligger i Netlify Blobs, inte i repot –
// se "Uppdatera inför nytt år" i README. Här finns typerna och det som är likadant varje år.

import { loadContent } from './lib/content'

export type Competition = {
  name: string
  emoji: string
  /** Which illustration to show at the top of the competition. */
  art?: 'verkstad' | 'destilleri'
  theme?: { title: string; intro: string[] }
  /** A highlighted note, e.g. what's changed since last year. */
  notice?: string
  rules: string[]
  criteria?: string[]
}

export type JulEvent = {
  id: string
  name: string
  emoji: string
  tagline: string
  start: string // ISO, lokal tid
  durationHours: number
  location: string
  description: string
  image: string
  reindeer: string
  accent: 'red' | 'green' | 'gold'
  competitions?: Competition[]
  potluck?: boolean
  /** Only for those invited (personal invite links, see `invites` in content.json) – left out for everyone else. */
  private?: boolean
  /** Leds by Santa himself – shown as the sleigh instead of a reindeer on the front page. */
  santa?: boolean
}

const content = await loadContent()

export const YEAR = content.year

// (without the private events you're not invited to – the julbord may well be missing)
export const EVENTS: JulEvent[] = content.events

// `photo` är valfritt – utan foto visas gästens initial istället (och de är inte med i memory-spelet).
export const GUESTS = content.guests

export const PARTICIPANTS = GUESTS.map((g) => ({ name: g.name, image: g.photo ?? null }))

export const MEMORIES = content.memories ?? []

export type Dish = { id: string; name: string; emoji: string; category: 'Fisk' | 'Kött' | 'Tillbehör' | 'Dryck'; x: number; y: number }

// x/y = position i procent på julbordsbilden (för den interaktiva kartan)
export const DISHES: Dish[] = [
  { id: 'gravad-lax', name: 'Gravad lax', emoji: '🐟', category: 'Fisk', x: 21.4, y: 39.7 },
  { id: 'rokt-lax', name: 'Rökt lax', emoji: '🐟', category: 'Fisk', x: 16.3, y: 37.1 },
  { id: 'gravlaxsas', name: 'Gravlaxsås', emoji: '🥣', category: 'Fisk', x: 27.7, y: 39.6 },
  { id: 'laxrora', name: 'Laxröra', emoji: '🥣', category: 'Fisk', x: 35.4, y: 44.3 },
  { id: 'inlagd-sill', name: 'Inlagd sill', emoji: '🐠', category: 'Fisk', x: 16.2, y: 63.3 },
  { id: 'smaksill', name: 'Italiensk sill & currysill', emoji: '🐠', category: 'Fisk', x: 28.6, y: 56.6 },
  { id: 'julskinka', name: 'Julskinka', emoji: '🍖', category: 'Kött', x: 52.8, y: 44.5 },
  { id: 'prinskorv', name: 'Prinskorv', emoji: '🌭', category: 'Kött', x: 45.9, y: 51.5 },
  { id: 'kottbullar', name: 'Köttbullar', emoji: '🧆', category: 'Kött', x: 31.8, y: 84 },
  { id: 'ribs', name: 'Ribs', emoji: '🍖', category: 'Kött', x: 83.3, y: 70.3 },
  { id: 'agg', name: 'Ägg', emoji: '🥚', category: 'Tillbehör', x: 70.4, y: 35 },
  { id: 'potatis', name: 'Potatis', emoji: '🥔', category: 'Tillbehör', x: 70.3, y: 40.4 },
  { id: 'rodbetssallad', name: 'Rödbetssallad', emoji: '🥗', category: 'Tillbehör', x: 69, y: 59.9 },
  { id: 'jansson', name: 'Jansson', emoji: '🥘', category: 'Tillbehör', x: 62.8, y: 81.1 },
  { id: 'vortbrod', name: 'Vörtbröd', emoji: '🍞', category: 'Tillbehör', x: 41.5, y: 66.7 },
  { id: 'ostar', name: 'Ostar', emoji: '🧀', category: 'Tillbehör', x: 88.1, y: 49 },
  { id: 'glogg', name: 'Glögg', emoji: '🍷', category: 'Dryck', x: 82.2, y: 8.2 },
  { id: 'julmust', name: 'Julmust', emoji: '🥤', category: 'Dryck', x: 95.3, y: 3.5 },
  { id: 'julol', name: 'Julöl', emoji: '🍺', category: 'Dryck', x: 88, y: 1.9 },
  { id: 'vin', name: 'Vin', emoji: '🍾', category: 'Dryck', x: 76.9, y: 9 },
  { id: 'snaps', name: 'Snaps', emoji: '🥃', category: 'Dryck', x: 83.2, y: 25 },
]

export const POTLUCK_IMAGE = '/knytis.png'
