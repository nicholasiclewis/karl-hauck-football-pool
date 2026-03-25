import { useState, useEffect } from 'react'
import TopNav from '../components/layout/TopNav'
import BottomNav from '../components/layout/BottomNav'
import WeekCard from '../components/history/WeekCard'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function History() {
  const { user, profile } = useAuth()

  const [season, setSeason]       = useState(null)
  const [weeks, setWeeks]         = useState([])
  const [scores, setScores]       = useState({})  // { week_id: score_row }
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (user) fetchHistory()
  }, [user])

  async function fetchHistory() {
    setLoading(true)
    try {
      // Active season
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('id, year')
        .eq('is_active', true)
        .maybeSingle()

      if (!seasonData) { setLoading(false); return }
      setSeason(seasonData)

      // All weeks for this season
      const { data: weeksData } = await supabase
        .from('weeks')
        .select('id, week_number, container_type, college_focus, conference, picks_open, is_complete, week_start')
        .eq('season_id', seasonData.id)
        .order('week_number', { ascending: false })

      setWeeks(weeksData ?? [])

      // User's weekly scores
      const weekIds = (weeksData ?? []).map((w) => w.id)
      if (weekIds.length > 0) {
        const { data: scoresData } = await supabase
          .from('weekly_scores')
          .select('*')
          .eq('user_id', user.id)
          .in('week_id', weekIds)

        const scoresMap = {}
        scoresData?.forEach((s) => {
          // Calculate losses: games played minus correct - pushes
          scoresMap[s.week_id] = {
            ...s,
            total_losses: Math.max(0, (s.correct_picks + s.push_count)
              ? (6 - s.correct_picks - s.push_count)
              : 0),
          }
        })
        setScores(scoresMap)
      }
    } catch (err) {
      console.error('fetchHistory error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Season totals
  const totalPts  = Object.values(scores).reduce((sum, s) => sum + (s.total_points ?? 0), 0)
  const totalWins = Object.values(scores).reduce((sum, s) => sum + (s.correct_picks ?? 0), 0)
  const totalLoss = Object.values(scores).reduce((sum, s) => sum + (s.total_losses ?? 0), 0)
  const totalPush = Object.values(scores).reduce((sum, s) => sum + (s.push_count ?? 0), 0)
  const totalGames = totalWins + totalLoss + totalPush
  const atsPct = totalGames > 0
    ? ((totalWins + totalPush * 0.5) / totalGames * 100).toFixed(1)
    : null

  // Win bar width
  const winPct  = totalGames > 0 ? (totalWins / totalGames) * 100 : 0
  const pushPct = totalGames > 0 ? (totalPush / totalGames) * 100 : 0

  const firstName = profile?.display_name?.split(' ')[0] ?? ''
  const lastName  = profile?.display_name?.split(' ')[1]
  const shortName = lastName ? `${firstName} ${lastName[0]}.` : firstName

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-bounce">🏈</span>
          <p className="text-sm" style={{ color: '#94afd4' }}>Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a' }}>
      <TopNav />

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div
        className="pt-14 border-b"
        style={{ background: 'linear-gradient(135deg, #141e2e 0%, #1e293b 100%)', borderColor: '#374e6b' }}
      >
        <div className="px-4 pt-5 pb-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            📋 My Pick History
          </h1>
          <p className="text-xs mt-1" style={{ color: '#94afd4' }}>
            {season?.year} Season · {shortName}
          </p>

          {/* ── Stats bar ──────────────────────────────────────────────────── */}
          <div
            className="grid grid-cols-4 gap-px mt-4 rounded-xl overflow-hidden border"
            style={{ borderColor: '#374e6b' }}
          >
            {[
              { val: totalPts.toFixed(1), lbl: 'Total Pts', color: '#60a5fa' },
              { val: totalWins,           lbl: 'Wins',      color: '#10b981' },
              { val: totalLoss,           lbl: 'Losses',    color: '#ef4444' },
              { val: totalPush,           lbl: 'Pushes',    color: '#f0f6ff' },
            ].map(({ val, lbl, color }) => (
              <div
                key={lbl}
                className="flex flex-col items-center py-3"
                style={{ background: '#1e293b' }}
              >
                <span className="text-xl font-bold leading-none" style={{ color }}>{val}</span>
                <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: '#6b8fbb' }}>{lbl}</span>
              </div>
            ))}
          </div>

          {/* ── Win/push/loss bar ──────────────────────────────────────────── */}
          {totalGames > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: '#94afd4' }}>
                  Season Record
                </span>
                <span className="text-xs font-semibold" style={{ color: '#93c5fd' }}>
                  {totalWins}-{totalLoss}-{totalPush} · {atsPct}% ATS
                </span>
              </div>
              <div className="flex rounded-full overflow-hidden h-2" style={{ background: '#253347' }}>
                <div style={{ width: `${winPct}%`, background: '#10b981' }} />
                <div style={{ width: `${pushPct}%`, background: '#94afd4' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Week list ───────────────────────────────────────────────────────── */}
      <div className="mx-4 mt-4 rounded-xl overflow-hidden border" style={{ borderColor: '#374e6b' }}>
        {weeks.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold" style={{ color: '#f0f6ff' }}>No weeks yet</p>
            <p className="text-sm mt-1" style={{ color: '#94afd4' }}>
              Your pick history will appear here once the season starts.
            </p>
          </div>
        ) : (
          weeks.map((week) => (
            <WeekCard
              key={week.id}
              week={week}
              score={scores[week.id] ?? null}
              userId={user?.id}
            />
          ))
        )}
      </div>
      <BottomNav />
    </div>
  )
}
