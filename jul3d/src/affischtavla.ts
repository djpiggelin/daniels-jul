// Affischtavlan in the village: a cork board on posts at the east side of the square, by where you come in.
// The newest posters and notes are pinned on it (PNG and JPG as they are, a PDF as a paper with its name);
// step up and press E to see them all, pin up your own or write a note – the same board as /affischtavla.
import * as THREE from 'three'
import { addPoster, getPosters, POSTER_MAX_BYTES, POSTER_TYPES, rememberedName, type Poster } from '../../src/lib/api'
import { makeCanvas, toTexture } from './tex'
import type { Circle } from './world'

/** Where the board stands, and which way its face looks (west, towards the path in from the south). */
const AT = { x: 8.5, z: 29 }
const YAW = -Math.PI / 2
const PANEL_W = 3.4
const PANEL_H = 2.1
const PANEL_Y = 1.75
/** The board's picture, in pixels (same shape as the panel). */
const TW = 1360
const TH = 840
const SHOWN = 6

const NOTE_COLORS = ['#fff6c9', '#ffe1e1', '#e3f5e6', '#e2ecff']
const PIN_COLORS = ['#e5383b', '#f6c453', '#2fa36b', '#4a7fd6']
const hash = (s: string) => Math.abs([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))

const std = (color: number, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness })

function load(url: string) {
  return new Promise<HTMLImageElement | null>((ok) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => ok(null)
    img.src = url
  })
}

/** Wrap text into at most `max` lines that fit `w`. */
function lines(ctx: CanvasRenderingContext2D, text: string, w: number, max: number) {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > w && line) {
        out.push(line)
        line = word
      } else line = next
    }
    out.push(line)
  }
  if (out.length > max) {
    out.length = max
    out[max - 1] = `${out[max - 1].replace(/\s*\S*$/, '')} …`
  }
  return out
}

function cork(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#b98a58'
  ctx.fillRect(0, 0, TW, TH)
  // speckles, the same every time
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(80,48,20,0.35)' : 'rgba(255,235,200,0.25)'
    ctx.fillRect(rnd() * TW, rnd() * TH, 2 + rnd() * 2, 2 + rnd() * 2)
  }
}

function pin(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.arc(x + 3, y + 4, 11, 0, Math.PI * 2)
  ctx.fill()
  const g = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, 12)
  g.addColorStop(0, '#fff')
  g.addColorStop(0.35, color)
  g.addColorStop(1, color)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, 11, 0, Math.PI * 2)
  ctx.fill()
}

/** Draw the newest posters onto the cork, three across and two down. */
async function drawBoard(ctx: CanvasRenderingContext2D, list: Poster[]) {
  const shown = list.slice(0, SHOWN)
  const images = await Promise.all(shown.map((p) => (p.file && p.file.type !== 'application/pdf' ? load(p.file.url) : Promise.resolve(null))))
  cork(ctx)
  if (!shown.length) {
    ctx.fillStyle = '#fbf1dc'
    ctx.save()
    ctx.translate(TW / 2, TH / 2)
    ctx.rotate(-0.03)
    ctx.fillRect(-330, -110, 660, 220)
    ctx.fillStyle = '#3a2a1c'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '600 54px Fraunces, Georgia, serif'
    ctx.fillText('Affischtavlan', 0, -30)
    ctx.font = "400 30px 'DM Sans', sans-serif"
    ctx.fillText('Gå fram och sätt upp något! 📌', 0, 40)
    ctx.restore()
    pin(ctx, TW / 2, TH / 2 - 100, PIN_COLORS[0])
    return
  }
  const cols = 3
  const cw = TW / cols
  const ch = TH / 2
  shown.forEach((p, i) => {
    const h = hash(p.id)
    const cx = cw * (i % cols) + cw / 2
    const cy = ch * Math.floor(i / cols) + ch / 2 + 6
    const boxW = cw - 40
    const boxH = ch - 44
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((((h % 7) - 3) * 0.6 * Math.PI) / 180)
    const img = images[i]
    let w = boxW
    let hgt = boxH
    if (img) {
      // the picture as it is: fit inside the box, keep its shape
      const k = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight)
      w = img.naturalWidth * k
      hgt = img.naturalHeight * k
      ctx.shadowColor = 'rgba(40,20,0,0.45)'
      ctx.shadowBlur = 14
      ctx.shadowOffsetY = 6
      ctx.fillStyle = '#fdfbf6'
      ctx.fillRect(-w / 2 - 6, -hgt / 2 - 6, w + 12, hgt + 12)
      ctx.shadowColor = 'transparent'
      ctx.drawImage(img, -w / 2, -hgt / 2, w, hgt)
    } else {
      const pdf = p.file?.type === 'application/pdf'
      if (pdf) {
        w = Math.min(boxW, boxH / 1.414)
        hgt = w * 1.414
      }
      ctx.shadowColor = 'rgba(40,20,0,0.45)'
      ctx.shadowBlur = 14
      ctx.shadowOffsetY = 6
      ctx.fillStyle = pdf ? '#fdfbf6' : NOTE_COLORS[h % NOTE_COLORS.length]
      ctx.fillRect(-w / 2, -hgt / 2, w, hgt)
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = '#2a2018'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      if (pdf) {
        ctx.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
        ctx.fillText('📄', 0, -hgt / 2 + 40)
        ctx.font = "600 24px 'DM Sans', sans-serif"
        lines(ctx, p.file!.name, w - 30, 3).forEach((l, j) => ctx.fillText(l, 0, -hgt / 2 + 140 + j * 30))
      } else {
        ctx.font = '400 30px Fraunces, Georgia, serif'
        lines(ctx, p.text ?? '', w - 36, 6).forEach((l, j) => ctx.fillText(l, 0, -hgt / 2 + 26 + j * 36))
      }
      ctx.font = "500 20px 'DM Sans', sans-serif"
      ctx.globalAlpha = 0.65
      ctx.textBaseline = 'bottom'
      ctx.fillText(`— ${p.by}`, 0, hgt / 2 - 10)
      ctx.globalAlpha = 1
    }
    pin(ctx, 0, -hgt / 2 + 4, PIN_COLORS[h % PIN_COLORS.length])
    ctx.restore()
  })
  if (list.length > SHOWN) {
    ctx.fillStyle = 'rgba(7,11,29,0.7)'
    ctx.beginPath()
    ctx.roundRect(TW - 300, TH - 52, 288, 40, 20)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = "600 22px 'DM Sans', sans-serif"
    ctx.fillText(`+ ${list.length - SHOWN} till – gå fram och titta`, TW - 150, TH - 32)
  }
}

function header() {
  const [c, ctx] = makeCanvas(768, 160)
  ctx.fillStyle = '#7a1f1f'
  ctx.beginPath()
  ctx.roundRect(4, 4, 760, 152, 26)
  ctx.fill()
  ctx.strokeStyle = '#f6c453'
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.fillStyle = '#fff3dc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 76px Fraunces, Georgia, serif'
  ctx.fillText('📌 Affischtavlan', 384, 84)
  return c
}

export type PosterBoard = ReturnType<typeof buildPosterBoard>

export function buildPosterBoard(scene: THREE.Scene) {
  const group = new THREE.Group()
  group.position.set(AT.x, 0, AT.z)
  group.rotation.y = YAW
  scene.add(group)

  const wood = std(0x6b4426)
  const dark = std(0x4a2c1c)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    group.add(m)
    return m
  }
  // two posts, the frame, a little roof with snow on it
  for (const x of [-PANEL_W / 2 - 0.12, PANEL_W / 2 + 0.12]) add(new THREE.BoxGeometry(0.16, 3.3, 0.16), dark, x, 1.65, 0)
  add(new THREE.BoxGeometry(PANEL_W + 0.3, PANEL_H + 0.3, 0.1), wood, 0, PANEL_Y, -0.03)
  const roof = add(new THREE.BoxGeometry(PANEL_W + 0.8, 0.08, 0.75), dark, 0, 3.34, 0.08)
  roof.rotation.x = 0.28
  const snow = add(new THREE.BoxGeometry(PANEL_W + 0.7, 0.07, 0.68), std(0xf4f8ff, 1), 0, 3.4, 0.07)
  snow.rotation.x = 0.28

  const [canvas, ctx] = makeCanvas(TW, TH)
  cork(ctx)
  const tex = toTexture(canvas, { live: true })
  const face = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }))
  face.position.set(0, PANEL_Y, 0.03)
  face.receiveShadow = true
  group.add(face)

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.354), new THREE.MeshStandardMaterial({ map: toTexture(header()), roughness: 0.7 }))
  sign.position.set(0, PANEL_Y + PANEL_H / 2 + 0.3, 0.06)
  group.add(sign)

  group.updateMatrixWorld(true)
  const world = (x: number, z: number) => group.localToWorld(new THREE.Vector3(x, 0, z))
  const colliders: Circle[] = [-PANEL_W / 2, -PANEL_W / 4, 0, PANEL_W / 4, PANEL_W / 2].map((x) => {
    const p = world(x, 0)
    return { x: p.x, z: p.z, r: 0.35 }
  })

  let drawing = Promise.resolve()
  const show = (list: Poster[]) => {
    drawing = drawing.then(() => drawBoard(ctx, list)).then(() => void (tex.needsUpdate = true))
  }
  const refresh = () => getPosters().then(show).catch(() => {})

  return {
    group,
    colliders,
    show,
    refresh,
    /** In front of the board, facing it? */
    near(pos: THREE.Vector3, fwd: THREE.Vector3) {
      const c = world(0, 0)
      const f = world(0, 1.8)
      const dx = c.x - pos.x
      const dz = c.z - pos.z
      return Math.hypot(f.x - pos.x, f.z - pos.z) < 2.6 && (dx * fwd.x + dz * fwd.z) / Math.hypot(dx, dz) > 0.5
    },
  }
}

/* ---------- the panel: every poster, and the form to pin up your own ---------- */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

const when = (iso: string) => new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export class PosterPanel {
  private el = document.getElementById('affisch')!
  private listEl = this.el.querySelector<HTMLElement>('.posters')!
  private form = this.el.querySelector<HTMLFormElement>('form')!
  private nameEl = this.el.querySelector<HTMLInputElement>('.name')!
  private textEl = this.el.querySelector<HTMLTextAreaElement>('textarea')!
  private fileEl = this.el.querySelector<HTMLInputElement>('input[type=file]')!
  private fileName = this.el.querySelector<HTMLElement>('.file-name')!
  private sendEl = this.el.querySelector<HTMLButtonElement>('.send')!
  private statusEl = this.el.querySelector<HTMLElement>('.status')!
  private file: File | null = null
  private busy = false
  onClose: () => void = () => {}
  /** A new list came in – for the board out in the village. */
  onList: (list: Poster[]) => void = () => {}
  get open() {
    return !this.el.hidden
  }

  constructor() {
    this.el.querySelector('.close')!.addEventListener('click', () => this.close())
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close()
    })
    // typing here mustn't walk you around the village
    this.el.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') e.stopPropagation()
    })
    this.fileEl.addEventListener('change', () => this.pick(this.fileEl.files?.[0] ?? null))
    this.el.querySelector('.unpick')!.addEventListener('click', () => this.pick(null))
    this.form.addEventListener('submit', (e) => {
      e.preventDefault()
      void this.send()
    })
  }

  async show() {
    this.nameEl.value = rememberedName.get()
    this.status('')
    this.el.hidden = false
    this.listEl.replaceChildren(el('p', 'empty', 'Hämtar affischerna …'))
    try {
      this.render(await getPosters())
    } catch {
      this.listEl.replaceChildren(el('p', 'empty', 'Kunde inte hämta affischtavlan just nu – försök igen om en stund.'))
    }
  }

  close() {
    if (!this.open) return
    this.el.hidden = true
    ;(document.activeElement as HTMLElement | null)?.blur()
    this.onClose()
  }

  private status(text: string) {
    this.statusEl.textContent = text
  }

  private pick(f: File | null) {
    this.status('')
    if (f && !POSTER_TYPES.includes(f.type)) {
      this.status('Bara PNG, JPG och PDF går att sätta upp.')
      f = null
    } else if (f && f.size > POSTER_MAX_BYTES) {
      this.status('Filen är för stor – max 4,5 MB.')
      f = null
    }
    this.file = f
    if (!f) this.fileEl.value = ''
    this.fileName.textContent = f ? f.name : 'PNG, JPG eller PDF, max 4,5 MB'
    this.el.querySelector<HTMLElement>('.unpick')!.hidden = !f
  }

  private async send() {
    if (this.busy) return
    const name = this.nameEl.value.trim().replace(/\s+/g, ' ').slice(0, 24)
    const text = this.textEl.value.trim()
    if (!name) return this.status('Skriv ditt namn först.')
    if (!text && !this.file) return this.status('Välj en fil eller skriv något.')
    this.busy = true
    this.sendEl.disabled = true
    this.sendEl.textContent = 'Sätter upp …'
    this.status('')
    try {
      rememberedName.set(name)
      const list = await addPoster(name, text, this.file)
      this.textEl.value = ''
      this.pick(null)
      this.render(list)
      this.status('📌 Uppsatt! Den sitter på tavlan nu.')
    } catch (err) {
      this.status(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Kunde inte sätta upp affischen – försök igen.')
    } finally {
      this.busy = false
      this.sendEl.disabled = false
      this.sendEl.textContent = 'Sätt upp'
    }
  }

  private render(list: Poster[]) {
    this.onList(list)
    if (!list.length) {
      this.listEl.replaceChildren(el('p', 'empty', 'Tavlan är tom – bli först att sätta upp något! 📌'))
      return
    }
    this.listEl.replaceChildren(
      ...list.map((p) => {
        const h = hash(p.id)
        const fig = el('figure', p.file ? 'poster' : 'poster note')
        fig.style.setProperty('--tilt', `${((h % 7) - 3) * 0.5}deg`)
        if (!p.file) fig.style.background = NOTE_COLORS[h % NOTE_COLORS.length]
        const pinEl = el('span', 'pin')
        pinEl.style.background = `radial-gradient(circle at 35% 35%, #fff8 0 20%, ${PIN_COLORS[h % PIN_COLORS.length]} 45%)`
        fig.append(pinEl)
        if (p.file?.type === 'application/pdf') {
          const obj = el('object', 'pdf')
          obj.data = p.file.url
          obj.type = 'application/pdf'
          const fallback = el('a', 'pdf-fallback')
          fallback.href = p.file.url
          fallback.target = '_blank'
          fallback.rel = 'noreferrer'
          fallback.append(el('span', 'big', '📄'), el('span', '', p.file.name), el('small', '', 'Öppna PDF:en'))
          obj.append(fallback)
          const open = el('a', 'open', 'Öppna i helskärm ↗')
          open.href = p.file.url
          open.target = '_blank'
          open.rel = 'noreferrer'
          fig.append(obj, open)
        } else if (p.file) {
          const a = el('a')
          a.href = p.file.url
          a.target = '_blank'
          a.rel = 'noreferrer'
          const img = el('img')
          img.src = p.file.url
          img.alt = p.text || p.file.name
          img.loading = 'lazy'
          a.append(img)
          fig.append(a)
        }
        if (p.text) fig.append(el('p', 'text', p.text))
        const cap = el('figcaption')
        cap.append(el('span', '', `— ${p.by}`), el('span', '', when(p.at)))
        fig.append(cap)
        return fig
      }),
    )
  }
}
