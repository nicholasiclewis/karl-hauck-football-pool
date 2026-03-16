import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { calculatePickOutcome, calculateWeeklyScore, pointsForOutcome } from '../../lib/scoring'
import { fetchScores } from '../../lib/oddsApi'

export default function ResultsTab() {
  const [weeks, setWeeks]               = useState([])
  const [selectedWeekId, setSelectedWeekId] = useState(null)
  const [games, setGames]               = useState([])
  const [scores, setScores]             = useState({}) // { gameId: { home_score, away_score } }
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [resolving, setResolving]       = useState(false)
  const [fetching, setFetching]         = useState(false)
  const [message, setMessage]           = useState('')
  const [error, setError]               = useState('')

  useEffect(() => { loadWeeks() }, [])
  useEffect(() => { if (selectedWeekId) loadGames() }, [selectedWeekId])

  async function loadWeeks() {
    setLoading(true)
    const { data: s } = await supabase.from('seasons').select('id').eq('is_active', true).maybeSingle()
    if (!s) { setLoading(false); return }
    const { data: w } = await supabase.from('weeks').select('*').eq('season_id', s.id).order('week_number')
    const rows = w ?? []
    setWeeks(rows)
    if (rows.length > 0) {
      const openWeek = rows.find(wk => wk.picks_open) ?? rows[rows.length - 1]
      setSelectedWeekId(openWeek.id)
    }
    setLoading(false)
  }

  async function loadGames() {
    const { data } = await supabase.from('games').select('*').eq('week_id', selectedWeekId).order('kickoff_time')
    const gs = data ?? []
    setGames(gs)
    const map = {}
    gs.forEach(g => {
      map[g.id] = {
        home_score: g.home_score ?? '',
        away_score: g.away_score ?? '',
      }
    })
    setScores(map)
  }

  async function saveScores() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      for (const game of games) {
        const s = scores[game.id]
        if (s.home_score === '' || s.away_score === '') continue
        const { error: err } = await supabase.from('games').update({
          home_score: parseInt(s.home_score),
          away_score: parseInt(s.away_score),
        }).eq('id', game.id)
        if (err) throw err
      }
      await loadGames()
      setMessage('Scores saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function fetchFromApi() {
    setFetching(true)
    setError('')
    setMessage('')
    try {
      const result = await fetchScores(selectedWeekId)
      if (result.error) throw new Error(result.error)
      await loadGames()
      setMessage(`✓ Fetched scores: ${result.updated} of ${result.total_games} games updated.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setFetching(false)
    }
  }

  async function resolvePicks() {
    setResolving(true)
    setError('')
    setMessage('')
    try {
      const week = weeks.find(w => w.id === selectedWeekId)
      if (!week) throw new Error('Week not found')

      // Reload freshest game data
      const { data: freshGames } = await supabase.from('games').select('*').eq('week_id', selectedWeekId)
      const gameMap = Object.fromEntries((freshGames ?? []).map(g => [g.id, g]))

      // Fetch all picks for this week
      const { data: allPicks } = await supabase.from('picks').select('*').eq('week_id', selectedWeekId)

      // Compute outcomes for picks with scored games
      const toUpdate = (allPicks ?? [])
        .filter(p => {
          const g = gameMap[p.game_id]
          return g && g.home_score !== null && g.away_score !== null
        })
        .map(p => {
          const g = gameMap[p.game_id]
          const outcome = calculatePickOutcome(g, p.picked_team)
          return { ...p, outcome, points_earned: pointsForOutcome(outcome) }
        })

      // Batch-update picks
      for (const pick of toUpdate) {
        await supabase.from('picks').update({
          outcome:       pick.outcome,
          points_earned: pick.points_earned,
          is_locked:     true,
        }).eq('id', pick.id)
      }

      // Group by user → compute weekly scores
      const userPicksMap = {}
      for (const pick of toUpdate) {
        if (!userPicksMap[pick.user_id]) userPicksMap[pick.user_id] = []
        userPicksMap[pick.user_id].push(pick)
      }

      const scoreRows = []
      for (const [userId, userPicks] of Object.entries(userPicksMap)) {
        const totalCorrect = userPicks.filter(p => p.outcome === 'win').length
        const nflCorrect   = userPicks.filter(p => p.outcome === 'win' && gameMap[p.game_id]?.sport === 'nfl').length
        const pushCount    = userPicks.filter(p => p.outcome === 'push').length
        const { basePoints, bonusPoints, totalPoints } = calculateWeeklyScore(
          week.container_type, { totalCorrect, nflCorrect, pushCount }
        )
        scoreRows.push({
          user_id:       userId,
          week_id:       selectedWeekId,
          correct_picks: totalCorrect,
          nfl_correct:   nflCorrect,
          push_count:    pushCount,
          base_points:   basePoints,
          bonus_points:  bonusPoints,
          total_points:  totalPoints,
        })
      }

      if (scoreRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('weekly_scores')
          .upsert(scoreRows, { onConflict: 'user_id,week_id' })
        if (upsertErr) throw upsertErr
      }

      setMessage(`✓ Resolved ${toUpdate.length} picks across ${scoreRows.length} players.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setResolving(false)
    }
  }

  const selectedWeek = weeks.find(w => w.id === selectedWeekId)

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      {/* ── Week chips ── */}
      {weeks.length > 0 && (
        <div>
          <label className="text-xs font-semibold block mb-2" style={{ color: '#3a6090' }}>Select Week</label>
          <div className="flex gap-2 flex-wrap">
            {weeks.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWeekId(w.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border"
                style={{
                  background:  selectedWeekId === w.id ? '#003087' : '#000d2e',
                  borderColor: selectedWeekId === w.id ? '#4a7fd4' : '#001a5c',
                  color:       selectedWeekId === w.id ? '#ffffff'  : '#3a6090',
                }}
              >
                Week {w.week_number}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Status messages ── */}
      {message && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          {error}
        </p>
      )}

      {/* ── Score entry ── */}
      {selectedWeekId && games.length > 0 && (
        <>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#001a5c' }}>
            <div className="px-4 py-2 flex items-center justify-between" style={{ background: '#000d2e', borderBottom: '1px solid #001040' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#3a6090' }}>
                Final Scores — Week {selectedWeek?.week_number}
              </span>
              <span className="text-[10px]" style={{ color: '#1e3a5f' }}>Away – Home</span>
            </div>
            {games.map((game) => (
              <div
                key={game.id}
                className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: '#001040' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: '#a8c8ff' }}>
                    {game.away_team} @ {game.home_team}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number" min="0" placeholder="–"
                    value={scores[game.id]?.away_score ?? ''}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { ...s[game.id], away_score: e.target.value } }))}
                    className="w-14 text-center rounded-lg border px-2 py-1.5 text-sm"
                    style={{ background: '#000d2e', borderColor: '#001a5c', color: '#d4e4ff' }}
                  />
                  <span style={{ color: '#3a6090' }}>–</span>
                  <input
                    type="number" min="0" placeholder="–"
                    value={scores[game.id]?.home_score ?? ''}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { ...s[game.id], home_score: e.target.value } }))}
                    className="w-14 text-center rounded-lg border px-2 py-1.5 text-sm"
                    style={{ background: '#000d2e', borderColor: '#001a5c', color: '#d4e4ff' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Action buttons ── */}
          <button
            onClick={fetchFromApi}
            disabled={fetching}
            className="w-full py-2.5 rounded-lg text-sm font-bold"
            style={{ background: 'rgba(74,127,212,0.15)', color: '#4a7fd4' }}
          >
            {fetching ? 'Fetching...' : '⬇ Fetch Scores from Odds API'}
          </button>

          <div className="flex gap-3">
            <button
              onClick={saveScores}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: '#001a5c', color: '#a8c8ff' }}
            >
              {saving ? 'Saving...' : 'Save Scores'}
            </button>
            <button
              onClick={resolvePicks}
              disabled={resolving}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: '#003087', color: '#ffffff' }}
            >
              {resolving ? 'Resolving...' : 'Resolve Picks'}
            </button>
          </div>

          <p className="text-[10px] text-center" style={{ color: '#1e3a5f' }}>
            Fetch pulls scores automatically · Save stores manual edits · Resolve updates standings
          </p>
        </>
      )}

      {selectedWeekId && games.length === 0 && (
        <p className="text-center text-sm py-6" style={{ color: '#3a6090' }}>No games for this week.</p>
      )}
    </div>
  )
}

function Spinner() {
  return <div className="py-12 text-center"><span className="text-3xl animate-bounce">📊</span></div>
}
