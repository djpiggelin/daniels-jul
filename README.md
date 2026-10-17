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

## Driftsättning (Netlify)

Sidan är en Vite + React-app med två Netlify Functions (`netlify/functions`) som lagrar data i
**Netlify Blobs**. Ingen databas eller API-nyckel behövs.

1. Netlify → *Add new site → Import from Git* → välj `djpiggelin/daniels-jul`
   (eller, om du fortfarande har den gamla sajten: *Site configuration → Build & deploy → Link repository*).
2. Build-inställningar läses från `netlify.toml` (`npm run build`, publish `dist`).
3. Klart – `/api/potluck` och `/api/leaderboard` fungerar direkt.
