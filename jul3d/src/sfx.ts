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
