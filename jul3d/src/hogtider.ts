// When the village's high days happen, by the village clock (korsang.ts's wallClock: Stockholm's time, or
// the pretend one in the URL) – the same for everyone:
// - Julmarknad on the square every Advent weekend, Saturday and Sunday, 10–18 (julmarknad.ts);
// - on julafton, Kalle Anka on the big screen on the square at three, and from five to eight Tomten
//   himself knocking on the doors round the village (julafton.ts);
// - on nyårsafton, fireworks now and then all evening, and the big show at midnight (fyrverkeri.ts).
import { firstAdvent, wallClock } from './korsang'

const parts = (now: number) => {
  const d = new Date(now)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate(), dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes(), sec: d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() + d.getUTCMilliseconds() / 1000 }
}
const at = (h: number, m = 0) => h * 60 + m

/** Is it an Advent weekend (the Saturday before each Advent Sunday, and the Sunday)? */
export function adventWeekend(now = wallClock()) {
  const { y, dow } = parts(now)
  if (dow !== 0 && dow !== 6) return false
  const a1 = firstAdvent(y).getTime()
  const day = Math.floor(now / 86400000) * 86400000
  for (let w = 0; w < 4; w++) {
    const sunday = a1 + w * 7 * 86400000
    if (day === sunday || day === sunday - 86400000) return true
  }
  return false
}

/** The julmarknad is open: Advent weekends, ten to six. */
export const marketOpen = (now = wallClock()) => adventWeekend(now) && parts(now).min >= at(10) && parts(now).min < at(18)

/** Julafton, between `from` and `to` (hours, minutes). */
export const onJulafton = (from: number, to: number, now = wallClock()) => {
  const p = parts(now)
  return p.m === 12 && p.day === 24 && p.min >= from && p.min < to
}
/** Kalle Anka on the big screen: three to four on julafton (the screen goes up a little before). */
export const kalleAnka = (now = wallClock()) => onJulafton(at(15), at(16), now)
export const screenUp = (now = wallClock()) => onJulafton(at(14, 30), at(16, 15), now)
/** Tomten's own rounds of the village, door to door: five to eight on julafton. */
export const tomteVisit = (now = wallClock()) => onJulafton(at(17), at(20), now)

/**
 * Nyårsafton: seconds to midnight (negative after it), or null when it isn't the evening of it – from six
 * on nyårsafton until one on New Year's morning.
 */
export function toMidnight(now = wallClock()) {
  const p = parts(now)
  if (p.m === 12 && p.day === 31 && p.min >= at(18)) return 86400 - p.sec
  if (p.m === 1 && p.day === 1 && p.min < at(1)) return -p.sec
  return null
}
