import { formatSpread, teamAbbr } from '../../lib/gameUtils'

/**
 * Who in the pool took which side, for a week that is over.
 *
 * Visitor on the left, host on the right, the same way the pick card and the
 * printed slate read the matchup. The side that covered is greened, matching
 * the pick card again, so a player learns one colour for one meaning across
 * the whole app.
 *
 * A side nobody took says so rather than showing an empty box: "nobody" is a
 * result, and on a lopsided game it is the interesting one.
 */
export default function RoomPicks({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="py-4 text-center text-sm" style={{ color: '#94afd4' }}>
        No games in this week.
      </div>
    )
  }

  return (
    <div className="space-y-2 px-4 py-3">
      {rows.map(({ game, home, away, total, covered }) => (
        <div
          key={game.id}
          className="rounded-lg border p-2.5"
          style={{ background: '#1e293b', borderColor: '#374e6b' }}
        >
          {/* Matchup line */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={game.sport === 'nfl'
                ? { background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }
                : { background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
            >
              {game.sport === 'nfl' ? 'NFL' : 'CFB'}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: '#94afd4' }}>
              {teamAbbr(game.away_team)} @ {teamAbbr(game.home_team)}
              <span className="ml-1.5">{formatSpread(game.spread)}</span>
            </span>
            {game.home_score !== null && game.home_score !== undefined && (
              <span className="text-[11px]" style={{ color: '#94afd4' }}>
                {game.away_score}–{game.home_score}
              </span>
            )}
            <span className="text-[10px] ml-auto" style={{ color: '#94afd4' }}>
              {total === 0 ? 'unpicked' : total === 1 ? '1 pick' : `${total} picks`}
            </span>
          </div>

          {/* The two sides */}
          <div className="grid grid-cols-2 gap-2">
            <Side
              team={game.away_team}
              spread={formatSpread(-game.spread)}
              players={away}
              covered={covered === 'away'}
              push={covered === 'push'}
            />
            <Side
              team={game.home_team}
              spread={formatSpread(game.spread)}
              players={home}
              covered={covered === 'home'}
              push={covered === 'push'}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** One side of a game, and everyone who took it. */
function Side({ team, spread, players, covered, push }) {
  return (
    <div
      className="rounded-lg border px-2 py-1.5"
      style={{
        background:  covered ? 'rgba(16,185,129,0.08)' : '#0f172a',
        borderColor: covered ? 'rgba(16,185,129,0.4)' : '#374e6b',
      }}
    >
      <div
        className="text-[11px] font-bold leading-tight"
        style={{ color: covered ? '#10b981' : '#93c5fd' }}
      >
        {team} {spread}
        {covered && <span className="ml-1">✓</span>}
        {push && <span className="ml-1" style={{ color: '#94afd4' }}>~</span>}
      </div>

      {players.length === 0 ? (
        <div className="text-[10px] mt-1 italic" style={{ color: '#94afd4' }}>nobody</div>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {players.map((name) => (
            <li key={name} className="text-[11px] leading-snug" style={{ color: '#f0f6ff' }}>
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
