// Knytis in the village: pick who you are and paxa a dish – same list as /knytis on the 2D site.
import { getClaims, rememberedName, setClaim, type Claims } from '../../src/lib/api'
import { DISHES, PARTICIPANTS, type Dish } from './data'

const CATS = ['Fisk', 'Kött', 'Tillbehör', 'Dryck'] as const
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const pictureFor = (name: string) => PARTICIPANTS.find((p) => same(p.name, name))?.image ?? null

/** Ask the village to open the knytis panel (from a shopkeeper, the wall board or the menu). */
export const openKnytis = () => dispatchEvent(new Event('jul:knytis'))

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export class KnytisPanel {
  private el = document.getElementById('knytis')!
  private card = this.el.querySelector<HTMLElement>('.card')!
  private guestsEl = this.el.querySelector<HTMLElement>('.guests')!
  private nameEl = this.el.querySelector<HTMLInputElement>('.name')!
  private dishesEl = this.el.querySelector<HTMLElement>('.dishes')!
  private progressEl = this.el.querySelector<HTMLElement>('.progress')!
  private statusEl = this.el.querySelector<HTMLElement>('.status')!
  private claims: Claims = {}
  private me = ''
  private busy = false
  onClose: () => void = () => {}
  get open() {
    return !this.el.hidden
  }

  constructor() {
    this.el.querySelector('.close')!.addEventListener('click', () => this.close())
    // clicking the dimmed backdrop also closes (not `!card.contains(target)`: a click re-renders
    // the buttons, so by the time it bubbles up here its target is no longer in the card)
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close()
    })
    this.nameEl.addEventListener('input', () => this.setMe(this.nameEl.value, false))
  }

  async show() {
    this.me = rememberedName.get()
    this.nameEl.value = this.me
    this.status('')
    this.el.hidden = false
    this.render()
    try {
      this.claims = await getClaims()
      this.render()
    } catch {
      this.status('Kunde inte hämta knytis-listan just nu – försök igen om en stund.')
    }
  }

  close() {
    if (!this.open) return
    this.el.hidden = true
    ;(document.activeElement as HTMLElement | null)?.blur()
    this.onClose()
  }

  private setMe(name: string, fillInput = true) {
    this.me = name.trim().replace(/\s+/g, ' ').slice(0, 24)
    if (fillInput) this.nameEl.value = this.me
    rememberedName.set(this.me)
    this.render()
  }

  private status(text: string) {
    this.statusEl.textContent = text
  }

  private render() {
    const claimed = DISHES.filter((d) => this.claims[d.id]?.length).length
    this.progressEl.textContent = `${claimed} av ${DISHES.length} rätter är paxade`

    this.guestsEl.replaceChildren(
      ...PARTICIPANTS.map((p) => {
        const b = el('button', 'guest')
        b.type = 'button'
        b.classList.toggle('on', !!this.me && same(p.name, this.me))
        if (p.image) {
          const img = el('img')
          img.src = p.image
          img.alt = ''
          b.append(img)
        } else b.append(el('span', 'initial', p.name[0]))
        b.append(el('span', '', p.name))
        b.onclick = () => this.setMe(p.name)
        return b
      }),
    )

    this.dishesEl.replaceChildren(
      ...CATS.map((cat) => {
        const col = el('div', 'cat')
        col.append(el('h3', '', cat))
        for (const d of DISHES.filter((x) => x.category === cat)) col.append(this.dishButton(d))
        return col
      }),
    )
  }

  private dishButton(d: Dish) {
    const who = this.claims[d.id] ?? []
    const mine = !!this.me && who.some((c) => same(c.name, this.me))
    const b = el('button', 'dish')
    b.type = 'button'
    b.disabled = this.busy
    b.classList.toggle('mine', mine)
    b.classList.toggle('taken', who.length > 0 && !mine)
    b.append(el('span', 'emoji', d.emoji))
    const text = el('span', 'text')
    text.append(el('b', '', d.name), el('small', '', mine ? (who.length > 1 ? `Du + ${who.length - 1}` : 'Du tar med den ✓') : who.length ? who.map((c) => c.name).join(', ') : 'Ledig'))
    b.append(text)
    b.onclick = () => this.toggle(d, mine)
    return b
  }

  private async toggle(d: Dish, mine: boolean) {
    if (this.busy) return
    if (!this.me) {
      this.status('Välj vem du är först 👆')
      this.nameEl.focus()
      return
    }
    this.busy = true
    this.render()
    try {
      this.claims = await setClaim(d.id, this.me, pictureFor(this.me), mine ? 'unclaim' : 'claim')
      this.status(mine ? `Okej, ${d.name} är släppt.` : `${d.emoji} Toppen – du tar med ${d.name}!`)
    } catch (err) {
      this.status(err instanceof Error ? err.message : 'Något gick fel – försök igen.')
    } finally {
      this.busy = false
      this.render()
    }
  }
}
