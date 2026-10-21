// Tomtememory: find the pairs among the guests. Drawn on canvas so it can live on the arcade screen.
import { PARTICIPANTS } from '../data'
import { blip } from '../sfx'
import { emoji, H, hud, W, type Game } from './shared'

type Card = { name: string; img: HTMLImageElement; flip: number; x: number; y: number }

const WITH_PHOTO = PARTICIPANTS.filter((p): p is { name: string; image: string } => !!p.image)
const PAIRS = Math.min(8, WITH_PHOTO.length)
const COLS = 4
const GAP = 12
const SIZE = (W - 40 - GAP * (COLS - 1)) / COLS
const TOP = 110

// load the faces once, up front
const faces = new Map<string, HTMLImageElement>()
for (const p of WITH_PHOTO) {
  const img = new Image()
  img.src = encodeURI(p.image)
  faces.set(p.name, img)
}

const shuffle = <T>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export const memoryScore = (moves: number, seconds: number) => Math.max(50, Math.round(2000 - Math.max(0, moves - PAIRS) * 45 - seconds * 8))

export class Tomtememory implements Game {
  readonly cursor = true
  readonly stick = 0
  over = false
  private cards: Card[]
  private open: number[] = []
  private found = new Set<string>()
  private moves = 0
  private seconds = 0
  private started = false
  /** Counts down to turning a mismatched pair back (or locking a found pair in). */
  private wait = 0
  private doneFor = 0
  private hover = -1

  constructor(private ctx: CanvasRenderingContext2D) {
    const people = shuffle(WITH_PHOTO).slice(0, PAIRS)
    this.cards = shuffle(people.flatMap((p) => [p, p])).map((p, i) => ({
      name: p.name,
      img: faces.get(p.name)!,
      flip: 0,
      x: 20 + (i % COLS) * (SIZE + GAP),
      y: TOP + Math.floor(i / COLS) * (SIZE + GAP),
    }))
  }

  get score() {
    return memoryScore(this.moves, this.seconds)
  }

  private at(x: number, y: number) {
    return this.cards.findIndex((c) => x >= c.x && x <= c.x + SIZE && y >= c.y && y <= c.y + SIZE)
  }

  pointer(x: number, y: number, kind: 'move' | 'down') {
    this.hover = this.at(x, y)
    if (kind === 'down' && this.hover >= 0) this.pick(this.hover)
  }

  key(code: string, down: boolean) {
    if (!down) return
    // keyboard: move a highlight around the grid, E/Space to flip
    const n = this.cards.length
    const h = this.hover < 0 ? 0 : this.hover
    const move: Record<string, number> = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -COLS, KeyW: -COLS, ArrowDown: COLS, KeyS: COLS }
    if (code in move) this.hover = this.hover < 0 ? 0 : (h + move[code] + n) % n
    else if (['Space', 'Enter', 'KeyE'].includes(code) && this.hover >= 0) this.pick(this.hover)
  }

  private pick(i: number) {
    const c = this.cards[i]
    if (this.open.length === 2 || this.open.includes(i) || this.found.has(c.name)) return
    this.started = true
    blip(600, 0.05, 'triangle', 0.04)
    this.open.push(i)
    if (this.open.length === 2) {
      this.moves++
      this.wait = this.cards[this.open[0]].name === this.cards[this.open[1]].name ? 0.35 : 0.85
    }
  }

  frame(dt: number, now: number) {
    const ctx = this.ctx
    const done = this.found.size === PAIRS
    if (this.started && !done) this.seconds += dt
    if (this.open.length === 2 && (this.wait -= dt) <= 0) {
      const [a, b] = this.open.map((k) => this.cards[k])
      if (a.name === b.name) {
        this.found.add(a.name)
        blip(990, 0.15, 'triangle', 0.07)
      }
      this.open = []
    }
    if (done && (this.doneFor += dt) > 0.9) this.over = true

    // background
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#0b1230')
    g.addColorStop(1, '#1d2a5c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    hud(ctx, `🔄 ${this.moves} drag`, 20, 34, 'left', 22)
    hud(ctx, `⏱️ ${Math.floor(this.seconds)}s`, W / 2, 34, 'center', 22)
    ctx.font = "700 22px 'DM Sans', sans-serif"
    hud(ctx, `⭐ ${this.score}`, W - 20, 34, 'right', 22)

    this.cards.forEach((c, i) => {
      const shown = this.open.includes(i) || this.found.has(c.name)
      c.flip += ((shown ? 1 : 0) - c.flip) * Math.min(1, dt * 12)
      const sx = Math.abs(Math.cos(c.flip * Math.PI))
      const face = c.flip > 0.5
      const lift = i === this.hover && !shown ? -4 : 0
      ctx.save()
      ctx.translate(c.x + SIZE / 2, c.y + SIZE / 2 + lift)
      ctx.scale(Math.max(0.02, sx), 1)
      ctx.translate(-SIZE / 2, -SIZE / 2)
      ctx.beginPath()
      ctx.roundRect(0, 0, SIZE, SIZE, 16)
      ctx.save()
      ctx.clip()
      if (face) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, SIZE, SIZE)
        if (c.img.complete && c.img.naturalWidth) {
          const s = Math.max(SIZE / c.img.naturalWidth, SIZE / c.img.naturalHeight)
          ctx.drawImage(c.img, (SIZE - c.img.naturalWidth * s) / 2, (SIZE - c.img.naturalHeight * s) / 2, c.img.naturalWidth * s, c.img.naturalHeight * s)
        }
        ctx.fillStyle = 'rgba(7,11,29,0.7)'
        ctx.fillRect(0, SIZE - 24, SIZE, 24)
        ctx.fillStyle = '#fff'
        ctx.font = "600 15px 'DM Sans', sans-serif"
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(c.name, SIZE / 2, SIZE - 12)
      } else {
        // candy-cane back
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, SIZE, SIZE)
        ctx.fillStyle = '#e5383b'
        for (let k = -SIZE; k < SIZE * 2; k += 22) {
          ctx.beginPath()
          ctx.moveTo(k, 0)
          ctx.lineTo(k + 11, 0)
          ctx.lineTo(k + 11 - SIZE, SIZE)
          ctx.lineTo(k - SIZE, SIZE)
          ctx.fill()
        }
        ctx.fillStyle = '#0f1838'
        ctx.beginPath()
        ctx.roundRect(8, 8, SIZE - 16, SIZE - 16, 11)
        ctx.fill()
        emoji(ctx, '🎄', SIZE / 2, SIZE / 2 + 2, 40)
      }
      ctx.restore()
      ctx.lineWidth = 5
      ctx.strokeStyle = this.found.has(c.name) && face ? '#2fa36b' : face ? '#f6c453' : i === this.hover ? '#f6c453' : 'rgba(255,255,255,0.15)'
      ctx.stroke()
      ctx.restore()
    })

    if (!this.started) {
      ctx.fillStyle = 'rgba(7,11,29,0.6)'
      ctx.fillRect(40, H - 108, W - 80, 56)
      hud(ctx, 'Vänd två kort i taget', W / 2, H - 94, 'center', 22)
    }
    if (done) {
      ctx.globalAlpha = Math.min(1, this.doneFor * 2)
      emoji(ctx, '🎉', W / 2, H - 70, 50 + Math.sin(now / 100) * 4)
      ctx.globalAlpha = 1
    }
  }
}
