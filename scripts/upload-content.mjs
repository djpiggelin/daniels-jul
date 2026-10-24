// Uploads this year's content to the Netlify Blobs store the site reads from.
//
//   npm run upload-content              uploads ./content
//   npm run upload-content -- --prune   …and removes blobs that no longer exist locally
//
// The folder looks like public/example/: content.json + photos/ + images/.
// Needs NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN (e.g. in a .env file, which is gitignored).

import { getStore } from '@netlify/blobs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const STORE = 'daniels-jul-content' // keep in sync with netlify/lib/store.mts
const MEDIA = /\.(png|jpe?g|webp|avif|gif)$/i

const args = process.argv.slice(2)
const prune = args.includes('--prune')
const dir = args.find((a) => !a.startsWith('--')) ?? 'content'

const fail = (msg) => {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

const { NETLIFY_SITE_ID: siteID, NETLIFY_AUTH_TOKEN: token } = process.env
if (!siteID || !token) fail('Sätt NETLIFY_SITE_ID och NETLIFY_AUTH_TOKEN (t.ex. i .env) – se README.')

async function walk(d) {
  const out = []
  for (const entry of await readdir(d, { withFileTypes: true })) {
    const p = join(d, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

if (!(await stat(dir).catch(() => null))?.isDirectory()) fail(`Hittar inte mappen ${dir}/`)

let content
try {
  content = JSON.parse(await readFile(join(dir, 'content.json'), 'utf8'))
} catch (err) {
  fail(`${dir}/content.json saknas eller är inte giltig JSON (${err.message})`)
}
if (typeof content.year !== 'number' || !Array.isArray(content.events) || !Array.isArray(content.guests))
  fail('content.json måste ha year (nummer), events (lista) och guests (lista)')

// personal invite links for the private events (the julbord) – see netlify/lib/invite.mts
const invites = Object.entries(content.invites ?? {})
const privateIds = content.events.filter((e) => e.private).map((e) => e.id)
for (const [code, inv] of invites) {
  if (!/^[\w-]{4,}$/.test(code)) fail(`Inbjudningskoden "${code}" ska vara minst 4 tecken: bokstäver, siffror, - och _`)
  if (typeof inv?.name !== 'string' || !Array.isArray(inv.events)) fail(`Inbjudan "${code}" behöver name och events`)
  const unknown = inv.events.filter((id) => !privateIds.includes(id))
  if (unknown.length) fail(`Inbjudan "${code}" (${inv.name}) pekar på ${unknown.join(', ')} – inget privat event med det id:t`)
  if (!content.guests.some((g) => g.name.toLowerCase() === inv.name.toLowerCase()))
    console.warn(`⚠ ${inv.name} (inbjudan "${code}") finns inte bland gästerna – får sitt namn men ingen bild`)
}
if (privateIds.length && !invites.length) console.warn(`⚠ ${privateIds.join(', ')} är privat men ingen är inbjuden`)

const files = (await walk(dir))
  .map((p) => relative(dir, p).split(sep).join('/'))
  .filter((key) => key === 'content.json' || MEDIA.test(key))

const referenced = [...content.events, ...(content.memories ?? [])].map((x) => x.image).concat(content.guests.map((g) => g.photo)).filter(Boolean)
const missing = referenced.filter((p) => !files.includes(p))
if (missing.length) fail(`content.json pekar på filer som saknas:\n  ${missing.join('\n  ')}`)

const store = getStore({ name: STORE, siteID, token })

for (const key of files) {
  const data = await readFile(join(dir, ...key.split('/')))
  await store.set(key, new Blob([data]))
  console.log(`↑ ${key}`)
}

if (prune) {
  const { blobs } = await store.list()
  for (const { key } of blobs.filter((b) => !files.includes(b.key))) {
    await store.delete(key)
    console.log(`✖ ${key}`)
  }
}

console.log(`✔ ${files.length} filer uppladdade till "${STORE}"`)
if (invites.length) {
  console.log('\nInbjudningslänkar (sätt sajtens adress framför):')
  for (const [code, inv] of invites) console.log(`  ${inv.name.padEnd(20)} /?inbjudan=${encodeURIComponent(code)}`)
}
