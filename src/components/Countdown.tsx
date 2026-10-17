import { countdown, useNow } from '../lib/time'

const UNITS = [
  ['days', 'dagar'],
  ['hours', 'timmar'],
  ['minutes', 'min'],
  ['seconds', 'sek'],
] as const

export function Countdown({ target, size = 'lg' }: { target: string; size?: 'lg' | 'sm' }) {
  const now = useNow()
  const c = countdown(target, now)
  const big = size === 'lg'

  return (
    <div className={`flex justify-center ${big ? 'gap-3 divide-x divide-white/10 sm:gap-4' : 'gap-1.5'}`} role="timer" aria-label={`${c.days} dagar kvar`}>
      {UNITS.map(([k, label]) => (
        <div
          key={k}
          className={`flex flex-col items-center ${big ? 'min-w-[3.5rem] sm:min-w-[4.5rem]' : 'min-w-[3.1rem] rounded-xl bg-night-950/40 px-1.5 py-1.5'}`}
        >
          <span
            className={`flip-digit font-medium leading-none ${big ? 'text-3xl text-white sm:text-4xl' : 'text-xl text-white'}`}
          >
            {String(c[k]).padStart(2, '0')}
          </span>
          <span className={`mt-1.5 uppercase tracking-wider text-snow/50 ${big ? 'text-[10px]' : 'text-[9px]'}`}>{label}</span>
        </div>
      ))}
    </div>
  )
}
