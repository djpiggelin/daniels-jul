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
// (only the album's guitar-only tracks: the rest have a band with drums and electric bass)
const SONGS = ['jingle-bells', 'away-in-a-manger', 'joy-to-the-world', 'o-holy-night', 'we-wish-you']
/** After Christmas, the new year's one too. */
const NEW_YEAR = 'auld-lang-syne'
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

  /** `quiet`: the choir has the square (the Lucia procession, the advent concert), so they rest and listen. */
  function update(t: number, player: THREE.Vector3, enabled: boolean, month: number, day: number, quiet: boolean) {
    const d = Math.hypot(player.x - BENCH.x, player.z - BENCH.z)
    // all December, and on into January until it all comes down
    const season = month === 12 || (month === 1 && day <= 13)
    const vol = enabled && season && !quiet && d < HEAR ? 0.55 * (1 - d / HEAR) ** 1.4 : 0
    if (vol > 0.003) {
      const list = SONGS.map((s) => `${DIR}${s}.mp3`)
      if (month === 1 || day >= 26) list.push(`${DIR}${NEW_YEAR}.mp3`)
      song.start(list)
      song.level(vol)
    } else if (song.playing) {
      song.level(0.0001)
      if (d > HEAR + 4 || !enabled || !season || quiet) song.stop()
    }
    g.visible = season
    // strumming along (and resting between songs), heads nodding to the beat
    const playing = song.playing && song.loudness() > 0.02
    players.forEach((n, i) => {
      const k = playing ? 1 : 0
      n.armR.rotation.x = -0.85 + Math.sin(t * (i ? 14 : 9)) * 0.18 * k
      n.armL.rotation.z = -0.75 + Math.sin(t * 1.3 + i) * 0.05 * k
      n.head.rotation.x = Math.sin(t * 4.4 + i) * 0.08 * k
      n.body.rotation.z = Math.sin(t * 2.2 + i * 2) * 0.03 * k
    })
  }
  const hush = () => {
    if (song.playing) song.stop()
  }
  return { group: g, colliders, solids, update, hush }
}
