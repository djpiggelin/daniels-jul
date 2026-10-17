import confetti from 'canvas-confetti'

const COLORS = ['#e5383b', '#2fa36b', '#f6c453', '#ffffff']

export function burst(x = 0.5, y = 0.5) {
  confetti({ particleCount: 90, spread: 80, startVelocity: 38, origin: { x, y }, colors: COLORS, scalar: 1.1, zIndex: 100 })
}

export function snowBurst(x = 0.5, y = 0.5) {
  confetti({ particleCount: 40, spread: 120, startVelocity: 20, gravity: 0.4, origin: { x, y }, colors: ['#ffffff', '#dfe9ff'], shapes: ['circle'], scalar: 0.8, zIndex: 100 })
}

export function burstFrom(el: Element) {
  const r = el.getBoundingClientRect()
  burst((r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight)
}

/** Tiny WebAudio jingle so we don't have to ship extra sound files. */
let ctx: AudioContext | null = null
export function jingle(notes = [659, 659, 659, 659, 659, 659, 659, 784, 523, 587, 659], step = 0.14) {
  try {
    ctx ??= new AudioContext()
    const t0 = ctx.currentTime
    const pattern = [1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 3]
    let t = t0
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      o.type = 'triangle'
      o.frequency.value = f
      const d = step * (pattern[i] ?? 1)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.95)
      o.connect(g).connect(ctx!.destination)
      o.start(t)
      o.stop(t + d)
      t += d
    })
  } catch {
    /* audio not available */
  }
}

export function blip(freq = 880, dur = 0.08, type: OscillatorType = 'square', vol = 0.06) {
  try {
    ctx ??= new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + dur)
    g.gain.setValueAtTime(vol, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + dur)
  } catch {
    /* ignore */
  }
}
