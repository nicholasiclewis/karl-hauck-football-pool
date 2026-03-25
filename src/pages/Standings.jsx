import { useState, useEffect } from 'react'
import TopNav from '../components/layout/TopNav'
import BottomNav from '../components/layout/BottomNav'
import PodiumSlot from '../components/standings/PodiumSlot'
import PlayerRow from '../components/standings/PlayerRow'
import { useStandings } from '../hooks/useStandings'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

// ── Dues helper ─────────────────────────────────────────────────────────────
function duesIcon(isPaid, currentWeekNumber) {
  if (isPaid) return '✅'
  if (currentWeekNumber >= 9) return '🎓'
  return '🔴'
}

// ── Week chip label helper ───────────────────────────────────────────────────
function weekChipLabel(week) {
  if (!week) return ''
  const type = week.container_type
  let label = `Wk ${week.week_number}`
  if (type === 'nfl_college') label += ' · 4 NFL · 2 CFB'
  else if (type === 'nfl_only') label += ' · 6 NFL'
  else if (type === 'college_only') label += ' · 6 CFB'
  return label
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Standings() {
  const { user } = useAuth()

  // Active season
  const [season, setSeason]           = useState(null)
  const [seasonLoading, setSeasonLoading] = useState(true)

  // All weeks for this season (used in WeekBreakdown + Weekly tab)
  const [weeks, setWeeks]             = useState([])
  const [weeksLoading, setWeeksLoading] = useState(false)

  // Current open week number (for dues logic)
  const [currentWeekNumber, setCurrentWeekNumber] = useState(0)

  // View toggle: 'season' | 'weekly'
  const [activeTab, setActiveTab]     = useState('season')

  // Which player row is expanded (season tab)
  const [expandedUserId, setExpandedUserId] = useState(null)

  // Which week is selected in the weekly tab
  const [selectedWeekId, setSelectedWeekId] = useState(null)

  // ── Fetch active season ────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchSeason() {
      try {
        const { data } = await supabase
          .from('seasons')
          .select('id, year')
          .eq('is_active', true)
          .maybeSingle()
        setSeason(data ?? null)
      } catch (err) {
        console.error('fetchSeason error:', err)
      } finally {
        setSeasonLoading(false)
      }
    }
    fetchSeason()
  }, [])

  // ── Fetch weeks when we have a season ─────────────────────────────────────
  useEffect(() => {
    if (!season) return

    async function fetchWeeks() {
      setWeeksLoading(true)
      try {
        const { data } = await supabase
          .from('weeks')
          .select('id, week_number, picks_open, container_type, conference')
          .eq('season_id', season.id)
          .order('week_number', { ascending: true })

        const rows = data ?? []
        setWeeks(rows)

        // Determine "current" week number (the open week or last week)
        const openWeek = rows.find((w) => w.picks_open)
        const latest   = rows[rows.length - 1]
        setCurrentWeekNumber(openWeek?.week_number ?? latest?.week_number ?? 0)

        // Default selected week for the Weekly tab
        if (rows.length > 0 && !selectedWeekId) {
          setSelectedWeekId((openWeek ?? latest)?.id ?? rows[0].id)
        }
      } catch (err) {
        console.error('fetchWeeks error:', err)
      } finally {
        setWeeksLoading(false)
      }
    }
    fetchWeeks()
  }, [season])

  // ── Standings hook ─────────────────────────────────────────────────────────
  const { standings, loading: standingsLoading } = useStandings(season?.id)

  // ── Derived values ─────────────────────────────────────────────────────────
  const loading = seasonLoading || standingsLoading || weeksLoading

  const currentUserEntry = standings.find((s) => s.user_id === user?.id)

  // For the weekly tab: filter weekly scores to the selected week
  const weeklyRows = selectedWeekId
    ? standings.map((entry) => {
        const weekScore = (entry.weekly ?? []).find((w) => w.week_id === selectedWeekId)
        return {
          ...entry,
          weekScore: weekScore ?? null,
        }
      }).sort((a, b) => (b.weekScore?.total_points ?? -1) - (a.weekScore?.total_points ?? -1))
    : []

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId)

  // ── Toggle row expansion ───────────────────────────────────────────────────
  function toggleExpand(userId) {
    setExpandedUserId((prev) => (prev === userId ? null : userId))
  }

  // ── Subtitle ───────────────────────────────────────────────────────────────
  const subtitle = season
    ? `${season.year} Season · Week ${currentWeekNumber}`
    : 'Loading...'

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-bounce">🏈</span>
          <p className="text-sm" style={{ color: '#94afd4' }}>Loading standings...</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a' }}>
      <TopNav />

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div
        className="border-b pt-14"
        style={{
          background: 'linear-gradient(135deg, #141e2e 0%, #1e293b 100%)',
          borderColor: '#374e6b',
        }}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          {/* Left: title + subtitle */}
          <div>
            <h1 className="text-2xl font-bold text-white">Standings</h1>
            <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>
              {subtitle}
            </p>
          </div>

          {/* Right: current user's season total badge */}
          {currentUserEntry && (
            <div
              className="flex flex-col items-center px-4 py-2 rounded-xl border"
              style={{ background: '#1e293b', borderColor: '#374e6b' }}
            >
              <span
                className="text-2xl font-black leading-none"
                style={{ color: '#60a5fa' }}
              >
                {currentUserEntry.total_points ?? 0}
              </span>
              <span
                className="text-[9px] uppercase tracking-widest mt-0.5 font-bold"
                style={{ color: '#94afd4' }}
              >
                Your Pts
              </span>
            </div>
          )}
        </div>

        {/* ── Podium (top 3) ─────────────────────────────────────────────── */}
        {standings.length > 0 && (
          <div className="flex items-end gap-1 px-4 pb-0">
            {/* 2nd place — left */}
            <PodiumSlot
              entry={standings[1] ?? null}
              place={2}
              blockHeight={52}
              duesIcon={duesIcon(false, currentWeekNumber)}
            />
            {/* 1st place — center, tallest */}
            <PodiumSlot
              entry={standings[0] ?? null}
              place={1}
              blockHeight={70}
              duesIcon={duesIcon(false, currentWeekNumber)}
            />
            {/* 3rd place — right, shortest */}
            <PodiumSlot
              entry={standings[2] ?? null}
              place={3}
              blockHeight={38}
              duesIcon={duesIcon(false, currentWeekNumber)}
            />
          </div>
        )}
      </div>

      {/* ── View Toggle ─────────────────────────────────────────────────── */}
      <div className="px-4 my-4">
        <div
          className="flex rounded-xl p-1 border"
          style={{ background: '#1e293b', borderColor: '#374e6b' }}
        >
          {[
            { key: 'season', label: 'Season Standings' },
            { key: 'weekly', label: 'Weekly Scores' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: activeTab === key ? '#253347' : 'transparent',
                color: activeTab === key ? '#f0f6ff' : '#94afd4',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ SEASON STANDINGS TAB ═════════════════════════════════════════ */}
      {activeTab === 'season' && (
        <div>
          {standings.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className="mx-4 rounded-xl overflow-hidden border"
              style={{ borderColor: '#374e6b' }}
            >
              {standings.map((entry, index) => (
                <PlayerRow
                  key={entry.user_id}
                  entry={entry}
                  rank={index + 1}
                  isCurrentUser={entry.user_id === user?.id}
                  isExpanded={expandedUserId === entry.user_id}
                  onToggle={() => toggleExpand(entry.user_id)}
                  weeks={weeks}
                  duesIcon={duesIcon(false, currentWeekNumber)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ WEEKLY SCORES TAB ════════════════════════════════════════════ */}
      {activeTab === 'weekly' && (
        <div>
          {/* Week selector chips — horizontal scroll */}
          {weeks.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex gap-2 px-4 pb-3" style={{ width: 'max-content' }}>
                {weeks.map((w) => {
                  const isSelected = w.id === selectedWeekId
                  const label = weekChipLabel(w)
                  return (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWeekId(w.id)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors"
                      style={{
                        background: isSelected ? '#2563eb' : '#1e293b',
                        borderColor: isSelected ? '#60a5fa' : '#374e6b',
                        color: isSelected ? '#ffffff' : '#94afd4',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Player scores for the selected week */}
          {weeklyRows.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className="mx-4 rounded-xl overflow-hidden border"
              style={{ borderColor: '#374e6b' }}
            >
              {/* Column headers */}
              <div
                className="flex items-center gap-3 px-4 py-2"
                style={{ background: '#1e293b', borderBottom: '1px solid #253347' }}
              >
                <span className="w-6" />
                <span className="w-9" />
                <span
                  className="flex-1 text-[10px] uppercase tracking-widest"
                  style={{ color: '#94afd4' }}
                >
                  Player
                </span>
                <span
                  className="w-16 text-right text-[10px] uppercase tracking-widest"
                  style={{ color: '#94afd4' }}
                >
                  Correct
                </span>
                <span
                  className="w-12 text-right text-[10px] uppercase tracking-widest"
                  style={{ color: '#94afd4' }}
                >
                  Pts
                </span>
              </div>

              {weeklyRows.map((entry, index) => {
                const ws = entry.weekScore
                const isCurrentUser = entry.user_id === user?.id
                const initials = (entry.display_name || '?')
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)

                return (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom: '1px solid #253347',
                      background: isCurrentUser
                        ? 'linear-gradient(90deg, #2563eb 0%, #253347 100%)'
                        : 'transparent',
                      borderLeft: isCurrentUser ? '2px solid #60a5fa' : '2px solid transparent',
                    }}
                  >
                    {/* Rank */}
                    <span
                      className="w-6 text-center text-sm font-bold flex-shrink-0"
                      style={{
                        color:
                          index === 0
                            ? '#fbbf24'
                            : index === 1
                            ? '#94a3b8'
                            : index === 2
                            ? '#b45309'
                            : '#f0f6ff',
                      }}
                    >
                      {ws ? index + 1 : '–'}
                    </span>

                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                      style={{ background: '#374e6b', color: '#ffffff' }}
                    >
                      {initials}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-sm font-semibold truncate"
                          style={{ color: isCurrentUser ? '#ffffff' : '#f0f6ff' }}
                        >
                          {entry.display_name ?? 'Unknown'}
                        </span>
                        {isCurrentUser && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0"
                            style={{ background: '#60a5fa', color: '#1e293b' }}
                          >
                            You
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Correct picks */}
                    <span
                      className="w-16 text-right text-sm"
                      style={{ color: ws ? '#f0f6ff' : '#94afd4' }}
                    >
                      {ws ? ws.correct_picks : '–'}
                      {ws?.nfl_correct > 0 && (
                        <span className="text-[10px] text-muted block">
                          {ws.nfl_correct} NFL
                        </span>
                      )}
                    </span>

                    {/* Points */}
                    <span
                      className="w-12 text-right text-sm font-bold"
                      style={{ color: ws ? '#60a5fa' : '#94afd4' }}
                    >
                      {ws ? ws.total_points : '–'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

// ── Helper sub-components ────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center mt-12 px-4 text-center">
      <span className="text-5xl mb-4">🏆</span>
      <p className="font-semibold" style={{ color: '#f0f6ff' }}>
        No scores yet this season
      </p>
      <p className="text-sm mt-1" style={{ color: '#94afd4' }}>
        Standings will appear once the first week is scored.
      </p>
    </div>
  )
}
