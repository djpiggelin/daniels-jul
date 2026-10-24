// What the people of Kolgruvan have to say: the foreman, the old man by the lake, the gem polisher,
// and the rest of the nissar who weren't quite nice enough for Leksaksfabriken – why they're down
// here, what the coal is for, the song, and the lists (without giving the calendar's story away).
import { html, type Talk } from './ui'

const DARK = '#2a2420'

export const MINE_TALK: Record<string, Talk> = {
  foreman: {
    name: 'Förman Kolbjörn',
    avatar: '⛏️',
    avatarBg: DARK,
    greeting: () => [html.p('Hm. En besökare. Det var inte i går.'), html.p('Vem sa åt dig om stubben? … Nej, säg inget. Jag vill inte veta.')],
    topics: [
      {
        label: '⛏️ Vad är det här för ställe?',
        pages: () => [
          html.p('Kolgruvan. Här under byn har vi brutit kol i trehundra år.'),
          html.p('Varje bit kol som hamnar i en strumpa hos ett stygt barn på julafton har gått genom mina händer. Eller genom någon annans här nere. Men jag har räknat den.'),
        ],
      },
      {
        label: '📜 Vad är Stygga listan?',
        pages: () => [
          html.p('Den står där på tavlan. Varje namn får sin säck. Ju längre ner på listan, desto större säck.'),
          html.p('Resten ligger utrullat på golvet. Den blir längre för varje år. Barn nu för tiden … och nissar också, för den delen.'),
        ],
      },
      {
        label: '🎄 Och Snälla listan?',
        pages: () => [html.p('Snälla listan? Den har vi inte. Den ligger väl i Tomtens fina fabrik.'), html.p('Varför frågar du det? … Gå och titta på kristallerna eller nåt.')],
      },
      {
        label: '🤔 Varför är ni här nere och inte i fabriken?',
        pages: () => [
          html.p('Den som är för stygg för fabriken hamnar här. Så har det alltid varit.'),
          html.p('Jag själv? Jag målade mustasch på alla dockor 1987. Alla. Tolv tusen dockor. Det var värt det.'),
        ],
      },
    ],
    bye: 'Seså. Gå inte och berätta för någon där uppe.',
  },

  fisher: {
    name: 'Gamle Sot-Sixten',
    avatar: '🎣',
    avatarBg: '#123040',
    greeting: () => [html.p('Schh … du skrämmer fisken.'), html.p('Nej, det finns ingen fisk i Svartsjön. Men man kan ju hoppas.')],
    topics: [
      {
        label: '🌊 Vad är det här för sjö?',
        pages: () => [html.p('Svartsjön. Den är så djup att ingen har sett botten. Svamparna lyser året om, och det är det enda ljuset vi har som inte kostar fotogen.'), html.p('Jag kommer hit när det blir för mycket hackande. Det är tyst här.')],
      },
      {
        label: '⏳ Hur länge har du varit här nere?',
        pages: () => [
          html.p('Längst av alla. Jag kom ner samma år som stubben var en gran.'),
          html.p('Vad jag gjorde? Jag bytte ut alla julklappar i en hel by mot strumpor. Grå strumpor. Det var inte så roligt som jag trodde.'),
        ],
      },
      {
        label: '🎄 Saknar du att vara däruppe?',
        pages: () => [html.p('Varje jul. Man hör dem sjunga ibland, däruppe. Och så tänker man på julklappar.'), html.p('Vi får aldrig några, vet du. Inte en enda. Det är så det är med kol.')],
      },
    ],
    bye: 'Kom igen någon gång. Ta med en macka.',
  },

  jeweller: {
    name: 'Glimma',
    avatar: '💎',
    avatarBg: '#3a2060',
    greeting: () => [html.p('Åh! Akta så du inte trampar på kristallerna. De växer, vet du. Långsamt.')],
    topics: [
      {
        label: '💎 Vad gör du?',
        pages: () => [
          html.p('Jag putsar ädelstenarna som vi hittar när vi bryter kol. Ibland ligger det en i kolet, mitt i allt det svarta.'),
          html.p('De skickar vi upp till fabriken, i hemlighet. Vissa kronor och stjärnor i leksaksverkstaden har stenar härifrån. Det vet ingen där uppe.'),
        ],
      },
      {
        label: '😈 Hur hamnade du här?',
        pages: () => [html.p('Jag gömde Tomtens glasögon. Tre år i rad. Han letade varje gång i en vecka.'), html.p('Det tredje året la jag dem i hans skägg.')],
      },
      {
        label: '✨ Varför lyser kristallerna?',
        pages: () => [html.p('De lyser av allt snällt som någon har gjort men som ingen har sett. Det är min teori i alla fall.'), html.p('Därför är det så ljust här nere, trots allt.')],
      },
    ],
    bye: 'Glimta på dig!',
  },

  apprentice: {
    name: 'Lill-Snorre',
    avatar: '🧒',
    avatarBg: DARK,
    greeting: () => [html.p('Hej! Är du från fabriken? Är det sant att de har en rutschkana där?!')],
    topics: [
      {
        label: '🏭 Vill du till fabriken?',
        pages: () => [
          html.p('Mer än allt! Jag är bara lite stygg, typ. Jag åt upp marsipanen ur hundra julklappar. Bara marsipanen.'),
          html.p('Förmannen säger att om man är snäll ett helt år kan man få komma upp. Men ingen har klarat det. Det är jättesvårt att vara snäll när det är mörkt hela tiden.'),
        ],
      },
      {
        label: '🎶 Vad är det de sjunger?',
        pages: () => [html.p('Pråmdragarnas sång! Den lärde vi oss av ryska gruvnissar som var här på besök för längesen. Jättelängesen.'), html.p('Man hackar i takt. ”Ej uchnem!” – då slår alla samtidigt. Testa själv vid den lediga ådern!')],
      },
      {
        label: '🛤️ Vart går Gruvexpressen?',
        pages: () => [html.p('Ingen vet! Vagnen åker in i gångarna och kommer tillbaka full med kol. Eller tom, om någon har kraschat.'), html.p('Mitt rekord är 312 meter. Slå det om du kan!')],
      },
    ],
    bye: 'Hälsa på rutschkanan från mig!',
  },

  grump: {
    name: 'Tjurige Tore',
    avatar: '😤',
    avatarBg: DARK,
    greeting: () => [html.p('Vad glor du på? Jag har rast.')],
    topics: [
      {
        label: '😤 Varför är du så sur?',
        pages: () => [html.p('Jag är inte sur. Jag är bara här nere. Det är skillnad.'), html.p('Okej, lite sur. Kol i skägget, kol i gröten, kol i sängen. Allt är kol.')],
      },
      {
        label: '🙃 Vad gjorde du för stygt?',
        pages: () => [html.p('Inget! … Jag knöt ihop renarnas svansar. En gång. Rudolf har inte förlåtit mig.'), html.p('Och jag tog Tomtens tomteluva och gav den till en snögubbe. Den såg bättre ut på snögubben.')],
      },
    ],
    bye: 'Ja ja. Hej då då.',
  },

  cards: {
    name: 'Fusk-Folke och Knorr-Knut',
    avatar: '🃏',
    avatarBg: DARK,
    greeting: () => [html.p('– Vi spelar Svarte Petter, säger Folke.'), html.p('– Och Folke fuskar, säger Knut.')],
    topics: [
      {
        label: '🃏 Får jag vara med?',
        pages: () => [html.p('– Nej, säger båda samtidigt.'), html.p('– Man förlorar alltid mot Folke, säger Knut. – Han har tre Svarte Petter i ärmen.')],
      },
      {
        label: '😈 Varför är ni här nere?',
        pages: () => [
          html.p('– Vi hällde salt i Tomtens julgröt, säger Folke stolt.'),
          html.p('– Och sen bytte vi alla namnlappar på julklapparna, säger Knut. – Farmor fick en sparkcykel och en liten pojke fick en strumpbyxa.'),
        ],
      },
    ],
    bye: '– Gå nu, vi är mitt i en hand.',
  },

  sorter: {
    name: 'Kol-Karin',
    avatar: '🪨',
    avatarBg: DARK,
    greeting: () => [html.p('Stora bitar dit, små bitar hit. Stora dit, små hit. Hej.')],
    topics: [
      {
        label: '🪨 Vad sorterar du?',
        pages: () => [html.p('Kolet. Stora bitar är till de riktigt stygga. Små bitar till de som bara var lite stygga – som slarvade med att borsta tänderna, typ.'), html.p('Och dammet sopar vi ihop till dem som var nästan snälla. Det räknas ändå.')],
      },
      {
        label: '😴 Vem är det som sover där borta?',
        pages: () => [html.p('Slö-Stig. Han sover på kolsäckarna varje dag. Det är därför han är här nere.'), html.p('Han sov igenom en hel julafton en gång. Han var den som skulle väcka Tomten.')],
      },
    ],
    bye: 'Stora dit, små hit …',
  },

  sleeper: {
    name: 'Slö-Stig',
    avatar: '😴',
    avatarBg: DARK,
    greeting: () => [html.p('Zzz … mmh … fem minuter till …'), html.p('… zzz … ingen julgröt till Stig … zzz …')],
    topics: [{ label: '👋 Vakna!', pages: () => [html.p('Mmh? … Är det julafton?'), html.p('… Nej? Då sover jag lite till. Zzz …')] }],
    bye: 'Zzz …',
  },

  skipper: {
    name: 'Smyg-Sigge',
    avatar: '🤫',
    avatarBg: '#123040',
    greeting: () => [html.p('Jag gör ingenting! Jag kastar bara macka. Det finns inga pepparkakor i min ficka.')],
    topics: [
      {
        label: '🍪 Vadå för pepparkakor?',
        pages: () => [html.p('… Precis. Vilka pepparkakor? Det finns inga pepparkakor.'), html.p('Bagarnissen däruppe bakar för många ändå. Ingen märker om några försvinner.')],
      },
      {
        label: '🪨 Hur många studs?',
        pages: () => [html.p('Mitt rekord är sju! Men Svartsjön är så stilla att stenen nästan inte vill sjunka.'), html.p('Gamle Sixten blir arg varje gång. Han säger att jag skrämmer fisken. Det finns ingen fisk.')],
      },
    ],
    bye: 'Du har inte sett mig!',
  },
}
