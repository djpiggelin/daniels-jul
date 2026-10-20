# 🎄 Daniels Jul

Nedräkning, info och lite julkaos inför årets julbak och julbord.

- **Hem** – flygande släde (tryck på den!), nedräkning och alla händelser
- **Event-sidor** – tider, plats, tävlingsregler, årets tema och "Lägg till i kalendern" (.ics)
- **Knytis** – klicka på en rätt på julbordsbilden och paxa den
- **Spel** – Klappfångst, Rudolfs Flygtur och Tomtememory, med topplistor

## Uppdatera inför nytt år

Årets innehåll – datum, platser, tema, regler, gäster, gästbilder och eventbilder – ligger **inte i
repot** utan i Netlify Blobs (storen `daniels-jul-content`). Sidan hämtar det från `/api/content` och
bilderna från `/media/…`. Det som är likadant varje år (rätterna på knytis-kartan, spelen) ligger kvar
i koden, i [`src/data.ts`](src/data.ts).

Innehållet hålls i en lokal mapp `content/` (gitignorerad) med samma upplägg som exemplet i
[`public/example/`](public/example):

```
content/
  content.json      år, events och gäster
  photos/           gästbilder, t.ex. photos/Tomten.png
  images/           eventbilder
```

I `content.json` anges `image` och `photo` som sökvägar inuti mappen (`"photo": "photos/Tomten.png"`).
Utan `photo` visas gästens initial (och de är inte med i memory-spelet).

Ladda upp med:

```bash
npm run upload-content
```

Skriptet behöver `NETLIFY_SITE_ID` (Netlify → *Site configuration → Site ID*) och `NETLIFY_AUTH_TOKEN`
(Netlify → *User settings → Applications → Personal access tokens*), t.ex. i en `.env`-fil i roten –
den är gitignorerad. Ändringar syns på sajten inom någon minut, ingen ny deploy behövs. Lägg till
`-- --prune` för att också ta bort filer som inte längre finns lokalt.

Knytis-listan och topplistorna nollställs automatiskt varje säsong (från 1 juli).

## Utveckla lokalt

```bash
npm install
npm run dev
```

Du behöver inget riktigt innehåll: utan `/api/content` använder `npm run dev` det påhittade
exempelinnehållet i `public/example/`, och knytis och topplistor sparas i webbläsarens localStorage.
För att köra mot riktiga funktioner lokalt: `npx netlify dev`.

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
- Lägg aldrig in riktiga namn, bilder eller adresser i repot – sådant hör hemma i Netlify Blobs
  (se *Uppdatera inför nytt år*). Behöver du testdata, utöka exemplet i `public/example/`.

## Driftsättning (Netlify)

Sidan är en Vite + React-app med Netlify Functions (`netlify/functions`) som lagrar data i
**Netlify Blobs**. Ingen databas eller API-nyckel behövs.

1. Netlify → *Add new site → Import from Git* → välj `djpiggelin/daniels-jul`
   (eller, om du fortfarande har den gamla sajten: *Site configuration → Build & deploy → Link repository*).
2. Build-inställningar läses från `netlify.toml` (`npm run build`, publish `dist`).
3. Ladda upp årets innehåll med `npm run upload-content` (se *Uppdatera inför nytt år*).
4. Klart – knytis, topplistor och ritningar fungerar direkt.
