// Which event lives in which house in Tomtens by – shared by the front page and the event pages.
import { EVENTS, type JulEvent } from '../data'
import type { Building } from '../components/Scenery'

export const JULBAK = EVENTS.find((e) => e.competitions?.some((c) => c.art))
export const JULBORD = EVENTS.find((e) => e.potluck)
export const JULAFTON = EVENTS.find((e) => e.santa)

export const EVENT_FOR: Partial<Record<Building, JulEvent | undefined>> = {
  verkstad: JULBAK,
  destilleri: JULBAK,
  julbord: JULBORD,
  julafton: JULAFTON,
}

/** Where clicking a house takes you. */
export const linkFor = (b: Building) => {
  if (b === 'spel') return '/spel'
  if (b === 'ritningar') return '/pepparkaksarkitekten'
  if (b === 'verkstad' || b === 'destilleri') return `/event/${JULBAK?.id}#${b}`
  return `/event/${EVENT_FOR[b]?.id ?? ''}`
}

/** The house an event lives in – where Santa parks his sleigh on that event's page. */
export const buildingFor = (eventId: string): Building | undefined =>
  eventId === JULBAK?.id ? 'verkstad' : eventId === JULBORD?.id ? 'julbord' : eventId === JULAFTON?.id ? 'julafton' : undefined

// everyone knows it's December – the house number is just the day
const day = (e?: JulEvent) => (e ? String(new Date(e.start).getDate()) : undefined)
export const HOUSE_NUMBERS: Partial<Record<Building, string>> = {
  julafton: day(JULAFTON),
  destilleri: day(JULBAK),
  verkstad: day(JULBAK),
  julbord: day(JULBORD),
}
