import type { ScoreEntry } from '../lib/api'

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ entries, highlight, loading, chalk }: { entries: ScoreEntry[] | null; highlight?: string; loading?: boolean; chalk?: boolean }) {
  const muted = chalk ? 'py-6 text-center text-xl text-[#f2efe6]/60' : 'py-6 text-center text-snow/60'
  if (loading || !entries) return <p className={muted}>Hämtar topplistan …</p>
  if (!entries.length) return <p className={muted}>Inga poäng ännu – bli först! ✨</p>

  if (chalk) {
    return (
      <ol className="text-xl">
        {entries.map((e, i) => (
          <li
            key={`${e.name}-${e.at}`}
            className={`flex items-baseline gap-3 border-b border-dashed border-[#f2efe6]/20 py-1.5 last:border-0 ${e.at === highlight ? 'text-jul-gold' : ''}`}
          >
            <span className="w-7 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
            <span className="flex-1 truncate">{e.name}</span>
            <span className="tabular-nums">{e.score}</span>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <ol className="space-y-1.5">
      {entries.map((e, i) => (
        <li
          key={`${e.name}-${e.at}`}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 ${e.at === highlight ? 'bg-jul-gold/25 ring-2 ring-jul-gold' : i < 3 ? 'bg-white/10' : 'bg-white/5'}`}
        >
          <span className="w-7 text-center font-display font-semibold">{MEDALS[i] ?? i + 1}</span>
          <span className="flex-1 truncate font-display font-semibold">{e.name}</span>
          <span className="font-display font-semibold tabular-nums text-jul-gold">{e.score}</span>
        </li>
      ))}
    </ol>
  )
}
