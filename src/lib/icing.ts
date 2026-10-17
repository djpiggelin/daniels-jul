// Facade sketches for Pepparkaksarkitekten: icing strokes and candy stamps,
// stored as small vector ops in centimetres so they survive resizing the
// house and fit comfortably in a blob.

import type { Piece } from './gingerbread'

export type StampType = 'polkagris' | 'gele' | 'mandel' | 'kanel' | 'parlsocker'

export type Op =
  /** icing stroke: width in cm, flat [x, y, x, y, …] in cm; e = eraser */
  | { k: 's'; w: number; p: number[]; e?: 1 }
  /** candy stamp at x, y (cm), rotated r radians; s seeds colour and scatter */
  | { k: 't'; t: StampType; x: number; y: number; r: number; s: number }

export type Sketches = Record<string, Op[]>

export const STAMPS: { type: StampType; name: string }[] = [
  { type: 'polkagris', name: 'Polkagris' },
  { type: 'gele', name: 'Gelé' },
  { type: 'mandel', name: 'Mandel' },
  { type: 'kanel', name: 'Kanelstång' },
  { type: 'parlsocker', name: 'Pärlsocker' },
]

export const NOZZLES = [
  { w: 0.15, name: 'Fin' },
  { w: 0.3, name: 'Mellan' },
  { w: 0.55, name: 'Tjock' },
]

/** Space around the piece on the sketch canvas, in cm. */
export const MARGIN = 0.6

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const GELE = ['#d93a3d', '#2fa36b', '#f2b632', '#e8742c', '#9b3fb5']

export function drawStamp(ctx: CanvasRenderingContext2D, op: Extract<Op, { k: 't' }>) {
  ctx.save()
  ctx.translate(op.x, op.y)
  ctx.rotate(op.r)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (op.t) {
    case 'polkagris': {
      const cane = () => {
        ctx.beginPath()
        ctx.moveTo(0.35, 1.5)
        ctx.lineTo(0.35, -0.55)
        ctx.arc(-0.2, -0.55, 0.55, 0, Math.PI, true)
        ctx.lineTo(-0.75, -0.25)
      }
      ctx.lineWidth = 0.42
      ctx.strokeStyle = 'rgba(70,30,10,0.35)'
      ctx.translate(0.04, 0.06)
      cane()
      ctx.stroke()
      ctx.translate(-0.04, -0.06)
      ctx.strokeStyle = '#fffaf3'
      cane()
      ctx.stroke()
      ctx.lineCap = 'butt'
      ctx.strokeStyle = '#d93a3d'
      ctx.lineWidth = 0.4
      ctx.setLineDash([0.17, 0.2])
      cane()
      ctx.stroke()
      ctx.setLineDash([])
      break
    }
    case 'gele': {
      const c = GELE[Math.floor(rand(op.s) * GELE.length)]
      ctx.fillStyle = 'rgba(70,30,10,0.3)'
      ctx.beginPath()
      ctx.ellipse(0.05, 0.48, 0.66, 0.16, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-0.62, 0.45)
      ctx.bezierCurveTo(-0.66, -0.2, -0.38, -0.6, 0, -0.6)
      ctx.bezierCurveTo(0.38, -0.6, 0.66, -0.2, 0.62, 0.45)
      ctx.quadraticCurveTo(0, 0.6, -0.62, 0.45)
      ctx.fillStyle = c
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.ellipse(-0.25, -0.25, 0.12, 0.2, -0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (let i = 0; i < 9; i++) {
        ctx.beginPath()
        ctx.arc(-0.45 + rand(op.s + i) * 0.9, -0.4 + rand(op.s + i + 20) * 0.8, 0.035, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'mandel': {
      const shape = () => {
        ctx.beginPath()
        ctx.moveTo(0, -0.85)
        ctx.bezierCurveTo(0.55, -0.5, 0.5, 0.55, 0, 0.75)
        ctx.bezierCurveTo(-0.5, 0.55, -0.55, -0.5, 0, -0.85)
      }
      ctx.translate(0.05, 0.06)
      shape()
      ctx.fillStyle = 'rgba(70,30,10,0.3)'
      ctx.fill()
      ctx.translate(-0.05, -0.06)
      shape()
      ctx.fillStyle = '#e8c79a'
      ctx.fill()
      ctx.strokeStyle = '#b07a45'
      ctx.lineWidth = 0.05
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, -0.6)
      ctx.quadraticCurveTo(0.08, 0, 0, 0.55)
      ctx.strokeStyle = 'rgba(176,122,69,0.6)'
      ctx.stroke()
      break
    }
    case 'kanel': {
      ctx.fillStyle = 'rgba(70,30,10,0.3)'
      ctx.fillRect(-1.75, -0.24, 3.6, 0.6)
      const g = ctx.createLinearGradient(0, -0.3, 0, 0.3)
      g.addColorStop(0, '#a35a2a')
      g.addColorStop(0.5, '#7a3e1a')
      g.addColorStop(1, '#5a2c12')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.roundRect(-1.8, -0.3, 3.6, 0.6, 0.12)
      ctx.fill()
      ctx.strokeStyle = 'rgba(40,18,6,0.5)'
      ctx.lineWidth = 0.04
      for (let i = 0; i < 5; i++) {
        const x = -1.4 + i * 0.65 + rand(op.s + i) * 0.2
        ctx.beginPath()
        ctx.moveTo(x, -0.28)
        ctx.lineTo(x + 0.08, 0.28)
        ctx.stroke()
      }
      // the rolled end
      ctx.fillStyle = '#b8743f'
      ctx.beginPath()
      ctx.ellipse(1.75, 0, 0.14, 0.3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#5a2c12'
      ctx.beginPath()
      ctx.ellipse(1.75, 0.02, 0.07, 0.16, 0, 0.3, Math.PI * 1.7)
      ctx.stroke()
      break
    }
    case 'parlsocker': {
      for (let i = 0; i < 9; i++) {
        const a = rand(op.s + i) * Math.PI * 2
        const d = Math.sqrt(rand(op.s + i + 40)) * 0.6
        const x = Math.cos(a) * d
        const y = Math.sin(a) * d
        const s = 0.09 + rand(op.s + i + 80) * 0.07
        ctx.fillStyle = 'rgba(70,30,10,0.3)'
        ctx.beginPath()
        ctx.arc(x + 0.025, y + 0.035, s, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fffdf8'
        ctx.beginPath()
        ctx.ellipse(x, y, s, s * 0.85, a, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
  }
  ctx.restore()
}

function strokePath(ctx: CanvasRenderingContext2D, p: number[]) {
  ctx.beginPath()
  ctx.moveTo(p[0], p[1])
  if (p.length === 2) ctx.lineTo(p[0] + 0.001, p[1])
  for (let i = 2; i < p.length; i += 2) {
    // smooth through midpoints
    if (i + 2 < p.length) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2)
    else ctx.lineTo(p[i], p[i + 1])
  }
}

/** Icing and candy on a transparent layer, in cm units (the caller sets the scale). */
export function drawOps(ctx: CanvasRenderingContext2D, ops: Op[]) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const op of ops) {
    if (op.k === 't') {
      drawStamp(ctx, op)
      continue
    }
    if (op.e) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = op.w
      strokePath(ctx, op.p)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
      continue
    }
    ctx.save()
    ctx.translate(op.w * 0.12, op.w * 0.22)
    ctx.strokeStyle = 'rgba(70,30,10,0.35)'
    ctx.lineWidth = op.w
    strokePath(ctx, op.p)
    ctx.stroke()
    ctx.restore()
    ctx.strokeStyle = '#fffaf2'
    ctx.lineWidth = op.w
    strokePath(ctx, op.p)
    ctx.stroke()
  }
}

function tracePiece(ctx: CanvasRenderingContext2D, piece: Piece) {
  ctx.beginPath()
  piece.outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
}

function traceCutouts(ctx: CanvasRenderingContext2D, piece: Piece, kind?: 'door' | 'window') {
  ctx.beginPath()
  for (const c of piece.cutouts) {
    if (kind && c.kind !== kind) continue
    c.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
  }
}

/**
 * Paint a piece onto a canvas at `ppc` pixels per cm, with MARGIN around it.
 * `dough` paints the baked gingerbread underneath; without it only the icing
 * is drawn on transparent – used as a texture for the 3D preview.
 */
export function renderPiece(canvas: HTMLCanvasElement, piece: Piece, ops: Op[], ppc: number, dough = true) {
  const W = Math.round((piece.w + MARGIN * 2) * ppc)
  const H = Math.round((piece.h + MARGIN * 2) * ppc)
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const toCm = () => ctx.setTransform(ppc, 0, 0, ppc, MARGIN * ppc, MARGIN * ppc)

  if (dough) {
    toCm()
    ctx.save()
    tracePiece(ctx, piece)
    ctx.fillStyle = '#b5713a'
    ctx.fill()
    ctx.clip()
    // speckles of spice, deterministic so the dough doesn't flicker
    const n = Math.min(900, Math.round(piece.w * piece.h * 1.6))
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(90,45,15,0.22)' : 'rgba(240,190,130,0.22)'
      ctx.beginPath()
      ctx.arc(rand(i) * piece.w, rand(i + 999) * piece.h, 0.03 + rand(i + 77) * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
    // darker baked edges
    tracePiece(ctx, piece)
    ctx.strokeStyle = 'rgba(110,55,20,0.55)'
    ctx.lineWidth = 0.6
    ctx.stroke()
    ctx.restore()
    traceCutouts(ctx, piece, 'window')
    ctx.fillStyle = '#ffcf6b'
    ctx.fill()
    traceCutouts(ctx, piece, 'door')
    ctx.fillStyle = '#3a1f0e'
    ctx.fill()
  }

  // icing on its own layer so the eraser only takes icing, never the dough
  const layer = document.createElement('canvas')
  layer.width = W
  layer.height = H
  const lc = layer.getContext('2d')!
  lc.setTransform(ppc, 0, 0, ppc, MARGIN * ppc, MARGIN * ppc)
  drawOps(lc, ops)
  // icing may hang a little over the edge, like the real thing – so no clip here
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(layer, 0, 0)
}

/** Thin out a freshly drawn stroke and round to 0.01 cm before storing it. */
export function compact(p: number[]) {
  const out: number[] = []
  for (let i = 0; i < p.length; i += 2) {
    const x = Math.round(p[i] * 100) / 100
    const y = Math.round(p[i + 1] * 100) / 100
    const n = out.length
    if (n >= 2 && i < p.length - 2 && Math.hypot(x - out[n - 2], y - out[n - 1]) < 0.06) continue
    out.push(x, y)
  }
  return out
}
