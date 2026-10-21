// HTML overlays: the shopkeeper dialog and the picture viewer.

export type Topic = {
  label: string
  /** HTML pages shown one at a time. */
  pages: () => string[]
  action?: () => void
  /** Leave the dialog and do something else (e.g. start a game) – the game stays paused. */
  go?: () => void
}

export type Talk = {
  name: string
  avatar: string
  avatarBg?: string
  greeting: () => string[]
  topics: Topic[]
  bye: string
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
export const html = {
  p: (s: string) => `<p>${esc(s)}</p>`,
  h: (s: string) => `<h3>${esc(s)}</h3>`,
  note: (s: string) => `<span class="note">${esc(s)}</span>`,
  list: (items: string[], cls = '') => `<ul class="${cls}">${items.map((i, k) => `<li style="animation-delay:${k * 70}ms">${esc(i)}</li>`).join('')}</ul>`,
}

export class Dialog {
  private el = document.getElementById('dialog')!
  private textEl = this.el.querySelector<HTMLElement>('.text')!
  private optsEl = this.el.querySelector<HTMLElement>('.options')!
  private moreEl = this.el.querySelector<HTMLElement>('.more')!
  private talk: Talk | null = null
  private pages: string[] = []
  private seen = new Set<string>()
  private toastTimer = 0
  onClose: () => void = () => {}
  get open() {
    return this.talk !== null
  }

  constructor() {
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return
      if (this.pages.length) this.next()
    })
    addEventListener('keydown', (e) => {
      if (!this.talk || e.code === 'Escape') return
      if (this.pages.length && ['Space', 'Enter', 'KeyE'].includes(e.code)) {
        e.preventDefault()
        return this.next()
      }
      if (this.pages.length) return
      const buttons = [...this.optsEl.querySelectorAll('button')]
      const n = Number(e.key)
      if (n >= 1) return buttons[n - 1]?.click()
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const step = ['ArrowDown', 'KeyS'].includes(e.code) ? 1 : ['ArrowUp', 'KeyW'].includes(e.code) ? -1 : 0
      if (step) {
        e.preventDefault()
        buttons[(at + step + buttons.length) % buttons.length]?.focus()
      } else if (e.code === 'KeyE') buttons[Math.max(0, at)]?.click()
    })
  }

  start(talk: Talk) {
    this.talk = talk
    this.seen = new Set()
    this.el.querySelector<HTMLElement>('.avatar')!.textContent = talk.avatar
    this.el.querySelector<HTMLElement>('.avatar')!.style.background = talk.avatarBg ?? '#b3202a'
    this.el.querySelector<HTMLElement>('.name')!.textContent = talk.name
    this.el.hidden = false
    this.show(talk.greeting())
  }

  private show(pages: string[]) {
    this.pages = [...pages]
    this.next()
  }

  private next() {
    const page = this.pages.shift()
    if (page === undefined) return this.menu()
    this.textEl.innerHTML = page
    this.optsEl.innerHTML = ''
    this.moreEl.hidden = false
    if (!this.pages.length) {
      // last page: show the menu under it straight away
      this.menu(false)
    }
  }

  private menu(clear = true) {
    if (!this.talk) return
    if (clear) this.textEl.innerHTML = html.p('Något mer du undrar över?')
    this.pages = []
    this.moreEl.hidden = true
    this.optsEl.innerHTML = ''
    const options = [...this.talk.topics, { label: '👋 Hej då!', pages: () => [], bye: true } as Topic & { bye?: boolean }]
    options.forEach((t, i) => {
      const b = document.createElement('button')
      b.innerHTML = `<span class="n">${i + 1}</span><span>${esc(t.label)}</span>`
      if (this.seen.has(t.label)) b.classList.add('seen')
      b.onclick = () => {
        if ('bye' in t) {
          // close inside the click so the mouse can be re-locked, and say goodbye in a toast
          const toast = document.getElementById('toast')!
          toast.textContent = `${this.talk!.avatar} ${this.talk!.bye}`
          toast.hidden = false
          clearTimeout(this.toastTimer)
          this.toastTimer = setTimeout(() => (toast.hidden = true), 2600)
          this.close()
          return
        }
        if (t.go) {
          this.close(false)
          return t.go()
        }
        this.seen.add(t.label)
        t.action?.()
        this.show(t.pages())
      }
      this.optsEl.appendChild(b)
    })
    if (matchMedia('(pointer: fine)').matches) this.optsEl.querySelector('button')?.focus({ preventScroll: true })
  }

  close(resume = true) {
    if (!this.talk) return
    this.talk = null
    this.el.hidden = true
    if (resume) this.onClose()
  }
}

export class Viewer {
  private el = document.getElementById('viewer')!
  private img = this.el.querySelector('img')!
  private cap = this.el.querySelector('figcaption')!
  onClose: () => void = () => {}
  get open() {
    return !this.el.hidden
  }

  constructor() {
    this.el.addEventListener('click', () => this.close())
    addEventListener('keydown', (e) => {
      if (this.open && ['KeyE', 'Space', 'Enter'].includes(e.code)) {
        e.preventDefault()
        this.close()
      }
    })
  }

  show(src: string, title: string, caption?: string) {
    this.img.src = src
    this.cap.innerHTML = esc(title) + (caption ? `<small>${esc(caption)}</small>` : '')
    this.el.hidden = false
  }

  close() {
    if (!this.open) return
    this.el.hidden = true
    this.onClose()
  }
}

/** While the mouse is grabbed the real cursor is hidden, so popups get a cursor of their own. */
export class VirtualCursor {
  private el = document.getElementById('vcursor')!
  private x = 0
  private y = 0
  private active = false
  private armedAt = 0
  private hover: Element | null = null

  constructor(private grabbed: () => boolean) {
    document.addEventListener('mousemove', (e) => {
      if (!this.active || !this.grabbed()) return
      this.x = Math.min(innerWidth - 2, Math.max(0, this.x + e.movementX))
      this.y = Math.min(innerHeight - 2, Math.max(0, this.y + e.movementY))
      this.place()
    })
    document.addEventListener('mousedown', (e) => {
      if (!this.active || !this.grabbed() || e.button !== 0 || e.timeStamp < this.armedAt) return
      ;(document.elementFromPoint(this.x, this.y) as HTMLElement | null)?.click()
    })
  }

  show() {
    this.active = this.grabbed()
    if (!this.active) return
    this.armedAt = performance.now() + 50
    this.x = innerWidth / 2
    this.y = innerHeight * 0.62
    this.el.hidden = false
    this.place()
  }

  hide() {
    this.active = false
    this.el.hidden = true
    this.hover?.classList.remove('vhover')
    this.hover = null
  }

  private place() {
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`
    const under = document.elementFromPoint(this.x, this.y)?.closest('button') ?? null
    if (under !== this.hover) {
      this.hover?.classList.remove('vhover')
      under?.classList.add('vhover')
      this.hover = under
    }
  }
}

/** The Esc menu: the mouse is let go while it is open; "Fortsätt" grabs it again. */
export class PauseMenu {
  private el = document.getElementById('menu')!
  private card = this.el.querySelector<HTMLElement>('.card')!
  private timer = 0
  onResume: () => void = () => {}
  get open() {
    return !this.el.hidden && !this.el.classList.contains('leaving')
  }

  constructor() {
    // clicking the dimmed backdrop also continues
    this.el.addEventListener('click', (e) => {
      if (!this.card.contains(e.target as Node)) this.onResume()
    })
    document.getElementById('resume')!.addEventListener('click', () => this.onResume())
  }

  show() {
    clearTimeout(this.timer)
    this.el.classList.remove('leaving')
    this.el.hidden = false
    document.getElementById('resume')!.focus({ preventScroll: true })
  }

  /** Fade out, so going back into the game feels like a transition rather than a cut. */
  hide() {
    if (this.el.hidden) return
    this.el.classList.add('leaving')
    ;(document.activeElement as HTMLElement | null)?.blur()
    this.timer = setTimeout(() => {
      this.el.hidden = true
      this.el.classList.remove('leaving')
    }, 380)
  }
}
