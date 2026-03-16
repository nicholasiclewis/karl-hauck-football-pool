import { useState } from 'react'
import PickRow from './PickRow'
import { supabase } from '../../lib/supabase'

/**
 * Collapsible week card in Pick History.
 * Shows week label, sub-label, bonus chips, W-L-P record, and pts.
 * Expands to show individual pick rows.
 */
export default function WeekCard({ week, score, userId }) {
  const [expanded, setExpanded] = useState(false)
  const [picks, setPicks] = useState([])
  const [games, setGames] = useState([])
  const [loadingPicks, setLoadingPicks] = useState(false)

  const isInProgress = week.picks_open && !week.is_complete

  // Score circle color
  const pts = score?.total_points ?? null
  let circleColor = '#1e3a5f'   // default muted
  let circleBorder = '#001a5c'
  if (pts !== null) {
    if (pts >= 7)      { circleColor = '#10b981'; circleBorder = '#10b981' }
    else if (pts >= 5) { circleColor = '#4a7fd4'; circleBorder = '#4a7fd4' }
    else if (pts >= 3) { circleColor = '#d4e4ff'; circleBorder = '#002480' }
    else               { circleColor = '#3a6090'; circleBorder = '#001a5c' }
  }

  // Bonus chips
  const bonusChips = []
  if (score) {
    const nflCorrect = score.nfl_correct ?? 0
    const totalCorrect = score.correct_picks ?? 0
    const ct = week.container_type
    if (ct === 'nfl_college' && nflCorrect >= 4 && totalCorrect < 6) {
      bonusChips.push({ label: 'NFL Sweep +1', color: 'blue' })
    }
    if (totalCorrect >= 6 && score.bonus_points >= 2) {
      bonusChips.push({ label: 'Full Sweep +2', color: 'green' })
    } else if (totalCorrect >= 6 && score.bonus_points >= 1) {
      bonusChips.push({ label: 'Full Sweep +1', color: 'green' })
    } else if (ct === 'nfl_college' && nflCorrect >= 4) {
      bonusChips.push({ label: 'NFL Sweep +1', color: 'blue' })
    }
  }

  // Week sub-label: "4 NFL · Power 4 (Big Ten)" etc.
  function weekSubLabel() {
    const ct = week.container_type
    let parts = []
    if (ct === 'nfl_college') parts.push('4 NFL')
    else if (ct === 'nfl_only') parts.push('6 NFL')
    else parts.push('6 CFB')

    if (week.college_focus) {
      const focus = week.college_focus === 'power4' ? 'Power 4'
        : week.college_focus === 'group5' ? 'Group of 5'
        : week.college_focus === 'top25' ? 'Top 25'
        : week.college_focus === 'rivalry' ? 'Rivalry'
        : week.college_focus === 'confchamp' ? 'Conf. Champs'
        : week.college_focus === 'cfp' ? 'CFP'
        : week.college_focus
      parts.push(week.conference ? `${focus} (${week.conference})` : focus)
    }
    return parts.join(' · ')
  }

  // W-L-P record string
  const record = score
    ? `${score.correct_picks ?? 0}-${score.total_losses ?? '?'}-${score.push_count ?? 0}`
    : null

  async function handleExpand() {
    if (!expanded && picks.length === 0) {
      setLoadingPicks(true)
      const [{ data: picksData }, { data: gamesData }] = await Promise.all([
        supabase.from('picks').select('*').eq('week_id', week.id).eq('user_id', userId),
        supabase.from('games').select('*').eq('week_id', week.id).order('kickoff_time'),
      ])
      setPicks(picksData ?? [])
      setGames(gamesData ?? [])
      setLoadingPicks(false)
    }
    setExpanded((v) => !v)
  }

  return (
    <div
      className="border-b"
      style={{ borderColor: '#001040' }}
    >
      {/* ── Row ── */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-card2 active:bg-card2"
      >
        {/* Score circle */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 border-2"
          style={{ color: circleColor, borderColor: circleBorder }}
        >
          {isInProgress ? '···' : pts !== null ? pts : '—'}
        </div>

        {/* Week info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: '#d4e4ff' }}>
              NFL Week {week.week_number}
            </span>
            {isInProgress && (
              <span className="text-[10px] font-semibold" style={{ color: '#4a7fd4' }}>
                • In Progress
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: '#3a6090' }}>
            {weekSubLabel()}
          </p>
          {bonusChips.length > 0 && (
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {bonusChips.map((chip, i) => (
                <span
                  key={i}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                  style={
                    chip.color === 'green'
                      ? { background: 'rgba(16,185,129,0.12)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }
                      : { background: 'rgba(74,127,212,0.12)', color: '#4a7fd4', borderColor: 'rgba(74,127,212,0.3)' }
                  }
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Record + chevron */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {record && (
            <span className="text-sm font-semibold" style={{ color: '#d4e4ff' }}>{record}</span>
          )}
          <span
            className="text-xs transition-transform"
            style={{
              color: '#3a6090',
              display: 'inline-block',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
        </div>
      </button>

      {/* ── Expanded picks ── */}
      {expanded && (
        <div style={{ background: '#00061a', borderTop: '1px solid #001040' }}>
          {loadingPicks ? (
            <div className="py-4 text-center text-sm" style={{ color: '#3a6090' }}>
              Loading picks...
            </div>
          ) : picks.length === 0 ? (
            <div className="py-4 text-center text-sm" style={{ color: '#3a6090' }}>
              No picks made this week
            </div>
          ) : (
            games.map((game) => {
              const pick = picks.find((p) => p.game_id === game.id)
              return <PickRow key={game.id} game={game} pick={pick ?? null} />
            })
          )}
        </div>
      )}
    </div>
  )
}
