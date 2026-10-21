// Everything drawn on a 2D canvas before it becomes a texture: chalkboards, parchments,
// sticky notes, signs, posters and the polaroid wall.
import * as THREE from 'three'

export const FONT = {
  chalk: '"Caveat", "Comic Sans MS", cursive',
  serif: '"Fraunces", Georgia, serif',
  sans: '"DM Sans", system-ui, sans-serif',
}

export async function loadFonts() {
  const specs = ['700 48px Caveat', '500 48px Caveat', '600 48px Fraunces', '400 48px Fraunces', 'italic 400 48px Fraunces', '400 48px "DM Sans"', '700 48px "DM Sans"']
  const all = Promise.all(specs.map((s) => document.fonts.load(s))).catch(() => undefined)
  await Promise.race([all, new Promise((r) => setTimeout(r, 4000))])
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

export function toTexture(src: HTMLCanvasElement | HTMLImageElement) {
  const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = encodeURI(url)
  })
}

/** The rendered SVGs only carry a viewBox – give them a real size so they rasterise crisply. */
export async function loadSvg(url: string, scale = 3) {
  const txt = await (await fetch(url)).text()
  const vb = txt.match(/viewBox="([^"]+)"/)![1].split(/[\s,]+/).map(Number)
  const w = Math.round(vb[2] * scale)
  const h = Math.round(vb[3] * scale)
  const sized = txt.replace('<svg', `<svg width="${w}" height="${h}"`)
  const blobUrl = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }))
  const img = new Image()
  img.src = blobUrl
  await img.decode()
  const [c, ctx] = makeCanvas(w, h)
  ctx.drawImage(img, 0, 0, w, h)
  URL.revokeObjectURL(blobUrl)
  return c
}

export function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/* ------------------------------------------------------------------ boards */

export type BoardStyle = 'chalk' | 'parchment' | 'note'
export type BoardSpec = {
  style: BoardStyle
  title: string
  subtitle?: string
  /** A line starting with "# " is drawn as a heading. */
  items: string[]
  marker?: 'check' | 'bullet' | 'number' | 'star' | 'none'
  footer?: string
  w?: number
  h?: number
  seed?: number
}

const INK = {
  chalk: { text: '#f3efe4', title: '#f6c453', head: '#9fe0bf', mark: '#f3efe4' },
  parchment: { text: '#3b2414', title: '#8e1b1b', head: '#1d6e48', mark: '#8e1b1b' },
  note: { text: '#3a2a00', title: '#9a1c1c', head: '#1d6e48', mark: '#3a2a00' },
}

function boardBackground(ctx: CanvasRenderingContext2D, W: number, H: number, style: BoardStyle, rand: () => number) {
  if (style === 'chalk') {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#26392f')
    g.addColorStop(1, '#1a2a22')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // old erased chalk
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.012 + rand() * 0.03})`
      ctx.beginPath()
      ctx.ellipse(rand() * W, rand() * H, 40 + rand() * 160, 10 + rand() * 50, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    // wooden frame
    const f = W * 0.035
    const wood = ctx.createLinearGradient(0, 0, 0, H)
    wood.addColorStop(0, '#8a5a32')
    wood.addColorStop(1, '#5c3a20')
    ctx.strokeStyle = wood
    ctx.lineWidth = f * 2
    ctx.strokeRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(f, f, W - 2 * f, H - 2 * f)
    // chalk tray dust
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(f, H - f - 18, W - 2 * f, 18)
  } else if (style === 'parchment') {
    const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.85)
    g.addColorStop(0, '#fbf0d6')
    g.addColorStop(0.7, '#ecd6a6')
    g.addColorStop(1, '#b98a4c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = `rgba(120,70,20,${0.03 + rand() * 0.05})`
      ctx.beginPath()
      ctx.arc(rand() * W, rand() * H, 10 + rand() * 60, 0, Math.PI * 2)
      ctx.fill()
    }
    // burnt edge
    ctx.strokeStyle = 'rgba(70,35,10,0.55)'
    ctx.lineWidth = 14
    ctx.strokeRect(0, 0, W, H)
    // nail
    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.arc(W / 2, W * 0.045, W * 0.018, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#999'
    ctx.beginPath()
    ctx.arc(W / 2 - 3, W * 0.045 - 3, W * 0.007, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#fff3a0')
    g.addColorStop(1, '#ffe56b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.06)'
    ctx.fillRect(0, H * 0.92, W, H * 0.08)
    // tape
    ctx.save()
    ctx.translate(W / 2, 14)
    ctx.rotate(-0.05)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillRect(-W * 0.18, -16, W * 0.36, 44)
    ctx.restore()
  }
}

function drawMarker(ctx: CanvasRenderingContext2D, kind: BoardSpec['marker'], x: number, y: number, fs: number, i: number, color: string, rand: () => number) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(2, fs * 0.07)
  const s = fs * 0.55
  if (kind === 'check') {
    // hand-drawn box
    ctx.beginPath()
    const j = () => (rand() - 0.5) * fs * 0.06
    ctx.moveTo(x + j(), y - s + j())
    ctx.lineTo(x + s + j(), y - s + j())
    ctx.lineTo(x + s + j(), y + j())
    ctx.lineTo(x + j(), y + j())
    ctx.closePath()
    ctx.stroke()
  } else if (kind === 'bullet') {
    ctx.beginPath()
    ctx.arc(x + s / 2, y - s / 2, s * 0.22, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'star') {
    ctx.font = `${fs * 0.8}px ${FONT.sans}`
    ctx.fillText('★', x - fs * 0.05, y)
  } else if (kind === 'number') {
    ctx.fillText(`${i + 1}.`, x, y)
  }
  ctx.restore()
}

export function drawBoard(spec: BoardSpec) {
  const W = spec.w ?? 1024
  const H = spec.h ?? 1365
  const [c, ctx] = makeCanvas(W, H)
  const rand = rng(spec.seed ?? 7)
  boardBackground(ctx, W, H, spec.style, rand)
  const ink = INK[spec.style]
  const chalk = spec.style !== 'parchment'
  const titleFont = (fs: number) => (chalk ? `700 ${fs}px ${FONT.chalk}` : `600 ${fs}px ${FONT.serif}`)
  const bodyFont = (fs: number) => (chalk ? `500 ${fs}px ${FONT.chalk}` : `400 ${fs}px ${FONT.serif}`)
  const headFont = (fs: number) => (chalk ? `700 ${fs}px ${FONT.chalk}` : `600 ${fs}px ${FONT.serif}`)
  const pad = W * 0.1
  const marker = spec.marker ?? 'check'
  const indent = marker === 'none' ? 0 : 1

  type Op = { font: string; color: string; text: string; x: number; y: number; align?: CanvasTextAlign; mark?: { i: number; x: number; y: number; fs: number } }
  const layout = (fs: number) => {
    const ops: Op[] = []
    let y = pad * (spec.style === 'parchment' ? 1.25 : 1)
    const tfs = fs * (chalk ? 1.7 : 1.45)
    ctx.font = titleFont(tfs)
    for (const l of wrapText(ctx, spec.title, W - 2 * pad)) {
      y += tfs
      ops.push({ font: titleFont(tfs), color: ink.title, text: l, x: W / 2, y, align: 'center' })
      y += tfs * 0.15
    }
    if (spec.subtitle) {
      const sfs = fs * 0.85
      const f = chalk ? `500 ${sfs}px ${FONT.chalk}` : `italic 400 ${sfs}px ${FONT.serif}`
      ctx.font = f
      for (const l of wrapText(ctx, spec.subtitle, W - 2 * pad)) {
        y += sfs * 1.2
        ops.push({ font: f, color: ink.text, text: l, x: W / 2, y, align: 'center' })
      }
    }
    y += fs * 0.9
    let n = 0
    for (const item of spec.items) {
      if (item.startsWith('# ')) {
        const hfs = fs * 1.05
        y += hfs * 0.5
        ops.push({ font: headFont(hfs), color: ink.head, text: item.slice(2), x: pad, y: y + hfs })
        y += hfs * 1.35
        continue
      }
      ctx.font = bodyFont(fs)
      const ix = pad + indent * fs * 1.05
      const lines = wrapText(ctx, item, W - pad - ix)
      lines.forEach((l, li) => {
        y += fs * 1.18
        ops.push({ font: bodyFont(fs), color: ink.text, text: l, x: ix, y, mark: li === 0 && indent ? { i: n, x: pad, y, fs } : undefined })
      })
      n++
      y += fs * 0.42
    }
    if (spec.footer) {
      const ffs = fs * 0.85
      ctx.font = bodyFont(ffs)
      const lines = wrapText(ctx, spec.footer, W - 2 * pad)
      y += ffs * 0.6
      for (const l of lines) {
        y += ffs * 1.2
        ops.push({ font: chalk ? `500 ${ffs}px ${FONT.chalk}` : `italic 400 ${ffs}px ${FONT.serif}`, color: ink.text, text: l, x: W / 2, y, align: 'center' })
      }
    }
    return { ops, bottom: y + pad * 0.8 }
  }

  let fs = W * 0.062
  let res = layout(fs)
  while (res.bottom > H && fs > 14) {
    fs -= 1.5
    res = layout(fs)
  }
  // centre vertically if there is slack
  const slack = Math.max(0, (H - res.bottom) * 0.35)
  for (const op of res.ops) {
    ctx.font = op.font
    ctx.textAlign = op.align ?? 'left'
    ctx.fillStyle = op.color
    const y = op.y + slack
    if (chalk && spec.style === 'chalk') {
      ctx.globalAlpha = 0.92
      ctx.fillText(op.text, op.x, y)
      ctx.globalAlpha = 0.18
      ctx.fillText(op.text, op.x + 1.5, y + 1)
      ctx.globalAlpha = 1
    } else ctx.fillText(op.text, op.x, y)
    if (op.mark) drawMarker(ctx, marker, op.mark.x, y - op.mark.fs * 0.12, op.mark.fs, op.mark.i, ink.mark, rand)
  }
  // underline the title
  const first = res.ops[0]
  if (first) {
    ctx.strokeStyle = ink.title
    ctx.globalAlpha = 0.6
    ctx.lineWidth = 3
    ctx.beginPath()
    const y = first.y + slack + fs * 0.35
    for (let x = W * 0.25; x <= W * 0.75; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05) * 3)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (spec.style === 'parchment') {
    // wax seal
    ctx.fillStyle = '#a3161f'
    ctx.beginPath()
    ctx.arc(W - pad * 0.95, H - pad * 0.9, W * 0.045, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = `700 ${W * 0.045}px ${FONT.serif}`
    ctx.textAlign = 'center'
    ctx.fillText('DJ', W - pad * 0.95, H - pad * 0.9 + W * 0.016)
  }
  return c
}

/* ------------------------------------------------------------------ signs */

export function drawSign(title: string, line2: string, colors = { bg: '#6b4226', fg: '#fff3dc', accent: '#f6c453' }) {
  const [c, ctx] = makeCanvas(1024, 300)
  const g = ctx.createLinearGradient(0, 0, 0, 300)
  g.addColorStop(0, colors.bg)
  g.addColorStop(1, '#3a2414')
  ctx.fillStyle = g
  roundRect(ctx, 0, 0, 1024, 300, 36)
  ctx.fill()
  // planks
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 3
  for (const y of [100, 200]) {
    ctx.beginPath()
    ctx.moveTo(10, y)
    ctx.lineTo(1014, y)
    ctx.stroke()
  }
  ctx.strokeStyle = colors.accent
  ctx.lineWidth = 8
  roundRect(ctx, 14, 14, 996, 272, 26)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = colors.fg
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 8
  let fs = 104
  ctx.font = `600 ${fs}px ${FONT.serif}`
  while (ctx.measureText(title).width > 920) ctx.font = `600 ${(fs -= 4)}px ${FONT.serif}`
  ctx.fillText(title, 512, 150)
  ctx.font = `700 52px ${FONT.sans}`
  ctx.fillStyle = colors.accent
  ctx.fillText(line2, 512, 240)
  return c
}

export function drawArrowSign(text: string, pointLeft: boolean) {
  const [c, ctx] = makeCanvas(768, 160)
  ctx.fillStyle = '#7a4c2a'
  ctx.beginPath()
  if (pointLeft) {
    ctx.moveTo(0, 80)
    ctx.lineTo(90, 0)
    ctx.lineTo(768, 0)
    ctx.lineTo(768, 160)
    ctx.lineTo(90, 160)
  } else {
    ctx.moveTo(768, 80)
    ctx.lineTo(678, 0)
    ctx.lineTo(0, 0)
    ctx.lineTo(0, 160)
    ctx.lineTo(678, 160)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#f6c453'
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.fillStyle = '#fff3dc'
  ctx.textAlign = 'center'
  let fs = 64
  ctx.font = `600 ${fs}px ${FONT.serif}`
  while (ctx.measureText(text).width > 600) ctx.font = `600 ${(fs -= 3)}px ${FONT.serif}`
  ctx.fillText(text, pointLeft ? 430 : 338, 102)
  return c
}

/* ------------------------------------------------------------------ posters */

export function drawPoster(opts: { accent: string; emoji: string; title: string; lines: string[]; photo?: HTMLImageElement | HTMLCanvasElement; seed?: number }) {
  const W = 768
  const H = 1152
  const [c, ctx] = makeCanvas(W, H)
  ctx.fillStyle = '#fbf3e2'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = opts.accent
  ctx.fillRect(0, 0, W, 90)
  ctx.fillRect(0, H - 40, W, 40)
  // pattern of little stars
  const rand = rng(opts.seed ?? 3)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `28px ${FONT.sans}`
  for (let i = 0; i < 14; i++) ctx.fillText('✦', rand() * W, 20 + rand() * 60)
  let y = 120
  if (opts.photo) {
    const ph = 520
    const iw = opts.photo.width
    const ih = opts.photo.height
    const s = Math.max((W - 80) / iw, ph / ih)
    ctx.save()
    roundRect(ctx, 40, y, W - 80, ph, 18)
    ctx.clip()
    ctx.drawImage(opts.photo, 40 + (W - 80 - iw * s) / 2, y + (ph - ih * s) / 2, iw * s, ih * s)
    ctx.restore()
    y += ph + 30
  }
  ctx.textAlign = 'center'
  ctx.font = `110px ${FONT.sans}`
  if (!opts.photo) {
    y += 120
    ctx.fillText(opts.emoji, W / 2, y)
    y += 40
  }
  ctx.fillStyle = '#2a1a10'
  let fs = 104
  ctx.font = `700 ${fs}px ${FONT.serif}`
  while (ctx.measureText(opts.title).width > W - 80) ctx.font = `700 ${(fs -= 4)}px ${FONT.serif}`
  y += fs
  ctx.fillText(opts.photo ? `${opts.emoji} ${opts.title}` : opts.title, W / 2, y)
  y += 24
  for (const line of opts.lines) {
    ctx.font = `500 40px ${FONT.sans}`
    for (const l of wrapText(ctx, line, W - 100)) {
      y += 52
      ctx.fillStyle = '#4a3020'
      ctx.fillText(l, W / 2, y)
    }
    y += 10
  }
  return c
}

/* ------------------------------------------------------------------ cork + polaroids */

export function drawCorkboard(opts: { title: string; cards: { label: string; img?: HTMLImageElement | null }[]; cols: number; w?: number; h?: number; seed?: number }) {
  const W = opts.w ?? 1800
  const H = opts.h ?? 1200
  const [c, ctx] = makeCanvas(W, H)
  const rand = rng(opts.seed ?? 11)
  ctx.fillStyle = '#b98a57'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(90,50,20,0.18)' : 'rgba(255,230,190,0.12)'
    ctx.fillRect(rand() * W, rand() * H, 2 + rand() * 3, 2 + rand() * 3)
  }
  ctx.strokeStyle = '#5c3a20'
  ctx.lineWidth = 40
  ctx.strokeRect(0, 0, W, H)
  // title on a paper strip
  ctx.save()
  ctx.translate(W / 2, 92)
  ctx.rotate(-0.012)
  ctx.fillStyle = '#fbf3e2'
  ctx.fillRect(-W * 0.24, -55, W * 0.48, 100)
  ctx.fillStyle = '#8e1b1b'
  ctx.textAlign = 'center'
  ctx.font = `700 76px ${FONT.chalk}`
  ctx.fillText(opts.title, 0, 22)
  ctx.restore()

  const rows = Math.ceil(opts.cards.length / opts.cols)
  const top = 170
  const cellW = (W - 80) / opts.cols
  const cellH = (H - top - 40) / rows
  const pw = Math.min(cellW * 0.82, cellH * 0.7)
  const ph = pw * 1.18
  const palette = ['#e5383b', '#2fa36b', '#f6c453', '#4a7bd0', '#b35fd0']
  opts.cards.forEach((card, i) => {
    const r = Math.floor(i / opts.cols)
    const inRow = Math.min(opts.cols, opts.cards.length - r * opts.cols)
    const col = i % opts.cols
    const rowOffset = ((opts.cols - inRow) * cellW) / 2
    const cx = 40 + rowOffset + cellW * (col + 0.5)
    const cy = top + cellH * (r + 0.5)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((rand() - 0.5) * 0.14)
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 6
    ctx.fillStyle = '#fdfcf8'
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph)
    ctx.shadowColor = 'transparent'
    const m = pw * 0.07
    const iw = pw - 2 * m
    if (card.img) {
      const s = Math.max(iw / card.img.width, iw / card.img.height)
      ctx.save()
      ctx.beginPath()
      ctx.rect(-pw / 2 + m, -ph / 2 + m, iw, iw)
      ctx.clip()
      ctx.fillStyle = '#dfe8f7'
      ctx.fillRect(-pw / 2 + m, -ph / 2 + m, iw, iw)
      ctx.drawImage(card.img, -card.img.width * s / 2, -ph / 2 + m + iw / 2 - card.img.height * s / 2, card.img.width * s, card.img.height * s)
      ctx.restore()
    } else {
      ctx.fillStyle = palette[i % palette.length]
      ctx.fillRect(-pw / 2 + m, -ph / 2 + m, iw, iw)
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.textAlign = 'center'
      ctx.font = `700 ${iw * 0.55}px ${FONT.serif}`
      ctx.fillText(card.label[0], 0, -ph / 2 + m + iw * 0.7)
    }
    ctx.fillStyle = '#2a1a10'
    ctx.textAlign = 'center'
    let fs = (ph - iw - m) * 0.62
    ctx.font = `700 ${fs}px ${FONT.chalk}`
    while (ctx.measureText(card.label).width > pw * 0.9) ctx.font = `700 ${(fs -= 2)}px ${FONT.chalk}`
    ctx.fillText(card.label, 0, ph / 2 - (ph - iw - m) * 0.32)
    // pin
    ctx.fillStyle = palette[(i + 2) % palette.length]
    ctx.beginPath()
    ctx.arc(0, -ph / 2 + 6, pw * 0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
  return c
}

/* ------------------------------------------------------------------ misc textures */

export function planksTexture(base: string, opts: { boards?: number; vertical?: boolean; seed?: number } = {}) {
  const [c, ctx] = makeCanvas(512, 512)
  const rand = rng(opts.seed ?? 5)
  const n = opts.boards ?? 6
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 512)
  const bw = 512 / n
  for (let i = 0; i < n; i++) {
    const shade = (rand() - 0.5) * 0.18
    ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`
    if (opts.vertical !== false) ctx.fillRect(i * bw, 0, bw, 512)
    else ctx.fillRect(0, i * bw, 512, bw)
    // grain
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.04 + rand() * 0.06})`
      ctx.lineWidth = 1 + rand() * 2
      ctx.beginPath()
      if (opts.vertical !== false) {
        const x = i * bw + rand() * bw
        ctx.moveTo(x, 0)
        ctx.bezierCurveTo(x + (rand() - 0.5) * 10, 170, x + (rand() - 0.5) * 10, 340, x, 512)
      } else {
        const y = i * bw + rand() * bw
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(170, y + (rand() - 0.5) * 10, 340, y + (rand() - 0.5) * 10, 512, y)
      }
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    if (opts.vertical !== false) ctx.fillRect(i * bw, 0, 3, 512)
    else ctx.fillRect(0, i * bw, 512, 3)
  }
  const t = toTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function glowTexture(inner = 'rgba(255,220,150,1)', outer = 'rgba(255,160,60,0)') {
  const [c, ctx] = makeCanvas(128, 128)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.45)'))
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return toTexture(c)
}

export function drawTvScreen(t: number) {
  const [c, ctx] = makeCanvas(512, 384)
  const g = ctx.createLinearGradient(0, 0, 0, 384)
  g.addColorStop(0, '#2a62c9')
  g.addColorStop(1, '#0f2f73')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 384)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 97 + t * 30) % 512, (i * 53 + t * 40) % 384, 3, 3)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.font = `700 54px ${FONT.serif}`
  ctx.fillText('Kalle Anka', 256, 150)
  ctx.font = `500 32px ${FONT.sans}`
  ctx.fillText('och hans vänner', 256, 196)
  ctx.fillText('önskar God Jul', 256, 236)
  ctx.fillStyle = '#f6c453'
  ctx.font = `700 44px ${FONT.sans}`
  ctx.fillText('kl. 15.00', 256, 310)
  return c
}
