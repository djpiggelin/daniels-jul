import { useEffect, useMemo, useRef, useState } from 'react'
import { PARTICIPANTS } from '../data'
import { blip } from '../lib/fx'
import type { GameProps } from './shared'

type Card = { id: number; name: string; image: string }

const WITH_PHOTO = PARTICIPANTS.filter((p): p is { name: string; image: string } => !!p.image)
const PAIRS = Math.min(8, WITH_PHOTO.length)

const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export const memoryScore = (moves: number, seconds: number) => Math.max(50, 2000 - Math.max(0, moves - PAIRS) * 45 - seconds * 8)

export default function Tomtememory({ onScore, onOver }: GameProps) {
  const deck = useMemo<Card[]>(() => {
    const people = shuffle(WITH_PHOTO).slice(0, PAIRS)
    return shuffle(people.flatMap((p, i) => [{ id: i * 2, ...p }, { id: i * 2 + 1, ...p }]))
  }, [])
  const [open, setOpen] = useState<number[]>([])
  const [found, setFound] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const startedAt = useRef<number | null>(null)
  const done = found.size === PAIRS

  useEffect(() => {
    if (done) return
    const id = setInterval(() => {
      if (startedAt.current) setSeconds(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [done])

  useEffect(() => {
    onScore(memoryScore(moves, seconds))
  }, [moves, seconds, onScore])

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => onOver(memoryScore(moves, seconds)), 900)
      return () => clearTimeout(t)
    }
  }, [done])

  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || found.has(deck[i].name)) return
    startedAt.current ??= Date.now()
    blip(600, 0.05, 'triangle', 0.04)
    const next = [...open, i]
    setOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next.map((k) => deck[k])
      if (a.name === b.name) {
        setTimeout(() => {
          setFound((f) => new Set(f).add(a.name))
          setOpen([])
          blip(990, 0.15, 'triangle', 0.07)
        }, 350)
      } else {
        setTimeout(() => setOpen([]), 850)
      }
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-night-900 to-night-700 p-3 sm:p-5">
      <div className="mb-3 flex justify-between font-display text-lg">
        <span>🔄 {moves} drag</span>
        <span>⏱️ {seconds}s</span>
        <span className="text-jul-gold">⭐ {memoryScore(moves, seconds)}</span>
      </div>
      <div className="grid flex-1 grid-cols-4 content-center gap-2 sm:gap-3" style={{ perspective: 800 }}>
        {deck.map((c, i) => {
          const shown = open.includes(i) || found.has(c.name)
          const matched = found.has(c.name)
          return (
            <button
              key={c.id}
              onClick={() => flip(i)}
              className="relative aspect-square w-full"
              aria-label={shown ? c.name : 'Dolt kort'}
            >
              <span
                className="absolute inset-0 transition-transform duration-500"
                style={{ transformStyle: 'preserve-3d', transform: shown ? 'rotateY(180deg)' : 'none' }}
              >
                {/* back */}
                <span
                  className="candy-border absolute inset-0 flex items-center justify-center rounded-2xl text-3xl sm:text-4xl"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  🎄
                </span>
                {/* face */}
                <span
                  className={`absolute inset-0 overflow-hidden rounded-2xl bg-white ring-4 ${matched ? 'ring-jul-green' : 'ring-jul-gold'}`}
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <img src={c.image} alt="" className="h-full w-full object-cover" draggable={false} />
                  <span className="absolute inset-x-0 bottom-0 bg-night-950/70 text-center font-display text-[11px] font-semibold text-white sm:text-sm">{c.name}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
