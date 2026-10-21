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

Snett bakom dig till vänster står **Husvagnen** – en gräddvit husvagn efter en gammal bil, med Musse Pigg och Kalle Anka
som vinkar bredvid (en hyllning till *Musse Pigg på camping* från Kalle Anka på julafton). Gå fram så frågar de
"Redo att åka?" – tryck `E`. Då fryser byn till en målad kuliss som viks ihop som en solfjäder rakt in i husvagnen, och
bakom den finns en soptipp vid foten av ett smalt, brant berg. Kör bil och husvagn uppför serpentinvägen till toppen
utan att spilla frukosten: akta staketluckorna, stenarna och tåget vid järnvägsövergången (`W`/`S` gasa/bromsa,
`A`/`D` eller musen styr). Uppe på toppen är frukosten klar – och medan du springer in lossnar kopplingen. Husvagnen
rullar baklänges hela vägen ner (biten SVT alltid klippte bort) och du styr den: `A`/`D` lutar, `S` är handbromsen.
Möt lastbilen, hinn före tåget, och om du kör ut i en staketlucka paddlar Musse er tillbaka. Längst ner kullerbyttar
husvagnen rakt upp på kopplingen igen – "Jag körde ner er sakta och säkert, va?". `Q`/`Esc` hoppar ur. Husvagnen och figurerna finns i [`src/camper.ts`](src/camper.ts) och
[`src/toons.ts`](src/toons.ts), kulissen i [`src/fan.ts`](src/fan.ts), berget i [`src/mountain.ts`](src/mountain.ts)
och själva resan i [`src/trip.ts`](src/trip.ts). `?husvagn` i adressen hoppar rakt in i resan.

Längs vänstra ytterväggen på Tomtens verkstad hänger **tre matadorer** och lutar sig mot väggen – en med foten uppe
på väggen, en med armarna i kors och solglasögon, en på axeln – tuggar strå och knäpper upp mynt. Gå fram så frågar de
"Vill du ha en utmaning?". Säg ja i dialogen så knyter de för ögonen på dig och du åker häst och vagn till Madrid: tio
sekunder i mörker med hjärtslag och hovar, och suddiga glimtar under ögonbindeln (hästen och vägen, en tjur som sitter
under en korkek och luktar på blommor, arenan som tornar upp sig) medan *PLAZA DE TOROS · MADRID* skrivs fram. Bindeln
åker av mitt i arenan i bländande middagssol framför fulla läktare (publiken är tre målade bilder som byts när de
jublar). Sen kommer tjurarna, en i taget: **Bravucón**, **Rayo** och **El Diablo**. Varje tjur skrapar med hoven en
stund innan den rusar (det är varningen) och slutar styra de sista metrarna. Håll ut skynket så går den på det röda i
stället för på dig – ¡Olé! (poäng gånger kombo). Bravucón är snäll, men varje tjur efter honom är svårare: snabbare,
kortare varning, svänger efter dig om du hoppar undan för tidigt, kommer ibland tillbaka direkt utan att skrapa, orkar
längre – och **krokar**: precis innan den når skynket svänger den hornen mot dig, så du måste kliva bort från skynket i
sista stund. Ibland struntar den i skynket helt (då lyser ögonen rött). Hoppa åt sidan, eller hoppa rakt upp så hornen
går under dig. Tre liv för hela kvällen; efter en stund (minst tio sekunder) orkar tjuren inte mer och travar ut. Efter
tre tjurar kommer finalen: fanfar, du biter på naglarna och darrar, och in springer **Ferdinand** – luktar på en bukett
som en señora kastar ner, sätter sig… på en humla, och blir galen. Han är snabbast av alla, sicksackar, tvärnitar,
krokar hårdast och struntar oftast i skynket, med humlan surrande runt baken. Klarar du honom flyger humlan iväg, han
sätter sig med blommorna igen och hela Madrid kastar ner hundratals blommor och buketter. I arenan byts byns musik mot
en pasodoble (egen, syntad i webbläsaren i [`src/sfx.ts`](src/sfx.ts)). Matadorerna och tjurarna finns i [`src/matadors.ts`](src/matadors.ts) och [`src/bull.ts`](src/bull.ts), arenan
och vägen dit i [`src/arena.ts`](src/arena.ts) och själva tjurfäktningen i [`src/corrida.ts`](src/corrida.ts).
`?tjuren` i adressen hoppar rakt in; `jul.corrida.jumpTo(3)` i konsolen går direkt till Ferdinand. Andra gången kan
du hoppa över filmsnuttarna med `Enter`.

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
- **I arenan:** `W A S D` gå, mus titta, håll vänster musknapp (eller `F`) för skynket, `Shift`, högerklick eller
  dubbeltryck `A`/`D` hoppar åt sidan, `Mellanslag` hoppar upp, `Q` / `Esc` flyr fältet. På mobil: vänster tumme går,
  dra höger för att titta, knappar för skynket, sidohoppen och hoppet.
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
