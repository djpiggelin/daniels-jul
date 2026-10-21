# 🎄 Daniels Jul – Byn (3D)

En liten snöig julby i three.js. Gå runt i förstapersonsvy, kika på väggarna, prata med nissarna bakom disken,
spela vid granen och kasta snöboll på tomtenissarna som springer runt.

| Butik | Händelse | Inne i butiken |
| --- | --- | --- |
| Tomtens verkstad | Julbak – pepparkakstävling | Verkstadsordning (regler), bedömning, verkstaden + de fyra rummen som tavlor, pepparkakshus |
| Tomtens destilleri | Julbak – drinktävling | Regler, bedömning, temat, kopparpannor som ångar |
| Julbordet | Julbord + knytis | Knytis-listan, gästlistan som polaroids, dukat bord |
| Tomtens stuga | Julafton | Att göra-lista, brasa, Kalle Anka på tv:n, minnesvägg |

På torget: julgranen, en affischpelare med alla händelser och en vägvisare till butikerna.

Runt granen står tre spelautomater med var sin värd – samma spel som på 2D-sajten:

| Automat | Värd | Spel |
| --- | --- | --- |
| 🎁 Klappfångst | Släd-Sigge | Styr släden, fånga klapparna, undvik kolet |
| 🦌 Rudolfs Flygtur | Flyg-Frida | Flaxa genom polkagrisarna |
| 🧠 Tomtememory | Minnes-Majken | Hitta paren bland gästerna |

Gå fram och tryck `E` (på automaten eller värden) så glider kameran in mot skärmen och du spelar på automatens egen
skärm. Rekorden sparas i webbläsaren. Spelen ligger i [`src/games/`](src/games), automaterna i [`src/arcade.ts`](src/arcade.ts).

Bakom dig när du kommer in i byn står **Tomtens släde** parkerad, med Rudolf och fyra renar framför. Gå fram till
tomten och tryck `E`: du knuffar ut honom i snön och hoppar in själv. Då flyger du släden i förstapersonsvy genom
polkagrisringar i himlen över byn – varje ring ger några sekunder till, perfekt mitt i ringen ger dubbla poäng. Var tionde poäng går det snabbare, ringarna blir mindre och svängarna
skarpare. När tiden
är slut landar du vid parkeringen igen (och tomten kliver tillbaka in, lite sur). Släden och renarna finns i
[`src/sleigh.ts`](src/sleigh.ts), flygspelet i [`src/flight.ts`](src/flight.ts).

Tomtenissarna ([`src/elves.ts`](src/elves.ts)) springer runt på torget – två av dem leker kull. Träffar du en med en
snöboll ramlar den omkull och kastar ofta tillbaka.

## Styrning

- **Dator:** `W A S D` gå (håll framåt en stund så springer du), mus titta direkt, `E` eller klick prata/titta/spela,
  håll `Shift` för att sikta en snöboll och släpp för att kasta (längre tryck = längre kast), `M` musik.
  Musen låses när du går in i byn och förblir låst i popuperna (de får en egen muspekare).
- **I släden:** `A D` / mus sväng, `W S` upp/ner, `Mellanslag` (eller `Shift`) turbo, `Q` / `Esc` landa.
  På mobil drar du för att styra.
- **`Esc`:** stänger det som är öppet (prat, bild, spel). Annars öppnas menyn – där är musen vanlig igen, och
  *Fortsätt* låser den och tar dig tillbaka in i byn. Menyn har också musik, helskärm, muskänslighet och
  *Grafik: fin / snål* (snål = färre pixlar och inga skuggor, för datorer som blir varma).
- **Mobil:** vänster tumme går, dra med höger för att titta, tryck på knappen för att prata, håll ❄️ för snöboll,
  ☰ öppnar menyn.

## Innehåll

Årets innehåll (händelser, gäster, bilder, minnen) hämtas via [`../src/data.ts`](../src/data.ts) – samma som 2D-sajten,
från Netlify Blobs i produktion och från exemplet i `public/example/` lokalt. Se huvud-README:n. Nissarnas repliker och
vad som hänger på väggarna finns i [`src/shops.ts`](src/shops.ts). Teckningarna i `public/art/` (i repots rot) är
renderade från `ThemeArt.tsx` i 2D-sajten.

## Kör lokalt

Från repots rot (beroendena delas med 2D-sajten):

```bash
npm install
npm run dev:3d
```

Byn är sajtens startsida: `npm run build` bygger den till `dist/by/`, och `netlify.toml` visar den på `/`.
I menyn och på startskärmen finns länkar till 2D-sidorna (knytis, händelser).

`?direkt` i adressen hoppar över startskärmen. I konsolen: `jul.goto(0)` teleporterar in i första butiken.
