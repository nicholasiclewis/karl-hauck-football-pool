import { useState } from 'react'
import PickRow from './PickRow'
import RoomPicks from './RoomPicks'
import { supabase } from '../../lib/supabase'
import { collegeFirst } from '../../lib/gameUtils'
import { roomPicks } from '../../lib/roomPicks'

/**
 * Collapsible week card in Pick History.
 * Shows week label, sub-label, bonus chips, W-L-P record, and pts.
 * Expands to show individual pick rows.
 *
 * A finished week also opens onto everyone else's picks. That is gated on the
 * week being complete, not merely on the player asking: picks are readable at
 * the database level from the moment they are made, and the only thing keeping
 * a live week private is that nothing offers to show it. This is that gate.
 */
export default function WeekCard({ week, score, userId, subjectIsAdmin = false }) {
  const [expanded, setExpanded] = useState(false)
  const [picks, setPicks] = useState([])
  const [games, setGames] = useState([])
  const [loadingPicks, setLoadingPicks] = useState(false)

  // Everyone else's picks, loaded only when asked for — most of the time a
  // player is looking at their own week and this is a query nobody needed.
  const [roomOpen, setRoomOpen] = useState(false)
  const [room, setRoom] = useState(null)
  const [loadingRoom, setLoadingRoom] = useState(false)

  const weekIsOver = Boolean(week.is_complete)

  const isInProgress = week.picks_open && !week.is_complete

  // Score circle color
  const pts = score?.total_points ?? null
  let circleColor = '#94afd4'   // default muted — the old #1e3a5f dash was near-invisible
  let circleBorder = '#374e6b'
  if (pts !== null) {
    if (pts >= 7)      { circleColor = '#10b981'; circleBorder = '#10b981' }
    else if (pts >= 5) { circleColor = '#60a5fa'; circleBorder = '#60a5fa' }
    else if (pts >= 3) { circleColor = '#f0f6ff'; circleBorder = '#4a6585' }
    else               { circleColor = '#94afd4'; circleBorder = '#374e6b' }
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
        // The embed names whoever entered the pick, for the receipt PickRow
        // shows on a late one. It is a left join on a nullable column, so a
        // pick nobody stamped still comes back.
        supabase
          .from('picks')
          .select('*, entered_by_user:entered_by ( display_name )')
          .eq('week_id', week.id)
          .eq('user_id', userId),
        supabase.from('games').select('*').eq('week_id', week.id).eq('is_featured', true).order('kickoff_time'),
      ])
      setPicks(picksData ?? [])
      setGames(gamesData ?? [])
      setLoadingPicks(false)
    }
    setExpanded((v) => !v)
  }

  /**
   * Everyone's picks for this week, fetched once and kept.
   *
   * The names come from a separate read rather than an embed on picks: the
   * roster is small, one query covers every row, and it keeps working for a
   * player whose picks reference a user the join would otherwise repeat on
   * every line.
   */
  async function toggleRoom() {
    if (roomOpen) { setRoomOpen(false); return }
    setRoomOpen(true)
    if (room) return

    setLoadingRoom(true)
    const [{ data: allPicks }, { data: users }] = await Promise.all([
      supabase.from('picks').select('user_id, game_id, picked_team').eq('week_id', week.id),
      supabase.from('users').select('id, display_name'),
    ])
    const names = Object.fromEntries((users ?? []).map((u) => [u.id, u.display_name]))
    setRoom(roomPicks([...games].sort(collegeFirst), allPicks ?? [], names))
    setLoadingRoom(false)
  }

  return (
    <div
      className="border-b"
      style={{ borderColor: '#253347' }}
    >
      {/* ── Row ── */}
      <button
        onClick={handleExpand}
        aria-expanded={expanded}
        aria-label={`Week ${week.week_number} — your picks`}
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
            <span className="text-sm font-bold" style={{ color: '#f0f6ff' }}>
              Week {week.week_number}
            </span>
            {isInProgress && (
              <span className="text-[10px] font-semibold" style={{ color: '#60a5fa' }}>
                • In Progress
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: '#94afd4' }}>
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
                      : { background: 'rgba(74,127,212,0.12)', color: '#60a5fa', borderColor: 'rgba(74,127,212,0.3)' }
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
            <span className="text-sm font-semibold" style={{ color: '#f0f6ff' }}>{record}</span>
          )}
          <span
            className="text-xs transition-transform"
            style={{
              color: '#94afd4',
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
        <div style={{ background: '#0f172a', borderTop: '1px solid #253347' }}>
          {loadingPicks ? (
            <div className="py-4 text-center text-sm" style={{ color: '#94afd4' }}>
              Loading picks...
            </div>
          ) : picks.length === 0 ? (
            <div className="py-4 text-center text-sm" style={{ color: '#94afd4' }}>
              No picks made this week
            </div>
          ) : (
            // Only the games this player actually picked — the rest of the
            // week's slate is noise here. College first, then NFL.
            games
              .filter((game) => picks.some((p) => p.game_id === game.id))
              .sort(collegeFirst)
              .map((game) => {
                const pick = picks.find((p) => p.game_id === game.id)
                return (
                  <PickRow
                    key={game.id}
                    game={game}
                    pick={pick}
                    subjectIsAdmin={subjectIsAdmin}
                  />
                )
              })
          )}

          {/* ── Everyone else's picks ──
              Only once the week is settled. Offering it while a week is live
              would turn the pool into a copying exercise. */}
          {weekIsOver && !loadingPicks && (
            <div style={{ borderTop: '1px solid #253347' }}>
              <button
                type="button"
                onClick={toggleRoom}
                aria-expanded={roomOpen}
                className="w-full px-4 py-3 text-left text-xs font-semibold"
                style={{ color: '#60a5fa' }}
              >
                {roomOpen ? 'Hide' : 'See'} everyone's picks
                <span className="ml-1.5" style={{ display: 'inline-block', transform: roomOpen ? 'rotate(180deg)' : 'none' }}>
                  ▾
                </span>
              </button>

              {roomOpen && (
                loadingRoom ? (
                  <div className="py-4 text-center text-sm" style={{ color: '#94afd4' }}>
                    Loading the room…
                  </div>
                ) : (
                  <RoomPicks rows={room ?? []} />
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
