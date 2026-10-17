import { useEffect, useRef } from 'react'

/** Full-screen canvas snowfall that drifts with the mouse. */
export function Snow({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let w = 0
    let h = 0
    let wind = 0
    let targetWind = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    type Flake = { x: number; y: number; r: number; vy: number; phase: number; o: number }
    let flakes: Flake[] = []

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(((w * h) / 9000) * density)
      flakes = Array.from({ length: count }, () => spawn(true))
    }
    const spawn = (anywhere = false): Flake => {
      const r = Math.random() ** 2 * 3 + 0.6
      return { x: Math.random() * w, y: anywhere ? Math.random() * h : -5, r, vy: 0.3 + r * 0.35, phase: Math.random() * 6.28, o: 0.4 + Math.random() * 0.6 }
    }
    const onMove = (e: PointerEvent) => {
      targetWind = (e.clientX / w - 0.5) * 1.6
    }

    const tick = () => {
      wind += (targetWind - wind) * 0.02
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#fff'
      for (const f of flakes) {
        f.phase += 0.01
        f.y += f.vy
        f.x += Math.sin(f.phase) * 0.35 + wind * f.r * 0.4
        if (f.y > h + 5) Object.assign(f, spawn())
        if (f.x > w + 5) f.x = -5
        if (f.x < -5) f.x = w + 5
        ctx.globalAlpha = f.o
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }

    resize()
    tick()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [density])

  return <canvas ref={ref} className="pointer-events-none fixed print:hidden inset-0 z-40 h-full w-full" aria-hidden />
}
