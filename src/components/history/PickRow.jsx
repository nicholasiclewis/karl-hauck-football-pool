import { formatSpread, teamAbbr, formatKickoff } from '../../lib/gameUtils'
import { lateEntry } from '../../lib/pickAudit'

/**
 * A single pick row inside the expanded WeekCard.
 * Shows: team abbr circle | matchup | picked team + spread | outcome badge
 *
 * A pick someone else entered after kickoff also carries a line saying who and
 * when. That write is allowed and often routine, but it is the one made
 * knowing something, so it is recorded in the open on the slate it affected
 * rather than in a log only admins read.
 */
export default function PickRow({ game, pick }) {
  const late = lateEntry(pick, game)
  const pickedHome = pick?.picked_team === 'home'
  const pickedTeamName = pick
    ? (pickedHome ? game.home_team : game.away_team)
    : null
  const pickedSpread = pick
    ? (pickedHome ? formatSpread(game.spread) : formatSpread(-game.spread))
    : null

  const outcome = pick?.outcome ?? null
  const outcomeConfig = {
    win:  { label: 'W', bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
    loss: { label: 'L', bg: 'rgba(248,113,113,0.15)',  color: '#f87171', border: 'rgba(248,113,113,0.3)' },
    push: { label: 'P', bg: 'rgba(58,96,144,0.2)',   color: '#94afd4', border: '#374e6b' },
  }
  const oc = outcome ? outcomeConfig[outcome] : null

  const homeAbbr = teamAbbr(game.home_team)
  const awayAbbr = teamAbbr(game.away_team)

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b"
      style={{ borderColor: '#253347' }}
    >
      {/* Sport indicator */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border"
        style={{ background: '#1e293b', borderColor: '#374e6b', color: '#94afd4' }}
      >
        {game.sport === 'nfl' ? 'NFL' : 'CFB'}
      </div>

      {/* Matchup */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium" style={{ color: '#94afd4' }}>
          {awayAbbr} @ {homeAbbr}
          <span className="ml-2" style={{ color: '#94afd4' }}>
            {formatSpread(game.spread)}
          </span>
        </div>
        {pick ? (
          <div className="text-sm font-semibold mt-0.5" style={{ color: '#93c5fd' }}>
            {pickedTeamName} {pickedSpread}
          </div>
        ) : (
          <div className="text-sm mt-0.5" style={{ color: '#94afd4' }}>No pick</div>
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
        <div className="text-xs text-center flex-shrink-0" style={{ color: '#94afd4' }}>
          <span>{game.away_score}</span>
          <span style={{ color: '#94afd4' }}> – </span>
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
