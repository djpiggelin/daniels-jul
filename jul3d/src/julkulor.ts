// Twenty-four baubles hidden round the village – by the bird feeder, under the buskers' bench, out by the
// lake, among the pulkor, in Leksaksfabriken's yard, in Tomtegården, one hanging on the julgran among
// its own… Each one glints now and then, to be found. Which you've found is kept in your browser; find
// them all and a golden one hangs on the julgran for you. Kul-Kerstin by the julgran has hints.
import * as THREE from 'three'
import { Nisse } from './npc'
import { glowTexture } from './tex'
import { html, type Talk } from './ui'
import type { Circle } from './world'

/** Where each one is, and the hint for it. */
const SPOTS: { x: number; y: number; z: number; hint: string }[] = [
  { x: 0, y: 1.5, z: 2.6, hint: 'Den hänger bland kulorna på granen på torget – fast den hör inte dit.' },
  { x: 7.3, y: 0.25, z: 11.4, hint: 'Vid foten av julstämningsmätaren.' },
  { x: -6.4, y: 0.25, z: 19.7, hint: 'Bakom affischpelaren.' },
  { x: -23.0, y: 0.3, z: 20.3, hint: 'Vid husbilen – Kalle tappar saker hela tiden.' },
  { x: -3.2, y: 0.25, z: 24.6, hint: 'Vid skylten till Snögubbsbacken.' },
  { x: 8.0, y: 0.3, z: 45.2, hint: 'Bland pulkorna vid backens fot.' },
  { x: -95.2, y: 0.56, z: -1.0, hint: 'På en bänk vid Skridskosjöns bortre strand.' },
  { x: -72.6, y: 0.25, z: -13.0, hint: 'Vid resultattavlan vid sjön.' },
  { x: 27.8, y: 0.25, z: 33.1, hint: 'Under fågelbordet, bland fröna.' },
  { x: 30.6, y: 1.5, z: 31.0, hint: 'I björken vid fågelbordet – på en låg gren.' },
  { x: 3.55, y: 0.15, z: -34.4, hint: 'Under bänken där gitarrnissarna spelar.' },
  { x: -40.2, y: 0.25, z: 10.4, hint: 'Vid skylten mot Skridskosjön.' },
  { x: 3.3, y: 0.25, z: -42.0, hint: 'Längs stigen mot Leksaksfabriken, i kanten.' },
  { x: -9.0, y: 0.3, z: -55.5, hint: 'Bland paketen vid granen på fabriksgården.' },
  { x: -20.6, y: 0.25, z: -61.6, hint: 'Vid ett hörn av Paketlinjens skjul.' },
  { x: 14.8, y: 0.25, z: -1.4, hint: 'Vid julkalendern på torget.' },
  { x: 5.0, y: 0.25, z: 6.6, hint: 'Vid spelautomaterna.' },
  { x: -16.6, y: 0.25, z: -8.2, hint: 'Vid vitrinen med pepparkakshus utanför bageriet.' },
  { x: 6.0, y: 0.25, z: -38.0, hint: 'Där stigen till Tomtegården börjar.' },
  { x: 38.0, y: 0.25, z: -46.0, hint: 'Mitt på Tomtegårdens gård.' },
  { x: 19.5, y: 0.25, z: -14.0, hint: 'Bakom Julstugan.' },
  { x: -30.0, y: 0.25, z: 30.0, hint: 'I byns sydvästra utkant, där haren brukar sitta.' },
  { x: -12.0, y: 0.25, z: -14.0, hint: 'Vid destilleriets dörr.' },
  { x: 15.6, y: 0.25, z: 9.3, hint: 'Vid Arkitektkontorets trappa.' },
]
const COLORS = [0xc8102e, 0x1d8a4e, 0x2b5fa8, 0xf6c453, 0xb04ad8, 0xe0e0e0]
const KEY = () => `julkulor-${new Date().getFullYear()}`

function bauble(color: number, r = 0.11) {
  const g = new THREE.Group()
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.7 }))
  ball.castShadow = true
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.32, r * 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xd4a64a, roughness: 0.3, metalness: 0.85 }))
  cap.position.y = r * 1.0
  const hook = new THREE.Mesh(new THREE.TorusGeometry(r * 0.18, r * 0.04, 6, 10), cap.material)
  hook.position.y = r * 1.25
  g.add(ball, cap, hook)
  return g
}

type Ctx = { say: (text: string) => void; found: () => void }

export type Baubles = ReturnType<typeof buildBaubles>

export function buildBaubles(scene: THREE.Scene, ctx: Ctx) {
  const group = new THREE.Group()
  scene.add(group)
  const colliders: Circle[] = []
  const found = new Set<number>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(KEY()) ?? '[]') as number[]
      } catch {
        return []
      }
    })(),
  )
  const save = () => {
    try {
      localStorage.setItem(KEY(), JSON.stringify([...found]))
    } catch {
      /* fine */
    }
  }
  const glint = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,240,200,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  const balls = SPOTS.map((s, i) => {
    const b = bauble(COLORS[i % COLORS.length])
    b.position.set(s.x, s.y, s.z)
    const spark = new THREE.Sprite(glint.clone())
    spark.position.set(0.04, 0.05, 0.04)
    spark.scale.setScalar(0.4)
    b.add(spark)
    b.visible = !found.has(i)
    group.add(b)
    return { b, spark, phase: i * 1.7 }
  })
  // the golden one on the julgran: yours, when you've found them all
  const gold = bauble(0xf6c453, 0.22)
  gold.position.set(0, 5.6, 1.05)
  const goldGlow = new THREE.Sprite(glint.clone())
  goldGlow.scale.setScalar(1.2)
  gold.add(goldGlow)
  gold.visible = found.size >= SPOTS.length
  group.add(gold)

  // Kul-Kerstin, by the julgran, who knows where they are
  const kerstin = new Nisse({ coat: 0x7a3fa0, hat: 0xf6c453, trim: true, beard: false, ears: true, scale: 1.0 })
  kerstin.group.position.set(-4.6, 0, -6.4)
  kerstin.setYaw(Math.atan2(4.6, 6.4))
  scene.add(kerstin.group)
  colliders.push({ x: -4.6, z: -6.4, r: 0.35 })
  const talk: Talk = {
    name: 'Kul-Kerstin',
    avatar: '🎄',
    greeting: () => [
      html.p(
        found.size >= SPOTS.length
          ? 'Alla tjugofyra! Du är byns bästa kulletare. Titta upp i granen – den gyllene kulan där är din.'
          : `Någon har tappat julgranskulor över hela byn – tjugofyra stycken! Du har hittat ${found.size}. De glittrar till ibland, om man tittar noga.`,
      ),
    ],
    topics: [
      {
        label: '🔎 Ge mig en ledtråd',
        pages: () => {
          const left = SPOTS.map((s, i) => ({ s, i })).filter(({ i }) => !found.has(i))
          if (!left.length) return [html.p('Du har ju hittat allihop!')]
          const pick = left[Math.floor(Math.random() * left.length)]
          return [html.p(`Hmm… ${pick.s.hint}`)]
        },
      },
      {
        label: '✨ Vad händer när jag hittat alla?',
        pages: () => [html.p('Då hänger jag upp den gyllene kulan i granen på torget – åt dig. Den syns bara för den som hittat alla tjugofyra.')],
      },
    ],
    bye: 'Lycka till med letandet!',
  }

  function update(t: number, dt: number, player: THREE.Vector3) {
    kerstin.update(t, dt, player, false)
    for (const [i, x] of balls.entries()) {
      if (!x.b.visible) continue
      // a slow turn, and a glint every few seconds
      x.b.rotation.y = t * 0.6 + i
      const k = Math.max(0, Math.sin(t * 1.3 + x.phase) - 0.85) / 0.15
      x.spark.material.opacity = k
      x.spark.scale.setScalar(0.25 + k * 0.4)
    }
    goldGlow.material.opacity = 0.6 + Math.sin(t * 2) * 0.3
  }

  return {
    group,
    colliders,
    talker: { npc: kerstin, talk },
    moving: [kerstin.group],
    update,
    /** A bauble within reach, in front of you (its index), or −1. */
    near(pos: THREE.Vector3, fwd: THREE.Vector3) {
      let best = -1
      let bestD = 2.3
      for (const [i, s] of SPOTS.entries()) {
        if (found.has(i)) continue
        const dx = s.x - pos.x
        const dz = s.z - pos.z
        const d = Math.hypot(dx, dz)
        if (d < bestD && (d < 0.6 || (dx * fwd.x + dz * fwd.z) / d > 0.3)) {
          best = i
          bestD = d
        }
      }
      return best
    },
    pick(i: number) {
      if (found.has(i)) return
      found.add(i)
      save()
      balls[i].b.visible = false
      ctx.found()
      const n = found.size
      if (n >= SPOTS.length) {
        gold.visible = true
        ctx.say('🎄 Alla tjugofyra julkulor! Titta upp i granen på torget – den gyllene kulan är din!')
      } else ctx.say(`🎄 En julkula! ${n} av ${SPOTS.length}.${n === 1 ? ' Kul-Kerstin vid granen vet var fler finns.' : ''}`)
    },
    get count() {
      return found.size
    },
  }
}
