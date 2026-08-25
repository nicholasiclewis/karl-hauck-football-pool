import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchScores, refreshStandings } from '../../lib/oddsApi'

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
    // Featured only — scores are entered for the six games in play, not for
    // the unselected candidates the Tuesday import leaves in the table.
    const { data } = await supabase.from('games').select('*').eq('week_id', selectedWeekId).eq('is_featured', true).order('kickoff_time')
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

      // The sync writes whatever has finished and resolves the week as it
      // goes, so say what landed and what is still being played rather than
      // reporting a count against the whole slate.
      if (result.skipped) {
        setMessage(result.skipped)
      } else {
        const waiting = result.stillOpen?.length ?? 0
        setMessage(
          `✓ ${result.updated} game${result.updated === 1 ? '' : 's'} scored and points updated` +
          (waiting ? ` · ${waiting} still in progress` : '') + '.'
        )
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setFetching(false)
    }
  }

  /**
   * Re-grade the week and rebuild everyone's totals.
   *
   * Goes through the same endpoint the scheduler uses, so the numbers written
   * here are produced by exactly the code that writes them automatically. This
   * used to be a second implementation of the scoring rules living in the
   * browser, which is one edit away from disagreeing with the real one.
   *
   * The case that needs it: picks entered after a week's games have finished
   * arrive ungraded, and nothing is still in progress to set them off.
   */
  async function refreshStandingsNow() {
    setResolving(true)
    setError('')
    setMessage('')
    try {
      const result = await refreshStandings(selectedWeekId)
      await loadGames()

      const graded = result.resolved?.[0]
      setMessage(
        graded
          ? `✓ Standings refreshed — ${graded.games} game${graded.games === 1 ? '' : 's'} graded ` +
            `across ${graded.players} player${graded.players === 1 ? '' : 's'}.`
          : '✓ Standings refreshed — nothing to grade yet.'
      )
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
          <label className="text-xs font-semibold block mb-2" style={{ color: '#94afd4' }}>Select Week</label>
          <div className="flex gap-2 flex-wrap">
            {weeks.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWeekId(w.id)}
                aria-pressed={selectedWeekId === w.id}
                className="px-3 py-1.5 rounded-full text-xs font-medium border"
                style={{
                  background:  selectedWeekId === w.id ? '#2563eb' : '#1e293b',
                  borderColor: selectedWeekId === w.id ? '#60a5fa' : '#374e6b',
                  color:       selectedWeekId === w.id ? '#ffffff'  : '#94afd4',
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
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
          {error}
        </p>
      )}

      {/* ── Score entry ── */}
      {selectedWeekId && games.length > 0 && (
        <>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
            <div className="px-4 py-2 flex items-center justify-between" style={{ background: '#1e293b', borderBottom: '1px solid #253347' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94afd4' }}>
                Final Scores — Week {selectedWeek?.week_number}
              </span>
              <span className="text-[10px]" style={{ color: '#94afd4' }}>Away – Home</span>
            </div>
            {games.map((game) => (
              <div
                key={game.id}
                className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: '#253347' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: '#93c5fd' }}>
                    {game.away_team} @ {game.home_team}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number" min="0" placeholder="–"
                    aria-label={`${game.away_team} score`}
                    value={scores[game.id]?.away_score ?? ''}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { ...s[game.id], away_score: e.target.value } }))}
                    className="w-14 text-center rounded-lg border px-2 py-1.5 text-sm"
                    style={{ background: '#1e293b', borderColor: '#374e6b', color: '#f0f6ff' }}
                  />
                  <span style={{ color: '#94afd4' }}>–</span>
                  <input
                    type="number" min="0" placeholder="–"
                    aria-label={`${game.home_team} score`}
                    value={scores[game.id]?.home_score ?? ''}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { ...s[game.id], home_score: e.target.value } }))}
                    className="w-14 text-center rounded-lg border px-2 py-1.5 text-sm"
                    style={{ background: '#1e293b', borderColor: '#374e6b', color: '#f0f6ff' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Action buttons ── */}
          <button
            onClick={fetchFromApi}
            disabled={fetching}
            className="w-full py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }}
          >
            {fetching ? 'Fetching...' : '⬇ Fetch Scores'}
          </button>

          <div className="flex gap-3">
            <button
              onClick={saveScores}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#374e6b', color: '#93c5fd' }}
            >
              {saving ? 'Saving...' : 'Save Scores'}
            </button>
            <button
              onClick={refreshStandingsNow}
              disabled={resolving}
              title="Re-grade every pick in this week and rebuild the standings"
              className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#2563eb', color: '#ffffff' }}
            >
              {resolving ? 'Refreshing...' : '↻ Refresh Standings'}
            </button>
          </div>

          <p className="text-[10px] text-center" style={{ color: '#94afd4' }}>
            Fetch pulls finals · Save stores manual edits · Refresh re-grades picks added later
          </p>
        </>
      )}

      {selectedWeekId && games.length === 0 && (
        <p className="text-center text-sm py-6" style={{ color: '#94afd4' }}>No games for this week.</p>
      )}
    </div>
  )
}

function Spinner() {
  return <div className="py-12 text-center"><span className="text-3xl animate-bounce">📊</span></div>
}
