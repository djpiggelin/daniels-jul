import { useEffect, useRef } from 'react'
import { blip } from '../lib/fx'
import { drawStars, emoji, H, hud, makeStars, setupCanvas, skyGradient, W, type GameProps } from './shared'

type Pole = { x: number; gapY: number; passed: boolean; gift: boolean }

const GAP = 190
const POLE_W = 64
const GRAVITY = 1500
const FLAP = -470
const SPEED = 170

export default function Renflyg({ onScore, onOver }: GameProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const { ctx } = setupCanvas(canvas)
    const stars = makeStars(70)
    const rudolf = { x: 130, y: H / 2, vy: 0 }
    let poles: Pole[] = []
    let score = 0
    let started = false
    let dead = false
    let deadFor = 0
    let dist = 0
    let last = performance.now()
    let raf = 0
    const trail: { x: number; y: number; life: number }[] = []

    const addPole = (x: number) => poles.push({ x, gapY: 160 + Math.random() * (H - 400), passed: false, gift: Math.random() < 0.35 })
    for (let i = 0; i < 3; i++) addPole(W + 120 + i * 260)

    const flap = () => {
      if (dead) return
      started = true
      rudolf.vy = FLAP
      blip(520, 0.07, 'triangle', 0.05)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'ArrowUp') {
        e.preventDefault()
        flap()
      }
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      flap()
    }

    const drawPole = (x: number, top: number, bottom: number) => {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, top, POLE_W, bottom - top)
      ctx.clip()
      ctx.fillStyle = '#fff'
      ctx.fillRect(x, top, POLE_W, bottom - top)
      ctx.fillStyle = '#e5383b'
      for (let y = top - 80; y < bottom + 40; y += 40) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + POLE_W, y - 28)
        ctx.lineTo(x + POLE_W, y - 10)
        ctx.lineTo(x, y + 18)
        ctx.fill()
      }
      // shading
      const g = ctx.createLinearGradient(x, 0, x + POLE_W, 0)
      g.addColorStop(0, 'rgba(0,0,0,0.15)')
      g.addColorStop(0.35, 'rgba(255,255,255,0.15)')
      g.addColorStop(1, 'rgba(0,0,0,0.3)')
      ctx.fillStyle = g
      ctx.fillRect(x, top, POLE_W, bottom - top)
      ctx.restore()
    }

    const drawRudolf = (t: number) => {
      ctx.save()
      ctx.translate(rudolf.x, rudolf.y)
      ctx.rotate(Math.max(-0.5, Math.min(0.9, rudolf.vy / 900)))
      ctx.scale(-1, 1)
      emoji(ctx, '🦌', 0, 0, 52)
      ctx.restore()
      // glowing nose
      const a = Math.max(-0.5, Math.min(0.9, rudolf.vy / 900))
      const nx = rudolf.x + Math.cos(a) * 24 - Math.sin(a) * -6
      const ny = rudolf.y + Math.sin(a) * 24 + Math.cos(a) * -6
      const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 22 + Math.sin(t / 120) * 4)
      glow.addColorStop(0, 'rgba(255,60,60,0.9)')
      glow.addColorStop(1, 'rgba(255,60,60,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(nx, ny, 26, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ff2d2d'
      ctx.beginPath()
      ctx.arc(nx, ny, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04)
      last = now

      if (started) {
        rudolf.vy += GRAVITY * dt
        rudolf.y += rudolf.vy * dt
      } else {
        rudolf.y = H / 2 + Math.sin(now / 300) * 12
      }

      if (started && !dead) {
        const speed = SPEED + Math.min(score * 3, 120)
        dist += speed * dt
        for (const p of poles) {
          p.x -= speed * dt
          if (!p.passed && p.x + POLE_W < rudolf.x) {
            p.passed = true
            score += 1
            onScore(score)
            blip(880, 0.1, 'triangle', 0.06)
          }
          if (p.gift && Math.abs(p.x + POLE_W / 2 - rudolf.x) < 26 && Math.abs(p.gapY - rudolf.y) < 30) {
            p.gift = false
            score += 3
            onScore(score)
            blip(1320, 0.12, 'triangle', 0.07)
          }
          // collision (circle vs rect, forgiving radius)
          const r = 18
          const inX = rudolf.x + r > p.x && rudolf.x - r < p.x + POLE_W
          const inGap = rudolf.y - r > p.gapY - GAP / 2 && rudolf.y + r < p.gapY + GAP / 2
          if (inX && !inGap) dead = true
        }
        if (poles[0].x < -POLE_W) {
          poles.shift()
          addPole(poles[poles.length - 1].x + 260)
        }
        if (rudolf.y > H - 50 || rudolf.y < -40) dead = true
        if (dead) {
          blip(200, 0.4, 'sawtooth', 0.08)
          if (navigator.vibrate) navigator.vibrate(120)
        }
        trail.push({ x: rudolf.x - 20, y: rudolf.y + 4, life: 1 })
      }
      for (const s of trail) {
        s.x -= 120 * dt
        s.life -= dt * 1.4
      }
      while (trail.length && trail[0].life <= 0) trail.shift()

      // draw
      skyGradient(ctx)
      drawStars(ctx, stars, now)
      // moon
      ctx.fillStyle = '#fbefc4'
      ctx.beginPath()
      ctx.arc(390, 110, 40, 0, Math.PI * 2)
      ctx.fill()
      // parallax hills
      ctx.fillStyle = '#2a3a78'
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 140 + Math.sin((x + dist * 0.3) / 70) * 24)
      ctx.lineTo(W, H)
      ctx.fill()

      for (const s of trail) {
        ctx.globalAlpha = Math.max(s.life, 0) * 0.8
        ctx.fillStyle = '#f6c453'
        ctx.beginPath()
        ctx.arc(s.x, s.y, 2.5 * s.life + 0.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      for (const p of poles) {
        drawPole(p.x, -10, p.gapY - GAP / 2)
        drawPole(p.x, p.gapY + GAP / 2, H - 40)
        // snow caps
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.ellipse(p.x + POLE_W / 2, p.gapY + GAP / 2, POLE_W / 2 + 6, 9, 0, Math.PI, 0)
        ctx.fill()
        if (p.gift) emoji(ctx, '🎁', p.x + POLE_W / 2, p.gapY + Math.sin(now / 250) * 6, 30)
      }

      // ground
      ctx.fillStyle = '#e4ecfb'
      ctx.fillRect(0, H - 50, W, 50)
      ctx.fillStyle = '#c9d6f2'
      for (let x = -((dist * 1) % 60); x < W; x += 60) ctx.fillRect(x, H - 50, 30, 6)

      drawRudolf(now)

      hud(ctx, `${score}`, W / 2, 30, 'center')
      if (!started) {
        ctx.fillStyle = 'rgba(7,11,29,0.55)'
        ctx.fillRect(60, H / 2 + 60, W - 120, 70)
        hud(ctx, 'Tryck för att flyga!', W / 2, H / 2 + 80, 'center')
      }

      if (dead) {
        deadFor += dt
        if (deadFor > 0.8) {
          onOver(score)
          return
        }
      }
      raf = requestAnimationFrame(loop)
    }

    canvas.addEventListener('pointerdown', onDown)
    addEventListener('keydown', onKey)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      removeEventListener('keydown', onKey)
    }
  }, [onScore, onOver])

  return <canvas ref={ref} className="block h-full w-full touch-none select-none" />
}
