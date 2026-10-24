// Two nissar on a bench by the path up to Leksaksfabriken, playing Christmas songs on a guitar and a
// banjo all through December (the guitar tracks from the U.S. Air Force Band of Mid-America's 2020
// Christmas album, public domain – see public/sounds/README.md). You hear them as you come along the path.
import * as THREE from 'three'
import { mergeRigid } from './batch'
import { Nisse } from './npc'
import { Playlist } from './sfx'
import { std } from './sleigh'
import type { Circle } from './world'

/** Where the bench stands: on the east side of the path, between two of its lanterns, facing across it. */
const BENCH = { x: 3.55, z: -34.7 }
const DIR = '/sounds/gitarr/'
/**
 * The set, in order, with each recording's length in seconds (the silence at their ends trimmed off).
 * Only the album's guitar-only tracks: the rest have a band with drums and electric bass.
 */
const SET: [string, number][] = [['jingle-bells', 118.8], ['away-in-a-manger', 116.58], ['joy-to-the-world', 123.92], ['o-holy-night', 131.87], ['we-wish-you', 117.19]]
/** After Christmas, the new year's one too. */
const NEW_YEAR: [string, number] = ['auld-lang-syne', 162.93]
/** A breath between songs (s). */
const BREATH = 4

/**
 * What they're playing at `sec` (seconds) on the village clock, the same for everyone in the
 * village (like the Lucia procession): the song and how far into it – or none, between two songs –
 * and which one is next.
 */
function onStage(sec: number, set: [string, number][]) {
  const cycle = set.reduce((sum, [, len]) => sum + len + BREATH, 0)
  let at = ((sec % cycle) + cycle) % cycle
  for (let i = 0; i < set.length; i++) {
    const [name, len] = set[i]
    const next = set[(i + 1) % set.length]
    if (at < len) return { name: name as string | null, at, left: len - at, next: next[0] }
    at -= len
    if (at < BREATH) return { name: null, at, left: BREATH - at, next: next[0] }
    at -= BREATH
  }
  return { name: null, at: 0, left: 0, next: set[0][0] }
}
const HEAR = 24

/** A guitar (or, `banjo`, a banjo) with its neck out along -x, the body at the origin. */
function instrument(banjo: boolean) {
  const g = new THREE.Group()
  const wood = std(0x9a5a2a, 0.5)
  const dark = std(0x2a1a10, 0.6)
  if (banjo) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20), std(0xb8b8c0, 0.3, 0.8))
    rim.rotation.x = Math.PI / 2
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), std(0xf2ead8, 0.8))
    head.position.z = 0.031
    g.add(rim, head)
  } else {
    for (const [x, r] of [[0.06, 0.17], [-0.12, 0.13]] as const) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), wood)
      lobe.scale.z = 0.3
      lobe.position.x = x
      g.add(lobe)
    }
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), std(0x0d0806, 0.9))
    hole.position.set(-0.04, 0, 0.052)
    g.add(hole)
  }
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.03), dark)
  neck.position.x = banjo ? -0.4 : -0.45
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.03), dark)
  top.position.x = banjo ? -0.69 : -0.74
  top.rotation.z = 0.25
  g.add(neck, top)
  return g
}

export function buildBuskers(scene: THREE.Scene) {
  const colliders: Circle[] = [{ x: BENCH.x + 0.2, z: BENCH.z, r: 1.05 }]
  const g = new THREE.Group()
  g.position.set(BENCH.x, 0, BENCH.z)
  // facing west, across the path
  g.rotation.y = -Math.PI / 2

  /* the bench, with snow on its back */
  const wood = std(0x6b4a2a, 0.8)
  const iron = std(0x1a1a20, 0.5, 0.5)
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.48), wood).translateY(0.45))
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.06), wood).translateY(0.74).translateZ(-0.22))
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.1), std(0xf4f8ff, 0.9)).translateY(0.97).translateZ(-0.22))
  for (const x of [-0.85, 0.85]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.46), iron).translateX(x).translateY(0.22))

  /* the open guitar case in the snow in front, a few coins in it */
  const caseG = new THREE.Group()
  caseG.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.38), std(0x1a1410, 0.7)).translateY(0.05))
  caseG.add(new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.02, 0.32), std(0x8a1424, 0.95)).translateY(0.09))
  const gold = new THREE.MeshStandardMaterial({ color: 0xf6c453, metalness: 0.8, roughness: 0.3 })
  for (let i = 0; i < 6; i++) caseG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.008, 10), gold).translateX(-0.3 + i * 0.11).translateY(0.105).translateZ(((i * 7) % 5) * 0.04 - 0.08))
  caseG.position.set(0.1, 0, 0.95)
  caseG.rotation.y = 0.15
  g.add(caseG)

  /* the two of them: a guitar on the left, a banjo on the right */
  const players = ([[-0.45, false, 0x2b5fa8, 0xc8102e], [0.45, true, 0x2fa36b, 0x2b5fa8]] as const).map(([x, banjo, coat, hat]) => {
    const n = new Nisse({ coat, hat, scale: 1.05, longBeard: banjo })
    n.sit(true)
    // (hips at 0.42 × 1.05: down on the seat)
    n.group.position.set(x, 0.05, 0.02)
    const inst = instrument(banjo)
    inst.position.set(0.02, 0.66, 0.3)
    inst.scale.setScalar(1.35)
    inst.rotation.set(0, 0, -0.38)
    n.body.add(inst)
    // the left hand up the neck, the right over the strings
    n.armL.rotation.set(-1.05, 0, -0.75)
    n.armR.rotation.set(-0.85, 0, -0.55)
    mergeRigid(n.group)
    g.add(n.group)
    return n
  })
  scene.add(g)

  const song = new Playlist(3)
  const solids = players.map((n) => n.group)
  // following the music: a strum on every beat the analyser hears, the hand settling between them
  const hands = players.map(() => ({ stroke: 0, dir: 1, at: -9 }))
  let slow = 0

  /**
   * `clock` is the village clock (ms), `quiet` when the choir has the square (the Lucia procession,
   * the advent concert): then they rest and listen.
   */
  function update(t: number, dt: number, player: THREE.Vector3, enabled: boolean, clock: number, quiet: boolean) {
    const date = new Date(clock)
    const month = date.getUTCMonth() + 1
    const day = date.getUTCDate()
    // all December, and on into January until it all comes down
    const season = month === 12 || (month === 1 && day <= 13)
    g.visible = season
    const set = month === 1 || day >= 26 ? [...SET, NEW_YEAR] : SET
    const now = onStage(clock / 1000, set)
    const on = season && !quiet && now.name !== null

    const d = Math.hypot(player.x - BENCH.x, player.z - BENCH.z)
    const vol = enabled && season && !quiet && d < HEAR ? 0.55 * (1 - d / HEAR) ** 1.4 : 0
    if (vol > 0.003) {
      song.level(vol)
      song.cue(now.name && `${DIR}${now.name}.mp3`, now.at)
      // the next one fetched in good time, so it starts on the dot
      if (now.left < 30) song.preload([`${DIR}${now.next}.mp3`])
    } else if (song.playing) {
      song.level(0.0001)
      if (d > HEAR + 4 || !enabled || !season || quiet) song.stop()
    }

    // a strum when the music jumps (out of earshot, a steady one as it would be)
    const loud = song.playing ? song.loudness() : 0
    const beat = song.playing ? loud > slow * 1.3 + 0.03 : on && Math.floor(t * 4) !== Math.floor((t - dt) * 4)
    slow += (loud - slow) * Math.min(1, dt * 3)
    players.forEach((n, i) => {
      const h = hands[i]
      if (on && beat && t - h.at > (i ? 0.09 : 0.14)) {
        h.at = t
        h.dir = -h.dir
      }
      // the stroke snaps across the strings, then the hand rests where it ended up
      h.stroke += ((on ? h.dir : 0) - h.stroke) * Math.min(1, dt * (i ? 30 : 22))
      const since = t - h.at
      n.armR.rotation.x = -0.85 + h.stroke * (i ? 0.1 : 0.17)
      n.armL.rotation.z = -0.75 + (on ? Math.sin(t * 1.3 + i) * 0.05 : 0)
      n.head.rotation.x = on ? Math.max(0, 1 - since / 0.3) * 0.09 : 0
      n.body.rotation.z = on ? Math.sin(t * 1.1 + i * 2) * 0.03 : 0
    })
  }
  const hush = () => {
    if (song.playing) song.stop()
  }
  return { group: g, colliders, solids, update, hush }
}
