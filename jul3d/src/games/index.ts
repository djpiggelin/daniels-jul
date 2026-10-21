// The three arcade games and the elves who host them.
import { Klappfangst } from './klappfangst'
import { Tomtememory } from './memory'
import { Renflyg } from './renflyg'
import type { Game } from './shared'

export type GameDef = {
  id: string
  name: string
  emoji: string
  tagline: string
  howTo: string[]
  /** Short key hint shown under the screen while playing. */
  keys: string
  accent: string
  make: (ctx: CanvasRenderingContext2D) => Game
  host: { name: string; avatar: string; coat: number; hat: number; greeting: string[]; bye: string }
}

export const GAMES: GameDef[] = [
  {
    id: 'klappfangst',
    name: 'Klappfångst',
    emoji: '🎁',
    tagline: 'Fånga klapparna – undvik kolet!',
    howTo: ['Styr släden med musen eller ← →.', '🎁 = 10p, 🍪 = 5p, ⭐ = 50p', 'Fångar du ett svart kol förlorar du ett liv. Lång svit ger combo!'],
    keys: 'mus / A D styr',
    accent: '#e5383b',
    make: (ctx) => new Klappfangst(ctx),
    host: {
      name: 'Släd-Sigge',
      avatar: '🛷',
      coat: 0xc8102e,
      hat: 0x2fa36b,
      greeting: ['Hoj hoj! Tomten har tappat klappar över hela himlen.', 'Hjälp mig fånga dem med släden – men akta dig för kolet!'],
      bye: 'Kom tillbaka och slå ditt rekord!',
    },
  },
  {
    id: 'renflyg',
    name: 'Rudolfs Flygtur',
    emoji: '🦌',
    tagline: 'Flyg genom polkagrisarna',
    howTo: ['Klicka eller Space för att flaxa.', 'Varje polkagris du passerar = 1p.', 'Plocka 🎁 på vägen för +3p.'],
    keys: 'Space / klick flaxa',
    accent: '#2fa36b',
    make: (ctx) => new Renflyg(ctx),
    host: {
      name: 'Flyg-Frida',
      avatar: '🦌',
      coat: 0x1d6e48,
      hat: 0xc8102e,
      greeting: ['Rudolf övar inför julafton och behöver en pilot.', 'Flaxa dig genom polkagrisarna – hur långt kommer du?'],
      bye: 'Rudolf hälsar! 🦌',
    },
  },
  {
    id: 'tomtememory',
    name: 'Tomtememory',
    emoji: '🧠',
    tagline: 'Hitta paren bland gästerna',
    howTo: ['Vänd två kort i taget och hitta alla par.', 'Färre drag och snabbare tid = fler poäng.', 'Mus och klick – eller piltangenterna och E.'],
    keys: 'klick vänd kort',
    accent: '#4f7dff',
    make: (ctx) => new Tomtememory(ctx),
    host: {
      name: 'Minnes-Majken',
      avatar: '🧠',
      coat: 0x4a7bd0,
      hat: 0xf6c453,
      greeting: ['Känner du gästerna? Jag har blandat ihop allihop på korten.', 'Hitta paren så snabbt du kan!'],
      bye: 'Glöm inte bort mig nu!',
    },
  },
]
