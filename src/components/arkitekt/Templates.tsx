import type { Piece, Pt } from '../../lib/gingerbread'

// A4 portrait with 10 mm print margins → 190 × 277 mm to draw on.
const PAGE_W = 190
const PAGE_H = 277
const TOP = 16 // header band
const BOTTOM = PAGE_H - 13 // footer band
const AREA_H = BOTTOM - TOP
const GAP = 6
const LABEL = 8 // room for the name above each piece
const OVERLAP = 10

type Placed = { piece: Piece; x: number; y: number; rot: boolean }
type Tile = { piece: Piece; rot: boolean; col: number; row: number; cols: number; rows: number }
export type Page = { placed: Placed[]; tile?: Tile }

const size = (p: Piece, rot: boolean) => (rot ? { w: p.h * 10, h: p.w * 10 } : { w: p.w * 10, h: p.h * 10 })

const tilesFor = (w: number, h: number) => {
  const cols = w <= PAGE_W ? 1 : Math.ceil((w - PAGE_W) / (PAGE_W - OVERLAP)) + 1
  const rows = h <= AREA_H ? 1 : Math.ceil((h - AREA_H) / (AREA_H - OVERLAP)) + 1
  return { cols, rows }
}

/** Shelf-pack the pieces that fit on a page; split the rest over several taped-together sheets. */
export function layoutPages(pieces: Piece[]): Page[] {
  const fits: { piece: Piece; rot: boolean }[] = []
  const big: Piece[] = []
  for (const p of pieces) {
    const a = size(p, false)
    const b = size(p, true)
    if (a.w <= PAGE_W && a.h + LABEL <= AREA_H) fits.push({ piece: p, rot: false })
    else if (b.w <= PAGE_W && b.h + LABEL <= AREA_H) fits.push({ piece: p, rot: true })
    else big.push(p)
  }
  fits.sort((a, b) => size(b.piece, b.rot).h - size(a.piece, a.rot).h)

  // first fit over every shelf on every page, so small bits fill the gaps
  const pages: Page[] = []
  const shelves: { page: Page; y: number; h: number; x: number }[] = []
  const used = new Map<Page, number>()
  for (const f of fits) {
    const { w, h } = size(f.piece, f.rot)
    const need = h + LABEL
    let shelf = shelves.find((sh) => need <= sh.h && sh.x + w <= PAGE_W)
    if (!shelf) {
      const page = pages.find((pg) => (used.get(pg) ?? 0) + need <= AREA_H)
      const target = page ?? { placed: [] }
      if (!page) pages.push(target)
      const y = used.get(target) ?? 0
      shelf = { page: target, y, h: need, x: 0 }
      shelves.push(shelf)
      used.set(target, y + need + GAP)
    }
    shelf.page.placed.push({ piece: f.piece, x: shelf.x, y: shelf.y + LABEL, rot: f.rot })
    shelf.x += w + GAP
  }

  for (const p of big) {
    const a = size(p, false)
    const b = size(p, true)
    const ta = tilesFor(a.w, a.h)
    const tb = tilesFor(b.w, b.h)
    const rot = tb.cols * tb.rows < ta.cols * ta.rows
    const { cols, rows } = rot ? tb : ta
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) pages.push({ placed: [], tile: { piece: p, rot, col, row, cols, rows } })
  }
  return pages
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('sv-SE')
const countText = (p: Piece) => `skär ${p.count} st${p.note ? ` · ${p.note}` : ''}`

function signedArea(pts: Pt[]) {
  let s = 0
  pts.forEach(([x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length]
    s += x1 * y2 - x2 * y1
  })
  return s / 2
}

/** The piece itself in cm units: cutting line, dashed openings and the length of every edge. */
function PieceDrawing({ piece }: { piece: Piece }) {
  const d = `M${piece.outline.map((p) => p.join(' ')).join('L')}Z`
  const inward = signedArea(piece.outline) > 0 ? 1 : -1
  return (
    <g>
      <path d={d} fill="#fff" stroke="#000" strokeWidth="0.04" strokeLinejoin="round" />
      {piece.cutouts.map((c, i) => (
        <path key={i} d={`M${c.pts.map((p) => p.join(' ')).join('L')}Z`} fill="none" stroke="#000" strokeWidth="0.03" strokeDasharray="0.25 0.15" />
      ))}
      {piece.outline.map(([x1, y1], i) => {
        const [x2, y2] = piece.outline[(i + 1) % piece.outline.length]
        const len = Math.hypot(x2 - x1, y2 - y1)
        if (len < 1.6) return null
        // normal pointing into the piece (y is down, so the sign flips with winding)
        const nx = (-(y2 - y1) / len) * inward
        const ny = ((x2 - x1) / len) * inward
        let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
        if (ang > 90) ang -= 180
        if (ang < -90) ang += 180
        const mx = (x1 + x2) / 2 + nx * 0.45
        const my = (y1 + y2) / 2 + ny * 0.45
        return (
          <text key={i} x={mx} y={my} transform={`rotate(${ang} ${mx} ${my})`} fontSize="0.32" textAnchor="middle" dominantBaseline="middle" fill="#555" fontFamily="DM Sans, sans-serif">
            {r1(len)} cm
          </text>
        )
      })}
    </g>
  )
}

function placedTransform(piece: Piece, rot: boolean, x: number, y: number) {
  // cm → mm, turned a quarter when it fits better that way
  return rot ? `translate(${x + piece.h * 10} ${y}) rotate(90) scale(10)` : `translate(${x} ${y}) scale(10)`
}

function ScaleBar() {
  return (
    <g transform={`translate(0 ${PAGE_H - 7})`} fontFamily="DM Sans, sans-serif" fill="#333">
      <path d="M0 0 H50 M0 -2 V2 M10 -1.2 V1.2 M20 -1.2 V1.2 M30 -1.2 V1.2 M40 -1.2 V1.2 M50 -2 V2" stroke="#000" strokeWidth="0.35" />
      <text x="54" y="1.2" fontSize="3">5 cm – mät linjen innan ni skär</text>
      <text x={PAGE_W} y="1.2" fontSize="3" textAnchor="end">
        Skriv ut i 100 % (faktisk storlek)
      </text>
    </g>
  )
}

export function TemplatePage({ page, index, total, title }: { page: Page; index: number; total: number; title: string }) {
  const t = page.tile
  return (
    <svg
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
      className="tpl-page block h-auto w-full bg-white text-black"
      fontFamily="DM Sans, sans-serif"
      role="img"
      aria-label={`Mall, sida ${index + 1} av ${total}`}
    >
      <text x="0" y="5" fontSize="3.6" fontFamily="Fraunces, Georgia, serif">
        Pepparkaksarkitekten
      </text>
      <text x="0" y="9.5" fontSize="2.8" fill="#555">
        {title}
      </text>
      <text x={PAGE_W} y="5" fontSize="3" textAnchor="end" fill="#555">
        Sida {index + 1} av {total}
      </text>

      {page.placed.map(({ piece, x, y, rot }) => (
        <g key={piece.id}>
          <text x={x} y={TOP + y - 2.5} fontSize="3.2" fill="#000">
            <tspan fontWeight="600">{piece.name}</tspan>
            <tspan fill="#555"> · {countText(piece)}</tspan>
          </text>
          <g transform={placedTransform(piece, rot, x, TOP + y)}>
            <PieceDrawing piece={piece} />
          </g>
        </g>
      ))}

      {t && <TileContent tile={t} />}
      <ScaleBar />
    </svg>
  )
}

function TileContent({ tile: t }: { tile: Tile }) {
  const { w, h } = size(t.piece, t.rot)
  const ox = t.col * (PAGE_W - OVERLAP)
  const oy = t.row * (AREA_H - OVERLAP)
  const id = `tile-${t.piece.id}-${t.col}-${t.row}`
  const vw = Math.min(PAGE_W, w - ox)
  const vh = Math.min(AREA_H, h - oy)
  return (
    <g>
      <text x="0" y={TOP - 2} fontSize="3.2">
        <tspan fontWeight="600">{t.piece.name}</tspan>
        <tspan fill="#555">
          {' '}
          · {countText(t.piece)} · del {t.row * t.cols + t.col + 1} av {t.cols * t.rows}
          {t.cols > 1 && t.rows > 1 ? ` (rad ${t.row + 1}, kolumn ${t.col + 1})` : ''}
        </tspan>
      </text>
      <clipPath id={id}>
        <rect x="0" y={TOP} width={vw} height={vh} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <g transform={placedTransform(t.piece, t.rot, -ox, TOP - oy)}>
          <PieceDrawing piece={t.piece} />
        </g>
      </g>
      {/* where the next sheet overlaps – tape the sheets so the lines meet */}
      {t.col < t.cols - 1 && (
        <g>
          <rect x={vw - OVERLAP} y={TOP} width={OVERLAP} height={vh} fill="#000" opacity="0.06" />
          <text x={vw - OVERLAP / 2} y={TOP + vh / 2} fontSize="2.6" textAnchor="middle" transform={`rotate(-90 ${vw - OVERLAP / 2} ${TOP + vh / 2})`} fill="#555">
            lägg nästa del här och tejpa
          </text>
        </g>
      )}
      {t.row < t.rows - 1 && (
        <g>
          <rect x="0" y={TOP + vh - OVERLAP} width={vw} height={OVERLAP} fill="#000" opacity="0.06" />
          <text x={vw / 2} y={TOP + vh - OVERLAP / 2 + 1} fontSize="2.6" textAnchor="middle" fill="#555">
            lägg nästa del här och tejpa
          </text>
        </g>
      )}
    </g>
  )
}
