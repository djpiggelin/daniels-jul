// The village has Stockholm's weather, as it is right now (netlify/functions/vader.mts): snow when it
// snows there, rain and sleet when it rains, clouds over the stars, the wind blowing the flakes, fog
// when it's foggy – and the northern lights brighter when the Kp index says they're out.
// ?vader=klart|mulet|snö|snöstorm|regn|slask|dimma|norrsken tries one out.

/** What /api/vader answers. */
export type RawWeather = {
  temp: number | null
  precip: number
  snow: number
  code: number
  cloud: number
  wind: number
  windFrom: number
  visibility: number | null
  kp: number | null
}

/** The weather as the village uses it. */
export type Weather = {
  /** how hard it snows, and rains (0 … 1) */
  snow: number
  rain: number
  /** how cloudy (0 … 1) */
  cloud: number
  /** wind speed (m/s) and which way it blows, as a unit vector in the village (east +x, north −z) */
  wind: number
  windX: number
  windZ: number
  /** how much thicker the haze is than on a clear day (1 …) */
  fog: number
  /** how bright the northern lights are, before the clouds hide them (1 as before) */
  aurora: number
  temp: number | null
  emoji: string
  label: string
}

/** If Stockholm can't be reached: the village as it always was, gently snowing. */
const FALLBACK: RawWeather = { temp: -3, precip: 0.3, snow: 0.2, code: 73, cloud: 60, wind: 2, windFrom: 200, visibility: 8000, kp: 3 }

const TRY: Record<string, RawWeather> = {
  klart: { temp: -9, precip: 0, snow: 0, code: 0, cloud: 0, wind: 1, windFrom: 0, visibility: 30000, kp: 2 },
  mulet: { temp: 0, precip: 0, snow: 0, code: 3, cloud: 100, wind: 4, windFrom: 230, visibility: 15000, kp: 2 },
  snö: { temp: -2, precip: 0.4, snow: 0.3, code: 73, cloud: 100, wind: 3, windFrom: 200, visibility: 5000, kp: 2 },
  snöstorm: { temp: -6, precip: 1.2, snow: 0.9, code: 75, cloud: 100, wind: 15, windFrom: 300, visibility: 600, kp: 2 },
  regn: { temp: 6, precip: 0.8, snow: 0, code: 63, cloud: 100, wind: 6, windFrom: 220, visibility: 9000, kp: 2 },
  slask: { temp: 1, precip: 0.6, snow: 0.2, code: 63, cloud: 100, wind: 5, windFrom: 220, visibility: 6000, kp: 2 },
  dimma: { temp: 1, precip: 0, snow: 0, code: 45, cloud: 100, wind: 0.5, windFrom: 0, visibility: 250, kp: 2 },
  norrsken: { temp: -14, precip: 0, snow: 0, code: 0, cloud: 0, wind: 0.5, windFrom: 0, visibility: 30000, kp: 7 },
}
const trying = (() => {
  const q = new URLSearchParams(location.search).get('vader')
  const key = q?.toLowerCase() ?? ''
  return TRY[({ sno: 'snö', snostorm: 'snöstorm' } as Record<string, string>)[key] ?? key]
})()

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))

/** WMO weather codes: what falls, how hard, and what to call it. */
function kind(code: number): { what: 'none' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'showers' | 'snowshowers' | 'thunder'; k: number } {
  if (code === 45 || code === 48) return { what: 'fog', k: 0 }
  if (code >= 51 && code <= 57) return { what: 'drizzle', k: [0.2, 0.3, 0.45][Math.min(2, Math.floor((code - 51) / 2))] }
  if (code >= 61 && code <= 67) return { what: 'rain', k: [0.35, 0.65, 1][Math.min(2, Math.floor((code - 61) / 2))] }
  if (code >= 71 && code <= 75) return { what: 'snow', k: [0.35, 0.65, 1][(code - 71) / 2] ?? 0.65 }
  if (code === 77) return { what: 'snow', k: 0.25 }
  if (code >= 80 && code <= 82) return { what: 'showers', k: [0.4, 0.7, 1][code - 80] }
  if (code === 85 || code === 86) return { what: 'snowshowers', k: code === 85 ? 0.5 : 0.9 }
  if (code >= 95) return { what: 'thunder', k: 1 }
  return { what: 'none', k: 0 }
}

export function interpret(r: RawWeather): Weather {
  const t = r.temp ?? 0
  let { what, k } = kind(r.code)
  // (a code that says dry while something is falling: go by the amount, mm per quarter hour)
  if (k === 0 && r.precip > 0.05) {
    what = r.snow > 0 ? 'snow' : 'rain'
    k = clamp((r.precip * 4) / 3, 0.2, 1)
  }
  // how much of it is snow: snow codes are snow, rain turns to sleet and then snow as it gets colder
  const falls = what !== 'none' && what !== 'fog'
  const snowy = what === 'snow' || what === 'snowshowers' ? 1 : t <= 0.5 ? 1 : t < 2.5 ? 0.5 : r.snow > 0 ? 0.3 : 0
  let snow = falls ? k * snowy : 0
  const rain = falls ? k * (1 - snowy) : 0
  // a hard, clear frost: a glitter of ice crystals in the air
  if (!falls && t <= -6 && r.cloud < 40) snow = 0.04
  // the wind blows *from* windFrom: towards the opposite way
  const a = (r.windFrom * Math.PI) / 180
  const vis = r.visibility ?? 20000
  const fog = clamp(1 + Math.log10(10000 / Math.max(vis, 50)) * 1.5, 1, 4) * (what === 'fog' ? 1.3 : 1)
  const aurora = r.kp == null ? 1 : 0.4 + 0.6 * clamp((r.kp - 1) / 3, 0, 2)

  const sleet = falls && snowy > 0 && snowy < 1
  const label =
    what === 'fog' ? 'dimma'
    : what === 'thunder' ? 'åska'
    : sleet ? 'snöblandat regn'
    : what === 'snow' || (falls && snowy === 1 && what !== 'snowshowers') ? (k < 0.4 ? 'lätt snöfall' : k < 0.8 ? 'snöfall' : 'ymnigt snöfall')
    : what === 'snowshowers' ? 'snöbyar'
    : what === 'drizzle' ? 'duggregn'
    : what === 'showers' ? 'regnskurar'
    : what === 'rain' ? (k < 0.8 ? 'regn' : 'kraftigt regn')
    : snow > 0 ? 'iskristaller i luften'
    : r.cloud < 20 ? 'klart'
    : r.cloud < 50 ? 'mest klart'
    : r.cloud < 85 ? 'halvklart'
    : 'mulet'
  const emoji =
    what === 'fog' ? '🌫️'
    : what === 'thunder' ? '⛈️'
    : sleet ? '🌨️'
    : snow > 0.05 ? '❄️'
    : rain > 0 ? '🌧️'
    : snow > 0 ? '✨'
    : r.cloud < 20 ? '✨'
    : r.cloud < 85 ? '⛅'
    : '☁️'
  const windy = r.wind >= 14 ? ', storm' : r.wind >= 9 ? ', blåsigt' : ''
  // (a high Kp and a clear sky: worth looking up)
  const lights = r.kp != null && r.kp >= 4 && r.cloud < 50 ? ' · norrsken!' : ''

  return {
    snow,
    rain,
    cloud: clamp(r.cloud / 100),
    wind: r.wind,
    windX: -Math.sin(a),
    windZ: Math.cos(a),
    fog,
    aurora,
    temp: r.temp,
    emoji,
    label: label + windy + lights,
  }
}

/** One line for the HUD: "❄️ −3 °C i Stockholm · lätt snöfall". */
export function weatherLine(w: Weather) {
  const temp = w.temp == null ? '' : ` ${Math.round(w.temp).toString().replace('-', '−')} °C`
  return `${w.emoji}${temp} i Stockholm · ${w.label}`
}

/** Fetches Stockholm's weather now and every ten minutes, and hands it on as it changes. */
export function watchWeather(onChange: (w: Weather) => void) {
  if (trying) {
    onChange(interpret(trying))
    return
  }
  let had = false
  const load = async () => {
    try {
      const res = await fetch('/api/vader')
      if (!res.ok) throw new Error(String(res.status))
      onChange(interpret((await res.json()) as RawWeather))
      had = true
    } catch {
      // (not there – in local development, or Stockholm down: keep what we had, or the village's own snow)
      if (!had) onChange(interpret(FALLBACK))
    }
  }
  load()
  setInterval(load, 10 * 60 * 1000)
}
