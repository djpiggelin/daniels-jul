// Tiny WebAudio effects, so we don't have to ship sound files.
let ctx: AudioContext | null = null
const audio = () => (ctx ??= new AudioContext())

export function blip(freq = 880, dur = 0.08, type: OscillatorType = 'square', vol = 0.06) {
  try {
    const a = audio()
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, a.currentTime)
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, a.currentTime + dur)
    g.gain.setValueAtTime(vol, a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
    o.connect(g).connect(a.destination)
    o.start()
    o.stop(a.currentTime + dur)
  } catch {
    /* audio not available */
  }
}

let noiseBuf: AudioBuffer | null = null
/** Filtered noise: a soft "puff" (low) or a "whoosh" (sweeping). */
export function noise(dur: number, from: number, to: number, vol: number, q = 0.8) {
  try {
    const a = audio()
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate)
      const d = noiseBuf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    const src = a.createBufferSource()
    src.buffer = noiseBuf
    const f = a.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = q
    f.frequency.setValueAtTime(from, a.currentTime)
    f.frequency.exponentialRampToValueAtTime(to, a.currentTime + dur)
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, a.currentTime)
    g.gain.exponentialRampToValueAtTime(vol, a.currentTime + Math.min(0.03, dur / 4))
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
    src.connect(f).connect(g).connect(a.destination)
    src.start()
    src.stop(a.currentTime + dur)
  } catch {
    /* audio not available */
  }
}

export const puff = (vol = 0.35) => noise(0.28, 900, 220, vol, 0.6)
export const whoosh = () => noise(0.32, 500, 2400, 0.12, 1.4)

/* ---------- the camper trip ---------- */
/** One putt of an old engine (call it in time with the revs). */
export const putter = (revs: number) => blip(48 + revs * 30, 0.06, 'sawtooth', 0.025)
/** The fan's ribs clicking shut one by one. */
export const ratchet = () => blip(1500 + Math.random() * 500, 0.025, 'square', 0.025)
/** Something big landing in the dirt. */
export const thud = () => noise(0.6, 260, 50, 0.7, 0.5)
/** A lever pulled. */
export const clunk = () => {
  blip(140, 0.08, 'square', 0.05)
  setTimeout(() => blip(95, 0.1, 'square', 0.05), 70)
}
/** Two-tone train whistle. */
export function horn() {
  blip(330, 0.5, 'sawtooth', 0.04)
  blip(415, 0.5, 'sawtooth', 0.035)
  setTimeout(() => {
    blip(330, 0.7, 'sawtooth', 0.04)
    blip(415, 0.7, 'sawtooth', 0.035)
  }, 550)
}
/** The crossing bell. */
export const bell = () => blip(1900, 0.12, 'triangle', 0.035)
/** A bump that rattles the crockery in the back. */
export function rattle() {
  noise(0.12, 600, 300, 0.25)
  for (let i = 0; i < 3; i++) setTimeout(() => blip(2600 + Math.random() * 1200, 0.04, 'triangle', 0.025), 30 + i * 45)
}

/* ---------- Tjuren Ferdinand ---------- */
/** A crowd swelling up and dying away: `vol` 0..1, `dur` seconds. */
export function crowd(dur = 2.5, vol = 0.5, pitch = 1) {
  try {
    const a = audio()
    if (!noiseBuf) noise(0.01, 500, 500, 0.0001)
    const src = a.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const f = a.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 0.5
    f.frequency.setValueAtTime(700 * pitch, a.currentTime)
    f.frequency.linearRampToValueAtTime(1100 * pitch, a.currentTime + dur * 0.4)
    const g = a.createGain()
    const t = a.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.25 * vol, t + Math.min(0.5, dur * 0.25))
    g.gain.setValueAtTime(0.25 * vol, t + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(a.destination)
    src.start()
    src.stop(t + dur)
  } catch {
    /* audio not available */
  }
}
/** One hoof on hard sand (or cobbles). */
export const clop = (vol = 0.2) => noise(0.05, 1800, 900, vol, 2)
/** A bull blowing out through its nose. */
export const snort = (vol = 0.4) => noise(0.45, 380, 140, vol, 0.7)
/** Your heart, through a blindfold. */
export function heartbeat(vol = 0.12) {
  blip(55, 0.12, 'sine', vol)
  setTimeout(() => blip(48, 0.14, 'sine', vol * 0.8), 160)
}
/** A bumblebee going past (call often for a steady buzz). */
export const buzz = (vol = 0.03) => blip(210 + Math.random() * 40, 0.09, 'sawtooth', vol)
/** Trumpets: the paseíllo fanfare. */
export function fanfare() {
  const notes = [392, 523, 659, 784, 659, 784]
  const lens = [0.14, 0.14, 0.14, 0.32, 0.14, 0.6]
  let at = 0
  notes.forEach((n, i) => {
    setTimeout(() => {
      blip(n, lens[i], 'sawtooth', 0.04)
      blip(n * 1.005, lens[i], 'square', 0.02)
    }, at * 1000)
    at += lens[i] + 0.04
  })
}
/** Long two-note whistle from the stands (a miss, a fall). */
export function boo() {
  blip(260, 0.6, 'triangle', 0.05)
  setTimeout(() => blip(200, 0.8, 'triangle', 0.05), 300)
}

/* ---------- the paso doble in the bullring ---------- */
// An original little march in the paso doble style: trumpets over an oom-pah band and castanets, A minor with the
// Spanish E-major turn, then a trio in A major. Written out as [midi note, beats] (0 = rest), two beats a bar.
type Bar = [number, number][]
const MINOR: Bar[] = [
  [[76, 0.75], [77, 0.25], [76, 0.5], [74, 0.25], [72, 0.25]],
  [[71, 0.5], [72, 0.5], [69, 1]],
  [[68, 0.75], [69, 0.25], [71, 0.5], [72, 0.25], [74, 0.25]],
  [[76, 1.5], [0, 0.5]],
  [[77, 0.75], [76, 0.25], [74, 0.5], [72, 0.25], [71, 0.25]],
  [[72, 0.5], [71, 0.5], [68, 1]],
  [[69, 0.5], [71, 0.25], [72, 0.25], [74, 0.5], [76, 0.5]],
  [[69, 1.5], [0, 0.5]],
  [[81, 0.75], [80, 0.25], [81, 0.5], [76, 0.5]],
  [[77, 0.5], [76, 0.5], [74, 0.5], [72, 0.5]],
  [[74, 0.75], [72, 0.25], [74, 0.5], [77, 0.5]],
  [[81, 1.5], [0, 0.5]],
  [[76, 0.5], [81, 0.5], [84, 0.5], [83, 0.5]],
  [[83, 0.5], [81, 0.25], [80, 0.25], [77, 0.5], [76, 0.5]],
  [[74, 0.25], [72, 0.25], [71, 0.5], [68, 0.5], [71, 0.5]],
  [[69, 1.5], [0, 0.5]],
]
const MINOR_CHORDS = 'Am Am E E E E Am Am Am Am Dm Dm Am E Am Am'.split(' ')
const TRIO: Bar[] = [
  [[73, 1], [76, 1]],
  [[81, 1.5], [80, 0.5]],
  [[78, 0.5], [76, 0.5], [74, 0.5], [71, 0.5]],
  [[76, 2]],
  [[74, 1], [71, 1]],
  [[68, 1], [71, 0.5], [74, 0.5]],
  [[73, 0.5], [76, 0.5], [81, 0.5], [76, 0.5]],
  [[69, 2]],
  [[73, 1], [76, 1]],
  [[81, 1], [85, 1]],
  [[83, 0.5], [81, 0.5], [78, 0.5], [74, 0.5]],
  [[78, 2]],
  [[76, 0.75], [73, 0.25], [69, 0.5], [73, 0.5]],
  [[71, 0.5], [74, 0.5], [80, 0.5], [83, 0.5]],
  [[81, 2]],
  [[0, 2]],
]
const TRIO_CHORDS = 'A A E E E E A A A A D D A E A A'.split(' ')
/** Bass root and fifth, and the off-beat chord, for each chord name. */
const CHORDS: Record<string, { bass: [number, number]; notes: number[] }> = {
  Am: { bass: [45, 40], notes: [57, 60, 64] },
  E: { bass: [40, 47], notes: [56, 59, 62, 64] },
  Dm: { bass: [38, 45], notes: [57, 62, 65] },
  A: { bass: [45, 40], notes: [57, 61, 64] },
  D: { bass: [38, 45], notes: [57, 62, 66] },
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export class PasoDoble {
  private gain: GainNode | null = null
  private timer = 0
  private events: { at: number; fn: (t: number, out: AudioNode) => void }[] = []
  private length = 0
  private next = 0
  private loopAt = 0
  private beat = 60 / 118
  playing = false

  constructor() {
    // the whole tune as a list of timed events, in beats: the minor part twice, then the trio
    let at = 0
    const part = (bars: Bar[], chords: string[]) => {
      bars.forEach((bar, i) => {
        let t = at
        for (const [m, len] of bar) {
          if (m) this.events.push({ at: t, fn: (time, out) => this.trumpet(time, hz(m), len * this.beat, out) })
          t += len
        }
        const ch = CHORDS[chords[i]]
        for (let b = 0; b < 2; b++) {
          const bass = ch.bass[b]
          this.events.push({ at: at + b, fn: (time, out) => this.bass(time, hz(bass), out) })
          this.events.push({ at: at + b + 0.5, fn: (time, out) => this.chord(time, ch.notes, out) })
        }
        // castanets: ta-ka-ta … ta-ta
        for (const c of [0, 0.25, 0.5, 1, 1.5, 1.75]) this.events.push({ at: at + c, fn: (time, out) => this.click(time, c === 0 ? 1 : 0.6, out) })
        at += 2
      })
    }
    part(MINOR, MINOR_CHORDS)
    part(MINOR, MINOR_CHORDS)
    part(TRIO, TRIO_CHORDS)
    this.length = at
    this.events.sort((a, b) => a.at - b.at)
  }

  start(vol = 0.22) {
    if (this.playing) return
    try {
      const a = audio()
      void a.resume()
      this.playing = true
      this.gain = a.createGain()
      this.gain.gain.setValueAtTime(0.0001, a.currentTime)
      this.gain.gain.exponentialRampToValueAtTime(vol, a.currentTime + 0.8)
      this.gain.connect(a.destination)
      this.next = 0
      this.loopAt = a.currentTime + 0.1
      this.timer = window.setInterval(() => this.schedule(), 60)
      this.schedule()
    } catch {
      /* audio not available */
    }
  }

  /** Quieter (or back up) for a moment of drama. */
  level(vol: number, secs = 0.8) {
    if (!this.gain) return
    const a = audio()
    this.gain.gain.cancelScheduledValues(a.currentTime)
    this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), a.currentTime)
    this.gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), a.currentTime + secs)
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    clearInterval(this.timer)
    const g = this.gain
    this.gain = null
    if (!g) return
    const a = audio()
    g.gain.cancelScheduledValues(a.currentTime)
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.6)
    setTimeout(() => g.disconnect(), 800)
  }

  /** Queue up whatever falls in the next half second. */
  private schedule() {
    const a = audio()
    const out = this.gain
    if (!out) return
    const ahead = a.currentTime + 0.5
    for (;;) {
      const e = this.events[this.next]
      const time = this.loopAt + e.at * this.beat
      if (time > ahead) break
      // fell behind (a hidden tab): skip ahead rather than play a pile of notes at once
      if (time > a.currentTime - 0.05) e.fn(time, out)
      this.next++
      if (this.next >= this.events.length) {
        this.next = 0
        this.loopAt += this.length * this.beat
      }
    }
  }

  private trumpet(t: number, f: number, dur: number, out: AudioNode) {
    const a = audio()
    const g = a.createGain()
    const filter = a.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(900, t)
    filter.frequency.linearRampToValueAtTime(2600, t + 0.05)
    filter.Q.value = 1.5
    const end = t + Math.max(0.08, dur * 0.92)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.025)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.12)
    g.gain.setValueAtTime(0.22, end - 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    for (const [type, det] of [
      ['sawtooth', -6],
      ['square', 7],
    ] as const) {
      const o = a.createOscillator()
      o.type = type
      o.frequency.setValueAtTime(f, t)
      o.detune.setValueAtTime(det, t)
      // a little vibrato on the long notes
      if (dur > 0.6) {
        const lfo = a.createOscillator()
        const depth = a.createGain()
        lfo.frequency.value = 5.5
        depth.gain.setValueAtTime(0, t)
        depth.gain.linearRampToValueAtTime(14, t + dur * 0.8)
        lfo.connect(depth).connect(o.detune)
        lfo.start(t)
        lfo.stop(end)
      }
      o.connect(filter)
      o.start(t)
      o.stop(end + 0.02)
    }
    filter.connect(g).connect(out)
  }

  private bass(t: number, f: number, out: AudioNode) {
    const a = audio()
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(f, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.32)
  }

  /** The "pah": a short brassy stab of the chord on the off-beat. */
  private chord(t: number, notes: number[], out: AudioNode) {
    const a = audio()
    const g = a.createGain()
    const filter = a.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1500
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    for (const m of notes) {
      const o = a.createOscillator()
      o.type = 'square'
      o.frequency.setValueAtTime(hz(m), t)
      o.connect(filter)
      o.start(t)
      o.stop(t + 0.18)
    }
    filter.connect(g).connect(out)
  }

  private click(t: number, vol: number, out: AudioNode) {
    const a = audio()
    if (!noiseBuf) noise(0.01, 500, 500, 0.0001)
    const src = a.createBufferSource()
    src.buffer = noiseBuf
    const f = a.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 3200
    f.Q.value = 3
    const g = a.createGain()
    g.gain.setValueAtTime(0.5 * vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + 0.04)
  }
}

/* ---------- Marche Militaire (Leksaksfabriken's toy soldiers) ---------- */
// Schubert's Marche militaire No. 1 in D, D.733 (1818 – long in the public domain), from the
// Mutopia Project's public-domain edition: the opening fanfare, the march twice, its second part
// and the march again, round and round. Glockenspiel and piccolo on the tune, tuba on the bass,
// the band's chord on the off-beats and a snare – a toy band, for the toy soldiers.
//
// Bars are written as notes with their length in sixteenths ("F#5:4" is a quarter), "r" a rest.
const FANFARE = ['D4:2 A3:1 A3:1 G#3:2 A3:2', 'D4:2 A3:1 A3:1 G#3:2 A3:2', 'D4:2 A3:2 D4:2 A3:2', 'D4:2 A3:2 F#3:2 A3:2', 'D4:2 A3:2 D4:2 F#4:2', 'A4:8']
const MARCH = {
  tune: [
    'A5:4 G5:2 F#5:2', 'E5:4 F#5:2 E5:2', 'D5:4 E5:2 F#5:2', 'A4:3 B4:1 A4:2 r:2',
    'A5:4 G5:2 F#5:2', 'B5:4 A5:2 F#5:2', 'G5:2 A5:1 G5:1 F#5:2 G5:1 F#5:1', 'E5:1 E5:1 F#5:1 G5:1 A5:1 B5:1 C#6:1 D6:1',
    'E6:2 E6:1 E6:1 D6:2 E6:2', 'F#6:2 G6:2 A6:4', 'E6:2 F#6:2 G6:4', 'F#6:2 E6:2 D6:4',
    'E6:2 E6:1 E6:1 D6:2 E6:2', 'F#6:2 G6:2 A6:4', 'G#6:2 A6:2 B6:3 C#7:1', 'A6:4 r:4',
  ],
  bass: [
    'D2:4 r:4', 'A1:4 r:4', 'D2:4 r:4', 'A1:4 r:4',
    'D2:4 r:4', 'B1:4 r:4', 'E2:2 r:2 B1:2 r:2', 'E2:4 r:4',
    'A1:4 r:2 A1:2', 'D2:4 r:2 F#1:2', 'A1:4 r:2 A1:2', 'D2:2 A1:2 D2:4',
    'A1:4 r:2 A1:2', 'D2:4 r:2 D2:2', 'E2:2 E2:2 E2:3 E2:1', 'A1:2 A2:1 A2:1 A2:2 A2:2',
  ],
  chords: ['D', 'A7', 'D', 'A7', 'D', 'Bm', 'B7', 'A7', 'A7', 'D', 'A7', 'D', 'A7', 'D', 'E7', 'A'],
}
const SECOND = {
  tune: [
    'G6:2 E6:2 G6:2 E6:2', 'G6:2 E6:2 G6:2 E6:2', 'C6:2 C6:1 C6:1 B5:2 C6:2', 'D6:2 C6:1 C6:1 B5:2 C6:2',
    'D6:2 C6:2 D6:2 C6:2', 'D6:2 C6:2 D6:2 C6:2', 'E6:4 D#6:2 D6:2', 'C6:4 B5:2 A5:2',
    'G#5:4 A5:2 B5:2', 'A5:1 G#5:1 A5:1 B5:1 C6:2 C#6:2', 'D6:4 C#6:2 C6:2', 'B5:4 A5:2 G5:2',
    'F#5:4 G5:2 A5:2', 'G5:1 F#5:1 G5:1 A5:1 B5:2 B5:1 B5:1', 'B5:4 C#6:2 D#6:2', 'E6:2 F#6:2 G6:2 G#6:2',
    'A6:4 B6:1 A6:1 B6:1 C#7:1', 'A6:2 r:6',
  ],
  bass: [
    'G3:2 E3:2 G3:2 E3:2', 'G3:2 E3:2 G3:2 E3:2', 'C3:2 C3:1 C3:1 G2:2 C3:2', 'G2:2 C3:1 C3:1 G2:2 C3:2',
    'G2:2 C3:2 G2:2 C3:2', 'G2:2 C3:2 G2:2 C3:2', 'E2:4 r:4', 'E2:4 r:4',
    'E2:4 r:4', 'A2:4 r:4', 'D2:4 r:4', 'D2:4 r:4',
    'D2:4 r:4', 'G2:4 r:2 B2:1 B2:1', 'B2:4 A#2:2 A2:2', 'G2:2 F#2:2 E2:2 D2:2',
    'C#2:4 E2:4', 'A2:2 r:6',
  ],
  chords: ['C', 'C', 'C', 'G7', 'G7', 'G7', 'E', 'Am', 'E', 'Am', 'D7', 'G', 'D7', 'G', 'B7', 'E7', 'A', 'A'],
}
const MARCH_CHORDS: Record<string, number[]> = {
  D: [62, 66, 69], A7: [61, 64, 67], A: [61, 64, 69], Bm: [62, 66, 71], B7: [63, 66, 69], E7: [62, 64, 68], E: [64, 68, 71],
  C: [60, 64, 67], G7: [59, 62, 65], G: [62, 67, 71], Am: [60, 64, 69], D7: [60, 62, 66],
}
const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** "F#5" → MIDI 78; 0 for a rest. */
function midi(name: string) {
  if (name === 'r') return 0
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)!
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
/** A bar as [MIDI note, length in beats (quarters)] pairs. */
const bar = (s: string) => s.split(' ').map((n) => {
  const [name, sixteenths] = n.split(':')
  return [midi(name), Number(sixteenths) / 4] as const
})

export class ToyMarch {
  private gain: GainNode | null = null
  private timer = 0
  private events: { at: number; fn: (t: number, out: AudioNode) => void }[] = []
  private length = 0
  private next = 0
  private loopAt = 0
  private startAt = 0
  readonly beat = 60 / 120
  playing = false

  constructor() {
    let at = 0
    const play = (line: string, voice: (t: number, f: number, dur: number, out: AudioNode) => void) => {
      let t = at
      for (const [m, len] of bar(line)) {
        if (m) {
          const start = t
          this.events.push({ at: start, fn: (time, out) => voice(time, hz(m), len * this.beat, out) })
        }
        t += len
      }
    }
    // the fanfare: the band in unison, the tuba an octave under
    FANFARE.forEach((b, i) => {
      play(b, (t, f, d, out) => this.horn(t, f, d, out))
      play(b, (t, f, d, out) => this.tuba(t, f / 2, d, out))
      this.events.push({ at: at + 1, fn: (time, out) => this.snare(time, 1, out) })
      if (i === 5) for (const r of [1, 1.25, 1.5, 1.75]) this.events.push({ at: at + r, fn: (time, out) => this.snare(time, 0.6, out) })
      at += 2
    })
    const part = (p: { tune: string[]; bass: string[]; chords: string[] }) => {
      p.tune.forEach((b, i) => {
        // the tune sits an octave under the page for the piccolo; the glockenspiel rings it at pitch
        play(b, (t, f, d, out) => {
          this.piccolo(t, f / 2, d, out)
          this.glock(t, f, out)
        })
        play(p.bass[i], (t, f, d, out) => this.tuba(t, f, d, out))
        for (const off of [0.5, 1.5]) this.events.push({ at: at + off, fn: (time, out) => this.stab(time, MARCH_CHORDS[p.chords[i]], out) })
        this.events.push({ at: at + 1, fn: (time, out) => this.snare(time, 1, out) })
        if (i % 4 === 3) for (const r of [1.5, 1.625, 1.75, 1.875]) this.events.push({ at: at + r, fn: (time, out) => this.snare(time, 0.5, out) })
        if (i === 0) this.events.push({ at, fn: (time, out) => this.cymbal(time, out) })
        at += 2
      })
    }
    part(MARCH)
    part(MARCH)
    part(SECOND)
    part(MARCH)
    this.length = at
    this.events.sort((a, b) => a.at - b.at)
  }

  /** How many beats in we are (for marching in step); 0 when not playing. */
  get beats() {
    if (!this.playing || !ctx) return 0
    return Math.max(0, (ctx.currentTime - this.startAt) / this.beat)
  }

  start(vol = 0.3) {
    if (this.playing) return
    try {
      const a = audio()
      void a.resume()
      this.playing = true
      this.gain = a.createGain()
      this.gain.gain.setValueAtTime(0.0001, a.currentTime)
      this.gain.gain.exponentialRampToValueAtTime(vol, a.currentTime + 0.2)
      this.gain.connect(a.destination)
      this.next = 0
      this.loopAt = this.startAt = a.currentTime + 0.1
      this.timer = window.setInterval(() => this.schedule(), 60)
      this.schedule()
    } catch {
      /* audio not available */
    }
  }

  /** Softer further away. */
  level(vol: number) {
    if (!this.gain) return
    // (a slow glide, so walking up to the band fades it in rather than jumping)
    this.gain.gain.setTargetAtTime(Math.max(0.0001, vol), audio().currentTime, 0.5)
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    clearInterval(this.timer)
    const g = this.gain
    this.gain = null
    if (!g) return
    const a = audio()
    g.gain.cancelScheduledValues(a.currentTime)
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.4)
    setTimeout(() => g.disconnect(), 600)
  }

  private schedule() {
    const a = audio()
    const out = this.gain
    if (!out) return
    const ahead = a.currentTime + 0.5
    for (;;) {
      const e = this.events[this.next]
      const time = this.loopAt + e.at * this.beat
      if (time > ahead) break
      if (time > a.currentTime - 0.05) e.fn(time, out)
      this.next++
      if (this.next >= this.events.length) {
        this.next = 0
        this.loopAt += this.length * this.beat
      }
    }
  }

  /** A struck bar: the note and its bright overtones, ringing out. */
  private glock(t: number, f: number, out: AudioNode) {
    const a = audio()
    for (const [mult, vol, decay] of [[1, 0.1, 0.8], [2.76, 0.03, 0.22], [5.4, 0.012, 0.09]] as const) {
      const o = a.createOscillator()
      const g = a.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(f * mult, t)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + decay + 0.02)
    }
  }

  private piccolo(t: number, f: number, dur: number, out: AudioNode) {
    const a = audio()
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(f, t)
    const end = t + Math.max(0.07, dur * 0.8)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.015)
    g.gain.setValueAtTime(0.09, end - 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(end + 0.02)
  }

  /** Brass in unison, for the fanfare. */
  private horn(t: number, f: number, dur: number, out: AudioNode) {
    const a = audio()
    const o = a.createOscillator()
    const filter = a.createBiquadFilter()
    const g = a.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f, t)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(700, t)
    filter.frequency.linearRampToValueAtTime(1800, t + 0.04)
    const end = t + Math.max(0.08, dur * 0.85)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
    g.gain.setValueAtTime(0.13, end - 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    o.connect(filter).connect(g).connect(out)
    o.start(t)
    o.stop(end + 0.02)
  }

  private tuba(t: number, f: number, dur: number, out: AudioNode) {
    const a = audio()
    const o = a.createOscillator()
    const filter = a.createBiquadFilter()
    const g = a.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f, t)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(420, t)
    const end = t + Math.min(0.4, Math.max(0.12, dur * 0.7))
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    o.connect(filter).connect(g).connect(out)
    o.start(t)
    o.stop(end + 0.02)
  }

  private stab(t: number, notes: number[], out: AudioNode) {
    const a = audio()
    const g = a.createGain()
    const filter = a.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1300
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    for (const m of notes) {
      const o = a.createOscillator()
      o.type = 'square'
      o.frequency.setValueAtTime(hz(m), t)
      o.connect(filter)
      o.start(t)
      o.stop(t + 0.15)
    }
    filter.connect(g).connect(out)
  }

  private burst(t: number, freq: number, q: number, vol: number, dur: number, out: AudioNode) {
    const a = audio()
    if (!noiseBuf) noise(0.01, 500, 500, 0.0001)
    const src = a.createBufferSource()
    src.buffer = noiseBuf
    const f = a.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = a.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  private snare(t: number, vol: number, out: AudioNode) {
    this.burst(t, 2400, 0.9, 0.3 * vol, 0.1, out)
  }

  private cymbal(t: number, out: AudioNode) {
    this.burst(t, 7000, 0.5, 0.15, 1.1, out)
  }
}

/* ---------- recordings, one after another (the choir) ---------- */
// Each track is fetched and decoded the first time it's needed, then played through one gain (to fade
// with distance) and an analyser (so the singers' mouths can follow how loud it is). A track that
// can't be loaded is skipped. After the last one it starts over.
export class Playlist {
  private buffers = new Map<string, Promise<AudioBuffer | null>>()
  private src: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private data: Uint8Array<ArrayBuffer> | null = null
  private tracks: string[] = []
  private index = 0
  private want = 0.0001
  private gapTimer = 0
  /** Start from the first track (in order) rather than anywhere in the list. */
  ordered = false
  playing = false

  constructor(
    /** Silence between tracks (s). */
    private gap = 2.5,
  ) {}

  private current = ''
  /** When (on the audio clock) the playing track's start would have been. */
  private began = 0
  private load(url: string) {
    // decoded songs are big (tens of MB each): keep only the one playing and the next couple
    if (!this.buffers.has(url) && this.buffers.size >= 3) {
      const old = [...this.buffers.keys()].find((k) => k !== this.current)
      if (old) this.buffers.delete(old)
    }
    if (!this.buffers.has(url))
      this.buffers.set(
        url,
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((raw) => audio().decodeAudioData(raw))
          .catch(() => null),
      )
    return this.buffers.get(url)!
  }

  /** The gain and analyser everything plays through; false if there's no audio. */
  private open() {
    if (this.gain) return true
    try {
      const a = audio()
      void a.resume()
      this.gain = a.createGain()
      this.gain.gain.setValueAtTime(0.0001, a.currentTime)
      this.gain.gain.setTargetAtTime(this.want, a.currentTime, 0.5)
      this.analyser = a.createAnalyser()
      this.analyser.fftSize = 512
      this.data = new Uint8Array(this.analyser.fftSize)
      this.analyser.connect(this.gain).connect(a.destination)
      this.playing = true
      return true
    } catch {
      return false
    }
  }

  /** Fetch and decode these ahead of time (a couple at most), so there's no wait when their turn comes. */
  preload(tracks: string[]) {
    for (const t of tracks) void this.load(t)
  }

  /** Start on these tracks (quietly; level() brings it up). Starting on a different list switches over. */
  start(tracks: string[]) {
    const same = this.playing && !this.cued && tracks.join('|') === this.tracks.join('|')
    if (same) return
    if (this.playing) this.stop()
    this.choose(tracks)
    if (this.open()) void this.playNext(0)
  }

  /** Pick where these tracks will start and get that one ready – long before anyone is near enough to hear. */
  prepare(tracks: string[]) {
    this.choose(tracks)
    void this.load(tracks[this.index % tracks.length])
  }

  private choose(tracks: string[]) {
    if (tracks.join('|') === this.tracks.join('|')) return
    this.tracks = tracks
    this.index = this.ordered ? 0 : Math.floor(Math.random() * tracks.length)
  }

  private cued: { url: string; at: number; offset: number } | null = null
  private cueing: string | null = null
  /**
   * Play this track from `offset` seconds in – or nothing, for null – following someone else's clock
   * (the Lucia concert): called every frame, it only starts over when the track or the place in it
   * has drifted.
   */
  cue(url: string | null, offset: number) {
    if (!this.open()) return
    const a = audio()
    if (!url) {
      if (this.cued) this.stopSource()
      return
    }
    // (a little drift is fine – starting over mid-note is what sounds wrong)
    if (this.cued?.url === url && Math.abs(a.currentTime - this.cued.at + this.cued.offset - offset) < 3) return
    if (this.cueing === url) return
    this.cueing = url
    const asked = a.currentTime
    void this.load(url).then((buf) => {
      this.cueing = null
      if (!buf || !this.gain) return
      this.stopSource()
      const from = Math.min(buf.duration - 0.05, offset + (a.currentTime - asked))
      const src = a.createBufferSource()
      src.buffer = buf
      src.connect(this.analyser!)
      src.onended = () => {
        if (this.src === src) this.src = null
      }
      src.start(0, Math.max(0, from))
      this.src = src
      this.current = url
      this.began = a.currentTime - Math.max(0, from)
      this.cued = { url, at: a.currentTime, offset: from }
    })
  }

  private stopSource() {
    const src = this.src
    this.src = null
    this.cued = null
    if (!src) return
    try {
      src.stop()
    } catch {
      /* never started */
    }
    src.disconnect()
  }

  private async playNext(tries: number) {
    if (!this.playing || !this.tracks.length || tries > this.tracks.length) return
    const url = this.tracks[this.index % this.tracks.length]
    const list = this.tracks
    const buf = await this.load(url)
    if (!this.playing || list !== this.tracks) return
    this.index++
    if (!buf) return void this.playNext(tries + 1)
    const a = audio()
    const src = a.createBufferSource()
    src.buffer = buf
    src.connect(this.analyser!)
    src.onended = () => {
      if (this.src !== src) return
      this.src = null
      this.gapTimer = window.setTimeout(() => void this.playNext(0), this.gap * 1000)
    }
    this.src = src
    this.current = url
    src.start()
    this.began = a.currentTime
    void this.load(this.tracks[this.index % this.tracks.length])
  }

  /** Fade towards `vol` (a slow glide, as you walk up or away). */
  level(vol: number) {
    this.want = Math.max(0.0001, vol)
    if (this.gain) this.gain.gain.setTargetAtTime(this.want, audio().currentTime, 0.5)
  }

  /** Which track is playing, and how many seconds into it – or null between tracks. */
  position() {
    if (!this.src) return null
    return { url: this.current, at: audio().currentTime - this.began }
  }

  /** How loud the recording is right now, 0…1 (before the distance fade). */
  loudness() {
    if (!this.analyser || !this.data || !this.src) return 0
    this.analyser.getByteTimeDomainData(this.data)
    let sum = 0
    for (const v of this.data) sum += (v - 128) ** 2
    return Math.min(1, (Math.sqrt(sum / this.data.length) / 128) * 4)
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    this.cued = null
    this.cueing = null
    clearTimeout(this.gapTimer)
    const src = this.src
    const g = this.gain
    const an = this.analyser
    this.src = this.gain = this.analyser = null
    if (!g) return
    const a = audio()
    g.gain.cancelScheduledValues(a.currentTime)
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.4)
    setTimeout(() => {
      try {
        src?.stop()
      } catch {
        /* never started */
      }
      src?.disconnect()
      an?.disconnect()
      g.disconnect()
    }, 500)
  }
}

/* ---------- the mine cart ride ---------- */
/** "I Bergakungens sal" (Grieg): low plucked strings creeping up, a deep bassoon under them, a drum on the beat. */
const MOUNTAIN = {
  melody: [
    'B2:2 C#3:2 D3:2 E3:2 F#3:2 D3:2 F#3:4', 'F3:2 C#3:2 F3:4 E3:2 C3:2 E3:4',
    'B2:2 C#3:2 D3:2 E3:2 F#3:2 D3:2 F#3:2 B3:2', 'A3:2 F#3:2 D3:2 F#3:2 A3:8',
    'F#3:2 G#3:2 A#3:2 B3:2 C#4:2 A#3:2 C#4:4', 'D4:2 A#3:2 D4:4 C#4:2 A#3:2 C#4:4',
    'F#3:2 G#3:2 A#3:2 B3:2 C#4:2 A#3:2 C#4:2 D4:2', 'C#4:2 A#3:2 F#3:2 A#3:2 C#4:8',
  ],
  bass: ['B1', 'B1', 'B1', 'F#1', 'F#1', 'F#1', 'F#1', 'C#2'],
}

/**
 * The mine cart's music: Grieg's troll king's hall, faster and faster as the cart picks up speed
 * (`rate` 1 is a creep; it is played step by step, so the tempo can change as it goes).
 */
export class MountainKing {
  private gain: GainNode | null = null
  private timer = 0
  private steps = new Map<number, ((t: number, out: AudioNode) => void)[]>()
  private length = 0
  private step = 0
  private stepAt = 0
  rate = 1
  playing = false

  constructor() {
    const on = (s: number, fn: (t: number, out: AudioNode) => void) => {
      if (!this.steps.has(s)) this.steps.set(s, [])
      this.steps.get(s)!.push(fn)
    }
    let s = 0
    MOUNTAIN.melody.forEach((line, i) => {
      const start = s
      for (const [m, beats] of bar(line)) {
        const len = beats * 4
        if (m) on(s, (t, out) => this.pluck(t, hz(m), out))
        s += len
      }
      // the bassoon on every beat, the drum on one and three
      const b = hz(midi(MOUNTAIN.bass[i]))
      for (let k = 0; k < 16; k += 4) {
        on(start + k, (t, out) => this.bassoon(t, k % 8 === 0 ? b : b * 1.5, out))
        if (k % 8 === 0) on(start + k, (t, out) => this.drum(t, out))
      }
    })
    this.length = s
  }

  start(vol = 0.2) {
    if (this.playing) return
    try {
      const a = audio()
      void a.resume()
      this.playing = true
      this.gain = a.createGain()
      this.gain.gain.setValueAtTime(0.0001, a.currentTime)
      this.gain.gain.exponentialRampToValueAtTime(vol, a.currentTime + 0.2)
      // (warm and low: the top taken off everything)
      const warm = a.createBiquadFilter()
      warm.type = 'lowpass'
      warm.frequency.value = 1800
      this.gain.connect(warm).connect(a.destination)
      this.step = 0
      this.stepAt = a.currentTime + 0.1
      this.timer = window.setInterval(() => this.schedule(), 50)
      this.schedule()
    } catch {
      /* audio not available */
    }
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    clearInterval(this.timer)
    const g = this.gain
    this.gain = null
    if (!g) return
    const a = audio()
    g.gain.cancelScheduledValues(a.currentTime)
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), a.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.3)
    setTimeout(() => g.disconnect(), 500)
  }

  private schedule() {
    const a = audio()
    const out = this.gain
    if (!out) return
    // (a sixteenth at the tempo right now: from 96 beats a minute up to about four times that)
    const sixteenth = 60 / (96 * this.rate) / 4
    if (this.stepAt < a.currentTime - 0.1) this.stepAt = a.currentTime + 0.02
    while (this.stepAt < a.currentTime + 0.25) {
      for (const fn of this.steps.get(this.step) ?? []) fn(this.stepAt, out)
      this.step = (this.step + 1) % this.length
      this.stepAt += sixteenth
    }
  }

  /** Plucked strings: a bright attack dying away. */
  private pluck(t: number, f: number, out: AudioNode) {
    const a = audio()
    const o = a.createOscillator()
    const filter = a.createBiquadFilter()
    const g = a.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f, t)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1400, t)
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.2)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    o.connect(filter).connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.25)
  }

  private bassoon(t: number, f: number, out: AudioNode) {
    const a = audio()
    const o = a.createOscillator()
    const filter = a.createBiquadFilter()
    const g = a.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f, t)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(260, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    o.connect(filter).connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.22)
  }

  /** A timpani-ish thump. */
  private drum(t: number, out: AudioNode) {
    const a = audio()
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.22)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.32)
  }
}
