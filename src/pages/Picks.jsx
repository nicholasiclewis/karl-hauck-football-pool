import { useState } from 'react'
import TopNav from '../components/layout/TopNav'
import BottomNav from '../components/layout/BottomNav'
import GameCard from '../components/picks/GameCard'
import PointsPreview from '../components/picks/PointsPreview'
import { useWeek } from '../hooks/useWeek'
import { usePicks } from '../hooks/usePicks'
import { weekChipLabel, calcProjectedPoints, countdownToKickoff, formatKickoff } from '../lib/gameUtils'

export default function Picks() {
  const { week, games, loading: weekLoading, error: weekError } = useWeek()
  const { picks, loading: picksLoading, error: picksError, makePick } = usePicks(week?.id)
  const [pickError, setPickError] = useState('')

  const loading = weekLoading

  // Split games into NFL and college sections
  const nflGames     = games.filter((g) => g.sport === 'nfl')
  const collegeGames = games.filter((g) => g.sport === 'college')

  // Score bar calculations
  const picksCount     = Object.keys(picks).length
  const projectedPts   = calcProjectedPoints(picks, games, week?.container_type)

  // Next lock = soonest kickoff among unplayed games
  const upcomingGames  = games.filter((g) => new Date(g.kickoff_time) > new Date())
  const nextKickoff    = upcomingGames.sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))[0]
  const nextLockStr    = nextKickoff
    ? formatKickoff(nextKickoff.kickoff_time).split(' · ').slice(0, 2).join(' ')  // "THU · OCT 17"
    + ' · ' + formatKickoff(nextKickoff.kickoff_time).split(' · ')[2]             // "8:15 PM ET"
    : null

  async function handlePick(gameId, side) {
    setPickError('')
    try {
      await makePick(gameId, side)
    } catch (err) {
      setPickError(err.message)
    }
  }

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-bounce">🏈</span>
          <p className="text-muted text-sm">Loading picks...</p>
        </div>
      </div>
    )
  }

  // ── No active week ───────────────────────────────────────────
  if (!week) {
    return (
      <div className="min-h-screen bg-bg pt-14 pb-24">
        <TopNav />
        <div className="flex flex-col items-center justify-center mt-20 px-4 text-center">
          <span className="text-5xl mb-4">🏈</span>
          <h2 className="text-text font-bold text-lg mb-2">No Active Week</h2>
          <p className="text-muted text-sm">
            The commissioner hasn't opened picks for this week yet. Check back soon.
          </p>
        </div>
        <BottomNav />
      </div>
    )
  }

  const weekChip = weekChipLabel(games)

  return (
    <div className="min-h-screen bg-bg pt-14 pb-24">
      <TopNav />

      {/* ── Week Header ──────────────────────────────────────── */}
      <div
        className="border-b border-border pb-4"
        style={{ background: 'linear-gradient(135deg, #0f1320 0%, #111827 100%)' }}
      >
        {/* Week label row */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] tracking-[3px] text-primary-light uppercase">
              Week {week.week_number}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-primary/15 text-primary-light border border-primary/30 tracking-wide">
              {weekChip}
            </span>
          </div>
          {nextKickoff && (
            <div className="text-right">
              <p className="text-[11px] text-muted">Next lock</p>
              <p className="text-[11px] text-red font-bold">
                {formatKickoff(nextKickoff.kickoff_time).split(' · ').slice(1).join(' ')}
              </p>
            </div>
          )}
        </div>

        {/* Score bar */}
        <div className="mx-4 bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-2">
          <ScoreItem value={picksCount}           label="Picked"      />
          <Divider />
          <ScoreItem value={games.length}         label="Total Games" />
          <Divider />
          <ScoreItem value={projectedPts}         label="Proj. Pts"   gold />
          <Divider />
          <ScoreItem value={8}                    label="Max Pts"     />
        </div>
      </div>

      {/* ── Pick error ───────────────────────────────────────── */}
      {pickError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red/10 border border-red/30 rounded-lg">
          <p className="text-red text-sm">{pickError}</p>
        </div>
      )}

      {/* ── NFL Games ────────────────────────────────────────── */}
      {nflGames.length > 0 && (
        <>
          <SectionHeader icon="🏈" title="NFL Games" count={nflGames.length} />
          {nflGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              pick={picks[game.id] ?? null}
              onPick={handlePick}
              disabled={!week.picks_open}
            />
          ))}
        </>
      )}

      {/* ── College Games ────────────────────────────────────── */}
      {collegeGames.length > 0 && (
        <>
          <SectionHeader icon="🎓" title="College Games" count={collegeGames.length} />
          {collegeGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              pick={picks[game.id] ?? null}
              onPick={handlePick}
              disabled={!week.picks_open}
            />
          ))}
        </>
      )}

      {/* ── Points Preview ───────────────────────────────────── */}
      {picksCount > 0 && (
        <>
          <SectionHeader icon="📊" title="Points Tracker" count={null} />
          <PointsPreview week={week} games={games} picks={picks} />
        </>
      )}

      <BottomNav />
    </div>
  )
}

// ── Small helper components ─────────────────────────────────────

function ScoreItem({ value, label, gold = false }) {
  return (
    <div className="flex-1 text-center">
      <div className={`text-xl font-bold ${gold ? 'text-primary-light' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-border2 mt-0.5">{label}</div>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-8 bg-border" />
}

function SectionHeader({ icon, title, count }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-5 pb-2.5">
      <span className="text-[13px] tracking-widest uppercase text-muted">{icon} {title}</span>
      <div className="flex-1 h-px bg-border" />
      {count !== null && (
        <span className="text-[11px] text-border2">{count} GAME{count !== 1 ? 'S' : ''}</span>
      )}
    </div>
  )
}
