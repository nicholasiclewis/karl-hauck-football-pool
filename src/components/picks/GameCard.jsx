import { formatKickoff, countdownToKickoff, formatSpread, teamAbbr } from '../../lib/gameUtils'
import TeamLogo from '../ui/TeamLogo'
import RankBadge from '../ui/RankBadge'

/**
 * Single game card — handles open, locked, and completed states.
 *
 * Props:
 *   game         — game row from DB
 *   pick         — current user's pick for this game (or null)
 *   onPick       — fn(gameId, 'home'|'away'); tapping the picked side retracts it
 *   disabled     — week is not open, or this game is out of reach
 *   capReached   — unpicked and this sport's limit is already used up
 *   playerLocked — the player locked their slate; buttons freeze until they unlock
 *   homeRank     — AP rank of the home team, or null when unranked
 *   awayRank     — AP rank of the away team, or null when unranked
 */
export default function GameCard({ game, pick, onPick, disabled = false, capReached = false, playerLocked = false, live = null, homeRank = null, awayRank = null }) {
  const kickedOff  = new Date(game.kickoff_time) <= new Date()
  const isLocked   = kickedOff || pick?.is_locked
  const isComplete = game.result !== null

  // A game on the field right now, per ESPN. Only used to display a score and
  // a clock — the pick stays ungraded until the sync writes a real final, so
  // a team ahead at halftime never shows as a win.
  const isLive = !isComplete && live?.state === 'in'

  // Over on the scoreboard, not yet written by the sync. Without this the
  // score a player just watched for three hours vanishes at the final whistle
  // and reappears minutes later — the card keeps showing it, labeled Final,
  // while the W/L badge still waits for the real grading.
  const justEnded = !isComplete && live?.state === 'post'

  // Scores come from the database once the game is settled; before that, from
  // the live feed if it has them.
  const showScore = isComplete || isLive || justEnded
  const homeScore = isComplete ? game.home_score : live?.home_score
  const awayScore = isComplete ? game.away_score : live?.away_score

  const countdown = kickedOff ? null : countdownToKickoff(game.kickoff_time)

  // On the board before its line posted. The schedule is free to look up and
  // arrives a day before the odds, so the week shows who is playing while the
  // numbers are still being set — but there is nothing here to pick yet.
  const noLine = game.spread === null || game.spread === undefined

  const homeSpread = noLine ? null : game.spread   // e.g. -3.5 (home favored)
  const awaySpread = noLine ? null : -game.spread  // e.g. +3.5
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
      } ${isLocked && !showScore ? 'opacity-60' : ''} ${
        (capReached || (playerLocked && !hasPick)) && !isLocked ? 'opacity-50' : ''
      }`}
    >
      <div className="p-4">

        {/* ── Kickoff row ───────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-muted tracking-wide">
            {formatKickoff(game.kickoff_time)}
          </span>

          {isComplete || justEnded ? (
            <span className="text-[11px] text-muted">Final</span>
          ) : isLive ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red/10 text-red border border-red/40 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
              {live.detail}
            </span>
          ) : isLocked ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-border text-muted border border-border2 text-[11px]">
              🔒 Locked
            </span>
          ) : noLine ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(245,179,1,0.12)', color: '#f5b301' }}>
              Line to come
            </span>
          ) : countdown ? (
            <span className="text-[11px] text-muted">{countdown}</span>
          ) : null}
        </div>

        {/* ── Matchup ───────────────────────────────────
            Visitor on the left, host on the right, so the "@" between them
            reads the way the matchup is spoken: East Carolina @ Alabama. */}
        <div className="flex items-center gap-2 mb-4">

          <Side
            team={game.away_team} abbr={awayAbbr} sport={game.sport}
            rank={awayRank} score={awayScore} showScore={showScore}
            covered={game.result === 'away_covers'}
          />

          {/* Separator, sitting over the line it belongs to. The number is
              quoted for the home team, so the box names that team rather than
              saying "Spread" between two teams it could equally describe. */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0 w-14">
            <span className="text-[11px] text-muted">@</span>
            <div className="w-full bg-bg border border-border2 rounded-lg px-1 py-1.5 text-center">
              <span className="block text-base font-bold text-primary-light">
                {formatSpread(homeSpread)}
              </span>
              <span className="block text-[9px] text-muted uppercase tracking-wide truncate">
                {homeAbbr}
              </span>
            </div>
            {/* Nobody covered, so neither side goes green. Said out loud, or an
                unhighlighted final looks like a game the app forgot to grade. */}
            {game.result === 'push' && (
              <span className="text-[9px] font-bold text-muted uppercase tracking-wide">
                Push
              </span>
            )}
          </div>

          <Side
            team={game.home_team} abbr={homeAbbr} sport={game.sport}
            rank={homeRank} score={homeScore} showScore={showScore}
            covered={game.result === 'home_covers'}
          />
        </div>

        {/* ── Pick buttons, locked state, or no line yet ─ */}
        {noLine ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-bg rounded-lg border border-border">
            <span className="text-sm">⏳</span>
            <span className="text-sm text-muted flex-1 leading-snug">
              Line not posted yet — this game becomes pickable when it lands.
            </span>
          </div>
        ) : isLocked ? (
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
          <>
            <div className="flex gap-2">
              <PickBtn
                team={game.away_team}
                rank={awayRank}
                spread={formatSpread(awaySpread)}
                selected={pickedAway}
                disabled={disabled}
                onClick={() => onPick(game.id, 'away')}
              />
              <PickBtn
                team={game.home_team}
                rank={homeRank}
                spread={formatSpread(homeSpread)}
                selected={pickedHome}
                disabled={disabled}
                onClick={() => onPick(game.id, 'home')}
              />
            </div>
            {playerLocked ? (
              hasPick ? (
                <p className="text-[11px] text-muted text-center mt-2">
                  🔒 Locked in — unlock in the summary up top to make changes
                </p>
              ) : null
            ) : capReached ? (
              <p className="text-[11px] text-muted text-center mt-2">
                Limit reached — retract another pick to choose this one
              </p>
            ) : hasPick ? (
              <p className="text-[11px] text-muted text-center mt-2">
                Tap your pick again to retract it
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * One side of the matchup: crest, rank, name, and score once there is one.
 *
 * `covered` greens the side that beat the spread — everyone's, not just the
 * player's own pick, so the card answers "who covered?" at a glance. It keys
 * off game.result, which only the sync writes, so a team ahead on the live
 * scoreboard never goes green before the game is graded. The word carries the
 * meaning alongside the colour; green on its own says nothing to a player who
 * cannot see it.
 */
function Side({ team, abbr, sport, rank, score, showScore, covered = false }) {
  return (
    <div
      className={`flex-1 flex flex-col items-center gap-1.5 text-center rounded-lg px-1 py-1.5 transition-colors ${
        covered ? 'bg-green/10 ring-1 ring-green/40' : ''
      }`}
    >
      <TeamLogo team={team} sport={sport} abbr={abbr} />
      <span className={`text-sm font-bold leading-tight ${covered ? 'text-green' : 'text-white'}`}>
        <RankBadge rank={rank} />{team}
      </span>
      {showScore && (
        <span className={`text-lg font-bold ${covered ? 'text-green' : 'text-white'}`}>
          {score ?? '—'}
        </span>
      )}
      {covered && (
        <span className="text-[9px] font-bold text-green uppercase tracking-wide">
          ✓ Covered
        </span>
      )}
    </div>
  )
}

function PickBtn({ team, rank, spread, selected, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 min-h-[52px] py-3 px-2 rounded-lg border-2 text-center transition-all disabled:cursor-not-allowed ${
        selected
          ? 'border-primary-light bg-primary/10 text-primary-light font-bold'
          : 'border-border bg-bg text-accent-text hover:border-primary-light hover:text-primary-light hover:bg-primary/5'
      }`}
    >
      <span className="block text-[13px] font-bold leading-tight line-clamp-2">
        <RankBadge rank={rank} />{team}
      </span>
      <span className="block text-[11px] opacity-80 mt-0.5">{spread}</span>
    </button>
  )
}
