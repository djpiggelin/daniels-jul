import { lazy } from 'react'

export const GAMES = [
  {
    id: 'klappfangst',
    name: 'Klappfångst',
    emoji: '🎁',
    tagline: 'Fånga klapparna – undvik kolet!',
    howTo: ['Dra eller använd ← → för att styra släden.', '🎁 = 10p, 🍪 = 5p, ⭐ = 50p', 'Fångar du ett svart kol förlorar du ett liv. Lång svit ger combo!'],
    color: 'from-jul-red to-jul-red-dark',
    Component: lazy(() => import('./Klappfangst')),
  },
  {
    id: 'renflyg',
    name: 'Rudolfs Flygtur',
    emoji: '🦌',
    tagline: 'Flyg genom polkagrisarna',
    howTo: ['Tryck, klicka eller Space för att flaxa.', 'Varje polkagris du passerar = 1p.', 'Plocka 🎁 på vägen för +3p.'],
    color: 'from-jul-green to-jul-green-dark',
    Component: lazy(() => import('./Renflyg')),
  },
  {
    id: 'tomtememory',
    name: 'Tomtememory',
    emoji: '🧠',
    tagline: 'Hitta paren bland gästerna',
    howTo: ['Vänd två kort i taget och hitta alla par.', 'Färre drag och snabbare tid = fler poäng.'],
    color: 'from-[#4f7dff] to-[#2d4fc2]',
    Component: lazy(() => import('./Tomtememory')),
  },
] as const

export type GameId = (typeof GAMES)[number]['id']
