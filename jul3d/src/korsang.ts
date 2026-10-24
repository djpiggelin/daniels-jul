// The gang singing round a little tree of their own at the side of the square, like the end of the
// Christmas show on TV: Musse, Mimmi, Kalle, Kajsa and Långben on a riser, Knattarna and Piff & Puff in
// front and Pluto at their feet, howling along. They keep a concert diary (see choirMode below): an
// advent concert, the Lucia procession round the big tree – Mimmi is Lucia – carols now and then
// after Lucia, and julafton in red. The singing is real choirs – the US Air Force Band's Singing
// Sergeants and two Swedish 78s from 1947 (see public/sounds/README.md for each
// recording's source and licence) – fading in as you come near.
import * as THREE from 'three'
import { keepApart, mergeRigid } from './batch'
import { Playlist } from './sfx'
import { rod, std } from './sleigh'
import { glowTexture } from './tex'
import { Kalle, Musse, Toon } from './toons'
import { TOUCH } from './device'
import { CYCLE, PROGRAM, buildLuciaConcert, darknessAt, luciaTray, programAt } from './luciatag'
import { SUNG } from './sung'
import { LIGHTER_AT, RISER, STAGE, STAGE_YAW, buildAdventConcert, buildAdventStake, stageToWorld } from './adventskonsert'
import type { Circle } from './world'

const black = std(0x16161a, 0.55)
const white = std(0xfbfaf6, 0.7)
const glove = std(0xffffff, 0.6)
const pupil = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.2 })
const mouthMat = std(0x4a0f14, 0.6)

function ball(r: number, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  return m
}
function eyes(head: THREE.Group, y: number, z: number, gap: number, r: number, lashes = false) {
  for (const s of [-1, 1]) {
    head.add(ball(r, white, s * gap, y, z, 0.75, 1.15, 0.5))
    head.add(ball(r * 0.42, pupil, s * gap * 0.9, y - r * 0.15, z + r * 0.4, 0.8, 1.3, 0.5))
    if (lashes)
      for (const k of [-1, 0, 1]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.035, 0.008), black)
        l.position.set(s * gap + k * r * 0.35 + s * r * 0.2, y + r * 1.15, z + r * 0.1)
        l.rotation.z = -s * 0.3 - k * 0.3
        head.add(l)
      }
  }
}
/** A dark open mouth that the song moves (scaled in y). */
/** A dark open mouth that the song moves (scaled in y), with a red tongue showing when it opens. */
function mouth(head: THREE.Group, x: number, y: number, z: number, r: number) {
  const m = keepApart(ball(r, mouthMat, x, y, z, 1.35, 0.3, 0.6))
  m.add(ball(r * 0.55, std(0xd8505a, 0.6), 0, -r * 0.35, r * 0.4, 0.85, 0.6, 0.6))
  head.add(m)
  return m
}

/* ---------- the rest of the gang (Musse and Kalle come from toons.ts) ---------- */

class Mimmi extends Toon {
  constructor() {
    super()
    const red = std(0xe0306a, 0.55)
    const dot = std(0xfbfaf6, 0.6)
    const yellow = std(0xf2c230, 0.5)
    const skin = std(0xf3c9a0, 0.65)
    for (const x of [-0.07, 0.07]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.38, 0)
      hip.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.31, 0), 0.03, black))
      hip.add(ball(0.075, yellow, 0, -0.33, 0.06, 1, 0.6, 1.5))
      this.legs.push(hip)
      this.body.add(hip)
    }
    // a polka-dot skirt
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.28, 18, 1, true), red)
    skirt.position.y = 0.48
    skirt.material = new THREE.MeshStandardMaterial({ color: 0xe0306a, roughness: 0.55, side: THREE.DoubleSide })
    this.body.add(skirt)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const y = 0.4 + (i % 2) * 0.09
      const r = 0.2 - (y - 0.4) * 0.7
      this.body.add(ball(0.018, dot, Math.sin(a) * r, y, Math.cos(a) * r, 1, 1, 0.4))
    }
    this.body.add(ball(0.13, black, 0, 0.66, 0, 1, 1.1, 0.95))
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.12, 0.72, 0)
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.28, 0), 0.024, black))
      g.add(ball(0.055, glove, 0, -0.31, 0, 1.1, 1, 0.9))
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    this.head.position.y = 0.98
    this.head.add(ball(0.18, black, 0, 0, 0))
    this.head.add(ball(0.15, skin, 0, -0.04, 0.07, 1.05, 0.85, 0.9))
    this.head.add(ball(0.08, skin, 0, -0.07, 0.18, 1.1, 0.8, 1.3))
    this.head.add(ball(0.037, black, 0, -0.04, 0.28, 1.2, 0.9, 1))
    eyes(this.head, 0.04, 0.14, 0.05, 0.043, true)
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.025, 24), black)
      ear.rotation.x = Math.PI / 2
      ear.position.set(s * 0.18, 0.18, -0.03)
      this.head.add(ear)
      // the big bow on top, polka-dotted
      const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 12), red)
      lobe.rotation.z = (s * Math.PI) / 2
      lobe.position.set(s * 0.08, 0.2, 0.02)
      this.head.add(lobe)
      this.head.add(ball(0.014, dot, s * 0.1, 0.21, 0.06))
    }
    this.head.add(ball(0.035, red, 0, 0.2, 0.03))
    this.finish(1.2)
  }
}

class Kajsa extends Toon {
  constructor() {
    super()
    const orange = std(0xf29a1d, 0.55)
    const lilac = std(0xb05fc8, 0.6)
    const pink = std(0xf26aa6, 0.5)
    for (const x of [-0.08, 0.08]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.18, 0)
      hip.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.15, 0), 0.03, orange))
      hip.add(ball(0.075, orange, 0, -0.16, 0.06, 1.1, 0.3, 1.6))
      this.legs.push(hip)
      this.body.add(hip)
    }
    this.body.add(ball(0.19, white, 0, 0.34, 0, 1, 1.05, 1))
    const blouse = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.26, 16), lilac)
    blouse.position.y = 0.48
    this.body.add(blouse)
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.15, 0.56, 0)
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.2, 0), 0.038, lilac))
      g.add(ball(0.048, white, 0, -0.24, 0, 1, 1.2, 0.9))
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    this.head.position.y = 0.78
    this.head.add(ball(0.165, white, 0, 0, 0))
    this.head.add(ball(0.095, orange, 0, -0.05, 0.155, 1.05, 0.3, 1.3))
    this.head.add(ball(0.075, orange, 0, -0.09, 0.125, 0.95, 0.24, 1.15))
    eyes(this.head, 0.06, 0.12, 0.055, 0.044, true)
    // a bow on her head
    for (const s of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 12), pink)
      lobe.rotation.z = (s * Math.PI) / 2
      lobe.position.set(s * 0.065, 0.17, -0.02)
      this.head.add(lobe)
    }
    this.head.add(ball(0.03, pink, 0, 0.17, -0.01))
    this.finish(1.25)
  }
}

/** Knatte, Fnatte and Tjatte: little Kalles in caps and shirts of their own colour. */
class Knatte extends Toon {
  constructor(color: number) {
    super()
    const orange = std(0xf29a1d, 0.55)
    const c = std(color, 0.6)
    for (const x of [-0.07, 0.07]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.16, 0)
      hip.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.13, 0), 0.028, orange))
      hip.add(ball(0.07, orange, 0, -0.14, 0.05, 1.1, 0.3, 1.6))
      this.legs.push(hip)
      this.body.add(hip)
    }
    this.body.add(ball(0.17, white, 0, 0.3, 0, 1, 1.05, 1))
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.22, 16), c)
    shirt.position.y = 0.42
    this.body.add(shirt)
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.14, 0.48, 0)
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.17, 0), 0.034, c))
      g.add(ball(0.044, white, 0, -0.2, 0, 1, 1.2, 0.9))
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    this.head.position.y = 0.68
    this.head.add(ball(0.15, white, 0, 0, 0))
    this.head.add(ball(0.085, orange, 0, -0.045, 0.14, 1.05, 0.3, 1.3))
    this.head.add(ball(0.068, orange, 0, -0.08, 0.115, 0.95, 0.24, 1.15))
    eyes(this.head, 0.055, 0.11, 0.05, 0.04)
    // a cap worn a bit askew, the peak to the front
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), c)
    cap.position.set(0, 0.06, 0)
    cap.rotation.z = -0.15
    this.head.add(cap)
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.015, 16, 1, false, -Math.PI / 2, Math.PI), c)
    peak.position.set(0, 0.07, 0.1)
    this.head.add(peak)
    this.finish(1.05)
  }
}

class Langben extends Toon {
  constructor() {
    super()
    const orange = std(0xe8682a, 0.6)
    const vest = std(0x1b1b20, 0.6)
    const blue = std(0x2a4f9e, 0.7)
    const brown = std(0x6b3d1e, 0.6)
    const tan = std(0xf0d2a8, 0.65)
    const green = std(0x3c8a3a, 0.6)
    for (const x of [-0.09, 0.09]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.62, 0)
      hip.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.55, 0), 0.045, blue))
      hip.add(ball(0.09, brown, 0, -0.58, 0.08, 1, 0.55, 1.8))
      this.legs.push(hip)
      this.body.add(hip)
    }
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.42, 16), orange)
    shirt.position.y = 0.84
    this.body.add(shirt)
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.165, 0.36, 16, 1, true, -2.4, 4.8), vest)
    v.position.y = 0.84
    this.body.add(v)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 12), orange)
    neck.position.y = 1.1
    this.body.add(neck)
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.15, 1.0, 0)
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.38, 0), 0.035, orange))
      g.add(ball(0.06, glove, 0, -0.41, 0, 1.1, 1, 0.9))
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    // the long, friendly face: black head, tan muzzle, two buck teeth, long floppy ears, a green hat
    this.head.position.y = 1.32
    this.head.add(ball(0.15, black, 0, 0, 0, 1, 1.1, 1))
    this.head.add(ball(0.11, tan, 0, -0.06, 0.17, 0.9, 0.75, 1.5))
    this.head.add(ball(0.045, black, 0, -0.01, 0.33, 1.3, 1, 1))
    for (const s of [-1, 1]) this.head.add(new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.012), white).translateX(s * 0.016).translateY(-0.13).translateZ(0.26))
    eyes(this.head, 0.06, 0.12, 0.05, 0.045)
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.09), black)
      ear.position.set(s * 0.15, -0.08, -0.02)
      ear.rotation.z = s * 0.15
      this.head.add(ear)
    }
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 16), green)
    hat.position.y = 0.19
    hat.rotation.z = 0.12
    this.head.add(hat)
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 18), green)
    brim.position.y = 0.1
    this.head.add(brim)
    this.finish(1.25)
  }
}

/** Pluto sits, head up. */
class Pluto extends Toon {
  constructor() {
    super()
    const fur = std(0xf2b33a, 0.75)
    const green = std(0x2f8a3a, 0.5)
    for (const x of [-0.08, 0.08]) {
      const leg = new THREE.Group()
      leg.position.set(x, 0.3, 0.12)
      leg.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.27, 0.02), 0.035, fur))
      leg.add(ball(0.05, fur, 0, -0.28, 0.06, 1, 0.6, 1.4))
      this.legs.push(leg)
      this.body.add(leg)
      // haunches, sitting
      this.body.add(ball(0.11, fur, x * 1.4, 0.1, -0.12, 1, 0.8, 1.3))
    }
    this.body.add(ball(0.17, fur, 0, 0.28, -0.04, 0.85, 1.25, 0.9))
    this.body.add(rod(new THREE.Vector3(0, 0.08, -0.22), new THREE.Vector3(0, 0.3, -0.4), 0.02, fur))
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 20), green)
    collar.rotation.x = Math.PI / 2 - 0.3
    collar.position.set(0, 0.47, 0.03)
    this.body.add(collar)
    this.armL.position.set(0, 0, 0)
    this.armR.position.set(0, 0, 0)
    this.head.position.set(0, 0.58, 0.05)
    this.head.add(ball(0.12, fur, 0, 0, 0))
    this.head.add(ball(0.09, fur, 0, -0.03, 0.14, 0.85, 0.75, 1.5))
    this.head.add(ball(0.04, black, 0, 0.0, 0.28, 1.2, 0.9, 1))
    eyes(this.head, 0.06, 0.08, 0.045, 0.04)
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.08), black)
      ear.position.set(s * 0.11, -0.05, -0.02)
      ear.rotation.z = s * 0.35
      this.head.add(ear)
    }
    this.finish(1.3)
  }
}

/** Piff and Puff: the chipmunks (Puff's nose is the big red one). */
class Chipmunk extends Toon {
  constructor(red: boolean) {
    super()
    const fur = std(0x9a5a2c, 0.8)
    const belly = std(0xf0cf9a, 0.8)
    for (const x of [-0.05, 0.05]) {
      const hip = new THREE.Group()
      hip.position.set(x, 0.1, 0)
      hip.add(ball(0.045, fur, 0, -0.05, 0.03, 1, 0.6, 1.5))
      this.legs.push(hip)
      this.body.add(hip)
    }
    this.body.add(ball(0.11, fur, 0, 0.2, 0, 1, 1.2, 0.95))
    this.body.add(ball(0.08, belly, 0, 0.19, 0.05, 1, 1.2, 0.8))
    this.body.add(ball(0.1, fur, 0, 0.3, -0.16, 0.8, 1.6, 0.8))
    this.body.add(ball(0.06, black, 0, 0.32, -0.12, 0.3, 1.5, 0.6))
    const arm = (side: number, g: THREE.Group) => {
      g.position.set(side * 0.09, 0.26, 0)
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.09, 0), 0.022, fur))
      g.add(ball(0.025, fur, 0, -0.1, 0))
      return g
    }
    this.body.add(arm(-1, this.armL), arm(1, this.armR))
    this.head.position.y = 0.4
    this.head.add(ball(0.1, fur, 0, 0, 0))
    this.head.add(ball(0.07, belly, 0, -0.03, 0.06, 1.1, 0.8, 0.9))
    this.head.add(ball(red ? 0.032 : 0.022, red ? std(0xd8202c, 0.4) : black, 0, -0.01, 0.13))
    for (const s of [-1, 1]) this.head.add(ball(0.035, fur, s * 0.07, 0.08, -0.02, 1, 1, 0.4))
    this.head.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), white).translateY(-0.07).translateZ(0.11))
    eyes(this.head, 0.03, 0.07, 0.035, 0.03)
    this.finish(1.3)
  }
}

/* ---------- when they're there, and what they sing ---------- */
// (Swedish time, so everybody in the village sees the same choir at the same moment)
//
//   första advent       all day and evening – an advent concert
//   13 december         from 06:30 all day – the Lucia procession, round the big tree, again and again
//   13–23 december      now and then (the same moments for everyone) – carols
//   julafton            all day, in red
//   otherwise           away (the nook and its little tree wait for them)
//
// To try it out: ?kor=advent|lucia|jul|julafton|borta, or a time: ?datum=2026-12-13&tid=07:00
// (and with ?kor=lucia, &start=700 to begin that many seconds into the Lucia concert)
// (it carries on ticking from there).

export type ChoirMode = 'borta' | 'advent' | 'lucia' | 'jul' | 'julafton'
const MODES: ChoirMode[] = ['borta', 'advent', 'lucia', 'jul', 'julafton']

const S = '/sounds/kor/'
const SONGS: Record<Exclude<ChoirMode, 'borta'>, string[]> = {
  // (in this order; Hosianna, Otto Olsson's Advent and Bereden väg för Herran are sung once their
  // recordings are in kor/, and skipped till then)
  advent: ['hosianna', 'advent-otto-olsson', 'bereden-vag-for-herran', 'o-come-all-ye-faithful', 'o-little-town-of-bethlehem', 'hark-the-herald-angels-sing'].map((f) => `${S}${f}.mp3`),
  lucia: ['sankta-lucia', 'stilla-natt'].map((f) => `${S}${f}.mp3`),
  jul: ['deck-the-halls', 'o-tannenbaum', 'hark-the-herald-angels-sing', 'o-come-all-ye-faithful', 'o-little-town-of-bethlehem', 'stilla-natt'].map((f) => `${S}${f}.mp3`),
  julafton: ['stilla-natt', 'carols-of-the-season', 'o-tannenbaum', 'deck-the-halls'].map((f) => `${S}${f}.mp3`),
}

const query = new URLSearchParams(location.search)
const forced = MODES.includes(query.get('kor') as ChoirMode) ? (query.get('kor') as ChoirMode) : null
/** A pretend time from the URL, as wall-clock ms (read with the getUTC* methods). */
const pretend = (() => {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(query.get('datum') ?? '')
  if (!d) return null
  const t = /^(\d{1,2}):(\d{2})$/.exec(query.get('tid') ?? '') ?? [, '12', '00']
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]))
})()
const loadedAt = Date.now()
const stockholm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

/** Stockholm's wall clock right now, as ms whose getUTC* parts are Stockholm's date and time. */
export function wallClock() {
  if (pretend !== null) return pretend + (Date.now() - loadedAt)
  // (the date and the milliseconds from the same moment, or it could slip back a second as one ticks over)
  const now = new Date()
  const p = Object.fromEntries(stockholm.formatToParts(now).map((x) => [x.type, x.value]))
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) + now.getMilliseconds()
}

/** The real moment (UTC ms) – for the sun: now, or the pretend Swedish time in the URL. */
export function swedenNow() {
  if (pretend === null) return Date.now()
  // the pretend time is Stockholm's wall clock: find the moment that reads like that there
  const wall = wallClock()
  const guess = wall - 3600000
  const p = Object.fromEntries(stockholm.formatToParts(new Date(guess)).map((x) => [x.type, x.value]))
  const there = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return guess + (wall - there)
}

/** Seconds since midnight on the wall clock, with the milliseconds. */
function secondsOfDay() {
  return (((wallClock() % 86400000) + 86400000) % 86400000) / 1000
}

/** The first Sunday of Advent: four Sundays before Christmas Day. */
/** The first Sunday of Advent (midnight, as a wall-clock date). */
export function firstAdvent(year: number) {
  const xmas = new Date(Date.UTC(year, 11, 25))
  const back = xmas.getUTCDay() === 0 ? 7 : xmas.getUTCDay()
  return new Date(Date.UTC(year, 11, 25 - back - 21))
}

/** A number in [0, 1) that is the same for everyone for this text. */
function chance(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

export function choirMode(now = wallClock()): ChoirMode {
  if (forced) return forced
  const d = new Date(now)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes()
  const advent = firstAdvent(y)
  if (m === advent.getUTCMonth() + 1 && day === advent.getUTCDate() && minutes >= 8 * 60) return 'advent'
  if (m === 12 && day === 13 && minutes >= 6 * 60 + 30) return 'lucia'
  if (m === 12 && day === 24) return 'julafton'
  if (m === 12 && day >= 13 && day <= 23 && minutes >= 9 * 60 && minutes < 22 * 60) {
    // twenty-minute slots, about a third of them with the choir in
    const slot = Math.floor(minutes / 20)
    if (chance(`${y}-${m}-${day}-${slot}`) < 0.35) return 'jul'
  }
  return 'borta'
}

/* ---------- the choir ---------- */

type Kind = 'sing' | 'squeak' | 'howl'
type Singer = {
  toon: Toon
  mouth: THREE.Mesh
  open: number
  kind: Kind
  phase: number
  /** Where they stand in the nook (local to it). */
  home: { x: number; y: number; z: number; yaw: number }
  /** …and on the riser in front of the big tree, at the advent concert. */
  stage: { x: number; y: number; z: number; yaw: number }
  /** Costume parts shown in one mode or another. */
  wear: { book: THREE.Object3D[]; lucia: THREE.Object3D[]; julafton: THREE.Object3D[]; advent: THREE.Object3D[] }
  spacing: number
  look: Look
  /** Light or put out the candle (and Lucia's crown). */
  light: (on: boolean) => void
}

type Look = {
  make: () => Toon
  kind?: Kind
  /** In toon units: shoulder height, robe radius at top and bottom, where a hat sits on the head and how wide. */
  shoulder: number
  robe: [number, number]
  hatY: number
  hatR: number
  /** The right hand, in the arm (for the candle). */
  hand: number
  girl?: boolean
  lucia?: boolean
  mouth: [number, number, number, number]
  book: [number, number] | null
}

const robeGeo = new Map<string, THREE.CylinderGeometry>()
function robe(parent: THREE.Object3D, l: Look, color: number, collar: number) {
  const key = `${l.shoulder}|${l.robe}`
  if (!robeGeo.has(key)) robeGeo.set(key, new THREE.CylinderGeometry(l.robe[0], l.robe[1], l.shoulder - 0.04, 18, 1, true))
  const g = new THREE.Group()
  const m = new THREE.Mesh(robeGeo.get(key)!, new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }))
  m.position.y = (l.shoulder - 0.04) / 2 + 0.04
  g.add(m)
  const c = new THREE.Mesh(new THREE.TorusGeometry(l.robe[0] * 0.95, 0.025, 6, 18), std(collar, 0.7))
  c.rotation.x = Math.PI / 2
  c.position.y = l.shoulder - 0.01
  g.add(c)
  parent.add(g)
  return g
}

/** A lit candle, upright, for the right hand. */
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })
function candle(arm: THREE.Group, l: Look, glowTex: THREE.Texture) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 8), std(0xfbf8f2, 0.5)).translateY(0.08))
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 8), flameMat).translateY(0.185))
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  glow.position.y = 0.19
  glow.scale.setScalar(0.32)
  g.add(glow)
  g.position.set(0, -l.hand, 0.04)
  // the arm is held forward (rotation.x = −1.1): tip the candle back so it stands up
  g.rotation.x = 1.1
  arm.add(g)
  return g
}

/** The Lucia crown: lingonberry leaves and seven candles. */
function crown(head: THREE.Group, l: Look, glowTex: THREE.Texture) {
  const g = new THREE.Group()
  g.position.y = l.hatY
  const ring = new THREE.Mesh(new THREE.TorusGeometry(l.hatR, 0.03, 8, 24), std(0x1d5e3a, 0.8))
  ring.rotation.x = Math.PI / 2
  g.add(ring)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.11, 6), std(0xfbf8f2, 0.5)).translateX(Math.sin(a) * l.hatR).translateZ(Math.cos(a) * l.hatR).translateY(0.055))
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.035, 6), flameMat).translateX(Math.sin(a) * l.hatR).translateZ(Math.cos(a) * l.hatR).translateY(0.13))
    g.add(ball(0.012, std(0xc8102e, 0.4), Math.sin(a + 0.45) * l.hatR * 1.05, 0.01, Math.cos(a + 0.45) * l.hatR * 1.05))
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  glow.position.y = 0.12
  glow.scale.setScalar(0.7)
  g.add(glow)
  head.add(g)
  return g
}

/** A star boy's tall white cone, with three gold stars on the front. */
function strut(head: THREE.Group, l: Look) {
  const g = new THREE.Group()
  const h = l.hatR * 3.4
  g.position.y = l.hatY
  g.add(new THREE.Mesh(new THREE.ConeGeometry(l.hatR, h, 18), std(0xfbf8f2, 0.6)).translateY(h / 2))
  const gold = new THREE.MeshStandardMaterial({ color: 0xf6c453, roughness: 0.3, metalness: 0.7, emissive: 0x6a4a10, emissiveIntensity: 0.5 })
  for (let i = 0; i < 3; i++) {
    const y = h * (0.22 + i * 0.25)
    const r = l.hatR * (1 - (y / h)) + 0.004
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(l.hatR * 0.22), gold)
    s.position.set(0, y, r)
    s.scale.z = 0.35
    g.add(s)
  }
  head.add(g)
  return g
}

/** A red tomte hat with a white brim and bobble. */
function tomteluva(head: THREE.Group, l: Look) {
  const g = new THREE.Group()
  g.position.y = l.hatY
  const h = l.hatR * 2.4
  const cone = new THREE.Mesh(new THREE.ConeGeometry(l.hatR, h, 16), std(0xc8102e, 0.6))
  cone.position.set(0, h / 2, -0.02)
  cone.rotation.x = -0.35
  g.add(cone)
  const brim = new THREE.Mesh(new THREE.TorusGeometry(l.hatR, 0.03, 8, 20), std(0xfbf8f2, 0.9))
  brim.rotation.x = Math.PI / 2
  g.add(brim)
  g.add(ball(0.035, std(0xfbf8f2, 0.9), 0, h * 0.9, -h * 0.38))
  head.add(g)
  return g
}

/** A songbook held up in front, in both hands. */
function songbook(toon: Toon, y: number, z: number) {
  const book = new THREE.Group()
  const cover = std(0xa0132a, 0.6)
  for (const s of [-1, 1]) {
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.01), cover)
    page.position.set(s * 0.05, 0, 0)
    page.rotation.y = -s * 0.35
    book.add(page)
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.005), white)
    paper.position.set(s * 0.05, 0, 0.007)
    paper.rotation.y = -s * 0.35
    book.add(paper)
  }
  book.position.set(0, y, z)
  book.rotation.x = -0.5
  toon.body.add(book)
  return book
}

const moving = <T extends THREE.Object3D>(o: T): T => {
  mergeRigid(o)
  return keepApart(o)
}

/** `bakery`: Tomtens bageri's group – there are lussebullar on its counter on Lucia day. */
export function buildChoir(scene: THREE.Scene, bakery?: THREE.Object3D) {
  const group = new THREE.Group()
  const colliders: Circle[] = []
  const song = new Playlist(1)
  // a nook of their own on the east side of the square, between Julstugan and Arkitektkontoret,
  // with a little tree behind them – facing out over the square towards the big tree
  const A = THREE.MathUtils.degToRad(104)
  const R = 24.5
  group.position.set(Math.sin(A) * R, 0, -Math.cos(A) * R)
  group.rotation.y = Math.atan2(-group.position.x, -group.position.z)

  // their own little tree, with twinkling bulbs, a star and presents under it
  const tree = new THREE.Group()
  tree.position.set(0, 0, -2.0)
  const needles = std(0x1d5236, 0.9)
  const snowy = std(0xf4f8ff, 0.9)
  tree.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.7, 10), std(0x4a2c1c, 0.9)).translateY(0.35))
  for (const [r, h, y] of [[1.25, 1.5, 1.2], [0.95, 1.3, 2.0], [0.62, 1.1, 2.75], [0.32, 0.8, 3.35]]) {
    tree.add(new THREE.Mesh(new THREE.ConeGeometry(r, h, 18), needles).translateY(y))
    tree.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.4, h * 0.28, 18), snowy).translateY(y + h * 0.37))
  }
  const BULBS = 70
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), BULBS)
  bulbs.material.userData.glimmer = 0.22
  const bulbCols = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff, 0xfff4d6].map((c) => new THREE.Color(c))
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < BULBS; i++) {
    const k = i / BULBS
    const y = 0.6 + k * 3.0
    const rr = THREE.MathUtils.lerp(1.2, 0.1, k) + 0.04
    const a = k * Math.PI * 2 * 6
    bulbs.setMatrixAt(i, m4.makeTranslation(Math.cos(a) * rr, y, Math.sin(a) * rr))
    bulbs.setColorAt(i, bulbCols[i % bulbCols.length])
  }
  bulbs.computeBoundingSphere()
  tree.add(keepApart(bulbs))
  const star = keepApart(new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false })))
  star.position.y = 3.85
  tree.add(star)
  const glowTex = glowTexture('rgba(255,214,140,0.9)', 'rgba(255,170,70,0)')
  const starGlow = keepApart(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false })))
  starGlow.position.y = 3.85
  starGlow.scale.setScalar(1.8)
  tree.add(starGlow)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4
    const s = 0.24 + (i % 3) * 0.06
    const gift = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), std([0xd8202c, 0x2f9a4a, 0xf6c453, 0x4a7bd0, 0xfbf8f2][i], 0.6))
    gift.position.set(Math.cos(a) * 1.0, s * 0.4, Math.sin(a) * 1.0)
    gift.rotation.y = a
    tree.add(gift)
  }
  group.add(tree)

  // a low riser for the back row, snow along its edge, and a lantern either side
  const top = 0.38
  const stage = new THREE.Mesh(new THREE.BoxGeometry(4.0, top, 1.0), std(0x7a4a24, 0.8))
  stage.position.set(0, top / 2, -0.72)
  stage.castShadow = stage.receiveShadow = true
  group.add(stage)
  const rim = new THREE.Mesh(new THREE.BoxGeometry(4.04, 0.05, 1.04), snowy)
  rim.position.set(0, top + 0.02, -0.72)
  group.add(rim)
  const iron = std(0x15151c, 0.5, 0.6)
  const lamp = new THREE.MeshStandardMaterial({ color: 0x3a2410, emissive: 0xffc070, emissiveIntensity: 1.6 })
  for (const sx of [-1, 1]) {
    const x = sx * 2.45
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.5, 6), iron).translateX(x).translateY(0.75).translateZ(-0.5))
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), lamp).translateX(x).translateY(1.65).translateZ(-0.5))
    group.add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 4), iron).translateX(x).translateY(1.89).translateZ(-0.5).rotateY(Math.PI / 4))
    const g = keepApart(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false })))
    g.position.set(x, 1.65, -0.5)
    g.scale.setScalar(1.6)
    group.add(g)
  }
  // presents for Piff and Puff to stand on
  for (const x of [-1.45, 1.45]) {
    const gift = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), std(x > 0 ? 0x2f9a4a : 0xd8202c, 0.6))
    gift.position.set(x, 0.18, 0.25)
    gift.castShadow = true
    group.add(gift)
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.37, 0.08), std(0xf6c453, 0.4))
    rib.position.copy(gift.position)
    group.add(rib)
  }
  const light = new THREE.PointLight(0xffc98a, 10, 9, 1.5)
  light.position.set(0, 2.6, 1.2)
  group.add(light)
  scene.add(group)
  group.updateMatrixWorld(true)

  // the singers move about (to the Lucia procession and back), so they're kept out of the nook's bake
  const people = keepApart(new THREE.Group())
  scene.add(people)
  const singers: Singer[] = []
  const nook = (x: number, z: number) => group.localToWorld(new THREE.Vector3(x, 0, z))
  const join = (l: Look, x: number, y: number, z: number, yaw: number, spacing = 1.1) => {
    const toon = l.make()
    const wear: Singer['wear'] = { book: [], lucia: [], julafton: [], advent: [] }
    if (l.book) wear.book.push(moving(songbook(toon, l.book[0], l.book[1])))
    if (l.shoulder > 0) {
      // Lucia: white gowns for all, red sashes for the girls, a crown for Lucia, cones for the star boys
      const gown = robe(toon.body, l, 0xfbf8f2, 0xfbf8f2)
      if (l.girl) {
        const sash = new THREE.Mesh(new THREE.TorusGeometry((l.robe[0] + l.robe[1]) / 2 + 0.01, 0.02, 6, 20), std(0xc8102e, 0.5))
        sash.rotation.x = Math.PI / 2
        sash.position.y = l.shoulder * 0.62
        gown.add(sash)
      }
      wear.lucia.push(moving(gown), moving(l.lucia ? crown(toon.head, l, glowTex) : l.girl ? new THREE.Group() : strut(toon.head, l)))
      wear.lucia.push(moving(candle(toon.armR, l, glowTex)))
      // julafton: red choir robes with white collars
      wear.julafton.push(moving(robe(toon.body, l, 0xc8102e, 0xfbf8f2)))
      // advent: violet robes – the colour of Advent – with white collars
      wear.advent.push(moving(robe(toon.body, l, 0x5b2a86, 0xfbf8f2)))
    } else {
      // (Pluto: a violet bow on his collar)
      const bow = new THREE.Group()
      bow.position.set(0, 0.45, 0.12)
      const violet = std(0x6a2fa0, 0.5)
      for (const s of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 10), violet)
        lobe.rotation.z = (s * Math.PI) / 2
        lobe.position.x = s * 0.04
        bow.add(lobe)
      }
      bow.add(ball(0.02, violet, 0, 0, 0.005))
      toon.body.add(bow)
      wear.advent.push(moving(bow))
    }
    wear.julafton.push(moving(tomteluva(toon.head, l)))
    const m = mouth(toon.head, ...l.mouth)
    mergeRigid(toon.group)
    const flames: THREE.Object3D[] = []
    for (const o of wear.lucia) o.traverse((x) => ((x as THREE.Mesh).material === flameMat || (x as THREE.Sprite).isSprite) && flames.push(x))
    const light = (on: boolean) => {
      for (const f of flames) f.visible = on
    }
    const p = nook(x, z)
    toon.group.position.set(p.x, y, p.z)
    toon.setYaw(group.rotation.y + yaw)
    people.add(toon.group)
    // (the riser by the big tree is laid out like their nook)
    const sp = stageToWorld(x, z)
    const stage = { x: sp.x, y, z: sp.z, yaw: STAGE_YAW + yaw }
    singers.push({ toon, mouth: m, open: 0, kind: l.kind ?? 'sing', phase: Math.random() * Math.PI * 2, home: { x: p.x, y, z: p.z, yaw: group.rotation.y + yaw }, stage, wear, spacing, look: l, light })
  }
  const MUSSE: Look = { make: () => new Musse(), shoulder: 0.76, robe: [0.15, 0.24], hatY: 0.17, hatR: 0.13, hand: 0.33, mouth: [0, -0.15, 0.2, 0.065], book: [0.5, 0.2] }
  const MIMMI: Look = { make: () => new Mimmi(), shoulder: 0.76, robe: [0.14, 0.26], hatY: 0.17, hatR: 0.15, hand: 0.31, girl: true, lucia: true, mouth: [0, -0.145, 0.19, 0.06], book: [0.5, 0.2] }
  const KALLE: Look = { make: () => new Kalle(), shoulder: 0.6, robe: [0.17, 0.24], hatY: 0.15, hatR: 0.13, hand: 0.24, mouth: [0, -0.085, 0.24, 0.075], book: [0.4, 0.2] }
  const KAJSA: Look = { make: () => new Kajsa(), shoulder: 0.6, robe: [0.16, 0.24], hatY: 0.14, hatR: 0.13, hand: 0.24, girl: true, mouth: [0, -0.085, 0.23, 0.07], book: [0.4, 0.2] }
  const LANGBEN: Look = { make: () => new Langben(), shoulder: 1.1, robe: [0.15, 0.26], hatY: 0.29, hatR: 0.12, hand: 0.41, mouth: [0, -0.15, 0.26, 0.065], book: [0.78, 0.22] }
  const knatte = (c: number): Look => ({ make: () => new Knatte(c), shoulder: 0.5, robe: [0.14, 0.2], hatY: 0.11, hatR: 0.12, hand: 0.2, mouth: [0, -0.08, 0.2, 0.065], book: [0.35, 0.17] })
  const chip = (red: boolean): Look => ({ make: () => new Chipmunk(red), kind: 'squeak', shoulder: 0.3, robe: [0.09, 0.13], hatY: 0.08, hatR: 0.08, hand: 0.1, mouth: [0, -0.075, 0.11, 0.04], book: null })
  const PLUTO: Look = { make: () => new Pluto(), kind: 'howl', shoulder: 0, robe: [0, 0], hatY: 0.1, hatR: 0.09, hand: 0, mouth: [0, -0.09, 0.24, 0.055], book: null }
  // in the order they walk in the Lucia procession: Lucia first, then her tärna, then the star boys
  join(MIMMI, 0.75, top, -0.75, -0.1)
  join(KAJSA, 1.5, top, -0.7, -0.25)
  join(MUSSE, -0.75, top, -0.75, 0.1)
  join(KALLE, -1.5, top, -0.7, 0.25)
  join(LANGBEN, 0, top, -0.8, 0, 1.3)
  for (const [i, c] of [0xd8202c, 0x2f6fc6, 0x2f9a4a].entries()) join(knatte(c), -0.6 + i * 0.6, 0, 0.3, 0.15 - i * 0.15, 0.9)
  join(chip(false), -1.45, 0.36, 0.25, 0.3, 0.7)
  join(chip(true), 1.45, 0.36, 0.25, -0.3, 0.7)
  join(PLUTO, 0.35, 0, 1.05, -0.2, 1.0)

  // bump into the riser and the little tree always; into the singers only while they're there
  for (const [x, z, r] of [[0, -2.0, 1.2], [-1.4, -0.72, 0.6], [0, -0.72, 0.6], [1.4, -0.72, 0.6], [-2.45, -0.5, 0.15], [2.45, -0.5, 0.15], [-1.45, 0.25, 0.3], [1.45, 0.25, 0.3]] as const) {
    const p = nook(x, z)
    colliders.push({ x: p.x, z: p.z, r })
  }
  const front: Circle[] = []
  for (const [x, z] of [[-0.6, 0.3], [0, 0.3], [0.6, 0.3], [0.35, 1.05]] as const) {
    const p = nook(x, z)
    front.push({ x: p.x, z: p.z, r: 0.25 })
  }
  colliders.push(...front)

  /* ---------- the Lucia concert (luciatag.ts) ---------- */
  const squeaks = singers.filter((s) => s.kind === 'squeak')
  const concert = buildLuciaConcert(
    scene,
    singers.map((s) => ({
      toon: s.toon,
      girl: !!s.look.girl,
      lucia: s.look.lucia,
      tall: s.look.shoulder > 1,
      // Pluto at Lucia's side, Piff and Puff at the ends of the front row
      spot: s.kind === 'howl' ? new THREE.Vector3(1.0, 0, -58.3) : s.kind === 'squeak' ? new THREE.Vector3(s === squeaks[0] ? -3.9 : 3.9, 0, -59.0) : undefined,
      light: s.light,
    })),
    glowTex,
  )
  // (?kor=lucia&start=700 starts that many seconds into it – handy for trying the end)
  // (on the real clock, not added up frame by frame: a slow frame rate mustn't leave it behind the music)
  const luciaFrom = performance.now() / 1000 - (Number(query.get('start')) || 0)
  /** Seconds into the Lucia concert's cycle: from 06:30 on the wall clock, or since ?kor=lucia was opened. */
  function luciaTime(dt: number) {
    if (forced) return (performance.now() / 1000 - luciaFrom) % CYCLE
    // (to the millisecond: whole seconds would have them walking in jerks)
    const sec = secondsOfDay() - (6 * 3600 + 30 * 60)
    return ((sec % CYCLE) + CYCLE) % CYCLE
  }

  // lussebullar on the bakery counter, all of Lucia day
  const tray = bakery ? moving(luciaTray()) : null
  if (tray && bakery) {
    tray.position.set(-3.5, 0.85, 1.75)
    tray.scale.setScalar(1.3)
    bakery.add(tray)
  }
  const luciaDay = () => {
    if (forced) return forced === 'lucia'
    const d = new Date(wallClock())
    return d.getUTCMonth() === 11 && d.getUTCDate() === 13
  }

  /* ---------- the first Sunday of Advent (adventskonsert.ts) ---------- */
  const advent = buildAdventConcert(scene)
  const stake = buildAdventStake(scene, glowTex)
  colliders.push(...advent.colliders, ...stake.colliders)
  const mimmi = singers.find((s) => s.look.lucia)!
  /** Seconds into the advent concert: from 08:00 on the wall clock, or since ?kor=advent was opened. */
  function adventTime() {
    if (forced) return performance.now() / 1000 - luciaFrom
    return secondsOfDay() - 8 * 3600
  }
  // Before the first song Mimmi steps down from the riser, lights the first advent candle and goes back.
  const LIGHTER = stageToWorld(LIGHTER_AT.x, LIGHTER_AT.z)
  const WAY = [
    new THREE.Vector3(mimmi.stage.x, RISER, mimmi.stage.z),
    stageToWorld(1.75, -0.75).setY(RISER),
    stageToWorld(2.3, -0.15),
    LIGHTER,
  ]
  const legs = WAY.slice(1).map((p, i) => p.distanceTo(WAY[i]))
  const WALK = legs.reduce((a, b) => a + b) / 0.9
  const SET_OFF = 3
  /** When the match touches the wick, and when the music starts (she's back in her place). */
  const LIGHT_AT = SET_OFF + WALK + 1.6
  const INTRO = LIGHT_AT + 2 + WALK + 2.5
  /** Where Mimmi is `u` seconds into her walk (0 … WALK along WAY). */
  function along(u: number, out: THREE.Vector3) {
    let d = THREE.MathUtils.clamp(u, 0, WALK) * 0.9
    for (let i = 0; i < legs.length; i++) {
      if (d <= legs[i] || i === legs.length - 1) return out.lerpVectors(WAY[i], WAY[i + 1], Math.min(1, d / legs[i]))
      d -= legs[i]
    }
    return out
  }
  const step = new THREE.Vector3()
  const ahead = new THREE.Vector3()
  /** Mimmi's walk to the candlestick and back; returns false once she's in her place again. */
  function lighting(at: number) {
    if (at < SET_OFF || at > INTRO - 2.5) return false
    const t = mimmi.toon
    const there = SET_OFF + WALK
    const back = LIGHT_AT + 2
    let walking = true
    if (at < there) {
      along(at - SET_OFF, step)
      along(at - SET_OFF + 0.3, ahead)
    } else if (at < back) {
      walking = false
      step.copy(LIGHTER)
      ahead.copy(stake.group.position).setY(0)
    } else {
      along(WALK - (at - back), step)
      along(WALK - (at - back) - 0.3, ahead)
    }
    t.group.position.copy(step)
    if (ahead.distanceToSquared(step) > 1e-6) t.setYaw(Math.atan2(ahead.x - step.x, ahead.z - step.z))
    if (at > INTRO - 3.2) t.setYaw(THREE.MathUtils.lerp(t.group.rotation.y, mimmi.stage.yaw, 0.1))
    t.walkPose(at * 5.5, walking ? 0.6 : 0)
    // the match: the right arm comes up to the wick, and back down
    const reach = walking ? 0 : Math.sin(THREE.MathUtils.clamp((at - there) / (back - there), 0, 1) * Math.PI)
    t.armR.rotation.set(-1.1 - reach * 0.5, 0, -0.45 + reach * 0.35)
    return true
  }
  /** Today's date on the village clock – or, when ?kor= says which day without a ?datum, that day. */
  function seasonDay() {
    const now = new Date(wallClock())
    if (pretend !== null || !forced || forced === 'borta') return now
    const y = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
    if (forced === 'advent') return new Date(firstAdvent(y).getTime() + 8 * 3600000)
    return new Date(Date.UTC(y, 11, forced === 'lucia' ? 13 : forced === 'jul' ? 20 : 24, 12))
  }
  /** The candlestick through the season: hidden until the first Sunday of Advent, put away after tjugondag Knut. */
  function candlestick(ceremony: boolean) {
    const d = seasonDay()
    let y = d.getUTCFullYear()
    if (d.getUTCMonth() === 0) y--
    const days = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - firstAdvent(y).getTime()) / 86400000)
    const knut = Date.UTC(y + 1, 0, 13)
    stake.group.visible = days >= 0 && d.getTime() < knut + 86400000
    for (const c of stake.colliders) c.r = stake.group.visible ? Math.abs(c.r) : -Math.abs(c.r)
    // a candle more every Sunday; on the first one, only once Mimmi has lit it
    let lit = Math.min(4, Math.floor(days / 7) + 1)
    if (days === 0 && !ceremony) lit = 0
    // (candle i is first lit on Sunday i, and burns down a little more every week after)
    stake.set(lit, [0, 1, 2, 3].map((i) => Math.max(0, Math.min(days, 42) / 7 - i)))
  }

  /* ---------- the mode: who's where, wearing what ---------- */
  let mode: ChoirMode | null = null
  const setMode = (next: ChoirMode) => {
    if (next === mode) return
    mode = next
    people.visible = next !== 'borta'
    if (tray) tray.visible = luciaDay()
    concert.show(next === 'lucia')
    advent.show(next === 'advent')
    // (a collider with a negative radius never pushes)
    for (const c of front) c.r = next === 'borta' || next === 'lucia' || next === 'advent' ? -1 : 0.25
    for (const s of singers) {
      for (const o of s.wear.book) o.visible = next !== 'lucia'
      for (const o of s.wear.lucia) o.visible = next === 'lucia'
      for (const o of s.wear.julafton) o.visible = next === 'julafton'
      for (const o of s.wear.advent) o.visible = next === 'advent'
      const t = s.toon
      if (next === 'lucia') {
        t.armR.rotation.set(-1.1, 0, -0.15)
        t.armL.rotation.set(0, 0, 0.25)
      } else {
        const at = next === 'advent' ? s.stage : s.home
        t.group.position.set(at.x, at.y, at.z)
        t.setYaw(at.yaw)
        t.walkPose(0, 0)
        if (s.wear.book.length) {
          t.armL.rotation.set(-1.1, 0, 0.45)
          t.armR.rotation.set(-1.1, 0, -0.45)
        }
      }
    }
    if (song.playing) song.stop()
    // (the advent concert goes through its songs in order, from Hosianna; the others start anywhere)
    song.ordered = next === 'advent'
    candlestick(adventTime() >= LIGHT_AT)
    // the first song ready before anyone walks up (decoding takes a few seconds)
    if (next === 'lucia') song.preload([`${S}${PROGRAM[0].song}.mp3`])
    else if (next !== 'borta') song.prepare(SONGS[next])
  }
  setMode(choirMode())

  /* ---------- Lucia morning: everything else goes dark ---------- */
  // The world is dimmed through the renderer's exposure (main.ts reads `darkness`). Things that
  // ignore exposure – the bulbs on the trees, string lights, lamp flames – are made to follow it for
  // as long as the procession walks; only the candles and Lucia's crown stay as bright as ever, with a
  // warm light going along with them.
  let darkness = 0
  let dimmed: THREE.Material[] = []
  /** The trees' bulbs and the street lamps (marked userData.glimmer): not put out, only turned down that far. */
  let glimmer: { m: THREE.MeshBasicMaterial; base: THREE.Color; to: number }[] = []
  const candleLight = new THREE.PointLight(0xffb060, 0, 14, 1.4)
  /** What the renderer's exposure is multiplied by when it's fully dark: low (ACES needs it low), but
   *  enough to make out the houses and paths – a little more on a phone's small, dimmer screen. */
  const FLOOR = TOUCH ? 0.075 : 0.045
  const exposure = () => 1 - (1 - FLOOR) * darkness
  scene.add(candleLight)
  const theirs = new Set<THREE.Material>()
  for (const root of [people, concert.group]) root.traverse((o) => {
    const m = (o as THREE.Mesh).material
    for (const x of Array.isArray(m) ? m : m ? [m] : []) theirs.add(x)
  })
  function dim(on: boolean) {
    if (!on) {
      for (const m of dimmed) {
        m.toneMapped = false
        m.needsUpdate = true
      }
      dimmed = []
      for (const g of glimmer) g.m.color.copy(g.base)
      glimmer = []
      return
    }
    const seen = new Set<THREE.Material>()
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material
      for (const x of Array.isArray(m) ? m : m ? [m] : []) {
        if (seen.has(x) || theirs.has(x) || x.toneMapped !== false) continue
        seen.add(x)
        if (x.userData.glimmer) {
          const m = x as THREE.MeshBasicMaterial
          glimmer.push({ m, base: m.color.clone(), to: x.userData.glimmer })
          continue
        }
        x.toneMapped = true
        x.needsUpdate = true
        dimmed.push(x)
      }
    })
  }

  let twinkle = 0
  let modeCheck = 0
  const tint = new THREE.Color()
  /** Full voice within NEAR metres of them, fading to nothing at FAR. */
  const NEAR = 7
  const FAR = 24
  const centre = nook(0, 0)
  let loud = 0
  /** How loud the singing was last frame, 0 … 1 (for the Lucia villagers' mouths). */
  let voice = 0
  let floor = 0.2
  let peak = 0.3
  let t = 0
  /** Is somebody singing at this moment of the recording (see sung.ts)? */
  function sungNow() {
    const p = song.position()
    if (!p) return false
    const parts = SUNG[p.url.slice(p.url.lastIndexOf('/') + 1).replace(/.mp3$/, '')]
    return !parts || parts.some(([a, b]) => p.at >= a && p.at <= b)
  }
  function update(dt: number, player: THREE.Vector3, enabled: boolean) {
    t += dt
    // the little tree twinkles (a few times a second is plenty)
    if ((twinkle -= dt) <= 0) {
      twinkle = 0.12
      for (let i = 0; i < BULBS; i++) bulbs.setColorAt(i, tint.copy(bulbCols[i % bulbCols.length]).multiplyScalar(0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + i * 1.37))))
      bulbs.instanceColor!.needsUpdate = true
      star.rotation.y = t
    }
    if ((modeCheck -= dt) <= 0) {
      modeCheck = 10
      setMode(choirMode())
      candlestick(adventTime() >= LIGHT_AT)
    }
    stake.update(t, dt)
    // the first Sunday of Advent: the first candle is lit before the concert begins
    let intro = false
    let lit = adventTime() >= LIGHT_AT
    if (mode === 'advent') {
      const at = adventTime()
      intro = at < INTRO
      if (lighting(at)) {
        if (at >= LIGHT_AT && !lit) {
          lit = true
          candlestick(true)
        }
      } else if (at > INTRO - 2.5 && at < INTRO + 1) {
        mimmi.toon.group.position.set(mimmi.stage.x, mimmi.stage.y, mimmi.stage.z)
        mimmi.toon.setYaw(mimmi.stage.yaw)
        mimmi.toon.walkPose(0, 0)
        mimmi.toon.armR.rotation.set(-1.1, 0, -0.45)
      }
      advent.update(t, voice)
    }
    // Lucia: the concert runs on its clock – where everyone is, what's playing, how dark it is
    let at = mode === 'advent' ? STAGE : centre
    let dark = 0
    let cue: { song: string; offset: number } | null = null
    if (mode === 'lucia') {
      const lt = luciaTime(dt)
      at = concert.update(lt, t, voice)
      dark = darknessAt(lt)
      cue = programAt(lt)
    }
    // the dark comes in slowly as the procession sets off, and lifts as slowly afterwards
    darkness += (dark - darkness) * Math.min(1, dt * 0.4)
    if (mode === 'lucia' && !dimmed.length) dim(true)
    if (mode !== 'lucia' && dimmed.length && darkness < 0.02) dim(false)
    for (const g of glimmer) g.m.color.copy(g.base).multiplyScalar(1 - (1 - g.to) * darkness)
    const lucia = concert.lucia
    // (over Lucia once she is there; until then over the choir)
    if (darkness > 0.01) candleLight.position.set(lucia.shown ? lucia.pos.x : at.x, 1.7, (lucia.shown ? lucia.pos.z : at.z) + 0.6)
    // (the world is dimmed through exposure, which dims this light too – so it is turned up to match)
    candleLight.intensity = (6 * darkness * (lucia.lit && lucia.shown ? 1 : 0.45)) / exposure()
    if (mode === 'borta') return
    // at Lucia: whatever is playing now ready to hear wherever you are, and the next song too before it starts
    if (mode === 'lucia') {
      const i = cue ? PROGRAM.findIndex((p) => p.song === cue!.song) : -1
      if (cue) song.preload([`${S}${cue.song}.mp3`])
      if (!cue || cue.offset > 15) song.preload([`${S}${PROGRAM[(i + 1) % PROGRAM.length].song}.mp3`])
    }
    const d = mode === 'lucia' ? concert.distanceTo(player) : Math.hypot(player.x - at.x, player.z - at.z)
    // (at Lucia it fades too as the candles go out, one column after another)
    const fade = mode === 'lucia' ? 0.12 + 0.88 * concert.litShare : 1
    // (and at advent, not a note till the first candle is lit and Mimmi is back in her place)
    const vol = enabled && !intro ? 0.9 * fade * THREE.MathUtils.clamp((FAR - d) / (FAR - NEAR), 0, 1) : 0
    if (vol > 0.003) {
      if (mode === 'lucia') {
        song.cue(cue ? `${S}${cue.song}.mp3` : null, cue?.offset ?? 0)
      }
      else song.start(SONGS[mode!])
      song.level(vol)
    } else if (song.playing) {
      song.level(0.0001)
      if (d > FAR + 4 || !enabled) song.stop()
    }
    // the mouths follow the singing: how loud it is right now, between this song's quiet (the old
    // records crackle) and its recent loudest – so every syllable opens and closes them
    const raw = song.loudness()
    loud += (raw - loud) * Math.min(1, dt * 25)
    floor = loud < floor ? floor + (loud - floor) * Math.min(1, dt * 3) : floor + dt * 0.004
    peak = Math.max(loud, peak - dt * 0.05, floor + 0.05)
    const level = THREE.MathUtils.clamp((loud - floor) / (peak - floor), 0, 1)
    // (only where there's singing in the recording – not through the band's intros and interludes)
    const singing = loud > 0.04 && level > 0.12 && sungNow()
    voice = singing ? level : 0
    for (const s of singers) {
      // (at Lucia, the ones who have put out their candle have stopped singing)
      const sings = singing && (mode !== 'lucia' || concert.singing(s.toon))
      let want = sings ? 0.05 + level ** 1.3 * (0.85 + 0.15 * Math.sin(t * 9 + s.phase)) : 0
      if (s.kind === 'squeak') want = sings ? 0.1 + level * (0.6 + 0.4 * Math.sin(t * 15 + s.phase)) : 0
      // Pluto only joins in now and then, with a long howl
      if (s.kind === 'howl') want = sings && Math.sin(t * 0.9) > 0.6 ? 0.9 : 0.1
      // at the fika after the Lucia concert: munching lussebullar
      if (mode === 'lucia' && concert.eating(s.toon)) want = 0.1 + Math.max(0, Math.sin(t * 7 + s.phase)) * 0.35
      s.open += (want - s.open) * Math.min(1, dt * 22)
      s.mouth.scale.y = 0.12 + s.open * 1.3
      const head = s.toon.head
      if (singing && mode !== 'lucia') {
        head.rotation.z = Math.sin(t * 2.6 + s.phase * 0.2) * 0.1
        head.rotation.x = s.kind === 'howl' ? -0.5 - s.open * 0.3 : -0.08 - s.open * 0.06
      } else {
        head.rotation.z *= 1 - Math.min(1, dt * 3)
        head.rotation.x = s.kind === 'howl' ? -0.3 : 0
      }
    }
  }

  return {
    group,
    people,
    colliders,
    update,
    get mode() {
      return mode
    },
    /** 0 … 1: how far the world is dimmed for the Lucia procession. */
    get darkness() {
      return darkness
    },
    /** Multiplies the renderer's exposure (1 normally, about 0.03 in the dark of the Lucia concert). */
    get exposure() {
      return exposure()
    },
  }
}
