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
function noise(dur: number, from: number, to: number, vol: number, q = 0.8) {
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
