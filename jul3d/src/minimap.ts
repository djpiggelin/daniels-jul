// A little map of the village in the top right corner: the snow you can walk on, the lake, the houses,
// you in the middle (pointing the way you look – the map turns with you, so up is always ahead) and the
// others in the village as tiny dots in their colours. No names: it's a map, not a list.
import { HILL, LAKE, NORTH, VILLAGE_RADIUS, WEST, runX, type Circle, type Roof } from './world'

/** Metres per side of the world drawn once (x and z), and how finely. */
const X0 = -102
const X1 = 64
const Z0 = -104
const Z1 = 116
const PX = 4
/** How far you see on the map, from the middle to the edge. */
const RANGE = 42

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

export class Minimap {
  private bg: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D
  private size = 0
  private wait = 0

  constructor(private el: HTMLCanvasElement) {
    this.ctx = el.getContext('2d')!
  }

  /** Draw the village once, from the footprints of everything with a roof and the things you bump into. */
  build(roofs: Roof[], things: Circle[] = []) {
    const c = document.createElement('canvas')
    c.width = (X1 - X0) * PX
    c.height = (Z1 - Z0) * PX
    const g = c.getContext('2d')!
    g.scale(PX, PX)
    g.translate(-X0, -Z0)
    // forest all round
    g.fillStyle = '#21402f'
    g.fillRect(X0, Z0, X1 - X0, Z1 - Z0)
    // the snow you can walk on
    g.fillStyle = '#dfe8f2'
    g.beginPath()
    g.arc(0, 0, VILLAGE_RADIUS, 0, Math.PI * 2)
    g.fill()
    for (const r of [NORTH.path, NORTH.yard, NORTH.garden, WEST.path, WEST.shore, HILL.base]) g.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0)
    // Pulkabacken, winding up into the forest
    g.strokeStyle = '#cfd9e6'
    g.lineWidth = 9
    g.lineCap = 'round'
    g.beginPath()
    for (let z = HILL.z0 - 2; z <= HILL.z1; z += 2) g.lineTo(runX(Math.max(z, HILL.z0)), z)
    g.stroke()
    // Skridskosjön
    g.fillStyle = '#9cc7e6'
    g.beginPath()
    g.ellipse(LAKE.x, LAKE.z, LAKE.rx, LAKE.rz, 0, 0, Math.PI * 2)
    g.fill()
    // stalls, trees, lamp posts and the like
    g.fillStyle = '#7d6a58'
    for (const c of things) {
      if (c.r < 0.3 || c.r > 6) continue
      g.beginPath()
      g.arc(c.x, c.z, Math.max(0.5, c.r), 0, Math.PI * 2)
      g.fill()
    }
    // the houses
    g.fillStyle = '#8c3a2c'
    g.strokeStyle = '#4a1d16'
    g.lineWidth = 0.4
    for (const r of roofs) {
      g.save()
      g.translate(r.x, r.z)
      // (three.js turns x towards -z for a positive angle; the canvas, with z downwards, the other way)
      g.rotate(-Math.atan2(r.sin, r.cos))
      g.fillRect(-r.hw, -r.hd, r.hw * 2, r.hd * 2)
      g.strokeRect(-r.hw, -r.hd, r.hw * 2, r.hd * 2)
      g.restore()
    }
    // the big julgran on the square
    g.fillStyle = '#2f8a4c'
    g.beginPath()
    g.arc(0, 0, 2.2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#f6c453'
    g.beginPath()
    g.arc(0, 0, 0.8, 0, Math.PI * 2)
    g.fill()
    this.bg = c
  }

  /** A dozen times a second is plenty. */
  update(dt: number, me: { x: number; z: number; yaw: number }, others: { x: number; z: number; color: number }[]) {
    if ((this.wait -= dt) > 0 || !this.bg) return
    this.wait = 1 / 12
    const el = this.el
    const css = el.clientWidth
    if (!css) return
    const dpr = Math.min(2, devicePixelRatio || 1)
    const size = Math.round(css * dpr)
    if (size !== this.size) {
      this.size = el.width = el.height = size
    }
    const g = this.ctx
    const half = size / 2
    const k = half / RANGE // pixels per metre
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, size, size)
    g.save()
    g.beginPath()
    g.arc(half, half, half - dpr, 0, Math.PI * 2)
    g.clip()
    g.fillStyle = '#21402f'
    g.fillRect(0, 0, size, size)
    // you in the middle, ahead pointing up
    g.translate(half, half)
    g.rotate(me.yaw)
    g.scale(k, k)
    g.translate(-me.x, -me.z)
    g.imageSmoothingEnabled = true
    g.drawImage(this.bg, X0, Z0, X1 - X0, Z1 - Z0)
    // the others: a dot each, the same size however far you zoom
    for (const o of others) {
      g.beginPath()
      g.arc(o.x, o.z, (3.2 * dpr) / k, 0, Math.PI * 2)
      g.fillStyle = hex(o.color)
      g.fill()
      g.lineWidth = (1.2 * dpr) / k
      g.strokeStyle = '#fff'
      g.stroke()
    }
    g.restore()
    // you: a gold arrow
    g.save()
    g.translate(half, half)
    g.scale(dpr, dpr)
    g.beginPath()
    g.moveTo(0, -7)
    g.lineTo(5.5, 6)
    g.lineTo(0, 3)
    g.lineTo(-5.5, 6)
    g.closePath()
    g.fillStyle = '#f6c453'
    g.fill()
    g.lineWidth = 1.5
    g.strokeStyle = '#2a1a10'
    g.stroke()
    g.restore()
    // where north is, on the rim
    const nx = half - Math.sin(-me.yaw) * (half - 9 * dpr)
    const ny = half - Math.cos(-me.yaw) * (half - 9 * dpr)
    g.font = `700 ${10 * dpr}px "DM Sans", system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 3 * dpr
    g.strokeStyle = 'rgba(7, 11, 29, 0.8)'
    g.strokeText('N', nx, ny)
    g.fillStyle = '#fff3dc'
    g.fillText('N', nx, ny)
  }
}
