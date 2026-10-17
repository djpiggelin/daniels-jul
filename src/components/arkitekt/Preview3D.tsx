import { useMemo, useRef, useState } from 'react'
import { cross, type Design, type Face, type Piece, type V3 } from '../../lib/gingerbread'
import { MARGIN } from '../../lib/icing'

const DOUGH: V3 = [181, 113, 58]
const ROOF: V3 = [156, 90, 42]
const LIGHT = (() => {
  const l: V3 = [-0.45, 0.8, 0.55]
  const n = Math.hypot(...l)
  return l.map((c) => c / n) as V3
})()

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * Parallel projection of the house onto a cake board. Every face is one of the
 * template pieces put through an affine map, so the team's icing sketch can be
 * laid onto the walls exactly. Drag sideways to turn it, up and down to tilt.
 */
export function Preview3D({ design, textures, className = '' }: { design: Design; textures: Record<string, string>; className?: string }) {
  const [yaw, setYaw] = useState(-32)
  const [tilt, setTilt] = useState(24)
  const drag = useRef<{ x: number; y: number; yaw: number; tilt: number } | null>(null)

  const scene = useMemo(() => {
    const pieces = new Map(design.pieces.map((p) => [p.id, p]))
    const th = (yaw * Math.PI) / 180
    const ph = (tilt * Math.PI) / 180
    const [ct, st, cp, sp] = [Math.cos(th), Math.sin(th), Math.cos(ph), Math.sin(ph)]

    // centre the turntable on the footprint
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity
    const world = (f: Face, [p, q]: [number, number]): V3 => [
      f.origin[0] + p * f.u[0] + q * f.v[0],
      f.origin[1] + p * f.u[1] + q * f.v[1],
      f.origin[2] + p * f.u[2] + q * f.v[2],
    ]
    for (const f of design.faces) {
      if (f.attached) continue
      for (const pt of pieces.get(f.piece)!.outline) {
        const w = world(f, pt)
        minX = Math.min(minX, w[0])
        maxX = Math.max(maxX, w[0])
        minZ = Math.min(minZ, w[2])
        maxZ = Math.max(maxZ, w[2])
      }
    }
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const lin = (v: V3): [number, number] => {
      const xr = v[0] * ct - v[2] * st
      const zr = v[0] * st + v[2] * ct
      return [xr, -(v[1] * cp - zr * sp)]
    }
    const depth = (v: V3) => {
      const zr = (v[0] - cx) * st + (v[2] - cz) * ct
      return zr * cp + v[1] * sp
    }
    const project = (v: V3) => lin([v[0] - cx, v[1], v[2] - cz])
    const viewDir: V3 = [0, sp, cp]

    const faces = design.faces
      .map((f, i) => {
        const piece = pieces.get(f.piece)!
        let n = cross(f.v, f.u)
        if (f.mirror) n = n.map((c) => -c) as V3
        const nr: V3 = [n[0] * ct - n[2] * st, n[1], n[0] * st + n[2] * ct]
        const visible = dot(nr, viewDir) > 0.01
        const pts = piece.outline.map((pt) => world(f, pt))
        const d = pts.reduce((s, p) => s + depth(p), 0) / pts.length
        const [a, b] = lin(f.u)
        const [c, dd] = lin(f.v)
        const [e, ff] = project(f.origin)
        const nn = Math.hypot(...n)
        const light = 0.62 + 0.42 * Math.max(0, dot(n, LIGHT) / nn)
        const base = piece.roof ? ROOF : DOUGH
        const fill = `rgb(${base.map((c) => Math.min(255, Math.round(c * light))).join(',')})`
        return { i, f, piece, visible, d, matrix: `matrix(${a} ${b} ${c} ${dd} ${e} ${ff})`, fill, screen: pts.map(project) }
      })
      .filter((f) => f.visible)
      .sort((a, b) => Number(!!a.f.attached) - Number(!!b.f.attached) || a.d - b.d)

    // the cake board
    const pad = 3
    const board = (
      [
        [minX - pad, 0, minZ - pad],
        [maxX + pad, 0, minZ - pad],
        [maxX + pad, 0, maxZ + pad],
        [minX - pad, 0, maxZ + pad],
      ] as V3[]
    ).map(project)
    const all = [...board, ...faces.flatMap((f) => f.screen)]
    let x0 = Math.min(...all.map((p) => p[0])),
      x1 = Math.max(...all.map((p) => p[0])),
      y0 = Math.min(...all.map((p) => p[1])),
      y1 = Math.max(...all.map((p) => p[1]))
    // keep a sense of size: small houses look small
    const minW = 32,
      minH = 26
    if (x1 - x0 < minW) [x0, x1] = [(x0 + x1) / 2 - minW / 2, (x0 + x1) / 2 + minW / 2]
    if (y1 - y0 < minH) [y0, y1] = [y1 - minH, y1]
    return { faces, board, viewBox: `${x0 - 1.5} ${y0 - 1.5} ${x1 - x0 + 3} ${y1 - y0 + 3}` }
  }, [design, yaw, tilt])

  const pathOf = (piece: Piece) => `M${piece.outline.map((p) => p.join(' ')).join('L')}Z`

  return (
    <svg
      viewBox={scene.viewBox}
      className={`cursor-grab touch-none select-none active:cursor-grabbing ${className}`}
      role="img"
      aria-label="Förhandsvisning av pepparkakshuset. Dra för att vrida."
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY, yaw, tilt }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        setYaw(Math.max(-80, Math.min(80, d.yaw + (e.clientX - d.x) * 0.45)))
        setTilt(Math.max(8, Math.min(55, d.tilt + (e.clientY - d.y) * 0.3)))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <polygon points={scene.board.map((p) => p.join(',')).join(' ')} fill="#fffdf8" stroke="#d8c7ad" strokeWidth="0.25" />
      {scene.faces.map(({ i, piece, matrix, fill }) => (
        <g key={i} transform={matrix}>
          <clipPath id={`face-${i}`}>
            <path d={pathOf(piece)} />
          </clipPath>
          <path d={pathOf(piece)} fill={fill} />
          {piece.cutouts.map((c, j) => (
            <path key={j} d={`M${c.pts.map((p) => p.join(' ')).join('L')}Z`} fill={c.kind === 'window' ? '#ffcf6b' : '#3a1f0e'} />
          ))}
          {textures[piece.id] && (
            <image
              href={textures[piece.id]}
              x={-MARGIN}
              y={-MARGIN}
              width={piece.w + MARGIN * 2}
              height={piece.h + MARGIN * 2}
              clipPath={`url(#face-${i})`}
              preserveAspectRatio="none"
            />
          )}
          <path d={pathOf(piece)} fill="none" stroke="#fff8ee" strokeWidth={piece.roof ? 2.2 : 1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  )
}
