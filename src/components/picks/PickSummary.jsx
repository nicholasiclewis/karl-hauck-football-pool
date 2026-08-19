import TeamLogo from '../ui/TeamLogo'
import { formatSpread, formatKickoff, teamAbbr, collegeFirst } from '../../lib/gameUtils'

/**
 * Compact rundown of the player's current slate, shown above the game list.
 * College picks list first, then NFL, each by kickoff.
 *
 * Also owns the player lock: a self-imposed freeze so a stray tap can't
 * change a finished slate. It's separate from the hard per-game lock at
 * kickoff and stays reversible until then.
 *
 * Props:
 *   games        — the week's games
 *   picks        — { game_id → pick } for the current user
 *   total        — how many picks a full slate needs
 *   lockedIn     — player lock state
 *   canLock      — week is open and at least one picked game hasn't kicked off
 *   onToggleLock — fn() flips the player lock
 */
export default function PickSummary({ games, picks, total, lockedIn, canLock, onToggleLock }) {
  const picked = games.filter((g) => picks[g.id]).sort(collegeFirst)
  if (picked.length === 0) return null

  const outcomeStyle = { win: 'text-green', loss: 'text-red', push: 'text-muted' }
  const outcomeLabel = { win: '✓ W', loss: '✗ L', push: '~ P' }

  return (
    <div className="mx-4 mt-4 bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[10px] tracking-widest uppercase text-muted">Your Picks</span>
        <span className="text-[11px] font-semibold text-primary-light">
          {picked.length}/{total}
        </span>
      </div>

      {picked.map((game) => {
        const pick       = picks[game.id]
        const pickedHome = pick.picked_team === 'home'
        const team       = pickedHome ? game.home_team : game.away_team
        const opponent   = pickedHome ? `vs ${game.away_team}` : `@ ${game.home_team}`
        const spread     = formatSpread(pickedHome ? game.spread : -game.spread)
        const kickedOff  = new Date(game.kickoff_time) <= new Date()
        const isFinal    = game.result !== null

        // "THU · OCT 17 · 8:15 PM ET" → "THU 8:15 PM"
        const parts = formatKickoff(game.kickoff_time).split(' · ')
        const shortKick = `${parts[0]} ${(parts[2] ?? '').replace(' ET', '')}`

        return (
          <div key={game.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-border/50">
            <span className="w-9 flex-shrink-0 text-center text-[9px] font-bold text-muted bg-bg border border-border rounded-md py-0.5">
              {game.sport === 'nfl' ? 'NFL' : 'CFB'}
            </span>
            <TeamLogo team={team} sport={game.sport} abbr={teamAbbr(team)} size={28} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {team} <span className="text-primary-light">{spread}</span>
              </p>
              <p className="text-[11px] text-muted truncate">{opponent}</p>
            </div>
            {isFinal && pick.outcome ? (
              <span className={`text-xs font-bold flex-shrink-0 ${outcomeStyle[pick.outcome]}`}>
                {outcomeLabel[pick.outcome]}
              </span>
            ) : kickedOff || pick.is_locked ? (
              <span className="text-[11px] flex-shrink-0" aria-label="Locked">🔒</span>
            ) : (
              <span className="text-[11px] text-muted flex-shrink-0">{shortKick}</span>
            )}
          </div>
        )
      })}

      {canLock && (
        <div className="px-4 py-3 border-t border-border/50">
          {lockedIn ? (
            <div className="flex items-center gap-2 bg-green/10 border border-green/30 rounded-lg px-3 py-2.5">
              <span className="text-sm">🔒</span>
              <span className="text-sm text-green font-semibold flex-1">Picks locked in</span>
              <button
                onClick={onToggleLock}
                className="text-xs text-muted underline hover:text-white px-2 py-1"
              >
                Unlock
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onToggleLock}
                className="w-full min-h-[44px] py-2.5 rounded-lg bg-primary hover:bg-primary-light text-white text-sm font-bold transition-colors"
              >
                🔒 Lock In My Picks
              </button>
              <p className="text-[10px] text-muted text-center mt-1.5">
                Stops stray taps from changing your slate — unlock any time before kickoff
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
