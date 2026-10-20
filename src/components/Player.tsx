import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Building } from './Scenery'
import { blip } from '../lib/fx'
import { useSnowballs } from './Snowballs'

/*
 * A little villager you steer through Tomtens by with the keyboard on the front page.
 * ← → runs (keep holding for turbo), ↑ jumps – jump again in the air for a flip – and by a
 * door ↑ or Enter walks in. Hold space to wind up a snowball (the longer, the harder) and let
 * go to throw it. Everything moves in the village SVG's own units.
 */

export type PlayerDoor = {
  /** Matches the `data-door` on the building, so it can glow while you stand there. */
  id: string
  building: Building
  /** Where on the main path you stand to go in. */
  x: number
  /** The little path from the door down to the main path (quadratic, door first). */
  branch: string
  title: string
}

type At = { clientX: number; clientY: number }
type Anim = { door: PlayerDoor; dir: 'in' | 'out'; stage: number; t: number }
type Ball = { el: SVGCircleElement; shadow: SVGEllipseElement; x: number; y: number; vx: number; vy: number; trail: number }

const WALK = 165
const TURBO = 285
const ACCEL = 950
const BRAKE = 1300
const GRAVITY = 1400
const JUMP = 390
const JUMP2 = 340
const REACH = 24
// snowballs: a tap lobs one a few steps ahead, a full wind-up (CHARGE seconds) throws it far
const CHARGE = 1
const THROW_MIN = 150
const THROW_MAX = 540
const THROW_ANGLE = (38 * Math.PI) / 180
const BALL_GRAVITY = 760
const AIM_DOTS = 14
const SVGNS = 'http://www.w3.org/2000/svg'

// the door you last walked into, so you come back out of it
let lastDoor: string | undefined

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const quad = (d: string) => {
  const [x0, y0, cx, cy, x1, y1] = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  return (t: number) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1]
}
const KEY: Record<string, 'left' | 'right'> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }

export function Player({ doors, groundY, onEnter, startX = 520 }: { doors: PlayerDoor[]; groundY: (x: number) => number; onEnter: (b: Building, at: At) => void; startX?: number }) {
  const root = useRef<SVGGElement>(null)
  const body = useRef<SVGGElement>(null)
  const shadow = useRef<SVGEllipseElement>(null)
  const sign = useRef<SVGGElement>(null)
  const prints = useRef<SVGGElement>(null)
  const fx = useRef<SVGGElement>(null)
  const legA = useRef<SVGGElement>(null)
  const legB = useRef<SVGGElement>(null)
  const armA = useRef<SVGGElement>(null)
  const armB = useRef<SVGGElement>(null)
  const scarf = useRef<SVGGElement>(null)
  const pom = useRef<SVGGElement>(null)
  const eyes = useRef<SVGGElement>(null)
  const held = useRef<SVGCircleElement>(null)
  const meter = useRef<SVGGElement>(null)
  const meterFill = useRef<SVGRectElement>(null)
  const aim = useRef<SVGGElement>(null)
  const snow = useSnowballs()
  const snowRef = useRef(snow)
  snowRef.current = snow
  const enterRef = useRef(onEnter)
  enterRef.current = onEnter

  const [near, setNear] = useState<PlayerDoor | null>(null)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const svg = root.current!.ownerSVGElement!
    const back = doors.find((d) => d.id === lastDoor)
    const s = {
      x: back?.x ?? startX,
      vx: 0,
      h: 0,
      vh: 0,
      face: 1,
      jumps: 0,
      holding: false,
      flip: -1,
      squash: 0,
      run: 0,
      skid: false,
      phase: 0,
      air: 0,
      idle: 0,
      stride: 0,
      foot: 1,
      lean: 0,
      scarf: -78,
      pomX: 0,
      pomY: 0,
      nextPuff: 0,
      nextLine: 0,
      nextBreath: 2,
      nextBlink: 1.5,
      blinkUntil: 0,
      charging: false,
      power: 0,
      wind: 0,
      throwT: -1,
    }
    const balls: Ball[] = []
    let anim: Anim | null = back ? { door: back, dir: 'out', stage: 1, t: 0 } : null
    let nearId: string | undefined
    let lo = 14
    let hi = 1426
    let time = 0
    let last = -1
    let raf = 0
    const keys = new Set<string>()
    const timers = new Set<number>()

    // only the middle of the 1440-wide scene is on screen in a narrow window – stay inside it
    // (measured on the svg's box, which the zoom into a door doesn't scale)
    const box = svg.parentElement ?? svg
    const measure = () => {
      const w = box.clientWidth
      const h = box.clientHeight
      if (!w || !h) return
      const visible = w / Math.max(w / 1440, h / 460)
      lo = (1440 - visible) / 2 + 14
      hi = 1440 - lo
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)

    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id)
        fn()
      }, ms)
      timers.add(id)
    }
    const spawn = (layer: SVGGElement | null, tag: string, attrs: Record<string, string | number>, style: Record<string, string>, ms: number) => {
      if (!layer) return
      const el = document.createElementNS(SVGNS, tag)
      for (const k in attrs) el.setAttribute(k, String(attrs[k]))
      for (const k in style) el.style.setProperty(k, style[k])
      layer.appendChild(el)
      later(ms, () => el.remove())
    }
    const puff = (x: number, y: number, dx: number, dy: number, r = 2, dur = 0.6) =>
      spawn(fx.current, 'circle', { cx: x, cy: y, r, fill: '#f4f8ff', class: 'player-puff' }, { '--dx': `${dx}px`, '--dy': `${dy}px`, 'animation-duration': `${dur}s` }, dur * 1000 + 50)
    const burst = (x: number, y: number, n: number, power: number) => {
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1
        puff(x + side * 3, y - 1, side * (5 + Math.random() * 9) * power, -(2 + Math.random() * 6) * power, 1.6 + Math.random() * 1.4, 0.5 + Math.random() * 0.3)
      }
    }

    const screenPoint = (x: number, y: number): At => {
      const m = svg.getScreenCTM()
      if (!m) return { clientX: innerWidth / 2, clientY: innerHeight / 2 }
      const p = new DOMPoint(x, y).matrixTransform(m)
      return { clientX: p.x, clientY: p.y }
    }

    const jump = () => {
      if (anim) return
      if (s.h === 0) {
        s.vh = JUMP
        s.h = 0.01
        s.jumps = 1
        s.holding = true
        burst(s.x, groundY(s.x), 4, 0.7)
        blip(380, 0.09, 'triangle', 0.04)
      } else if (s.jumps < 2) {
        // second jump: a front flip
        s.vh = JUMP2
        s.jumps = 2
        s.flip = 0
        s.holding = false
        puff(s.x, groundY(s.x) - s.h, 0, 6, 3, 0.5)
        blip(620, 0.12, 'triangle', 0.04)
      }
    }
    // where the snowball leaves the hand, and how fast – shared by the aiming arc and the throw
    const hand = () => [s.x + s.face * 7, groundY(s.x) - s.h - 34]
    const launch = (power: number) => {
      const v = THROW_MIN + (THROW_MAX - THROW_MIN) * power
      return [s.face * v * Math.cos(THROW_ANGLE) + s.vx * 0.4, -v * Math.sin(THROW_ANGLE)]
    }
    const windUp = () => {
      if (anim || s.charging) return
      s.charging = true
      s.power = 0
      blip(300, 0.05, 'triangle', 0.025)
    }
    const throwBall = () => {
      if (!s.charging) return
      s.charging = false
      const [x, y] = hand()
      const [vx, vy] = launch(s.power)
      const shadowEl = document.createElementNS(SVGNS, 'ellipse')
      shadowEl.setAttribute('fill', '#1b2a44')
      prints.current?.appendChild(shadowEl)
      const el = document.createElementNS(SVGNS, 'circle')
      el.setAttribute('r', '2.8')
      el.setAttribute('class', 'player-ball')
      fx.current?.appendChild(el)
      balls.push({ el, shadow: shadowEl, x, y, vx, vy, trail: 0 })
      s.throwT = 0
      blip(240 + 360 * s.power, 0.12, 'triangle', 0.05)
      s.power = 0
    }
    const dropBall = (b: Ball) => {
      b.el.remove()
      b.shadow.remove()
      balls.splice(balls.indexOf(b), 1)
    }

    const enter = (door: PlayerDoor) => {
      if (anim) return
      anim = { door, dir: 'in', stage: 0, t: 1 }
      lastDoor = door.id
      keys.clear()
      s.charging = false
      blip(520, 0.1, 'triangle', 0.05)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      // a link or button you tabbed to keeps Enter/space – one that just got focus from a mouse click doesn't
      const control = t?.closest?.('button, a') as HTMLElement | null
      const onControl = !!control?.matches(':focus-visible')
      if (control && !onControl && (e.key === 'Enter' || e.key === ' ')) control.blur()
      const door = doors.find((d) => d.id === nearId)
      const k = e.key
      if (KEY[k]) {
        e.preventDefault()
        keys.add(KEY[k])
        setHint(false)
      } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        e.preventDefault()
        setHint(false)
        if (e.repeat) return
        if (door && s.h === 0) enter(door)
        else jump()
      } else if (k === ' ' && !onControl) {
        e.preventDefault()
        setHint(false)
        if (!e.repeat) windUp()
      } else if (k === 'ArrowDown') {
        e.preventDefault()
      } else if (k === 'Enter' && door && !onControl) {
        e.preventDefault()
        enter(door)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (KEY[e.key]) keys.delete(KEY[e.key])
      if (e.key === ' ') throwBall()
      // let go early for a little hop
      if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && s.holding) {
        s.holding = false
        if (s.vh > 120) s.vh *= 0.55
      }
    }
    const release = () => {
      keys.clear()
      s.charging = false
    }
    // coming back via the browser's back button may restore us mid-walk-in
    const onShow = () => {
      anim = null
      s.h = 0
      s.vh = 0
    }
    addEventListener('keydown', onKeyDown)
    addEventListener('keyup', onKeyUp)
    addEventListener('blur', release)
    addEventListener('pageshow', onShow)
    document.addEventListener('visibilitychange', release)

    const tick = (now: number) => {
      // rAF timestamps can trail the clock we started on – never step backwards
      const dt = last < 0 ? 0 : clamp((now - last) / 1000, 0, 0.05)
      last = now
      time += dt
      let px = s.x
      let py = groundY(s.x)
      let scale = 1
      let opacity = 1

      if (!anim) {
        const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)
        const turning = dir !== 0 && Math.sign(s.vx) === -dir
        // feet planted while winding up a throw – ← → just turns you to aim
        const planted = s.charging && s.h === 0
        const max = s.run > 0.9 ? TURBO : WALK
        const a = (dir === 0 || planted ? BRAKE * 0.8 : turning ? BRAKE : ACCEL) * (s.h > 0 ? 0.55 : 1)
        s.vx += clamp((planted ? 0 : dir * max) - s.vx, -a * dt, a * dt)
        if (dir) s.face = dir
        s.run = dir !== 0 && !turning && !planted ? s.run + dt : 0
        // skidding to turn around at speed
        if (turning && !planted && s.h === 0 && Math.abs(s.vx) > 140) {
          if (!s.skid) for (let i = 0; i < 5; i++) puff(s.x + s.face * 4, py - 1, s.face * (6 + Math.random() * 10), -(2 + Math.random() * 5), 1.8 + Math.random(), 0.55)
          s.skid = true
        } else s.skid = false
        s.x += s.vx * dt
        if (s.x < lo || s.x > hi) {
          s.x = clamp(s.x, lo, hi)
          s.vx = 0
          s.run = 0
        }
        px = s.x
        py = groundY(s.x)

        if (s.h > 0) {
          s.vh -= GRAVITY * dt
          s.h += s.vh * dt
          if (s.flip >= 0) {
            s.flip += dt * 900
            if (s.flip >= 360) s.flip = -1
          }
          if (s.h <= 0) {
            const impact = -s.vh
            s.h = 0
            s.vh = 0
            s.jumps = 0
            s.flip = -1
            s.squash = Math.min(1, impact / 480)
            burst(s.x, py, impact > 380 ? 8 : 5, impact > 380 ? 1.2 : 0.8)
            blip(150, 0.06, 'triangle', 0.035)
          }
        }
      } else {
        // walking in through a door, or back out of one
        const path = quad(anim.door.branch)
        s.h = Math.max(0, s.h - dt * 260)
        s.vh = 0
        s.flip = -1
        if (anim.stage === 0) {
          // first line up with the little path
          const d = anim.door.x - s.x
          const step = Math.sign(d) * Math.min(Math.abs(d), 230 * dt)
          s.x += step
          s.vx = step / dt
          if (d) s.face = Math.sign(d)
          px = s.x
          py = groundY(s.x)
          if (Math.abs(anim.door.x - s.x) < 0.5 && s.h === 0) {
            anim.stage = 1
            const [dx, dy] = path(0)
            enterRef.current(anim.door.building, screenPoint(dx, dy))
          }
        } else {
          const done = anim.dir === 'in' ? anim.t <= 0 : anim.t >= 1
          if (done && anim.dir === 'out') {
            s.x = anim.door.x
            s.vx = 0
            anim = null
            lastDoor = undefined
          } else {
            const t0 = anim.t
            anim.t = clamp(anim.t + (anim.dir === 'in' ? -dt : dt) / 0.6, 0, 1)
            const [ax, ay] = path(t0)
            const [bx, by] = path(anim.t)
            if (bx !== ax) s.face = Math.sign(bx - ax)
            s.vx = Math.hypot(bx - ax, by - ay) / dt
            px = bx
            py = by
            s.x = bx
            scale = 0.68 + 0.32 * anim.t
            opacity = anim.dir === 'in' ? clamp(anim.t / 0.35, 0, 1) : clamp(anim.t / 0.25, 0, 1)
          }
        }
      }

      // ---- pose -------------------------------------------------------
      const speed = Math.abs(s.vx)
      const speedN = Math.min(1, speed / WALK)
      const turbo = s.run > 0.9 && s.h === 0 && !anim
      const grounded = s.h === 0
      s.air += ((grounded ? 0 : 1) - s.air) * Math.min(1, dt * 14)
      s.idle = grounded && speedN < 0.03 && !anim ? s.idle + dt : 0
      s.squash = Math.max(0, s.squash - dt * 5)

      if (grounded) s.phase += speed * dt * 0.085
      const sw = Math.sin(s.phase) * speedN * (turbo ? 52 : 36)
      const rising = s.vh > 0
      const flipping = s.flip >= 0
      const flail = Math.sin(time * 26) * 16
      const waving = s.idle > 7
      const mix = (run: number, air: number) => run + (air - run) * s.air
      const lA = mix(-sw, flipping ? -70 : -38)
      const lB = mix(sw, flipping ? -55 : 24)
      let aA = waving ? -160 + Math.sin(time * 9) * 22 : mix(sw * 1.2, flipping ? -150 : rising ? -158 : -105 + flail)
      let aB = mix(-sw * 1.2, flipping ? -130 : rising ? -138 : -72 - flail)

      // winding up: arm cocked back with the snowball, the other one out front to aim, a bit of a crouch
      if (s.charging) s.power = Math.min(1, s.power + dt / CHARGE)
      const full = s.charging && s.power >= 1
      s.wind += ((s.charging ? 1 : 0) - s.wind) * Math.min(1, dt * 16)
      const shake = full ? Math.sin(time * 70) * 5 : 0
      aA += (150 + s.power * 15 + shake - aA) * s.wind
      aB += (-62 - aB) * s.wind
      // ...and the throw: whip the arm over the top, then settle back
      if (s.throwT >= 0) {
        s.throwT += dt
        const k = s.throwT
        aA = k < 0.07 ? 165 - 285 * (k / 0.07) : -120 + (aA + 120) * clamp((k - 0.07) / 0.28, 0, 1)
        if (k > 0.35) s.throwT = -1
      }
      const throwLean = s.throwT >= 0 ? 12 * (1 - s.throwT / 0.35) : 0

      const bob = grounded ? -Math.abs(Math.cos(s.phase)) * 2.2 * speedN : 0
      const leanTo = s.skid ? -12 : s.charging ? -4 - 4 * s.power : throwLean ? throwLean : grounded ? speedN * (turbo ? 11 : 6) : rising ? 4 : -3
      s.lean += (leanTo - s.lean) * Math.min(1, dt * 10)
      const scarfTo = -80 + speedN * (turbo ? 78 : 62) + (grounded ? 0 : rising ? 26 : -18) + Math.sin(time * 21) * 9 * speedN
      s.scarf += (scarfTo - s.scarf) * Math.min(1, dt * 9)
      s.pomX += (-speedN * 1.8 - s.pomX) * Math.min(1, dt * 10)
      s.pomY += (clamp(s.vh * 0.009, -3.2, 3.2) + Math.abs(Math.sin(s.phase)) * speedN * 1.4 - s.pomY) * Math.min(1, dt * 12)

      let sx = 1 + 0.22 * s.squash
      let sy = 1 - 0.28 * s.squash
      if (!grounded && rising) {
        const st = Math.min(0.1, (s.vh / JUMP) * 0.1)
        sy *= 1 + st
        sx *= 1 - st * 0.6
      }
      if (s.idle > 0) sy *= 1 + Math.sin(time * 2.6) * 0.015
      sy *= 1 - 0.07 * s.power * s.wind
      sx *= 1 + 0.03 * s.power * s.wind

      if (time > s.nextBlink) {
        s.blinkUntil = time + 0.12
        s.nextBlink = time + 2.5 + Math.random() * 3
      }

      // ---- effects ----------------------------------------------------
      if (grounded && speed > 40 && time > s.nextPuff) {
        s.nextPuff = time + (turbo ? 0.045 : 0.1)
        puff(px - s.face * 5, py - 1, -s.face * (5 + Math.random() * 8) * (turbo ? 1.5 : 1), -(2 + Math.random() * 5), turbo ? 2.4 : 1.8, 0.55)
      }
      if (turbo && time > s.nextLine) {
        s.nextLine = time + 0.06
        const ly = py - 8 - Math.random() * 30
        const lx = px - s.face * (12 + Math.random() * 6)
        spawn(fx.current, 'line', { x1: lx, y1: ly, x2: lx - s.face * 10, y2: ly, stroke: '#ffffff', 'stroke-width': 1.4, 'stroke-linecap': 'round', class: 'player-line' }, { '--dx': `${-s.face * 16}px` }, 360)
      }
      if (grounded && speed > 25 && !anim) {
        s.stride += speed * dt
        if (s.stride > 10) {
          s.stride = 0
          s.foot *= -1
          spawn(prints.current, 'ellipse', { cx: px + s.foot * 0.5, cy: py + 1 + s.foot * 1.6, rx: 1.7, ry: 0.9, fill: '#8197bd', class: 'player-print' }, {}, 6000)
        }
      }
      // frosty breath when standing still
      if (s.idle > 0.8 && time > s.nextBreath) {
        s.nextBreath = time + 2.4
        puff(px + s.face * 9, py - 33, s.face * 9, -6, 1.6, 1.4)
      }

      // ---- snowballs in flight ------------------------------------------
      for (const b of [...balls]) {
        b.vy += BALL_GRAVITY * dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        const g = groundY(b.x)
        b.el.setAttribute('cx', b.x.toFixed(2))
        b.el.setAttribute('cy', b.y.toFixed(2))
        const close = 1 - Math.min(1, (g - b.y) / 140)
        b.shadow.setAttribute('cx', b.x.toFixed(2))
        b.shadow.setAttribute('cy', (g + 0.6).toFixed(2))
        b.shadow.setAttribute('rx', (1.4 + 2 * close).toFixed(2))
        b.shadow.setAttribute('ry', (0.5 + 0.6 * close).toFixed(2))
        b.shadow.setAttribute('opacity', (0.08 + 0.17 * close).toFixed(2))
        if ((b.trail += dt) > 0.03) {
          b.trail = 0
          puff(b.x, b.y, -b.vx * 0.02, -b.vy * 0.02, 1.1, 0.35)
        }
        // whoever it hits on the way – nissar, the snowman – reacts like in the snowball fight
        const c = screenPoint(b.x, b.y)
        if (snowRef.current?.hitAt(c.clientX, c.clientY)) {
          dropBall(b)
          continue
        }
        if (b.vy > 0 && b.y >= g) {
          burst(b.x, g, 7, 1)
          spawn(prints.current, 'ellipse', { cx: b.x, cy: g + 0.6, rx: 3.6, ry: 1.3, fill: '#ffffff', class: 'player-lump' }, {}, 3000)
          blip(200, 0.07, 'triangle', 0.035)
          dropBall(b)
        } else if (b.x < lo - 60 || b.x > hi + 60) dropBall(b)
      }

      // the aiming arc while winding up: where the ball would go if you let go now
      if (aim.current) {
        aim.current.style.display = s.charging ? '' : 'none'
        if (s.charging) {
          let [x, y] = hand()
          let [vx, vy] = launch(s.power)
          const pts: number[][] = []
          for (let i = 0; i < 240; i++) {
            vy += BALL_GRAVITY / 120
            x += vx / 120
            y += vy / 120
            if (vy > 0 && y >= groundY(x)) {
              y = groundY(x)
              break
            }
            pts.push([x, y])
          }
          const dots = aim.current.children
          for (let i = 0; i < AIM_DOTS; i++) {
            const p = pts[Math.floor(((i + 1) / (AIM_DOTS + 1)) * pts.length)]
            const d = dots[i] as SVGCircleElement
            if (!p) {
              d.setAttribute('opacity', '0')
              continue
            }
            d.setAttribute('cx', p[0].toFixed(1))
            d.setAttribute('cy', p[1].toFixed(1))
            d.setAttribute('opacity', (0.95 - (i / AIM_DOTS) * 0.55).toFixed(2))
          }
          dots[AIM_DOTS]?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
        }
      }
      if (held.current) held.current.style.display = s.charging ? '' : 'none'
      if (meter.current) {
        meter.current.style.display = s.charging ? '' : 'none'
        meter.current.setAttribute('transform', `translate(${px.toFixed(2)} ${(py - s.h - 60).toFixed(2)})`)
        meter.current.style.opacity = full && Math.sin(time * 30) > 0 ? '0.55' : '1'
      }
      if (meterFill.current) {
        meterFill.current.setAttribute('width', (24 * s.power).toFixed(2))
        meterFill.current.setAttribute('fill', `hsl(${Math.round(120 - 120 * s.power)} 85% 52%)`)
      }

      // ---- write it all to the SVG -------------------------------------
      const tremble = full ? Math.sin(time * 90) * 0.5 : 0
      root.current?.setAttribute('transform', `translate(${(px + tremble).toFixed(2)} ${(py - s.h).toFixed(2)})`)
      if (root.current) root.current.style.opacity = String(opacity)
      body.current?.setAttribute(
        'transform',
        `translate(0 ${bob.toFixed(2)}) scale(${(s.face * sx * scale).toFixed(3)} ${(sy * scale).toFixed(3)}) rotate(${s.lean.toFixed(2)}) rotate(${Math.max(0, s.flip).toFixed(1)} 0 -24)`,
      )
      const lift = Math.min(1, s.h / 80)
      shadow.current?.setAttribute('transform', `translate(${px.toFixed(2)} ${(py + 0.5).toFixed(2)}) scale(${(1 - lift * 0.5) * scale} ${scale})`)
      if (shadow.current) shadow.current.style.opacity = String(0.2 * (1 - lift * 0.7) * opacity)
      sign.current?.setAttribute('transform', `translate(${px.toFixed(2)} ${(py - 64).toFixed(2)})`)
      // the sign stays put when you jump – get out of the way rather than collide with it
      if (sign.current) sign.current.style.opacity = String(clamp(1 - s.h / 22, 0, 1) * (1 - s.wind) * opacity)
      legA.current?.setAttribute('transform', `rotate(${lA.toFixed(1)} 0 -16)`)
      legB.current?.setAttribute('transform', `rotate(${lB.toFixed(1)} 0 -16)`)
      armA.current?.setAttribute('transform', `rotate(${aA.toFixed(1)} 0 -26.5)`)
      armB.current?.setAttribute('transform', `rotate(${aB.toFixed(1)} 0 -26.5)`)
      scarf.current?.setAttribute('transform', `rotate(${s.scarf.toFixed(1)} -3.5 -29)`)
      pom.current?.setAttribute('transform', `translate(${s.pomX.toFixed(2)} ${s.pomY.toFixed(2)})`)
      eyes.current?.setAttribute('transform', time < s.blinkUntil ? 'translate(0 -36) scale(1 0.12) translate(0 36)' : '')

      // which door you're standing at
      let best: PlayerDoor | undefined
      if (!anim) for (const d of doors) if (Math.abs(d.x - s.x) < REACH && (!best || Math.abs(d.x - s.x) < Math.abs(best.x - s.x))) best = d
      if (best?.id !== nearId) {
        if (nearId) svg.querySelector(`[data-door="${nearId}"]`)?.classList.remove('near')
        if (best) svg.querySelector(`[data-door="${best.id}"]`)?.classList.add('near')
        nearId = best?.id
        setNear(best ?? null)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      timers.forEach((id) => clearTimeout(id))
      if (nearId) svg.querySelector(`[data-door="${nearId}"]`)?.classList.remove('near')
      balls.forEach((b) => (b.el.remove(), b.shadow.remove()))
      removeEventListener('keydown', onKeyDown)
      removeEventListener('keyup', onKeyUp)
      removeEventListener('blur', release)
      removeEventListener('pageshow', onShow)
      document.removeEventListener('visibilitychange', release)
    }
  }, [doors, groundY, startX])

  return (
    <g pointerEvents="none" aria-hidden>
      <defs>
        <pattern id="player-scarf" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="4" height="4" fill="#e5383b" />
          <rect width="1.6" height="4" fill="#fbf7ef" />
        </pattern>
      </defs>
      <g ref={prints} />
      <ellipse ref={shadow} cx="0" cy="0" rx="9" ry="2.2" fill="#1b2a44" />

      <g ref={root}>
        <g ref={body}>
          {/* back arm + back leg, a shade darker */}
          <g ref={armB}>
            <rect x="-2.2" y="-26.5" width="4.4" height="11" rx="2.2" fill="#177a75" />
            <circle cx="0" cy="-15" r="2.5" fill="#b52a2d" />
          </g>
          <g ref={legB}>
            <rect x="-2.6" y="-17" width="5.2" height="13.5" rx="2.4" fill="#223258" />
            <path d="M-3 -4.6 h5.4 q4.4 0 4.6 3.2 q0 1.6 -1.6 1.6 h-8.4 z" fill="#3e2416" />
          </g>
          <g ref={legA}>
            <rect x="-2.6" y="-17" width="5.2" height="13.5" rx="2.4" fill="#2c3f6e" />
            <path d="M-3 -4.6 h5.4 q4.4 0 4.6 3.2 q0 1.6 -1.6 1.6 h-8.4 z" fill="#5a3320" />
            <path d="M-3 -2 h9.6" stroke="#fbf7ef" strokeWidth="0.6" opacity="0.5" />
          </g>

          {/* puffy jacket */}
          <path d="M-7.6 -12.5 Q-8.8 -22 -6 -28.4 Q0 -31.2 6 -28.4 Q8.8 -22 7.6 -12.5 Q0 -10.4 -7.6 -12.5 Z" fill="#1f9e98" />
          <path d="M-8 -17.6 Q0 -15.6 8 -17.6 M-7.4 -23 Q0 -21 7.4 -23" stroke="#167a75" strokeWidth="0.9" fill="none" />
          <path d="M3.4 -28 Q4.4 -20 3.6 -11.6" stroke="#e8f6f5" strokeWidth="0.7" fill="none" opacity="0.8" />
          <ellipse cx="-3.4" cy="-24.6" rx="2" ry="1.2" fill="#ffffff" opacity="0.25" />

          {/* candy-cane scarf: the tail streams out behind when running */}
          <g ref={scarf}>
            <path d="M-3.5 -29.5 Q-9 -28.6 -15 -27 L-14.2 -23.6 Q-8.6 -25.4 -3 -26.8 Z" fill="url(#player-scarf)" />
            <path d="M-14.8 -27 l-2 0.8 M-14.5 -25.3 l-2.2 0.7 M-14.2 -23.8 l-2 0.9" stroke="#fbf7ef" strokeWidth="0.8" strokeLinecap="round" />
          </g>
          <path d="M-6.4 -28.4 Q0 -25.2 6.6 -28.4 L6.6 -31.4 Q0 -28.4 -6.4 -31.4 Z" fill="url(#player-scarf)" />

          {/* head */}
          <path d="M-6.6 -36.6 q-1.8 3.4 -0.4 5.8 q1 -2.2 2.8 -2.4 Z" fill="#7a4a26" />
          <circle cx="1" cy="-35.4" r="7.6" fill="#f7d4bc" />
          <circle cx="4.6" cy="-32.8" r="1.9" fill="#f29a8a" opacity="0.7" />
          <g ref={eyes}>
            <circle cx="3.4" cy="-36.2" r="0.95" fill="#2a1d1a" />
            <circle cx="6.6" cy="-36" r="0.85" fill="#2a1d1a" />
          </g>
          <circle cx="8.4" cy="-34.4" r="1.25" fill="#f2a08a" />
          <path d="M3.8 -31.8 Q5.6 -30.4 7.2 -32" stroke="#7a3a2a" strokeWidth="0.7" fill="none" strokeLinecap="round" />

          {/* bobble hat */}
          <path d="M-7.2 -37.4 Q-7.8 -46.6 1 -47 Q9.8 -46.6 9.2 -37.4 Z" fill="#f6c453" />
          <path d="M-3 -46 Q-2.6 -42 -2.6 -39 M1 -47 V-39 M5 -46 Q5.2 -42 5.2 -39" stroke="#e0a92e" strokeWidth="0.7" fill="none" />
          <rect x="-8.2" y="-40.2" width="18.4" height="4.4" rx="2.2" fill="#e5383b" />
          <path d="M-7 -38 h16" stroke="#fbf7ef" strokeWidth="0.8" strokeDasharray="1.4 1.4" />
          <g ref={pom}>
            <circle cx="0.8" cy="-49.2" r="3.5" fill="#fffaf0" />
            <circle cx="-0.3" cy="-50.3" r="1.2" fill="#ffffff" />
          </g>

          {/* front arm */}
          <g ref={armA}>
            <rect x="-2.2" y="-26.5" width="4.4" height="11" rx="2.2" fill="#22b0a9" />
            <circle ref={held} cx="0" cy="-13.4" r="2.8" className="player-ball" style={{ display: 'none' }} />
            <circle cx="0" cy="-15" r="2.5" fill="#e5383b" />
          </g>
        </g>
      </g>

      <g ref={aim} style={{ display: 'none' }}>
        {Array.from({ length: AIM_DOTS }, (_, i) => (
          <circle key={i} r={1.7 - i * 0.04} fill="#ffffff" stroke="#24375a" strokeWidth="0.8" />
        ))}
        {/* where it lands */}
        <g>
          <ellipse rx="5" ry="1.8" fill="none" stroke="#e5383b" strokeWidth="0.9" strokeDasharray="1.6 1.2" />
          <ellipse rx="1.4" ry="0.6" fill="#e5383b" />
        </g>
      </g>

      <g ref={fx} />

      {/* how hard you'll throw */}
      <g ref={meter} style={{ display: 'none' }}>
        <rect x="-13.5" y="-3" width="27" height="6" rx="3" fill="#0d1a2e" fillOpacity="0.6" stroke="#ffffff" strokeWidth="0.7" />
        <rect ref={meterFill} x="-12" y="-1.6" width="0" height="3.2" rx="1.6" />
        <circle cx="-17.5" cy="0" r="2.6" className="player-ball" />
      </g>

      <g ref={sign}>
        <g className="player-float">
          {near ? <Sign key={near.id} text={near.title} keycap="↑" /> : hint ? <Sign key="hint" text="← → spring · ↑ hoppa · håll space: snöboll" /> : null}
        </g>
      </g>
    </g>
  )
}

/** A little wooden sign above the villager's head, in the same style as the house signs. */
function Sign({ text, keycap }: { text: string; keycap?: string }) {
  const label = useRef<SVGTextElement>(null)
  const [w, setW] = useState(text.length * 3.6)
  useLayoutEffect(() => {
    if (label.current) setW(label.current.getComputedTextLength())
  }, [text])
  const cap = keycap ? 12 : 0
  const total = w + cap + 12
  const left = -total / 2
  return (
    <g className="player-sign">
      <rect x={left} y="-12.5" width={total} height="13" rx="3" fill="#fff3dc" stroke="#5a3b22" strokeWidth="0.6" />
      <path d="M-3.2 0.4 L0 4 L3.2 0.4" fill="#fff3dc" stroke="#5a3b22" strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M-3.4 0 H3.4" stroke="#fff3dc" strokeWidth="1.2" />
      {keycap && (
        <g transform={`translate(${left + 5} -10.4)`}>
          <rect width="9.4" height="8.8" rx="1.8" fill="#ffffff" stroke="#a92529" strokeWidth="0.7" />
          <text x="4.7" y="6.6" textAnchor="middle" fontFamily="DM Sans, system-ui, sans-serif" fontSize="7" fontWeight="700" fill="#a92529">
            {keycap}
          </text>
        </g>
      )}
      <text ref={label} x={left + 6 + cap} y="-3.4" fontFamily="Fraunces, Georgia, serif" fontSize="7" fontWeight="700" fill="#a92529">
        {text}
      </text>
    </g>
  )
}
