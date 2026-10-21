// Shared bits for the arcade games (ported from the old site's canvas games).
// Every game draws into a 480×720 portrait canvas and gets its input from the arcade cabinet.

export const W = 480
export const H = 720

export interface Game {
  /** Advance and draw one frame. */
  frame(dt: number, now: number): void
  key?(code: string, down: boolean): void
  /** Pointer in game coordinates (0..W, 0..H). */
  pointer?(x: number, y: number, kind: 'move' | 'down'): void
  readonly score: number
  readonly over: boolean
  /** Show an on-screen cursor for the mouse. */
  readonly cursor: boolean
  /** -1..1, for the player's hand on the joystick. */
  readonly stick?: number
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

export function hud(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = 'left', size = 26) {
  ctx.font = `600 ${size}px 'DM Sans', sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = '#fff'
  ctx.fillText(text, x, y)
}
