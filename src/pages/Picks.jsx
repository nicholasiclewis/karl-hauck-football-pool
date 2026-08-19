import { useState, useEffect } from 'react'
import TopNav from '../components/layout/TopNav'
import BottomNav from '../components/layout/BottomNav'
import GameCard from '../components/picks/GameCard'
import PickSummary from '../components/picks/PickSummary'
import PointsPreview from '../components/picks/PointsPreview'
import { useAuth } from '../hooks/useAuth'
import { useWeek } from '../hooks/useWeek'
import { usePicks } from '../hooks/usePicks'
import { calcProjectedPoints, countdownToKickoff, formatKickoff } from '../lib/gameUtils'
import { remainingPicks } from '../lib/gameSelection'

export default function Picks() {
  const { user } = useAuth()
  const { week, games, loading: weekLoading, error: weekError } = useWeek()
  const { picks, loading: picksLoading, error: picksError, makePick, removePick, clearPicks } = usePicks(week?.id)
  const [pickError, setPickError] = useState('')

  // Player lock — the player's own "don't let me fat-finger this" freeze,
  // distinct from the hard per-game lock at kickoff. It only guards taps, so
  // it lives on the device rather than in the database.
  const lockKey = user && week ? `pick-lock:${user.id}:${week.id}` : null
  const [lockedIn, setLockedIn] = useState(false)

  useEffect(() => {
    setLockedIn(lockKey ? localStorage.getItem(lockKey) === '1' : false)
  }, [lockKey])

  const loading = weekLoading

  // Split games into NFL and college sections
  const nflGames     = games.filter((g) => g.sport === 'nfl')
  const collegeGames = games.filter((g) => g.sport === 'college')

  // Every eligible game is offered; each player picks their own slate, capped
  // per sport. Count what's used by joining picks back to their games.
  const pickedGames = games.filter((g) => picks[g.id])
  const { used, limits, remaining, complete } = remainingPicks(pickedGames, week?.container_type)

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
    if (lockedIn) return   // buttons are disabled too; belt and braces
    setPickError('')
    try {
      // Tapping the side you already picked retracts it — that's how you free
      // a slot when you're at the cap and want a different game.
      if (picks[gameId]?.picked_team === side) {
        await removePick(gameId)
        return
      }

      // Changing sides on a game you already picked doesn't use a new slot.
      if (!picks[gameId]) {
        const sport = games.find((g) => g.id === gameId)?.sport
        if (sport && remaining[sport] === 0) {
          setPickError(
            `You've already picked ${limits[sport]} ${sport === 'nfl' ? 'NFL' : 'college'} ` +
            `game${limits[sport] === 1 ? '' : 's'}. Tap one of them to swap it out.`
          )
          return
        }
      }

      await makePick(gameId, side)
    } catch (err) {
      setPickError(err.message)
    }
  }

  /** A game is out of reach when it's unpicked and that sport is full. */
  function atCap(game) {
    return !picks[game.id] && remaining[game.sport] === 0
  }

  // Only picks on games that haven't started can be retracted, so the button
  // stays hidden once everything is locked rather than offering a no-op.
  const clearableCount = pickedGames.filter(
    (g) => new Date(g.kickoff_time) > new Date()
  ).length

  async function handleClearAll() {
    if (!confirm(
      `Clear ${clearableCount} pick${clearableCount === 1 ? '' : 's'} for this week?\n\n` +
      'You can pick again until each game kicks off.'
    )) return

    setPickError('')
    try {
      const { kept } = await clearPicks()
      if (kept > 0) {
        setPickError(
          `${kept} pick${kept === 1 ? '' : 's'} could not be cleared — ` +
          `${kept === 1 ? 'that game has' : 'those games have'} already started.`
        )
      }
    } catch (err) {
      setPickError(err.message)
    }
  }

  function handleToggleLock() {
    if (!lockKey) return
    if (lockedIn) {
      localStorage.removeItem(lockKey)
      setLockedIn(false)
      return
    }
    // Locking an unfinished slate is allowed, but flag it — it's more often a
    // player who forgot a pick than one guarding a deliberate short slate.
    if (!complete && !confirm(
      `You've made ${picksCount} of ${limits.nfl + limits.college} picks. Lock in anyway?\n\n` +
      'You can come back, unlock, and finish your slate before kickoff.'
    )) return
    localStorage.setItem(lockKey, '1')
    setLockedIn(true)
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
      <div className="min-h-screen bg-bg pt-header pb-24">
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

  // The chip states the week's format, so it comes from the pick limits, not
  // from counting games: players now choose from every eligible game, so
  // counting produced "12 NFL · 8 CFB" instead of "4 NFL · 2 CFB".
  // College leads, matching how the slate is listed.
  const weekChip = [
    limits.college ? `${limits.college} CFB` : null,
    limits.nfl ? `${limits.nfl} NFL` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-bg pt-header pb-24">
      <TopNav />

      {/* ── Week Header ──────────────────────────────────────── */}
      <div
        className="border-b border-border pb-4"
        style={{ background: 'linear-gradient(135deg, #141e2e 0%, #1e293b 100%)' }}
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
          <ScoreItem
            value={`${picksCount}/${limits.nfl + limits.college}`}
            label="Picked"
            gold={complete}
          />
          <Divider />
          {limits.college > 0 && (
            <>
              <ScoreItem value={`${used.college}/${limits.college}`} label="College" />
              <Divider />
            </>
          )}
          {limits.nfl > 0 && (
            <>
              <ScoreItem value={`${used.nfl}/${limits.nfl}`} label="NFL" />
              <Divider />
            </>
          )}
          <ScoreItem value={projectedPts} label="Proj. Pts" gold />
        </div>

        {/* How many are still to make, or confirmation they're all in */}
        <p className="text-[11px] text-center mt-2 px-4" style={{ color: lockedIn || complete ? '#10b981' : '#94afd4' }}>
          {lockedIn
            ? '🔒 Picks locked in — unlock in the summary below to make changes'
            : complete
            ? '✓ All picks in — lock them in below so a stray tap can\'t change them'
            : `Choose ${[
                remaining.college > 0 ? `${remaining.college} more college` : null,
                remaining.nfl > 0 ? `${remaining.nfl} more NFL` : null,
              ].filter(Boolean).join(' and ')} from ${games.length} games`}
        </p>

        {/* Start over. Hidden once every picked game has kicked off, since
            nothing could be retracted at that point, and while the slate is
            locked in, since the lock exists to prevent exactly this. */}
        {clearableCount > 0 && !lockedIn && (
          <div className="text-center mt-2">
            <button
              onClick={handleClearAll}
              disabled={!week.picks_open}
              className="text-[11px] text-muted underline hover:text-red disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1"
            >
              Clear all picks
            </button>
          </div>
        )}
      </div>

      {/* ── Pick summary + player lock ───────────────────────── */}
      <PickSummary
        games={games}
        picks={picks}
        total={limits.nfl + limits.college}
        lockedIn={lockedIn}
        canLock={week.picks_open && clearableCount > 0}
        onToggleLock={handleToggleLock}
      />

      {/* ── Pick error ───────────────────────────────────────── */}
      {pickError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red/10 border border-red/30 rounded-lg">
          <p className="text-red text-sm">{pickError}</p>
        </div>
      )}

      {/* ── College Games ────────────────────────────────────── */}
      {collegeGames.length > 0 && (
        <>
          <SectionHeader
            icon="🎓"
            title="College Games"
            count={collegeGames.length}
            progress={limits.college > 0 ? `${used.college}/${limits.college} picked` : null}
          />
          {collegeGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              pick={picks[game.id] ?? null}
              onPick={handlePick}
              disabled={!week.picks_open || lockedIn || atCap(game)}
              capReached={atCap(game)}
              playerLocked={lockedIn}
            />
          ))}
        </>
      )}

      {/* ── NFL Games ────────────────────────────────────────── */}
      {nflGames.length > 0 && (
        <>
          <SectionHeader
            icon="🏈"
            title="NFL Games"
            count={nflGames.length}
            progress={limits.nfl > 0 ? `${used.nfl}/${limits.nfl} picked` : null}
          />
          {nflGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              pick={picks[game.id] ?? null}
              onPick={handlePick}
              disabled={!week.picks_open || lockedIn || atCap(game)}
              capReached={atCap(game)}
              playerLocked={lockedIn}
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
      <div className="text-[10px] uppercase tracking-wide text-muted mt-0.5">{label}</div>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-8 bg-border" />
}

function SectionHeader({ icon, title, count, progress = null }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-5 pb-2.5">
      <span className="text-[13px] tracking-widest uppercase text-muted">{icon} {title}</span>
      <div className="flex-1 h-px bg-border" />
      {progress && (
        <span className="text-[11px] text-primary-light font-semibold">{progress}</span>
      )}
      {count !== null && (
        <span className="text-[11px] text-muted">{count} GAME{count !== 1 ? 'S' : ''}</span>
      )}
    </div>
  )
}
