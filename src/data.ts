// ✏️ Allt innehåll för årets jul bor här – uppdatera datum, tema och texter varje år.

export const YEAR = 2026

export type Competition = {
  name: string
  emoji: string
  rules: string[]
  criteria?: string[]
}

export type JulEvent = {
  id: string
  name: string
  emoji: string
  tagline: string
  start: string // ISO, lokal tid
  durationHours: number
  location: string
  description: string
  image: string
  reindeer: string
  accent: 'red' | 'green' | 'gold'
  theme?: string
  competitions?: Competition[]
  potluck?: boolean
  /** Leds by Santa himself – shown as the sleigh instead of a reindeer on the front page. */
  santa?: boolean
}

export const EVENTS: JulEvent[] = [
  {
    id: 'julbak',
    name: 'Julbak',
    emoji: '🍪',
    tagline: 'Pepparkakshus, lussebullar & glögg',
    start: `${YEAR}-12-05T18:00:00`,
    durationHours: 6,
    location: 'Hemma hos Daniel',
    description:
      'Det årliga julbaket! Vi bygger pepparkakshus, bakar lussebullar, mixar drinkar och dricker varm glögg. Ta med vänner, förkläde och tävlingsinstinkt.',
    image: '/Images/Julbak/f534f49c-adbf-4f72-9fa9-523e70a93534.jpg',
    reindeer: 'Dasher',
    accent: 'gold',
    theme: 'Avslöjas snart …',
    competitions: [
      {
        name: 'Pepparkakstävling',
        emoji: '🏠',
        rules: [
          'Max 3 deltagare per lag – samarbeta och utnyttja allas styrkor!',
          'Bygget ska vara färdigt senast kl. 19:00.',
          'Ni får gärna planera och projektera i förväg, men själva bygget får inte påbörjas innan eventet.',
          'Prefabricerade delar är tillåtna, men de måste skapas samma dag som eventet och dokumenteras med datum.',
          'Planerar ni något stort (mer än ett halvt paket deg) – ta med extra pepparkaksdeg.',
        ],
        criteria: ['Igenkänning av byggnad', 'Estetik', 'Kreativitet & koppling till temat'],
      },
      {
        name: 'Drinktävling',
        emoji: '🍸',
        rules: [
          'Max 3 deltagare per lag – experimentera med smaker och presentation för att imponera på juryn!',
          'Förberedelser är tillåtna, men alla drinkar ska mixas på plats.',
          'Gör tillräckligt många drinkar så att alla på eventet kan smaka.',
          'Alla drinkar ska vara klara för servering senast kl. 19:30.',
        ],
        criteria: ['Smak', 'Presentation', 'Kreativitet'],
      },
    ],
  },
  {
    id: 'julbord',
    name: 'Julbord',
    emoji: '🍖',
    tagline: 'Sill, skinka, snaps & sång',
    start: `${YEAR}-12-12T19:00:00`,
    durationHours: 6,
    location: 'Hemma hos Daniel',
    description:
      'Det årliga julbordet med alla klassiker – sill, lax, skinka, köttbullar, Jansson och naturligtvis snaps. Knytkalas-style: välj vad du tar med på Knytis-listan. Klä upp dig fint och ta med aptiten!',
    image: '/Images/Julbord/47e43066-d754-4614-8875-a71d42462100.jpg',
    reindeer: 'Rudolf',
    accent: 'red',
    potluck: true,
  },
  {
    id: 'julafton',
    name: 'Julafton',
    emoji: '🎁',
    tagline: 'Den stora finalen',
    start: `${YEAR}-12-24T15:00:00`,
    durationHours: 9,
    location: 'Där hjärtat är',
    description: 'Den stora finalen! Kalle Anka, julmys, klappar och värme – Santa leder släden.',
    image: '/Images/Julbord/5121726d-7697-4990-9c78-7f9839e1c9b9.jpg',
    reindeer: 'Tomten',
    santa: true,
    accent: 'green',
  },
]

// 👥 GÄSTER – lägg till eller ta bort rader här.
// `photo` är valfritt: lägg bilden i public/Participants/ och skriv filnamnet.
// Utan foto visas gästens initial istället (och de är inte med i memory-spelet).
export const GUESTS: { name: string; photo?: string }[] = [
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
  { name: 'Gäst' },
]

export const PARTICIPANTS = GUESTS.map((g) => ({ name: g.name, image: g.photo ? `/Participants/${g.photo}` : null }))

export type Dish = { id: string; name: string; emoji: string; category: 'Fisk' | 'Kött' | 'Tillbehör' | 'Dryck'; x: number; y: number }

// x/y = position i procent på julbordsbilden (för den interaktiva kartan)
export const DISHES: Dish[] = [
  { id: 'gravad-lax', name: 'Gravad lax', emoji: '🐟', category: 'Fisk', x: 21.4, y: 39.7 },
  { id: 'rokt-lax', name: 'Rökt lax', emoji: '🐟', category: 'Fisk', x: 16.3, y: 37.1 },
  { id: 'gravlaxsas', name: 'Gravlaxsås', emoji: '🥣', category: 'Fisk', x: 27.7, y: 39.6 },
  { id: 'laxrora', name: 'Laxröra', emoji: '🥣', category: 'Fisk', x: 35.4, y: 44.3 },
  { id: 'inlagd-sill', name: 'Inlagd sill', emoji: '🐠', category: 'Fisk', x: 16.2, y: 63.3 },
  { id: 'smaksill', name: 'Italiensk sill & currysill', emoji: '🐠', category: 'Fisk', x: 28.6, y: 56.6 },
  { id: 'julskinka', name: 'Julskinka', emoji: '🍖', category: 'Kött', x: 52.8, y: 44.5 },
  { id: 'prinskorv', name: 'Prinskorv', emoji: '🌭', category: 'Kött', x: 45.9, y: 51.5 },
  { id: 'kottbullar', name: 'Köttbullar', emoji: '🧆', category: 'Kött', x: 31.8, y: 84 },
  { id: 'ribs', name: 'Ribs', emoji: '🍖', category: 'Kött', x: 83.3, y: 70.3 },
  { id: 'agg', name: 'Ägg', emoji: '🥚', category: 'Tillbehör', x: 70.4, y: 35 },
  { id: 'potatis', name: 'Potatis', emoji: '🥔', category: 'Tillbehör', x: 70.3, y: 40.4 },
  { id: 'rodbetssallad', name: 'Rödbetssallad', emoji: '🥗', category: 'Tillbehör', x: 69, y: 59.9 },
  { id: 'jansson', name: 'Jansson', emoji: '🥘', category: 'Tillbehör', x: 62.8, y: 81.1 },
  { id: 'vortbrod', name: 'Vörtbröd', emoji: '🍞', category: 'Tillbehör', x: 41.5, y: 66.7 },
  { id: 'ostar', name: 'Ostar', emoji: '🧀', category: 'Tillbehör', x: 88.1, y: 49 },
  { id: 'glogg', name: 'Glögg', emoji: '🍷', category: 'Dryck', x: 82.2, y: 8.2 },
  { id: 'julmust', name: 'Julmust', emoji: '🥤', category: 'Dryck', x: 95.3, y: 3.5 },
  { id: 'julol', name: 'Julöl', emoji: '🍺', category: 'Dryck', x: 88, y: 1.9 },
  { id: 'vin', name: 'Vin', emoji: '🍾', category: 'Dryck', x: 76.9, y: 9 },
  { id: 'snaps', name: 'Snaps', emoji: '🥃', category: 'Dryck', x: 83.2, y: 25 },
]

export const POTLUCK_IMAGE = '/Images/Julbord/Gemini_Generated_Image_4ulswq4ulswq4uls.png'
