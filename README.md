# 🎄 Daniels Jul

Nedräkning, info och lite julkaos inför årets julbak och julbord.

- **Hem** – flygande släde (tryck på den!), nedräkning och alla händelser
- **Event-sidor** – tider, plats, tävlingsregler, årets tema och "Lägg till i kalendern" (.ics)
- **Knytis** – klicka på en rätt på julbordsbilden och paxa den
- **Spel** – Klappfångst, Rudolfs Flygtur och Tomtememory, med topplistor

## Uppdatera inför nytt år

Allt innehåll ligger i [`src/data.ts`](src/data.ts): datum, tema, beskrivningar, regler, gäster och rätter.
Knytis-listan och topplistorna nollställs automatiskt varje säsong (från 1 juli).

Gästbilder ligger i `public/Participants/<Namn>.png`.

## Utveckla lokalt

```bash
npm install
npm run dev
```

I `npm run dev` sparas knytis och topplistor i webbläsarens localStorage. För att köra mot riktiga
funktioner lokalt: `npx netlify dev`.

## Bidra

Alla är välkomna att bidra – nya spel, buggfixar, texter eller nya rätter till knytis.

### Brancher

| Branch | Syfte |
| ------ | ----- |
| `dev`  | Utveckling. **Alla PR:er ska gå hit.** |
| `test` | Testning innan release. Uppdateras bara via PR från `dev`. |
| `main` | Produktion – det som ligger live på Netlify. Uppdateras bara via PR från `test`. |

Flödet är alltså: `din-branch` → `dev` → `test` → `main`.

### Så här gör du

1. Forka repot (eller skapa en branch om du har skrivrättigheter).
2. Utgå från `dev`:
   ```bash
   git switch dev
   git pull
   git switch -c feature/kort-beskrivning
   ```
   Namnge gärna branchen `feature/…`, `fix/…` eller `docs/…`.
3. Gör dina ändringar och kontrollera att det bygger:
   ```bash
   npm run build
   ```
4. Pusha och öppna en pull request **mot `dev`** (inte `main`). Beskriv vad du ändrat och varför,
   gärna med en skärmdump om det syns i gränssnittet.
5. En maintainer granskar och mergar. Därefter flyttas ändringen vidare till `test` och sedan `main`.

### Regler på GitHub

- `main`, `test` och `dev` är skyddade: ingen direkt push, ingen force-push och de kan inte raderas.
- Alla ändringar sker via pull request och kräver minst ett godkännande.
- CI (`.github/workflows/ci.yml`) bygger projektet på varje PR och kontrollerar att PR:er mot
  `test` kommer från `dev` och att PR:er mot `main` kommer från `test`.

### Tips

- Håll PR:er små och fokuserade – en sak per PR.
- Skriv commit-meddelanden som förklarar vad som ändrats, t.ex.
  `Snöbollskrig: tips om att klicka på snöhögen`.
- Nytt innehåll inför ett nytt år (datum, tema, gäster) hör hemma i [`src/data.ts`](src/data.ts).

## Driftsättning (Netlify)

Sidan är en Vite + React-app med två Netlify Functions (`netlify/functions`) som lagrar data i
**Netlify Blobs**. Ingen databas eller API-nyckel behövs.

1. Netlify → *Add new site → Import from Git* → välj `djpiggelin/daniels-jul`
   (eller, om du fortfarande har den gamla sajten: *Site configuration → Build & deploy → Link repository*).
2. Build-inställningar läses från `netlify.toml` (`npm run build`, publish `dist`).
3. Klart – `/api/potluck` och `/api/leaderboard` fungerar direkt.
