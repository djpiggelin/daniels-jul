import type { Config } from '@netlify/functions'

// The weather in Stockholm right now, for the village (jul3d/src/vader.ts): Open-Meteo's current
// conditions, and NOAA's planetary Kp index for how likely the northern lights are. Cached at the
// edge for ten minutes, so every visitor sees the same sky and the sources are asked rarely.

const WEATHER =
  'https://api.open-meteo.com/v1/forecast?latitude=59.33&longitude=18.07&wind_speed_unit=ms&timezone=Europe%2FStockholm' +
  '&current=temperature_2m,precipitation,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,visibility'
const KP = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'

async function getJSON(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.json()
}

/** The latest Kp (0–9); the list's rows are objects, or arrays with a header row in older versions. */
function latestKp(rows: unknown): number | null {
  if (!Array.isArray(rows) || !rows.length) return null
  const last = rows[rows.length - 1]
  const kp = Array.isArray(last) ? Number(last[1]) : Number((last as { Kp?: unknown }).Kp)
  return Number.isFinite(kp) ? kp : null
}

export default async () => {
  const [w, k] = await Promise.allSettled([getJSON(WEATHER), getJSON(KP)])
  if (w.status === 'rejected') {
    return new Response(JSON.stringify({ error: 'Inget väder just nu' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  }
  const c = w.value.current ?? {}
  const body = {
    at: c.time ?? null,
    temp: c.temperature_2m ?? null,
    /** mm over the last quarter of an hour, and how much of it fell as snow (cm) */
    precip: c.precipitation ?? 0,
    snow: c.snowfall ?? 0,
    code: c.weather_code ?? 0,
    cloud: c.cloud_cover ?? 0,
    wind: c.wind_speed_10m ?? 0,
    /** where the wind comes from, degrees from north */
    windFrom: c.wind_direction_10m ?? 0,
    visibility: c.visibility ?? null,
    kp: k.status === 'fulfilled' ? latestKp(k.value) : null,
  }
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=600, stale-while-revalidate=600',
    },
  })
}

export const config: Config = { path: '/api/vader' }
