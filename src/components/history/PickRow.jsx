import { formatSpread, teamAbbr, formatKickoff } from '../../lib/gameUtils'

/**
 * A single pick row inside the expanded WeekCard.
 * Shows: team abbr circle | matchup | picked team + spread | outcome badge
 */
export default function PickRow({ game, pick }) {
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
    loss: { label: 'L', bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    push: { label: 'P', bg: 'rgba(58,96,144,0.2)',   color: '#3a6090', border: '#001a5c' },
  }
  const oc = outcome ? outcomeConfig[outcome] : null

  const homeAbbr = teamAbbr(game.home_team)
  const awayAbbr = teamAbbr(game.away_team)

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b"
      style={{ borderColor: '#001040' }}
    >
      {/* Sport indicator */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border"
        style={{ background: '#000d2e', borderColor: '#001a5c', color: '#3a6090' }}
      >
        {game.sport === 'nfl' ? 'NFL' : 'CFB'}
      </div>

      {/* Matchup */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium" style={{ color: '#3a6090' }}>
          {awayAbbr} @ {homeAbbr}
          <span className="ml-2" style={{ color: '#1e3a5f' }}>
            {formatSpread(game.spread)}
          </span>
        </div>
        {pick ? (
          <div className="text-sm font-semibold mt-0.5" style={{ color: '#a8c8ff' }}>
            {pickedTeamName} {pickedSpread}
          </div>
        ) : (
          <div className="text-sm mt-0.5" style={{ color: '#1e3a5f' }}>No pick</div>
        )}
      </div>

      {/* Score (if final) */}
      {game.home_score !== null && (
        <div className="text-xs text-center flex-shrink-0" style={{ color: '#3a6090' }}>
          <span>{game.away_score}</span>
          <span style={{ color: '#1e3a5f' }}> – </span>
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
