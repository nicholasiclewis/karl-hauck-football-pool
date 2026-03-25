import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatKickoff, formatSpread } from '../../lib/gameUtils'
import { getTeamConference, CONFERENCE_ORDER } from '../../lib/collegeTeams'

const BLANK = {
  sport: 'nfl',
  away_team: '',
  home_team: '',
  spread: '',
  favorite: 'home',
  kickoff_time: '',
}

export default function GamesTab() {
  const [weeks, setWeeks]               = useState([])
  const [selectedWeekId, setSelectedWeekId] = useState(null)
  const [games, setGames]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [form, setForm]                 = useState(BLANK)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  // Odds API picker state
  const [pickerSport, setPickerSport]         = useState(null)   // 'nfl' | 'college' | null
  const [availableGames, setAvailableGames]   = useState([])
  const [selectedIds, setSelectedIds]         = useState(new Set())
  const [fetching, setFetching]               = useState(false)
  const [addingPicked, setAddingPicked]       = useState(false)
  const [pickerError, setPickerError]         = useState('')
  const [confFilter, setConfFilter]           = useState(null)   // conference name or null = all

  useEffect(() => { loadWeeks() }, [])
  useEffect(() => { if (selectedWeekId) loadGames() }, [selectedWeekId])

  async function loadWeeks() {
    setLoading(true)
    const { data: s } = await supabase.from('seasons').select('id').eq('is_active', true).maybeSingle()
    if (!s) { setLoading(false); return }
    const { data: w } = await supabase.from('weeks').select('*').eq('season_id', s.id).order('week_number')
    const rows = w ?? []
    setWeeks(rows)
    if (rows.length > 0) setSelectedWeekId(rows[0].id)
    setLoading(false)
  }

  async function loadGames() {
    const { data } = await supabase.from('games').select('*').eq('week_id', selectedWeekId).order('kickoff_time')
    setGames(data ?? [])
  }

  // ── Manual add ──────────────────────────────────────────────────────────────

  async function addGame(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const abs = Math.abs(parseFloat(form.spread))
      const storedSpread = form.favorite === 'home' ? -abs : abs
      const { error: err } = await supabase.from('games').insert({
        week_id:      selectedWeekId,
        sport:        form.sport,
        away_team:    form.away_team.trim(),
        home_team:    form.home_team.trim(),
        spread:       storedSpread,
        favorite:     form.favorite,
        kickoff_time: new Date(form.kickoff_time).toISOString(),
      })
      if (err) throw err
      setForm(BLANK)
      await loadGames()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteGame(id) {
    if (!confirm('Delete this game? All picks for it will also be deleted.')) return
    await supabase.from('games').delete().eq('id', id)
    setGames(gs => gs.filter(g => g.id !== id))
  }

  // ── Odds API picker ──────────────────────────────────────────────────────────

  async function openPicker(sport) {
    setPickerSport(sport)
    setAvailableGames([])
    setSelectedIds(new Set())
    setPickerError('')
    setConfFilter(null)
    setFetching(true)
    try {
      const fnName = sport === 'nfl' ? 'fetch-nfl-odds' : 'fetch-college-odds'
      const { data, error: fnErr } = await supabase.functions.invoke(fnName, {
        body: { week_id: selectedWeekId },
      })
      if (fnErr) throw new Error(fnErr.message)
      if (data?.error) throw new Error(data.error)

      // fetch-nfl-odds returns { games } (already inserted), fetch-college-odds returns { games }
      const list = data?.games ?? []
      setAvailableGames(list)
    } catch (err) {
      setPickerError(err.message)
    } finally {
      setFetching(false)
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function addSelectedGames() {
    setAddingPicked(true)
    setPickerError('')
    try {
      const toAdd = availableGames.filter(g => selectedIds.has(g.odds_api_id))
      for (const g of toAdd) {
        await supabase.from('games').upsert({
          week_id:      selectedWeekId,
          sport:        pickerSport,
          away_team:    g.away_team,
          home_team:    g.home_team,
          spread:       g.spread,
          favorite:     g.favorite,
          kickoff_time: g.kickoff_time,
          odds_api_id:  g.odds_api_id,
        }, { onConflict: 'odds_api_id' })
      }
      await loadGames()
      setPickerSport(null)
      setAvailableGames([])
      setSelectedIds(new Set())
    } catch (err) {
      setPickerError(err.message)
    } finally {
      setAddingPicked(false)
    }
  }

  const selectedWeek = weeks.find(w => w.id === selectedWeekId)

  if (loading) return <Spinner icon="🏈" />

  // ── Picker overlay ────────────────────────────────────────────────────────────
  if (pickerSport) {
    const sportLabel = pickerSport === 'nfl' ? 'NFL' : 'College'
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold" style={{ color: '#93c5fd' }}>
            Pick {sportLabel} Games — Week {selectedWeek?.week_number}
          </h2>
          <button
            onClick={() => setPickerSport(null)}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: '#94afd4', background: '#1e293b' }}
          >
            ✕ Cancel
          </button>
        </div>

        {pickerError && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {pickerError}
          </p>
        )}

        {fetching && (
          <div className="py-8 text-center">
            <span className="text-2xl animate-bounce">📡</span>
            <p className="text-xs mt-2" style={{ color: '#94afd4' }}>Fetching from Odds API...</p>
          </div>
        )}

        {!fetching && availableGames.length === 0 && !pickerError && (
          <p className="text-center text-sm py-6" style={{ color: '#94afd4' }}>
            No upcoming {sportLabel} games found with spread data.
          </p>
        )}

        {!fetching && availableGames.length > 0 && (
          <>
            {/* Conference filter chips — college only */}
            {pickerSport === 'college' && (
              <div className="overflow-x-auto">
                <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                  <button
                    onClick={() => setConfFilter(null)}
                    className="px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0"
                    style={{
                      background:  confFilter === null ? '#2563eb' : '#1e293b',
                      borderColor: confFilter === null ? '#60a5fa' : '#374e6b',
                      color:       confFilter === null ? '#ffffff'  : '#94afd4',
                    }}
                  >
                    All
                  </button>
                  {CONFERENCE_ORDER.filter(conf =>
                    availableGames.some(g => getTeamConference(g.home_team) === conf || getTeamConference(g.away_team) === conf)
                  ).map(conf => (
                    <button
                      key={conf}
                      onClick={() => setConfFilter(conf)}
                      className="px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0"
                      style={{
                        background:  confFilter === conf ? '#2563eb' : '#1e293b',
                        borderColor: confFilter === conf ? '#60a5fa' : '#374e6b',
                        color:       confFilter === conf ? '#ffffff'  : '#94afd4',
                      }}
                    >
                      {conf}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const filtered = confFilter
                ? availableGames.filter(g =>
                    getTeamConference(g.home_team) === confFilter ||
                    getTeamConference(g.away_team) === confFilter
                  )
                : availableGames
              return (
                <>
                  <p className="text-xs" style={{ color: '#94afd4' }}>
                    {filtered.length} game{filtered.length !== 1 ? 's' : ''}{confFilter ? ` · ${confFilter}` : ''} · {selectedIds.size} selected
                  </p>
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
                    {filtered.map((game) => {
                const isSelected = selectedIds.has(game.odds_api_id)
                const favTeam = game.favorite === 'home' ? game.home_team : game.away_team
                return (
                  <button
                    key={game.odds_api_id}
                    onClick={() => toggleSelect(game.odds_api_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b text-left transition-colors"
                    style={{
                      borderColor: '#253347',
                      background: isSelected ? 'rgba(74,127,212,0.1)' : 'transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2"
                      style={{
                        background:   isSelected ? '#60a5fa' : 'transparent',
                        borderColor:  isSelected ? '#60a5fa' : '#374e6b',
                      }}
                    >
                      {isSelected && <span className="text-[10px] text-white font-bold">✓</span>}
                    </div>

                    {/* Game info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#f0f6ff' }}>
                        {game.away_team} @ {game.home_team}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#94afd4' }}>
                        {favTeam} {formatSpread(-Math.abs(game.spread))}
                        {' · '}{formatKickoff(game.kickoff_time).split(' · ').slice(1).join(' ')}
                      </p>
                    </div>
                  </button>
                )
                    })}
                  </div>
                </>
              )
            })()}

            <button
              onClick={addSelectedGames}
              disabled={selectedIds.size === 0 || addingPicked}
              className="w-full py-2.5 rounded-lg text-sm font-bold"
              style={{
                background: selectedIds.size > 0 ? '#2563eb' : '#253347',
                color:      selectedIds.size > 0 ? '#ffffff'  : '#94afd4',
              }}
            >
              {addingPicked ? 'Adding...' : `Add ${selectedIds.size} Game${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    )
  }

  // ── Main view ─────────────────────────────────────────────────────────────────
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
                className="px-3 py-1.5 rounded-full text-xs font-medium border"
                style={{
                  background:   selectedWeekId === w.id ? '#2563eb' : '#1e293b',
                  borderColor:  selectedWeekId === w.id ? '#60a5fa' : '#374e6b',
                  color:        selectedWeekId === w.id ? '#ffffff'  : '#94afd4',
                }}
              >
                Week {w.week_number}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedWeekId && (
        <>
          {/* ── Odds API fetch buttons ── */}
          <div className="flex gap-3">
            <button
              onClick={() => openPicker('nfl')}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }}
            >
              📡 Browse NFL Games
            </button>
            <button
              onClick={() => openPicker('college')}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
            >
              📡 Browse College Games
            </button>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#253347' }} />
            <span className="text-xs" style={{ color: '#1e3a5f' }}>or add manually</span>
            <div className="flex-1 h-px" style={{ background: '#253347' }} />
          </div>

          {/* ── Manual add form ── */}
          <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
            <h2 className="text-sm font-bold" style={{ color: '#93c5fd' }}>
              Add Game — Week {selectedWeek?.week_number}
            </h2>
            {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
            <form onSubmit={addGame} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sport">
                  <select value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))} className="input-field w-full">
                    <option value="nfl">NFL</option>
                    <option value="college">College</option>
                  </select>
                </Field>
                <Field label="Favorite">
                  <select value={form.favorite} onChange={e => setForm(f => ({ ...f, favorite: e.target.value }))} className="input-field w-full">
                    <option value="home">Home team</option>
                    <option value="away">Away team</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Away Team">
                  <input type="text" required placeholder="e.g. Kansas City Chiefs" value={form.away_team} onChange={e => setForm(f => ({ ...f, away_team: e.target.value }))} className="input-field w-full" />
                </Field>
                <Field label="Home Team">
                  <input type="text" required placeholder="e.g. Baltimore Ravens" value={form.home_team} onChange={e => setForm(f => ({ ...f, home_team: e.target.value }))} className="input-field w-full" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Spread (pts favorite gives)">
                  <input type="number" step="0.5" min="0" required placeholder="e.g. 3.5" value={form.spread} onChange={e => setForm(f => ({ ...f, spread: e.target.value }))} className="input-field w-full" />
                </Field>
                <Field label="Kickoff (local time)">
                  <input type="datetime-local" required value={form.kickoff_time} onChange={e => setForm(f => ({ ...f, kickoff_time: e.target.value }))} className="input-field w-full" />
                </Field>
              </div>
              <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg text-sm font-bold" style={{ background: '#2563eb', color: '#ffffff' }}>
                {saving ? 'Adding...' : '+ Add Game'}
              </button>
            </form>
          </div>

          {/* ── Games list ── */}
          {games.length === 0 ? (
            <p className="text-center text-sm py-6" style={{ color: '#94afd4' }}>No games yet for this week.</p>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
              {games.map((game) => (
                <div key={game.id} className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#253347' }}>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
                    style={game.sport === 'nfl'
                      ? { background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }
                      : { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
                    }
                  >
                    {game.sport.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#f0f6ff' }}>
                      {game.away_team} @ {game.home_team}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#94afd4' }}>
                      {game.favorite === 'home' ? game.home_team : game.away_team}
                      {' '}{formatSpread(-Math.abs(game.spread))}
                      {' · '}{formatKickoff(game.kickoff_time).split(' · ').slice(1).join(' ')}
                    </p>
                  </div>
                  <button onClick={() => deleteGame(game.id)} className="text-lg flex-shrink-0 px-2 py-1 rounded" style={{ color: '#94afd4' }}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {weeks.length === 0 && !loading && (
        <p className="text-center text-sm py-8" style={{ color: '#94afd4' }}>
          Create a week in the Weeks tab first.
        </p>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>{label}</label>
      {children}
    </div>
  )
}

function Spinner({ icon }) {
  return <div className="py-12 text-center"><span className="text-3xl animate-bounce">{icon}</span></div>
}
