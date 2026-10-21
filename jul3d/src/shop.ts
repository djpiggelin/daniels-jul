// A shop house with an open front, plus helpers for hanging things on its walls.
import * as THREE from 'three'
import { drawSign, planksTexture, toTexture } from './tex'

export const W = 10
export const D = 8
export const H = 3.6
const RIDGE = 2.4

/** Axis-aligned box in shop-local space (x/z centre, half extents). */
export type Box = { x: number; z: number; hw: number; hd: number }
export type Wall = 'back' | 'left' | 'right'

export type Exhibit = {
  target: THREE.Object3D
  title: string
  caption?: string
  /** Full-size image for the viewer (data URL or path). */
  image: () => string
  /** Do this instead of showing the picture (e.g. open the knytis list), with its own prompt. */
  open?: () => void
  prompt?: string
}

export type ShopColors = { wall: string; trim: number; roof: number; inner?: string }

export class Shop {
  readonly group = new THREE.Group()
  readonly boxes: Box[] = []
  readonly exhibits: Exhibit[] = []
  readonly updaters: ((t: number, dt: number) => void)[] = []
  private sign: { canvas: HTMLCanvasElement; tex: THREE.Texture; title: string; last: string }

  constructor(
    readonly title: string,
    colors: ShopColors,
  ) {
    const g = this.group
    const outer = planksTexture(colors.wall, { boards: 7, seed: colors.wall.length * 13 })
    const inner = planksTexture(colors.inner ?? '#c89a68', { boards: 7, seed: 3 })
    const wallMats = (w: number, h: number) => {
      const o = outer.clone()
      o.repeat.set(w / 1.6, h / 1.6)
      const i = inner.clone()
      i.repeat.set(w / 1.6, h / 1.6)
      return { o: new THREE.MeshStandardMaterial({ map: o, roughness: 0.85 }), i: new THREE.MeshStandardMaterial({ map: i, roughness: 0.85 }) }
    }
    const trim = new THREE.MeshStandardMaterial({ color: colors.trim, roughness: 0.6 })
    const snow = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.9 })

    // floor
    const floorTex = planksTexture('#7a5232', { boards: 8, vertical: false, seed: 9 })
    floorTex.repeat.set(W / 2, D / 2)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0.03
    floor.receiveShadow = true
    g.add(floor)

    // walls: box faces order is +x, -x, +y, -y, +z, -z
    const back = wallMats(W, H)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.2), [back.o, back.o, trim, trim, back.i, back.o])
    backWall.position.set(0, H / 2, -D / 2)
    const side = wallMats(D, H)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, D), [side.i, side.o, trim, trim, side.o, side.o])
    leftWall.position.set(-W / 2, H / 2, 0)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, D), [side.o, side.i, trim, trim, side.o, side.o])
    rightWall.position.set(W / 2, H / 2, 0)
    for (const w of [backWall, leftWall, rightWall]) {
      w.castShadow = w.receiveShadow = true
      g.add(w)
    }
    this.boxes.push({ x: 0, z: -D / 2, hw: W / 2 + 0.2, hd: 0.25 }, { x: -W / 2, z: 0, hw: 0.25, hd: D / 2 + 0.2 }, { x: W / 2, z: 0, hw: 0.25, hd: D / 2 + 0.2 })

    // front posts + header beam
    for (const x of [-W / 2, W / 2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, H, 0.4), trim)
      post.position.set(x, H / 2, D / 2)
      post.castShadow = true
      g.add(post)
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.45, 0.4), trim)
    header.position.set(0, H - 0.22, D / 2)
    g.add(header)

    // gables
    const tri = new THREE.Shape()
    tri.moveTo(-W / 2 - 0.1, 0)
    tri.lineTo(W / 2 + 0.1, 0)
    tri.lineTo(0, RIDGE)
    tri.closePath()
    const gableGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false })
    const gableTex = outer.clone()
    gableTex.repeat.set(1 / 1.6, 1 / 1.6)
    const gableMat = new THREE.MeshStandardMaterial({ map: gableTex, roughness: 0.85 })
    for (const z of [D / 2 - 0.1, -D / 2 - 0.1]) {
      const gable = new THREE.Mesh(gableGeo, gableMat)
      gable.position.set(0, H, z)
      gable.castShadow = true
      g.add(gable)
    }
    // inner ceiling so the room feels cosy and closed
    const ceilMat = back.i.clone()
    ceilMat.color.setHex(0x8a6a50)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat)
    ceil.rotation.x = Math.PI / 2
    ceil.position.y = H
    g.add(ceil)
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.8 })
    for (const z of [-2.6, 0, 2.6]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, 0.2), beamMat)
      beam.position.set(0, H - 0.11, z)
      g.add(beam)
    }

    // roof panels with snow on top
    const a = Math.atan2(RIDGE, W / 2)
    const over = 0.7
    const len = (W / 2 + over) / Math.cos(a)
    const roofMat = new THREE.MeshStandardMaterial({ color: colors.roof, roughness: 0.8 })
    for (const s of [-1, 1]) {
      const ex = s * (W / 2 + over)
      const ey = H - over * Math.tan(a)
      const cx = ex / 2
      const cy = (ey + H + RIDGE) / 2
      const panel = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, D + 1.2), roofMat)
      panel.position.set(cx, cy, 0)
      panel.rotation.z = -s * a
      panel.castShadow = panel.receiveShadow = true
      const cover = new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, 0.16, D + 1.3), snow)
      cover.position.set(cx + s * Math.sin(a) * 0.15, cy + Math.cos(a) * 0.15, 0)
      cover.rotation.z = -s * a
      cover.castShadow = true
      g.add(panel, cover)
    }
    // icicles along the front eaves
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xdff3ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 })
    const iceGeo = new THREE.ConeGeometry(0.05, 1, 6)
    for (let i = 0; i < 26; i++) {
      const k = i / 25
      const x = THREE.MathUtils.lerp(-W / 2, W / 2, k)
      const y = H + RIDGE * (1 - Math.abs(x) / (W / 2)) - 0.05
      const h = 0.15 + ((i * 37) % 10) / 22
      const ice = new THREE.Mesh(iceGeo, iceMat)
      ice.scale.set(1, h, 1)
      ice.rotation.x = Math.PI
      ice.position.set(x, y - h / 2 + 0.02, D / 2 + 0.2)
      if (Math.abs(x) > 0.4) g.add(ice)
    }

    // string lights along the gable edge
    // (one instanced mesh: 31 bulbs in a single draw call, each still twinkling on its own)
    const cols = [0xff4d4d, 0xffd34d, 0x5dff9a, 0x5db8ff].map((c) => new THREE.Color(c))
    const N = 31
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), N)
    const spots: THREE.Vector3[] = []
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1)
      const x = THREE.MathUtils.lerp(-W / 2 - 0.3, W / 2 + 0.3, k)
      const y = H + RIDGE * (1 - Math.abs(x) / (W / 2)) - 0.18 - Math.sin(k * Math.PI * 6) ** 2 * 0.12
      spots.push(new THREE.Vector3(x, y, D / 2 + 0.25))
      bulbs.setColorAt(i, cols[i % 4])
    }
    g.add(bulbs)
    const one = new THREE.Object3D()
    this.updaters.push((t) => {
      for (let i = 0; i < N; i++) {
        one.position.copy(spots[i])
        one.scale.setScalar(0.7 + 0.5 * Math.max(0, Math.sin(t * 3 + i)))
        one.updateMatrix()
        bulbs.setMatrixAt(i, one.matrix)
      }
      bulbs.instanceMatrix.needsUpdate = true
    })

    // sign on the gable
    const canvas = drawSign(title, '')
    const tex = toTexture(canvas, { live: true })
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.29), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 }))
    sign.position.set(0, H + 0.78, D / 2 + 0.13)
    g.add(sign)
    this.sign = { canvas, tex, title, last: '' }

    // warm light inside + a lantern at the door
    const light = new THREE.PointLight(0xffc98a, 16, 13, 1.4)
    light.position.set(0, 2.5, -0.3)
    g.add(light)
    const fill = new THREE.PointLight(0xffb070, 6, 7, 1.5)
    fill.position.set(0, 2.2, D / 2 + 1.2)
    g.add(fill)
  }

  setSignLine(text: string) {
    if (text === this.sign.last) return
    this.sign.last = text
    const fresh = drawSign(this.sign.title, text)
    const ctx = this.sign.canvas.getContext('2d')!
    ctx.clearRect(0, 0, fresh.width, fresh.height)
    ctx.drawImage(fresh, 0, 0)
    this.sign.tex.needsUpdate = true
  }

  /** Place an object flat against an inner wall. `along` runs left→right as you face the wall
   *  (so on the left wall + is towards the back, on the right wall + is towards the door). */
  hang(obj: THREE.Object3D, wall: Wall, along: number, y: number) {
    const inset = 0.13
    if (wall === 'back') {
      obj.position.set(along, y, -D / 2 + inset)
      obj.rotation.y = 0
    } else if (wall === 'left') {
      obj.position.set(-W / 2 + inset, y, -along)
      obj.rotation.y = Math.PI / 2
    } else {
      obj.position.set(W / 2 - inset, y, along)
      obj.rotation.y = -Math.PI / 2
    }
    this.group.add(obj)
    return obj
  }

  exhibit(target: THREE.Object3D, ex: Omit<Exhibit, 'target'>) {
    this.exhibits.push({ target, ...ex })
  }

  block(x: number, z: number, hw: number, hd: number) {
    this.boxes.push({ x, z, hw, hd })
  }

  place(angleDeg: number, radius: number) {
    const a = THREE.MathUtils.degToRad(angleDeg)
    const x = Math.sin(a) * radius
    const z = -Math.cos(a) * radius
    this.group.position.set(x, 0, z)
    this.group.rotation.y = Math.atan2(-x, -z)
  }

  update(t: number, dt: number) {
    this.updaters.forEach((u) => u(t, dt))
  }
}

/* ------------------------------------------------------------------ wall pieces */

const frameMats = new Map<number, THREE.Material>()
function frameMat(color: number) {
  if (!frameMats.has(color)) frameMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: color === 0xd4a64a || color === 0xc8803c ? 0.7 : 0.1 }))
  return frameMats.get(color)!
}

/** A picture plane with a 3D frame around it. Height follows the image's aspect. */
/** `live`: the picture is redrawn later (e.g. the knytis chalkboard) – keep its canvas as it is. */
export function framed(src: HTMLCanvasElement | HTMLImageElement, width: number, opts: { frame?: number; border?: number; maxH?: number; live?: boolean } = {}) {
  const g = new THREE.Group()
  let w = width
  let h = (width * src.height) / src.width
  if (opts.maxH && h > opts.maxH) {
    h = opts.maxH
    w = (h * src.width) / src.height
  }
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: toTexture(src, { live: opts.live }), roughness: 0.6 }))
  pic.position.z = 0.03
  g.add(pic)
  const b = opts.border ?? 0.09
  const mat = frameMat(opts.frame ?? 0xd4a64a)
  const bars: [number, number, number, number][] = [
    [0, h / 2 + b / 2, w + 2 * b, b],
    [0, -h / 2 - b / 2, w + 2 * b, b],
    [-w / 2 - b / 2, 0, b, h],
    [w / 2 + b / 2, 0, b, h],
  ]
  for (const [x, y, bw, bh] of bars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), mat)
    bar.position.set(x, y, 0.04)
    g.add(bar)
  }
  const backing = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), frameMat(0x2a1a10))
  g.add(backing)
  g.userData.size = { w, h }
  return g
}

/** A sheet pinned flat to the wall (parchment, note, poster). */
export function sheet(src: HTMLCanvasElement, width: number, tilt = 0) {
  const h = (width * src.height) / src.width
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshStandardMaterial({ map: toTexture(src), roughness: 0.9, side: THREE.DoubleSide }))
  m.rotation.z = tilt
  const g = new THREE.Group()
  m.position.z = 0.02
  g.add(m)
  g.userData.size = { w: width, h }
  return g
}
