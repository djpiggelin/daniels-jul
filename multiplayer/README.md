# 🎅 Byn – multiplayer

Servern som gör att man ser varandra i 3D-byn och kan kasta snöboll på varandra. En
[Cloudflare Worker](https://developers.cloudflare.com/workers/) med en
[Durable Object](https://developers.cloudflare.com/durable-objects/) som håller "byn": vem som är där, var de står,
snöbollar som flyger och hur många träffar var och en har satt. Gratisnivån räcker gott för julens kvällar.

```
multiplayer/
  src/protocol.ts   meddelandena mellan byn och servern (delas med jul3d/src/multiplayer.ts)
  src/index.ts      Workern + Durable Objecten "Byn"
  wrangler.jsonc    Cloudflare-konfiguration
```

## Hur det fungerar

- Varje spelare skickar sin position högst ~8 gånger i sekunden (bara när den ändrats, annars var 2:a sekund).
  Servern skickar ut allas senaste positioner 10 gånger i sekunden, och byn glider mjukt mellan dem.
- Kastar du en snöboll skickas den till de andra, som låter den flyga hos sig. **Den som blir träffad avgör** och
  säger till – då kan ingen fuska till sig träffar på andra.
- Repot är öppet, så servern litar inte på något: namn rensas och kortas, färger och bilder måste vara tillåtna,
  positioner hålls inom byn, för många eller för stora meddelanden ignoreras, max 30 i byn samtidigt, och bara
  sajtens egna sidor (`hasslon.se`, `danielsjulkalender.netlify.app` och dess previews, `localhost`) får ansluta.
- Utan server – eller om den inte går att nå – är byn som vanligt, bara för en.

## Köra lokalt

```bash
npm run dev:mp
```

startar servern på `ws://localhost:8787/byn` (helt lokalt, inget Cloudflare-konto behövs). `npm run dev:3d` ansluter
dit automatiskt – öppna byn i två fönster så ser du dig själv.

## Driftsätta

En gång: skapa ett gratis Cloudflare-konto och logga in:

```bash
npx wrangler login
```

Sedan (och efter varje ändring här):

```bash
npm run deploy:mp
```

Wrangler skriver ut adressen, t.ex. `https://daniels-jul-byn.<ditt-konto>.workers.dev`. Lägg in den som
miljövariabel i Netlify (*Site configuration → Environment variables*) och bygg om sajten:

```
VITE_MP_URL = wss://daniels-jul-byn.<ditt-konto>.workers.dev/byn
```

Fler tillåtna adresser (t.ex. en egen domän) sätts med variabeln `ALLOWED_ORIGINS` på Workern
(kommaseparerad), i Cloudflare eller med `wrangler secret put ALLOWED_ORIGINS`.
