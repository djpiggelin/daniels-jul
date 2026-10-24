// Julkalendern – a tall gingerbread house on the square with 24 little doors in its front. From the
// first of December one more opens every morning at six (Swedish time), each with a chapter of this
// year's story – Den försvunna listan – and something new to do or find in the village. Everyone
// opens their own: which doors you've opened is kept in this browser. Doors you missed can be opened
// later; the ones still to come stay shut. Try other days with ?datum=2026-12-05&tid=08:00.
import * as THREE from 'three'
import { keepApart } from './batch'
import { wallClock } from './korsang'
import { blip, noise } from './sfx'
import { glowTexture, makeCanvas, toTexture } from './tex'
import type { Circle } from './world'

type Door = { title: string; story: string[]; icon: string; village: string }

/** The story, a chapter a day – and what there is in the village that day. */
export const DOORS: Door[] = [
  {
    title: 'Listan är borta!',
    icon: '📜',
    story: ['Det är första december och Leksaksfabriken surrar av liv. Men när Tomten ska ta fram Snälla listan för att börja packa är hyllan tom.', '– Den låg ju här i går! säger han. Nissarna tittar på varandra. Utan listan vet ingen vem som ska få vad i år.'],
    village: 'Kalenderhuset har tänts på torget – och alla bodar har fått julbelysning.',
  },
  {
    title: 'Tomten letar',
    icon: '🧤',
    story: ['Tomten vänder upp och ner på hela verkstaden: under rullbandet, bakom den stora klockan, ända ner i rutschkanan.', 'Listan hittar han inte. Och när han ska torka sig i pannan märker han att han har tappat sin ena vante också. – I dag tappar jag allt!'],
    village: 'Uppdrag: hitta Tomtens borttappade vante någonstans i byn.',
  },
  {
    title: 'Ett sotigt fingeravtryck',
    icon: '🖐️',
    story: ['På hyllan där listan låg syns ett litet, svart fingeravtryck. Tomten luktar på det. Det luktar … kol?', 'Ingen i verkstaden har svarta fingrar. Alla nissar där har vita vantar.'],
    village: 'En snögubbe har dykt upp på torget.',
  },
  {
    title: 'Förhöret',
    icon: '🔎',
    story: ['Tomten samlar alla nissar och frågar dem en och en. Bagarnissen bakade. Stämpelnissen stämplade. Tennsoldaterna marscherade.', 'Alla har alibi. – Men vem i hela världen gillar kol? undrar Tomten.'],
    village: 'Julgåta: svara rätt så får du en ledtråd.',
  },
  {
    title: 'Svarta fotspår',
    icon: '👣',
    story: ['Morgonen efter syns små sotiga fotspår i nysnön utanför fabriken.', 'De går en bit västerut … och sedan har snön fallit över dem.'],
    village: 'Sotiga fotspår syns en bit i snön. Vart leder de?',
  },
  {
    title: 'Bagarnissen har sett något',
    icon: '🍪',
    story: ['I bageriet doftar det pepparkakor. Bagarnissen lutar sig fram och viskar:', '– Sent i går kväll såg jag en liten svart figur smyga förbi fönstret. Med en lampa i pannan!'],
    village: 'Julbak i bageriet – och fem pepparkakor gömda i byn att samla.',
  },
  {
    title: 'En hemlig lapp',
    icon: '✉️',
    story: ['Mellan två plåtar med pepparkakor ligger en hoprullad lapp. Den är skriven med kol, i darriga bokstäver:', '”Vi lånar den bara lite. Under granarna i väster.”'],
    village: 'Uppdrag: hitta en till hoprullad lapp någonstans i byn.',
  },
  {
    title: 'Renarna blir oroliga',
    icon: '🦌',
    story: ['Renarna står med öronen åt väster och stampar i snön. Rudolfs nos blinkar oroligt.', 'Djur märker sådant som nissar missar.'],
    village: 'Renarna betar på ängen bakom bodarna.',
  },
  {
    title: 'Tomten blir misstänksam',
    icon: '🤔',
    story: ['– Lampa i pannan, svarta fingrar, kol … mumlar Tomten. – Det kan väl inte vara … gruvnissarna?', 'De som inte var tillräckligt snälla för att få jobba i fabriken. Ingen har sett dem på åratal.'],
    village: 'Stämpelutmaning: få minst 30 rätt i Kvalitetskontrollen.',
  },
  {
    title: 'Ett ljud underifrån',
    icon: '🎶',
    story: ['Om man står riktigt tyst i västra kanten av byn kan man höra något.', 'Djupa röster som sjunger – långt, långt under marken.'],
    village: 'Gå västerut och lyssna.',
  },
  {
    title: 'Leksaksnissen vågar sig ut',
    icon: '🎁',
    story: ['Den yngsta leksaksnissen bestämmer sig för att leta själv. Hon tar med sig en julklapp, ifall hon skulle behöva muta någon.', 'Men på vägen tappar hon den i snön.'],
    village: 'Uppdrag: hitta julklappen och lämna tillbaka den.',
  },
  {
    title: 'Kolet tar slut',
    icon: '🔥',
    story: ['Ugnen i bageriet har slocknat. Kolet är slut!', 'Varje år brukar det komma nytt kol, i en vagn som ingen vet varifrån den kommer. Men i år har ingen vagn kommit.'],
    village: 'Brasor har tänts på torget att värma sig vid.',
  },
  {
    title: 'Lucia',
    icon: '🕯️',
    story: ['Mitt i allt letande är det Lucia, och ljuset i mörkret får alla att tänka klarare.', 'Lucia viskar till Tomten: – Den som letar efter något i mörkret behöver ett ljus. Och ibland behöver man gå neråt.'],
    village: 'Luciatåget går på morgonen – och det finns lussekatter i bageriet.',
  },
  {
    title: 'Spåret leder ner',
    icon: '⭐',
    story: ['Stjärnan i toppen av granen på fabriksgården är borta! Bredvid granen hittar nissarna en bit av en sotig gruvlampa.', 'Spåret leder alltså inte bara västerut. Det leder ner.'],
    village: 'Uppdrag: hitta stjärnan och sätt tillbaka den i granen.',
  },
  {
    title: 'Någon har hittat gruvan',
    icon: '⛏️',
    story: ['Någon har tagit sig ner i gruvan. Kanske du? Förmannen tittar strängt.', '– Snälla listan? Vad skulle vi med den till? Vi har ju Stygga listan. Men han vänder sig bort lite för fort.'],
    village: 'Hittar du ner i gruvan? Prata med förmannen.',
  },
  {
    title: 'Förmannens hemlighet',
    icon: '🎀',
    story: ['På förmanskontorets skrivbord, under liggarna, sticker ett rött band fram.', 'Precis ett sådant rött band som Snälla listan brukar vara knuten med …'],
    village: 'En julmarknad med glöggstånd har öppnat i byn.',
  },
  {
    title: 'Den gamle vid Svartsjön',
    icon: '🎣',
    story: ['Den gamle nissen som metar vid Svartsjön har varit längst av alla i gruvan.', '– Vi ville bara se om våra namn stod där, säger han tyst. – Någon gång. Bara en gång.'],
    village: 'Uppdrag: hämta något som den metande nissen har tappat.',
  },
  {
    title: 'Gruvnissarnas önskan',
    icon: '🌟',
    story: ['Nu förstår man. Gruvnissarna har aldrig fått en enda julklapp. År efter år gräver de kol till alla stygga barn.', 'Och de har blivit lite stygga själva på kuppen. För vem orkar vara snäll i mörkret?'],
    village: 'Tre tomtenissar har gömt sig i byn. Hitta dem!',
  },
  {
    title: 'Tomten blir arg',
    icon: '😠',
    story: ['Tomten får höra allt och blir röd i ansiktet. – Ta listan utan att fråga! dundrar han.', 'Men när han har lugnat sig sätter han sig vid brasan och tänker. Länge.'],
    village: 'Gruvexpressen-utmaning: kör minst 500 meter.',
  },
  {
    title: 'Ett förslag',
    icon: '🌌',
    story: ['Norrskenet fladdrar över byn och Tomten har fått en idé.', '– Om gruvnissarna lämnar tillbaka listan och hjälper till att packa julklappar ända fram till julafton – då får de stå på listan i år.'],
    village: 'Ett extra kraftigt norrsken – och stjärnfall.',
  },
  {
    title: 'Vintersolståndet',
    icon: '🏮',
    story: ['Årets mörkaste dag. Gruvnissarna kliver upp ur stubben, blinkar mot lyktorna och går mot verkstaden.', 'Listan har de med sig, insvept i en kolsäck.'],
    village: 'Uppdrag: tänd lyktorna längs stigen åt dem.',
  },
  {
    title: 'Fabriken och gruvan',
    icon: '🤝',
    story: ['Det blir lite pinsamt först. Men snart står fabriksnissar och gruvnissar sida vid sida vid rullbandet.', 'Gruvnissarna sjunger sina djupa sånger, och arbetet går dubbelt så fort.'],
    village: 'Kolhackningsutmaning: hacka minst 60 kol.',
  },
  {
    title: 'Dopparedagen',
    icon: '🍖',
    story: ['Alla julklappar är packade. Och kolet? Det får värma verkstadens ugnar och bageriets spis i stället.', 'Ingen tycker att det är synd. Julbordet dukas fram.'],
    village: 'Ett julbord har dukats fram i verkstaden.',
  },
  {
    title: 'Julafton',
    icon: '🎅',
    story: ['Listan ligger tillbaka på hyllan, med några nya namn längst ner, skrivna med lite sotiga bokstäver.', 'Tomten delar ut julklappar till alla. Och i år får gruvnissarna sina allra första. God jul! 🎄'],
    village: 'Tomten har en julklapp till dig – och kören sjunger i rött.',
  },
]

/** The numbers on the front, mixed up as on a real calendar (row by row, 6 across). */
const LAYOUT = [13, 2, 19, 7, 22, 10, 5, 16, 1, 24, 11, 18, 21, 8, 14, 3, 20, 6, 9, 23, 4, 17, 12, 15]
const COLS = 6
const ROWS = 4
const CELL = 0.62
const DOOR = 0.5
/** Where it stands: on the east side of the square, facing the big tree. */
const AT = new THREE.Vector3(13.6, 0, -2.6)

/** The calendar day it is: which December (the year), and how many doors may be open. */
function today() {
  const d = new Date(wallClock())
  const m = d.getUTCMonth() + 1
  const year = m === 1 ? d.getUTCFullYear() - 1 : d.getUTCFullYear()
  let open = 0
  if (m === 12) open = Math.min(24, d.getUTCDate() - (d.getUTCHours() < 6 ? 1 : 0))
  else if (m === 1) open = 24
  return { year, open }
}

export function buildCalendar(scene: THREE.Scene) {
  const group = new THREE.Group()
  group.position.copy(AT)
  group.rotation.y = Math.atan2(-AT.x, -AT.z)
  const W = COLS * CELL + 0.5
  const H = ROWS * CELL + 1.6
  const D = 1.6
  const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

  // a gingerbread house: brown walls, white icing along every edge, a red roof with snow on it
  const ginger = std(0xa0602e, 0.85)
  const icing = std(0xfbf8f2, 0.5)
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), ginger)
  body.position.y = H / 2
  group.add(body)
  for (const y of [0.05, H]) group.add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.1, D + 0.12), icing).translateY(y))
  for (const x of [-W / 2, W / 2]) group.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, H, 0.1), icing).translateX(x).translateY(H / 2).translateZ(D / 2 + 0.02))
  // the roof
  const roofMat = std(0xb3202a, 0.7)
  const pitch = 0.6
  const slope = W / 2 / Math.cos(pitch) + 0.25
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.14, D + 0.5), roofMat)
    r.position.set((s * W) / 4, H + (Math.tan(pitch) * W) / 4, 0)
    r.rotation.z = -s * pitch
    group.add(r)
    const snow = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.08, D + 0.55), icing)
    snow.position.set((s * W) / 4, H + (Math.tan(pitch) * W) / 4 + 0.1, 0)
    snow.rotation.z = -s * pitch
    group.add(snow)
  }
  const gableShape = new THREE.Shape()
  gableShape.moveTo(-W / 2, 0)
  gableShape.lineTo(W / 2, 0)
  gableShape.lineTo(0, (Math.tan(pitch) * W) / 2)
  gableShape.closePath()
  for (const z of [D / 2, -D / 2]) {
    const g = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), new THREE.MeshStandardMaterial({ color: 0xa0602e, roughness: 0.85, side: THREE.DoubleSide }))
    g.position.set(0, H, z)
    group.add(g)
  }
  // the name in the gable, and a star on top
  const [nc, nctx] = makeCanvas(512, 128)
  nctx.fillStyle = '#fbf3e0'
  nctx.font = 'bold 66px Fraunces, Georgia, serif'
  nctx.textAlign = 'center'
  nctx.textBaseline = 'middle'
  nctx.fillText('Julkalendern', 256, 68)
  const name = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: toTexture(nc), transparent: true }))
  name.position.set(0, H + 0.55, D / 2 + 0.02)
  group.add(name)
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false })
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), starMat)
  star.position.set(0, H + (Math.tan(pitch) * W) / 2 + 0.35, 0)
  group.add(keepApart(star))
  const glowTex = glowTexture('rgba(255,214,140,0.9)', 'rgba(255,170,70,0)')
  const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false }))
  starGlow.position.copy(star.position)
  starGlow.scale.setScalar(1.6)
  group.add(keepApart(starGlow))
  // the step up to it
  group.add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.14, 0.6), std(0x6a4a2e, 0.9)).translateY(0.07).translateZ(D / 2 + 0.3))

  /* the doors: numbered, with a lit picture behind each one */
  const doors: { hinge: THREE.Group; frame: THREE.Mesh; open: number; want: number }[] = []
  const iconTex = (icon: string) => {
    const [c, ctx] = makeCanvas(128, 128)
    ctx.fillStyle = '#ffe0a8'
    ctx.fillRect(0, 0, 128, 128)
    ctx.font = '84px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, 64, 72)
    return toTexture(c)
  }
  const numberTex = (n: number) => {
    const [c, ctx] = makeCanvas(128, 128)
    const hue = [0xb3202a, 0x1d6e48, 0x1f3a8a, 0x8a4a1e][n % 4]
    ctx.fillStyle = `#${hue.toString(16).padStart(6, '0')}`
    ctx.fillRect(0, 0, 128, 128)
    ctx.strokeStyle = '#f6c453'
    ctx.lineWidth = 8
    ctx.strokeRect(6, 6, 116, 116)
    ctx.fillStyle = '#fbf3e0'
    ctx.font = 'bold 64px Fraunces, Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n), 64, 70)
    return toTexture(c)
  }
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, toneMapped: false, transparent: true, opacity: 0 })
  LAYOUT.forEach((n, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = (col - (COLS - 1) / 2) * CELL
    const y = 0.75 + (ROWS - 1 - row) * CELL + DOOR / 2
    // behind it: a little lit picture
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(DOOR * 0.92, DOOR * 0.92), new THREE.MeshBasicMaterial({ map: iconTex(DOORS[n - 1].icon), toneMapped: false }))
    pic.position.set(x, y, D / 2 + 0.005)
    group.add(pic)
    // the door, hinged on its left
    const hinge = keepApart(new THREE.Group())
    hinge.position.set(x - DOOR / 2, y, D / 2 + 0.02)
    const door = new THREE.Mesh(new THREE.BoxGeometry(DOOR, DOOR, 0.03), [ginger, ginger, ginger, ginger, new THREE.MeshStandardMaterial({ map: numberTex(n), roughness: 0.7 }), ginger])
    door.position.x = DOOR / 2
    hinge.add(door)
    group.add(hinge)
    // a gold glow round today's door
    const frame = keepApart(new THREE.Mesh(new THREE.PlaneGeometry(DOOR + 0.12, DOOR + 0.12), frameMat.clone()))
    frame.position.set(x, y, D / 2 + 0.01)
    group.add(frame)
    doors[n - 1] = { hinge, frame, open: 0, want: 0 }
  })
  scene.add(group)
  group.updateMatrixWorld(true)
  const colliders: Circle[] = [-1.3, 0, 1.3].map((x) => {
    const p = group.localToWorld(new THREE.Vector3(x, 0, 0))
    return { x: p.x, z: p.z, r: 1.05 }
  })

  /* which doors you've opened (in this browser) */
  const key = (y: number) => `jul3d.kalender.${y}`
  const opened = (): Set<number> => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key(today().year)) ?? '[]'))
    } catch {
      return new Set()
    }
  }
  const save = (s: Set<number>) => {
    try {
      localStorage.setItem(key(today().year), JSON.stringify([...s]))
    } catch {
      /* fine */
    }
  }
  const sync = () => {
    const o = opened()
    doors.forEach((d, i) => (d.want = o.has(i + 1) ? 1 : 0))
  }
  sync()

  /* the calendar on screen */
  const panel = document.createElement('div')
  panel.id = 'kalender'
  panel.hidden = true
  document.body.append(panel)
  const css = document.createElement('style')
  css.textContent = `
#kalender { position: fixed; inset: 0; z-index: 7; display: grid; place-items: center; background: rgba(7, 11, 29, 0.6); }
#kalender .card { width: min(560px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; background: #fff3dc; color: var(--ink); border-radius: 18px; padding: 22px 22px 18px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); font-family: var(--sans); }
#kalender h2 { margin: 0 0 4px; font: 700 28px var(--serif); color: #8a1a1e; }
#kalender .sub { margin: 0 0 14px; opacity: 0.7; font-size: 14px; }
#kalender .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
#kalender .grid button { aspect-ratio: 1; border-radius: 10px; border: 2px solid #c8962a; background: #a0602e; color: #fbf3e0; font: 700 20px var(--serif); padding: 0; position: relative; }
#kalender .grid button.open { background: #ffe0a8; color: #8a4a1e; font-size: 26px; }
#kalender .grid button.today { box-shadow: 0 0 0 3px #f6c453, 0 0 18px #f6c453; animation: kal-pulse 1.4s ease-in-out infinite; }
#kalender .grid button.locked { opacity: 0.45; cursor: default; }
#kalender .grid button.locked::after { content: '🔒'; position: absolute; right: 3px; bottom: 1px; font-size: 11px; }
@keyframes kal-pulse { 50% { box-shadow: 0 0 0 3px #f6c453, 0 0 30px #f6c453; } }
#kalender .day { font: 700 14px var(--sans); letter-spacing: 0.08em; text-transform: uppercase; color: #b3202a; margin-bottom: 2px; }
#kalender h3 { margin: 0 0 10px; font: 700 26px var(--serif); color: #2a1a10; }
#kalender .big { font-size: 54px; text-align: center; margin: 4px 0 8px; animation: kal-pop 0.5s ease-out; }
@keyframes kal-pop { from { transform: scale(0.3) rotate(-15deg); opacity: 0; } }
#kalender p { line-height: 1.55; margin: 0 0 10px; }
#kalender .village { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: rgba(29, 110, 72, 0.12); border-left: 4px solid #1d6e48; }
#kalender .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
#kalender .row button { padding: 9px 16px; border-radius: 999px; border: 1px solid #b3202a; background: #b3202a; color: #fff; font: 600 15px var(--sans); }
#kalender .row button.off { background: transparent; color: #b3202a; }
`
  document.head.append(css)
  let isOpen = false
  let onClose: () => void = () => {}

  function grid() {
    const { open } = today()
    const o = opened()
    const cells = Array.from({ length: 24 }, (_, i) => {
      const n = i + 1
      const cls = o.has(n) ? 'open' : n <= open ? (n === open ? 'today' : '') : 'locked'
      return `<button class="${cls}" data-day="${n}" ${n > open ? 'disabled' : ''}>${o.has(n) ? DOORS[i].icon : n}</button>`
    }).join('')
    const sub = open === 0 ? 'Den första luckan öppnas den 1 december kl. 06.' : open >= 24 ? 'Alla luckor är öppna. God jul! 🎄' : `${o.size} av ${open} luckor öppnade · nästa lucka i morgon kl. 06`
    panel.innerHTML = `<div class="card"><h2>🎄 Julkalendern</h2><p class="sub">${sub}</p><div class="grid">${cells}</div><div class="row"><button class="off" data-go="close">Stäng</button></div></div>`
  }
  function chapter(n: number, fresh: boolean) {
    const d = DOORS[n - 1]
    panel.innerHTML = `<div class="card"><div class="day">Lucka ${n} · ${n} december</div><h3>${d.title}</h3>${fresh ? `<div class="big">${d.icon}</div>` : ''}${d.story.map((s) => `<p>${s}</p>`).join('')}<div class="village"><b>I byn:</b> ${d.village}</div><div class="row"><button class="off" data-go="grid">Alla luckor</button><button data-go="close">Stäng</button></div></div>`
  }
  /** Open door n (if it may be): it swings open on the house, and the chapter shows. */
  function openDoor(n: number) {
    if (n > today().open) return
    const o = opened()
    const fresh = !o.has(n)
    if (fresh) {
      o.add(n)
      save(o)
      doors[n - 1].want = 1
      noise(0.3, 400, 1600, 0.08, 1)
      ;[784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => blip(f, 0.12, 'triangle', 0.05), 150 + i * 90))
    }
    chapter(n, fresh)
  }
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    if (!b) return
    if (b.dataset.day) openDoor(Number(b.dataset.day))
    else if (b.dataset.go === 'grid') grid()
    else if (b.dataset.go === 'close') close()
  })

  function show(done: () => void) {
    onClose = done
    isOpen = true
    panel.hidden = false
    // straight to today's door if it's waiting; otherwise all of them
    const { open } = today()
    if (open > 0 && !opened().has(open)) openDoor(open)
    else grid()
  }
  function close() {
    if (!isOpen) return
    isOpen = false
    panel.hidden = true
    onClose()
  }

  /** Is there a door today you haven't opened? */
  const waiting = () => {
    const { open } = today()
    return open > 0 && !opened().has(open)
  }

  /** It goes up on the first of December and comes down after tjugondag Knut. */
  const season = () => {
    const d = new Date(wallClock())
    return d.getUTCMonth() === 11 || (d.getUTCMonth() === 0 && d.getUTCDate() <= 13)
  }
  const setSeason = (on: boolean) => {
    group.visible = on
    for (const c of colliders) c.r = on ? Math.abs(c.r) : -Math.abs(c.r)
  }
  setSeason(season())
  let check = 0
  function update(t: number, dt: number) {
    if ((check -= dt) <= 0) {
      check = 5
      sync()
      setSeason(season())
    }
    if (!group.visible) return
    const { open } = today()
    doors.forEach((d, i) => {
      d.open += (d.want - d.open) * Math.min(1, dt * 3)
      d.hinge.rotation.y = -d.open * 1.9
      // today's door, if still shut, glows
      const glow = i + 1 === open && d.want === 0 ? 0.45 + Math.sin(t * 3) * 0.3 : 0
      ;(d.frame.material as THREE.MeshBasicMaterial).opacity = glow
    })
    star.rotation.y = t * 0.8
  }

  const centre = AT.clone()
  return {
    group,
    colliders,
    update,
    show,
    close,
    waiting,
    get open() {
      return isOpen
    },
    /** In front of it, facing it. */
    near(pos: THREE.Vector3, fwd: THREE.Vector3) {
      if (!group.visible) return false
      const front = group.localToWorld(new THREE.Vector3(0, 0, D / 2 + 1.2))
      const dx = centre.x - pos.x
      const dz = centre.z - pos.z
      const d = Math.hypot(front.x - pos.x, front.z - pos.z)
      return d < 3.2 && (dx * fwd.x + dz * fwd.z) / Math.hypot(dx, dz) > 0.5
    },
    prompt: () => (waiting() ? `Öppna lucka ${today().open} i julkalendern` : 'Titta i julkalendern'),
  }
}
