import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { closeEmbed } from '../lib/embed'

/** The page on its own – no header, snow or footer – for showing inside the 3D village. */
export function EmbeddedLayout() {
  useEffect(() => {
    // Esc goes back to the village, unless the page used it (e.g. to stop drawing a piece)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeEmbed()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  return (
    <main className="min-h-dvh">
      <Outlet />
    </main>
  )
}
