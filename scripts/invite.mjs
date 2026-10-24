// Invites someone to the private events (the julbord): adds them to the guests if they aren't there
// yet (with their photo, if there's one in photos/ by their name) and gives them a code of their own
// in content/content.json. Then prints their link – upload with `npm run upload-content` after.
//
//   npm run invite -- "Lisa"
//   npm run invite -- "Lisa" --event julbord   only this event (default: every private event)
//
// Already invited? You get the link they already have. Links start with SITE_URL (e.g. in .env).

import { randomInt } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DIR = 'content'
const FILE = join(DIR, 'content.json')
// (no 0/o, 1/l/i – easy to read out loud)
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const SITE = (process.env.SITE_URL ?? '<sajten>').replace(/\/$/, '')

const fail = (msg) => {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const wanted = args.flatMap((a, i) => (args[i - 1] === '--event' ? [a] : []))
const name = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--event')?.trim().replace(/\s+/g, ' ')
if (!name) fail('Vem ska bjudas in? npm run invite -- "Namn"')
if (name.length > 24) fail('Namnet får vara högst 24 tecken (som i byn)')

const raw = await readFile(FILE, 'utf8').catch(() => fail(`Hittar inte ${FILE}`))
const content = JSON.parse(raw)
const privateIds = content.events.filter((e) => e.private).map((e) => e.id)
if (!privateIds.length) fail('Inget event har "private": true – det finns inget att bjuda in till')
const unknown = wanted.filter((id) => !privateIds.includes(id))
if (unknown.length) fail(`${unknown.join(', ')} är inget privat event (privata: ${privateIds.join(', ')})`)
const events = wanted.length ? wanted : privateIds

const same = (a, b) => a.toLowerCase() === b.toLowerCase()

// on the guest list – with their photo, if there's one by their name
let guest = content.guests.find((g) => same(g.name, name))
if (!guest) {
  const photo = (await readdir(join(DIR, 'photos')).catch(() => [])).find((f) => /\.(png|jpe?g|webp|avif|gif)$/i.test(f) && same(f.replace(/\.[^.]+$/, ''), name))
  guest = photo ? { name, photo: `photos/${photo}` } : { name }
  content.guests.push(guest)
  content.guests.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  console.log(`+ ${guest.name} på gästlistan${photo ? ` (med ${guest.photo})` : ' – utan bild, lägg den i photos/ och kör igen om du vill ha en'}`)
}

// a code of their own (or the one they already have, now for these events too)
const invites = content.invites ?? {}
let code = Object.keys(invites).find((c) => same(invites[c].name, guest.name))
if (code) {
  const added = events.filter((id) => !invites[code].events.includes(id))
  invites[code].events.push(...added)
  console.log(added.length ? `+ ${guest.name} är nu också bjuden på ${added.join(', ')}` : `= ${guest.name} var redan inbjuden`)
} else {
  do code = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  while (invites[code])
  invites[code] = { name: guest.name, events }
  console.log(`+ inbjudan till ${events.join(', ')}`)
}

// written back like before: invites right after events, one line each
const PLACEHOLDER = '"__invites__"'
const ordered = Object.fromEntries(
  Object.entries(content).flatMap(([k, v]) => (k === 'invites' ? [] : k === 'events' ? [[k, v], ['invites', '__invites__']] : [[k, v]])),
)
const lines = Object.entries(invites).map(([c, i]) => `    ${JSON.stringify(c)}: { "name": ${JSON.stringify(i.name)}, "events": [${i.events.map((e) => JSON.stringify(e)).join(', ')}] }`)
let text = JSON.stringify(ordered, null, 2).replace(PLACEHOLDER, `{\n${lines.join(',\n')}\n  }`) + '\n'
if (raw.includes('\r\n')) text = text.replace(/\n/g, '\r\n')
await writeFile(FILE, text)

// every link in one place (not uploaded – only content.json and pictures are)
const list = Object.entries(invites).map(([c, i]) => `${i.name.padEnd(12)} ${SITE}/?inbjudan=${c}`)
await writeFile(join(DIR, 'inbjudningslankar.txt'), ['Inbjudningslänkar – en per person, dela inte vidare.', '', ...list, ''].join('\n'))

console.log(`\n${guest.name}s länk:\n  ${SITE}/?inbjudan=${code}\n\nKör npm run upload-content så börjar den fungera.`)
