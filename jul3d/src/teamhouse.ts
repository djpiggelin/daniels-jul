// The house you're drawing in Pepparkaksarkitekten, built in 3D on the drafting table in Arkitektkontoret.
// It reads the same plan the editor saves on this device and uses the same geometry, so every wall,
// window and icing sketch matches the templates.
import * as THREE from 'three'
import { DEFAULT_PARAMS, buildBoard, type Building, type CustomPiece, type Piece } from '../../src/lib/gingerbread'
import { MARGIN, renderPiece, type Sketches } from '../../src/lib/icing'

const STORAGE = 'pepparkaksarkitekten' // keep in sync with src/pages/Pepparkaksarkitekten.tsx
/** cm in the editor → metres in the village, a bit larger than life so it reads on the table */
const SCALE = 0.022
/** How big the board may get on the table, in metres. */
const MAX_SIZE = 0.75

type Plan = { buildings: Building[]; custom: CustomPiece[]; sketches: Sketches }

function readPlan(): Plan | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? 'null')
    if (!raw) return null
    // plans saved before there could be more than one building
    let buildings: Building[] = raw.buildings ?? (raw.params ? [{ id: 'h1', name: 'Hus 1', params: raw.params, x: 0, z: 0, rot: 0 }] : [])
    buildings = buildings.map((b) => ({ ...b, params: { ...DEFAULT_PARAMS, ...b.params } }))
    const sketches: Sketches = raw.buildings ? (raw.sketches ?? {}) : Object.fromEntries(Object.entries(raw.sketches ?? {}).map(([k, v]) => [k.includes('/') ? k : `h1/${k}`, v])) as Sketches
    return { buildings, custom: raw.custom ?? [], sketches }
  } catch {
    return null
  }
}

const shapeOf = (pts: [number, number][]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))

/** A flat piece laid into the world with origin + p·u + q·v, UVs matching renderPiece's canvas. */
function placed(geo: THREE.BufferGeometry, piece: Piece, origin: number[], u: number[], v: number[], lift = 0, n?: THREE.Vector3) {
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const p = pos.getX(i)
    const q = pos.getY(i)
    uv[i * 2] = (p + MARGIN) / (piece.w + MARGIN * 2)
    uv[i * 2 + 1] = 1 - (q + MARGIN) / (piece.h + MARGIN * 2)
    pos.setXYZ(
      i,
      origin[0] + p * u[0] + q * v[0] + (n ? n.x * lift : 0),
      origin[1] + p * u[1] + q * v[1] + (n ? n.y * lift : 0),
      origin[2] + p * u[2] + q * v[2] + (n ? n.z * lift : 0),
    )
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.computeVertexNormals()
  return geo
}

/** Build the plan saved on this device, or null when there's nothing drawn yet. */
export function buildTeamHouse(): THREE.Group | null {
  const plan = readPlan()
  if (!plan || (!plan.buildings.length && !plan.custom.length)) return null
  const design = buildBoard(plan.buildings, plan.custom)
  if (!design.faces.length) return null
  const pieces = new Map(design.pieces.map((p) => [p.id, p]))

  const house = new THREE.Group()
  const dough = new THREE.MeshStandardMaterial({ color: 0xb5713a, roughness: 0.85, side: THREE.DoubleSide })
  const roof = new THREE.MeshStandardMaterial({ color: 0x9c5a2a, roughness: 0.85, side: THREE.DoubleSide })
  const glow = new THREE.MeshBasicMaterial({ color: 0xffcf6b, side: THREE.DoubleSide })
  const door = new THREE.MeshBasicMaterial({ color: 0x3a1f0e, side: THREE.DoubleSide })
  const iced = new Map<string, THREE.Material>()

  for (const f of design.faces) {
    const piece = pieces.get(f.piece)
    if (!piece) continue
    const n = new THREE.Vector3(...f.u).cross(new THREE.Vector3(...f.v)).normalize()
    if (f.mirror) n.negate()

    let mat: THREE.Material = piece.roof ? roof : dough
    const ops = plan.sketches[piece.id]
    if (ops?.length) {
      if (!iced.has(piece.id)) {
        const c = document.createElement('canvas')
        renderPiece(c, piece, ops, 12, true)
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        iced.set(piece.id, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }))
      }
      mat = iced.get(piece.id)!
    }

    const shape = shapeOf(piece.outline)
    for (const c of piece.cutouts) shape.holes.push(shapeOf(c.pts))
    house.add(new THREE.Mesh(placed(new THREE.ShapeGeometry(shape), piece, f.origin, f.u, f.v), mat))
    // windows glow from a tea light inside; doors are dark
    for (const c of piece.cutouts) {
      const g = placed(new THREE.ShapeGeometry(shapeOf(c.pts)), piece, f.origin, f.u, f.v, -0.15, n)
      house.add(new THREE.Mesh(g, c.kind === 'window' ? glow : door))
    }
    // icing piping along the edges
    const edge = piece.outline.map(([p, q]) => new THREE.Vector3(f.origin[0] + p * f.u[0] + q * f.v[0], f.origin[1] + p * f.u[1] + q * f.v[1], f.origin[2] + p * f.u[2] + q * f.v[2]).addScaledVector(n, 0.05))
    house.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edge), new THREE.LineBasicMaterial({ color: 0xfff8ee })))
  }

  // centre it on its cake board, shrink it if the plan is big
  const box = new THREE.Box3().setFromObject(house)
  const size = box.getSize(new THREE.Vector3())
  const scale = Math.min(SCALE, MAX_SIZE / Math.max(size.x, size.z, 1e-3))
  const centre = box.getCenter(new THREE.Vector3())
  house.position.set(-centre.x * scale, -box.min.y * scale + 0.012, -centre.z * scale)
  house.scale.setScalar(scale)

  const out = new THREE.Group()
  const board = new THREE.Mesh(
    new THREE.CylinderGeometry(Math.max(size.x, size.z) * scale * 0.62 + 0.04, Math.max(size.x, size.z) * scale * 0.62 + 0.04, 0.012, 40),
    new THREE.MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.6 }),
  )
  board.position.y = 0.006
  out.add(board, house)
  out.traverse((o) => (o.castShadow = true))
  return out
}

/* ---------- the spot on the table ---------- */

let slot: THREE.Group | null = null
let fallback: () => THREE.Object3D = () => new THREE.Group()

/** Where the team's house stands, and what stands there before anything is drawn. */
export function setHouseSlot(group: THREE.Group, placeholder: () => THREE.Object3D) {
  slot = group
  fallback = placeholder
  refreshTeamHouse()
}

/** Rebuild the house from the latest plan – after closing the drawing board, for instance. */
export function refreshTeamHouse() {
  if (!slot) return
  for (const c of [...slot.children]) {
    slot.remove(c)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mats = (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) as THREE.Material[]
      for (const mat of mats) {
        ;(mat as THREE.MeshStandardMaterial).map?.dispose()
        mat.dispose()
      }
    })
  }
  let built: THREE.Object3D | null = null
  try {
    built = buildTeamHouse()
  } catch (err) {
    console.warn('Kunde inte bygga huset från ritningen', err)
  }
  slot.add(built ?? fallback())
}
