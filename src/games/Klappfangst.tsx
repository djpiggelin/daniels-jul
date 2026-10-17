import { useEffect, useRef } from 'react'
import { blip } from '../lib/fx'
import { drawStars, emoji, H, hud, makeStars, setupCanvas, skyGradient, W, type GameProps } from './shared'

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

export default function Klappfangst({ onScore, onOver }: GameProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const { ctx, toLocal } = setupCanvas(canvas)
    const stars = makeStars(60)
    const sleigh = { x: W / 2, w: 110, target: W / 2 }
    let items: Item[] = []
    let pops: Pop[] = []
    let score = 0
    let lives = 3
    let combo = 0
    let spawnIn = 0
    let elapsed = 0
    let shake = 0
    let last = performance.now()
    let raf = 0
    let over = false
    const keys = new Set<string>()

    const spawn = () => {
      const r = Math.random()
      const difficulty = Math.min(elapsed / 60, 1)
      const kind: Kind = r < 0.04 ? 'star' : r < 0.22 + difficulty * 0.18 ? 'coal' : r < 0.55 ? 'cookie' : 'gift'
      items.push({
        x: 30 + Math.random() * (W - 60),
        y: -30,
        vy: 140 + Math.random() * 60 + elapsed * 4,
        kind,
        rot: 0,
        vr: (Math.random() - 0.5) * 3,
      })
    }

    const onPointer = (e: PointerEvent) => {
      sleigh.target = toLocal(e.clientX, e.clientY).x
    }
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
        e.preventDefault()
        if (e.type === 'keydown') keys.add(e.key)
        else keys.delete(e.key)
      }
    }

    const drawSleigh = (x: number, y: number) => {
      ctx.save()
      ctx.translate(x, y)
      // runner
      ctx.strokeStyle = '#d6dbe6'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-58, 30)
      ctx.lineTo(48, 30)
      ctx.quadraticCurveTo(66, 30, 64, 12)
      ctx.stroke()
      // body
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

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      elapsed += dt

      // input
      if (keys.has('ArrowLeft') || keys.has('a')) sleigh.target -= 520 * dt
      if (keys.has('ArrowRight') || keys.has('d')) sleigh.target += 520 * dt
      sleigh.target = Math.max(sleigh.w / 2, Math.min(W - sleigh.w / 2, sleigh.target))
      sleigh.x += (sleigh.target - sleigh.x) * Math.min(1, dt * 14)

      // spawn
      spawnIn -= dt
      if (spawnIn <= 0) {
        spawn()
        spawnIn = Math.max(0.28, 0.9 - elapsed * 0.012)
      }

      const sy = H - 80
      for (const it of items) {
        it.y += it.vy * dt
        it.rot += it.vr * dt
        const caught = it.y > sy - 40 && it.y < sy + 10 && Math.abs(it.x - sleigh.x) < sleigh.w / 2 + 6
        if (caught) {
          it.y = H + 100
          if (it.kind === 'coal') {
            lives--
            combo = 0
            shake = 0.35
            blip(140, 0.25, 'sawtooth', 0.08)
            pops.push({ x: it.x, y: sy - 50, text: '−1 ❤️', life: 1, color: '#ff6b6e' })
            if (navigator.vibrate) navigator.vibrate(80)
          } else {
            combo++
            const mult = 1 + Math.floor(combo / 8)
            const pts = KINDS[it.kind].points * mult
            score += pts
            onScore(score)
            blip(it.kind === 'star' ? 1200 : 660 + Math.min(combo, 20) * 20, 0.08, 'triangle', 0.07)
            pops.push({ x: it.x, y: sy - 50, text: `+${pts}${mult > 1 ? ` x${mult}` : ''}`, life: 1, color: it.kind === 'star' ? '#f6c453' : '#fff' })
          }
        } else if (it.y > H + 40 && it.kind !== 'coal' && it.y < H + 90) {
          combo = 0
        }
      }
      items = items.filter((it) => it.y < H + 50)
      pops = pops.filter((p) => (p.life -= dt) > 0)
      shake = Math.max(0, shake - dt)

      // draw
      ctx.save()
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake)
      skyGradient(ctx)
      drawStars(ctx, stars, now)
      // ground
      ctx.fillStyle = '#e4ecfb'
      ctx.beginPath()
      ctx.moveTo(0, H - 40)
      ctx.quadraticCurveTo(W / 2, H - 70, W, H - 40)
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.fill()

      for (const it of items) {
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
      drawSleigh(sleigh.x, sy)

      for (const p of pops) {
        ctx.globalAlpha = p.life
        ctx.font = "700 24px 'DM Sans', sans-serif"
        ctx.textAlign = 'center'
        ctx.fillStyle = p.color
        ctx.fillText(p.text, p.x, p.y - (1 - p.life) * 50)
      }
      ctx.globalAlpha = 1
      ctx.restore()

      hud(ctx, `${score}`, 18, 16)
      hud(ctx, '❤️'.repeat(Math.max(lives, 0)) + '🤍'.repeat(3 - Math.max(lives, 0)), W - 18, 16, 'right')
      if (combo >= 8) hud(ctx, `Combo x${1 + Math.floor(combo / 8)}`, W / 2, 16, 'center')

      if (lives <= 0 && !over) {
        over = true
        onOver(score)
        return
      }
      raf = requestAnimationFrame(loop)
    }

    canvas.addEventListener('pointermove', onPointer)
    canvas.addEventListener('pointerdown', onPointer)
    addEventListener('keydown', onKey)
    addEventListener('keyup', onKey)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onPointer)
      canvas.removeEventListener('pointerdown', onPointer)
      removeEventListener('keydown', onKey)
      removeEventListener('keyup', onKey)
    }
  }, [onScore, onOver])

  return <canvas ref={ref} className="block h-full w-full touch-none select-none" />
}
