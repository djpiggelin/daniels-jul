import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Snow } from './Snow'
import { YEAR } from '../data'
import { useDaypart } from '../lib/daypart'
import { JULBORD } from '../lib/village'

const links = [
  { to: '/handelser', label: 'Händelser' },
  // (knytis is the julbord's – only for those invited)
  ...(JULBORD ? [{ to: '/knytis', label: 'Knytis' }] : []),
  { to: '/spel', label: 'Spel' },
]

export function Layout() {
  const { pathname } = useLocation()
  // the front page is one screen – the village – with nothing to scroll down to
  const home = pathname === '/handelser'
  useDaypart()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className={home ? 'relative h-dvh overflow-hidden' : 'relative min-h-dvh'}>
      <Snow density={pathname.startsWith('/spel/') ? 0.4 : 1} />

      <header
        className={`fixed inset-x-0 top-0 z-50 print:hidden transition-colors duration-300 ${
          scrolled ? 'border-b border-white/10 bg-night-950/80 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* a real page load – the front page is the 3D village, a separate app */}
          <a href="/" className="font-serif text-xl font-medium tracking-tight">
            Daniels Jul
          </a>
          <div className="flex items-center gap-5 text-sm sm:gap-8">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `relative py-1 transition-colors ${
                    isActive ? 'text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-jul-gold' : 'text-snow/65 hover:text-white'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      {!home && (
        <footer className="relative z-10 print:hidden bg-[#f7f9ff] px-4 pb-10 pt-4 text-center text-night-800">
          <p className="font-serif text-lg">God Jul & Gott Nytt År {YEAR + 1}</p>
          <p className="mt-1 text-sm opacity-60">Gjord med pepparkakor och kärlek av Daniel</p>
        </footer>
      )}
    </div>
  )
}
