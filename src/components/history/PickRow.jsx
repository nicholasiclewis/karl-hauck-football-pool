import { formatSpread, teamAbbr, formatKickoff } from '../../lib/gameUtils'
import { lateEntry } from '../../lib/pickAudit'

/**
 * A single pick row inside the expanded WeekCard.
 * Shows: team abbr circle | matchup | picked team + spread | outcome badge
 *
 * An admin's pick that another admin entered after kickoff also carries a line
 * saying who and when. Ordinary players are never marked: a late entry for
 * them is the entry tab doing its job. See pickAudit for why the line is drawn
 * there.
 */
export default function PickRow({ game, pick, subjectIsAdmin = false }) {
  const late = lateEntry(pick, game, subjectIsAdmin)
  const pickedHome = pick?.picked_team === 'home'
  const pickedTeamName = pick
    ? (pickedHome ? game.home_team : game.away_team)
    : null
  const pickedSpread = pick
    ? (pickedHome ? formatSpread(game.spread) : formatSpread(-game.spread))
    : null

  const outcome = pick?.outcome ?? null
  const outcomeConfig = {
    win:  { label: 'W', bg: 'rgba(16,185,129,0.15)', color: 'var(--green)', border: 'rgba(16,185,129,0.3)' },
    loss: { label: 'L', bg: 'rgba(248,113,113,0.15)',  color: 'var(--red)', border: 'rgba(248,113,113,0.3)' },
    push: { label: 'P', bg: 'rgba(58,96,144,0.2)',   color: 'var(--muted)', border: 'var(--border)' },
  }
  const oc = outcome ? outcomeConfig[outcome] : null

  const homeAbbr = teamAbbr(game.home_team)
  const awayAbbr = teamAbbr(game.away_team)

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b"
      style={{ borderColor: 'var(--card2)' }}
    >
      {/* Sport indicator */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        {game.sport === 'nfl' ? 'NFL' : 'CFB'}
      </div>

      {/* Matchup */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
          {awayAbbr} @ {homeAbbr}
          <span className="ml-2" style={{ color: 'var(--muted)' }}>
            {formatSpread(game.spread)}
          </span>
        </div>
        {pick ? (
          <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--accent-text)' }}>
            {pickedTeamName} {pickedSpread}
          </div>
        ) : (
          <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>No pick</div>
        )}

        {late && (
          <div
            className="text-[10px] mt-1 leading-snug"
            style={{ color: '#f5b301' }}
            title={`Entered ${new Date(late.at).toLocaleString()}`}
          >
            ⚠ entered by {late.by}, after kickoff
          </div>
        )}
      </div>

      {/* Score (if final) */}
      {game.home_score !== null && (
        <div className="text-xs text-center flex-shrink-0" style={{ color: 'var(--muted)' }}>
          <span>{game.away_score}</span>
          <span style={{ color: 'var(--muted)' }}> – </span>
          <span>{game.home_score}</span>
        </div>
      )}

      {/* Outcome badge */}
      {oc ? (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border"
          style={{ background: oc.bg, color: oc.color, borderColor: oc.border }}
        >
          {oc.label}
        </div>
      ) : (
        <div className="w-7 h-7 flex-shrink-0" />
      )}
    </div>
  )
}
