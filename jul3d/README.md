# 🎄 Daniels Jul – Byn (3D)

En liten snöig julby i three.js. Gå runt i förstapersonsvy, kika på väggarna, prata med nissarna bakom disken,
spela vid granen och kasta snöboll på tomtenissarna som springer runt.

| Butik | Händelse | Inne i butiken |
| --- | --- | --- |
| Tomtens verkstad | Julbak – pepparkakstävling | Verkstadsordning (regler), bedömning, verkstaden + de fyra rummen som tavlor, pepparkakshus |
| Tomtens destilleri | Julbak – drinktävling | Regler, bedömning, temat, kopparpannor som ångar |
| Julbordet | Julbord + knytis | Knytis-listan (klicka på tavlan eller fråga Skinknissen för att paxa en rätt), gästlistan som polaroids, dukat bord |
| Tomtens stuga | Julafton | Att göra-lista, brasa, Kalle Anka på tv:n, minnesvägg |
| Arkitektkontoret | Julbak – planera huset | Ritbordet: Pepparkaksarkitekten öppnas mitt i byn (fråga Ritnissen eller klicka på ritningen/bordet), och huset ni ritar står i 3D på bordet – med fönster, dörrar och glasyr |

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

## Fler i byn

Är fler inne samtidigt syns de som nissar i sin egen färg med namnskylt (och sin bild, om de valt ett namn från
gästlistan) – och snöbollar går att kasta på dem. `Enter` (eller 💬 på telefon) öppnar chatten: det du skriver blir en
pratbubbla över din nisse. Namnet skriver man på startskärmen (samma som på knytis).
Koden är [`src/multiplayer.ts`](src/multiplayer.ts); servern ligger i [`../multiplayer/`](../multiplayer/README.md).

## Styrning

- **Dator:** `W A S D` gå (håll framåt en stund så springer du), mus titta direkt, `E` eller klick prata/titta/spela,
  håll `Shift` för att sikta en snöboll och släpp för att kasta (längre tryck = längre kast), `M` musik.
  Musen låses när du går in i byn och förblir låst i popuperna (de får en egen muspekare).
- **I släden:** `A D` / mus sväng, `W S` upp/ner, `Mellanslag` (eller `Shift`) turbo, `Q` / `Esc` landa.
  På mobil drar du för att styra.
- **`Esc`:** stänger det som är öppet (prat, bild, spel). Annars öppnas menyn – där är musen vanlig igen, och
  *Fortsätt* låser den och tar dig tillbaka in i byn. Menyn har också musik, helskärm, muskänslighet och
  *Grafik: fin / snål* (snål = färre pixlar och inga skuggor, för datorer som blir varma).
- **Mobil:** tummen på vänster halva är en joystick där den landar (hela vägen ut = spring), dra för att titta,
  **tryck direkt på en nisse, tavla, automat eller släden** för att prata/titta/spela, håll ❄️ för snöboll, ☰ öppnar
  menyn. På Android går byn i helskärm när du kliver in; menyn har *📲 Lägg till på hemskärmen* (på iPhone är det enda
  sättet att få helskärm). Zoom-, studs- och långtrycksgester är avstängda så att man inte råkar lämna spelet.

## Innehåll

Årets innehåll (händelser, gäster, bilder, minnen) hämtas via [`../src/data.ts`](../src/data.ts) – samma som 2D-sajten,
från Netlify Blobs i produktion och från exemplet i `public/example/` lokalt. Se huvud-README:n. Nissarnas repliker och
vad som hänger på väggarna finns i [`src/shops.ts`](src/shops.ts). Teckningarna i `public/art/` (i repots rot) är
renderade från `ThemeArt.tsx` i 2D-sajten.

## Telefon, surfplatta och dator

[`src/device.ts`](src/device.ts) avgör en gång vad byn körs på och hur mycket den får kosta:

| | Telefon | Surfplatta | Dator |
| --- | --- | --- | --- |
| Pixeltäthet (max → min) | 1,25 → 0,6 | 1,25 → 0,75 | 1,5 → 1 |
| Största textur | 512 px (384 med lite minne) | 1024 px | full |
| Skuggor / kantutjämning | nej / nej | nej / ja | ja / ja |
| Tomtenissar | 4 | 5 | 8 |

- **Upplösningen följer bildfrekvensen**: under ~40 fps sänks den, över ~56 fps höjs den igen (aldrig över taket).
- **Texturbudgeten** krymper statiska ritytor *på plats* när de blir texturer – iOS Safari har ett hårt tak för hur mycket
  minne alla canvas får använda – så bildvisaren visar samma canvas, bara mindre. Skyltar och skärmar som ritas om hela
  tiden (`toTexture(c, { live: true })`) lämnas orörda.
- **Synfältet** hålls brett när telefonen hålls upp och ner (`walkFov`), annars ser man byn som genom ett rör.
- **Färre ritanrop** ([`src/batch.ts`](src/batch.ts)): när byn är byggd slås allt som står still ihop – en mesh per
  material per butik, nissarna del för del (huvud, armar, ben) – och glödlamporna är en instansad mesh. Torget gick
  från ~1 360 till ~620 ritanrop och från ~45 till ~8 ms per bild. Det som rör sig markeras med `keepApart()`.
- På dator ritas varje bild skärmen ber om (144 Hz → 144 fps); telefoner stannar vid 60.
- Tar grafiken slut på minne visas *Byn behöver en paus* med en knapp för att ladda om.

Testa: `?enhet=telefon`, `?enhet=surfplatta` eller `?enhet=dator` tvingar en profil (`?enhet=auto` släpper den).
`?diag` visar profil, fps, upplösning, ritanrop, texturminne och grafikkort – bra att läsa av på en riktig telefon.

## Kör lokalt

Från repots rot (beroendena delas med 2D-sajten):

```bash
npm install
npm run dev:3d
```

Ritbordet visar 2D-sajtens `/pepparkaksarkitekten` i en iframe. Med `dev:3d` hämtas den från 2D-dev-servern –
starta `npm run dev` i ett annat fönster (eller sätt `VITE_SITE_URL` i `jul3d/.env.development.local` om den kör på en
annan port). Lokalt ligger de på olika portar, så huset på bordet följer inte med det du ritar – det gör det i produktion
(och i Netlify-previews), där allt ligger på samma domän.

Byn är sajtens startsida: `npm run build` bygger den till `dist/by/`, och `netlify.toml` visar den på `/`.
I menyn och på startskärmen finns länkar till 2D-sidorna (knytis, händelser).

`?direkt` i adressen hoppar över startskärmen. I konsolen: `jul.goto(0)` teleporterar in i första butiken.
