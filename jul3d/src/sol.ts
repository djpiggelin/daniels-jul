// Where the sun is over Stockholm at a given moment, and so how light it is in the village: the long
// dark of December (light only from about nine to three, the sun barely clearing the trees) and the
// light summer nights alike.
import * as THREE from 'three'

const LAT = THREE.MathUtils.degToRad(59.33)
const LON = 18.07
const rad = THREE.MathUtils.degToRad

/** The sun's height above the horizon and its bearing from north (radians), at `utc` (ms). */
export function sunPosition(utc: number) {
  // (the usual low-precision formulae: good to a fraction of a degree)
  const d = utc / 86400000 - 10957.5
  const g = rad(357.529 + 0.98560028 * d)
  const q = 280.459 + 0.98564736 * d
  const L = rad(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g))
  const e = rad(23.439 - 0.00000036 * d)
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))
  const dec = Math.asin(Math.sin(e) * Math.sin(L))
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15
  const ha = rad(gmst + LON) - ra
  const elevation = Math.asin(Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(ha))
  const azimuth = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(LAT) - Math.sin(LAT) * Math.cos(ha))
  return { elevation, azimuth }
}

/**
 * How light it is (0 night … 1 day, rising through twilight from 10° below the horizon to 6° above)
 * and where the light comes from – north is −z in the village, east +x.
 */
export function daylightAt(utc: number) {
  const { elevation, azimuth } = sunPosition(utc)
  const k = THREE.MathUtils.smoothstep(THREE.MathUtils.radToDeg(elevation), -10, 6)
  const dir = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation))
  return { k, dir }
}
