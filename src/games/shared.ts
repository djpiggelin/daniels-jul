export type GameProps = {
  onScore: (score: number) => void
  onOver: (score: number) => void
}

export const W = 480
export const H = 720

export function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const toLocal = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect()
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H }
  }
  return { ctx, toLocal }
}

export function skyGradient(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#070b1d')
  g.addColorStop(0.6, '#16215080')
  g.addColorStop(1, '#24336b')
  ctx.fillStyle = '#0b1230'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

export function makeStars(n: number) {
  return Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.75, r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 }))
}

export function drawStars(ctx: CanvasRenderingContext2D, stars: ReturnType<typeof makeStars>, t: number) {
  ctx.fillStyle = '#fff'
  for (const s of stars) {
    ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 900 + s.p))
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function emoji(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number) {
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch, x, y)
}

export function hud(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = 'left') {
  ctx.font = "600 26px 'DM Sans', sans-serif"
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = '#fff'
  ctx.fillText(text, x, y)
}
