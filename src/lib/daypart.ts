import { useEffect, useState } from 'react'

// Tomtens by follows the visitor's own clock: morning, day, evening or night.
export type Daypart = 'morgon' | 'dag' | 'kvall' | 'natt'

const PARTS: Daypart[] = ['morgon', 'dag', 'kvall', 'natt']

export const daypartFor = (hour: number): Daypart =>
  hour >= 5 && hour < 9 ? 'morgon' : hour >= 9 && hour < 15 ? 'dag' : hour >= 15 && hour < 22 ? 'kvall' : 'natt'

/** `?tid=dag` (or morgon/kvall/natt) previews a time of day for this visit; `?tid=auto` goes back to the clock. */
function override(): Daypart | null {
  try {
    const q = new URLSearchParams(location.search).get('tid')
    if (q === 'auto') sessionStorage.removeItem('tid')
    else if (q && (PARTS as string[]).includes(q)) sessionStorage.setItem('tid', q)
    const saved = sessionStorage.getItem('tid')
    return saved && (PARTS as string[]).includes(saved) ? (saved as Daypart) : null
  } catch {
    return null
  }
}

const current = () => override() ?? daypartFor(new Date().getHours())

export function useDaypart() {
  const [part, setPart] = useState<Daypart>(current)
  useEffect(() => {
    const id = setInterval(() => setPart(current()), 60_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.daypart = part
  }, [part])
  return part
}
