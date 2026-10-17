import type { ScoreEntry } from '../lib/api'

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ entries, highlight, loading }: { entries: ScoreEntry[] | null; highlight?: string; loading?: boolean }) {
  if (loading || !entries) return <p className="py-6 text-center text-snow/60">Hämtar topplistan …</p>
  if (!entries.length) return <p className="py-6 text-center text-snow/60">Inga poäng ännu – bli först! ✨</p>
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
