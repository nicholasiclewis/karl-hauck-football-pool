import { formatKickoff, countdownToKickoff, formatSpread, teamAbbr } from '../../lib/gameUtils'

/**
 * Single game card — handles open, locked, and completed states.
 *
 * Props:
 *   game       — game row from DB
 *   pick       — current user's pick for this game (or null)
 *   onPick     — fn(gameId, 'home'|'away')
 *   disabled   — week is not open
 */
export default function GameCard({ game, pick, onPick, disabled = false }) {
  const kickedOff  = new Date(game.kickoff_time) <= new Date()
  const isLocked   = kickedOff || pick?.is_locked
  const isComplete = game.result !== null

  const countdown = kickedOff ? null : countdownToKickoff(game.kickoff_time)

  const homeSpread = game.spread                 // e.g. -3.5 (home favored)
  const awaySpread = -game.spread                // e.g. +3.5
  const homeAbbr   = teamAbbr(game.home_team)
  const awayAbbr   = teamAbbr(game.away_team)

  // Outcome badges for completed picks
  const outcomeStyle = {
    win:  'text-green',
    loss: 'text-red',
    push: 'text-muted',
  }

  const hasPick     = !!pick
  const pickedHome  = pick?.picked_team === 'home'
  const pickedAway  = pick?.picked_team === 'away'

  return (
    <div
      className={`mx-4 mb-3 bg-card rounded-2xl border overflow-hidden transition-colors ${
        hasPick && !isLocked ? 'border-primary-light' : 'border-border'
      } ${isLocked && !isComplete ? 'opacity-60' : ''}`}
    >
      <div className="p-4">

        {/* ── Kickoff row ───────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-muted tracking-wide">
            {formatKickoff(game.kickoff_time)}
          </span>

          {isComplete ? (
            <span className="text-[11px] text-muted">Final</span>
          ) : isLocked ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-border text-muted border border-border2 text-[11px]">
              🔒 Locked
            </span>
          ) : countdown ? (
            <span className="text-[11px] text-muted">{countdown}</span>
          ) : null}
        </div>

        {/* ── Matchup ───────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">

          {/* Home team */}
          <div className="flex-1 flex flex-col items-center gap-1.5 text-center">
            <div className="w-11 h-11 rounded-full bg-bg border-2 border-border2 flex items-center justify-center">
              <span className="text-xs font-bold text-accent-text">{homeAbbr}</span>
            </div>
            <span className="text-sm font-bold text-white leading-tight">{game.home_team}</span>
            {isComplete && (
              <span className="text-lg font-bold text-white">{game.home_score ?? '—'}</span>
            )}
          </div>

          {/* Spread / VS column */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0 w-14">
            <div className="bg-bg border border-border2 rounded-lg px-2.5 py-1.5 text-center">
              <span className="block text-base font-bold text-primary-light">
                {formatSpread(homeSpread)}
              </span>
              <span className="block text-[9px] text-muted uppercase tracking-wide">Spread</span>
            </div>
            <span className="text-[11px] text-border2">@</span>
          </div>

          {/* Away team */}
          <div className="flex-1 flex flex-col items-center gap-1.5 text-center">
            <div className="w-11 h-11 rounded-full bg-bg border-2 border-border2 flex items-center justify-center">
              <span className="text-xs font-bold text-accent-text">{awayAbbr}</span>
            </div>
            <span className="text-sm font-bold text-white leading-tight">{game.away_team}</span>
            {isComplete && (
              <span className="text-lg font-bold text-white">{game.away_score ?? '—'}</span>
            )}
          </div>
        </div>

        {/* ── Pick buttons or locked state ──────────── */}
        {isLocked ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-bg rounded-lg border border-border">
            <span className="text-sm">🔒</span>
            <span className="text-sm text-muted flex-1">
              {hasPick ? 'Your pick:' : 'No pick made'}
            </span>
            {hasPick && (
              <span className={`text-sm font-bold ${isComplete ? outcomeStyle[pick.outcome] ?? 'text-accent-text' : 'text-accent-text'}`}>
                {pickedHome ? game.home_team : game.away_team}
                {' '}
                {pickedHome ? formatSpread(homeSpread) : formatSpread(awaySpread)}
                {isComplete && pick.outcome && (
                  <span className="ml-2 text-xs">
                    {pick.outcome === 'win' ? '✓ W' : pick.outcome === 'loss' ? '✗ L' : '~ P'}
                  </span>
                )}
              </span>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <PickBtn
              team={game.home_team}
              spread={formatSpread(homeSpread)}
              selected={pickedHome}
              disabled={disabled}
              onClick={() => onPick(game.id, 'home')}
            />
            <PickBtn
              team={game.away_team}
              spread={formatSpread(awaySpread)}
              selected={pickedAway}
              disabled={disabled}
              onClick={() => onPick(game.id, 'away')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function PickBtn({ team, spread, selected, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2.5 px-2 rounded-lg border-2 text-center transition-all disabled:cursor-not-allowed ${
        selected
          ? 'border-primary-light bg-primary/10 text-primary-light font-bold'
          : 'border-border bg-bg text-accent-text hover:border-primary-light hover:text-primary-light hover:bg-primary/5'
      }`}
    >
      <span className="block text-[13px] font-bold leading-tight">{team}</span>
      <span className="block text-[11px] opacity-70 mt-0.5">{spread}</span>
    </button>
  )
}
