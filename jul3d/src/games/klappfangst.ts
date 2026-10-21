// Klappfångst: steer the sleigh, catch the presents, dodge the coal.
import { blip } from '../sfx'
import { drawStars, emoji, H, hud, makeStars, skyGradient, W, type Game } from './shared'

type Kind = 'gift' | 'cookie' | 'star' | 'coal'
type Item = { x: number; y: number; vy: number; kind: Kind; rot: number; vr: number }
type Pop = { x: number; y: number; text: string; life: number; color: string }

const KINDS: Record<Kind, { ch: string; points: number; size: number }> = {
  gift: { ch: '🎁', points: 10, size: 40 },
  cookie: { ch: '🍪', points: 5, size: 34 },
  star: { ch: '⭐', points: 50, size: 38 },
  coal: { ch: '', points: 0, size: 38 },
}

const COAL = [[-17, -6], [-8, -16], [6, -15], [17, -5], [14, 10], [2, 16], [-12, 13]]

function drawCoal(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'rgba(255,90,40,0.6)'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#1b1b22'
  ctx.beginPath()
  COAL.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#3a3a48'
  ctx.beginPath()
  ctx.moveTo(-8, -12)
  ctx.lineTo(4, -11)
  ctx.lineTo(-2, -3)
  ctx.fill()
  // grumpy face
  ctx.fillStyle = '#ff6b3d'
  ctx.fillRect(-7, -2, 4, 3)
  ctx.fillRect(4, -2, 4, 3)
  ctx.strokeStyle = '#ff6b3d'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 10, 5, Math.PI * 1.15, Math.PI * 1.85)
  ctx.stroke()
}

export class Klappfangst implements Game {
  readonly cursor = true
  score = 0
  over = false
  stick = 0
  private stars = makeStars(60)
  private sleigh = { x: W / 2, w: 110, target: W / 2 }
  private items: Item[] = []
  private pops: Pop[] = []
  private lives = 3
  private combo = 0
  private spawnIn = 0
  private elapsed = 0
  private shake = 0
  private keys = new Set<string>()

  constructor(private ctx: CanvasRenderingContext2D) {}

  key(code: string, down: boolean) {
    if (!['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) return
    if (down) this.keys.add(code)
    else this.keys.delete(code)
  }

  pointer(x: number) {
    this.sleigh.target = x
  }

  private spawn() {
    const r = Math.random()
    const difficulty = Math.min(this.elapsed / 60, 1)
    const kind: Kind = r < 0.04 ? 'star' : r < 0.22 + difficulty * 0.18 ? 'coal' : r < 0.55 ? 'cookie' : 'gift'
    this.items.push({ x: 30 + Math.random() * (W - 60), y: -30, vy: 140 + Math.random() * 60 + this.elapsed * 4, kind, rot: 0, vr: (Math.random() - 0.5) * 3 })
  }

  private drawSleigh(x: number, y: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(x, y)
    ctx.strokeStyle = '#d6dbe6'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-58, 30)
    ctx.lineTo(48, 30)
    ctx.quadraticCurveTo(66, 30, 64, 12)
    ctx.stroke()
    ctx.fillStyle = '#c1272d'
    ctx.beginPath()
    ctx.moveTo(-55, -8)
    ctx.lineTo(45, -8)
    ctx.quadraticCurveTo(58, -8, 60, -22)
    ctx.quadraticCurveTo(62, 20, 36, 24)
    ctx.lineTo(-40, 24)
    ctx.quadraticCurveTo(-56, 22, -55, -8)
    ctx.fill()
    ctx.strokeStyle = '#f6c453'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-55, -8)
    ctx.lineTo(45, -8)
    ctx.stroke()
    ctx.restore()
    emoji(ctx, '🎅', x - 10, y - 26, 40)
  }

  frame(dt: number, now: number) {
    const { ctx, sleigh, keys } = this
    this.elapsed += dt
    const left = keys.has('ArrowLeft') || keys.has('KeyA')
    const right = keys.has('ArrowRight') || keys.has('KeyD')
    if (left) sleigh.target -= 520 * dt
    if (right) sleigh.target += 520 * dt
    sleigh.target = Math.max(sleigh.w / 2, Math.min(W - sleigh.w / 2, sleigh.target))
    const before = sleigh.x
    sleigh.x += (sleigh.target - sleigh.x) * Math.min(1, dt * 14)
    this.stick = Math.max(-1, Math.min(1, (sleigh.x - before) / Math.max(dt, 1e-3) / 400))

    this.spawnIn -= dt
    if (this.spawnIn <= 0) {
      this.spawn()
      this.spawnIn = Math.max(0.28, 0.9 - this.elapsed * 0.012)
    }

    const sy = H - 80
    for (const it of this.items) {
      it.y += it.vy * dt
      it.rot += it.vr * dt
      const caught = it.y > sy - 40 && it.y < sy + 10 && Math.abs(it.x - sleigh.x) < sleigh.w / 2 + 6
      if (caught) {
        it.y = H + 100
        if (it.kind === 'coal') {
          this.lives--
          this.combo = 0
          this.shake = 0.35
          blip(140, 0.25, 'sawtooth', 0.08)
          this.pops.push({ x: it.x, y: sy - 50, text: '−1 ❤️', life: 1, color: '#ff6b6e' })
        } else {
          this.combo++
          const mult = 1 + Math.floor(this.combo / 8)
          const pts = KINDS[it.kind].points * mult
          this.score += pts
          blip(it.kind === 'star' ? 1200 : 660 + Math.min(this.combo, 20) * 20, 0.08, 'triangle', 0.07)
          this.pops.push({ x: it.x, y: sy - 50, text: `+${pts}${mult > 1 ? ` x${mult}` : ''}`, life: 1, color: it.kind === 'star' ? '#f6c453' : '#fff' })
        }
      } else if (it.y > H + 40 && it.kind !== 'coal' && it.y < H + 90) {
        this.combo = 0
      }
    }
    this.items = this.items.filter((it) => it.y < H + 50)
    this.pops = this.pops.filter((p) => (p.life -= dt) > 0)
    this.shake = Math.max(0, this.shake - dt)

    ctx.save()
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * this.shake, (Math.random() - 0.5) * 14 * this.shake)
    skyGradient(ctx)
    drawStars(ctx, this.stars, now)
    ctx.fillStyle = '#e4ecfb'
    ctx.beginPath()
    ctx.moveTo(0, H - 40)
    ctx.quadraticCurveTo(W / 2, H - 70, W, H - 40)
    ctx.lineTo(W, H)
    ctx.lineTo(0, H)
    ctx.fill()

    for (const it of this.items) {
      ctx.save()
      ctx.translate(it.x, it.y)
      ctx.rotate(it.rot)
      if (it.kind === 'star') {
        ctx.shadowColor = '#f6c453'
        ctx.shadowBlur = 20
      }
      if (it.kind === 'coal') drawCoal(ctx)
      else emoji(ctx, KINDS[it.kind].ch, 0, 0, KINDS[it.kind].size)
      ctx.restore()
    }
    this.drawSleigh(sleigh.x, sy)

    for (const p of this.pops) {
      ctx.globalAlpha = p.life
      ctx.font = "700 24px 'DM Sans', sans-serif"
      ctx.textAlign = 'center'
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y - (1 - p.life) * 50)
    }
    ctx.globalAlpha = 1
    ctx.restore()

    const lives = Math.max(this.lives, 0)
    hud(ctx, `${this.score}`, 18, 16)
    hud(ctx, '❤️'.repeat(lives) + '🤍'.repeat(3 - lives), W - 18, 16, 'right')
    if (this.combo >= 8) hud(ctx, `Combo x${1 + Math.floor(this.combo / 8)}`, W / 2, 16, 'center')
    if (this.lives <= 0) this.over = true
  }
}
