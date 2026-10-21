// The drawing board in Arkitektkontoret: Pepparkaksarkitekten opens over the village instead of
// leaving it. It's the 2D site's editor in an iframe (same site, so the plan and share links are
// the same everywhere), kept loaded so going back to it is instant.

/** Ask the village to open the drawing board (from Ritnissen or the blueprint on the wall). */
export const openRitbord = () => dispatchEvent(new Event('jul:ritbord'))

// `npm run dev:3d` only serves the village – point at the 2D dev server for the editor
const EDITOR = import.meta.env.DEV ? `${import.meta.env.VITE_SITE_URL ?? 'http://localhost:5173'}/pepparkaksarkitekten` : '/pepparkaksarkitekten'

export class RitbordPanel {
  private el = document.getElementById('ritbord')!
  private frame = this.el.querySelector('iframe')!
  onClose: () => void = () => {}
  get open() {
    return !this.el.hidden
  }

  constructor() {
    this.el.querySelector('.close')!.addEventListener('click', () => this.close())
    // the editor asks to close (Esc inside it)
    addEventListener('message', (e) => {
      if (e.source === this.frame.contentWindow && e.data?.type === 'jul:stang') this.close()
    })
  }

  show() {
    if (!this.frame.src) this.frame.src = EDITOR
    this.el.hidden = false
    this.frame.focus()
  }

  close() {
    if (!this.open) return
    this.el.hidden = true
    this.frame.blur()
    this.onClose()
  }
}
