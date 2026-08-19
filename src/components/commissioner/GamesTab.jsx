import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatKickoff, formatSpread } from '../../lib/gameUtils'
import { getTeamConference, CONFERENCE_ORDER } from '../../lib/conferences'
import { fetchTop25ForDate, buildRankMap, rankOf } from '../../lib/rankings'
import { weekWindow, formatWeekWindow } from '../../lib/weekWindow'
import { pickLimits } from '../../lib/gameSelection'

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
  const [confFilter, setConfFilter]           = useState(null)   // conference name, 'TOP25', or null = all
  const [rankMap, setRankMap]                 = useState(null)   // normalized team name -> rank
  const [rankLabel, setRankLabel]             = useState('')
  const [importing, setImporting]             = useState(false)
  const [importResult, setImportResult]       = useState('')

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
    // Commissioner sees everything: the featured slate plus any unselected
    // candidates the Tuesday import brought in. Featured float to the top.
    const { data } = await supabase
      .from('games').select('*').eq('week_id', selectedWeekId)
      .order('is_featured', { ascending: false })
      .order('kickoff_time')
    setGames(data ?? [])
  }

  /**
   * Run the same import the Tuesday cron runs, for the selected week.
   * Needed when a week is created after its Tuesday has already passed, so
   * the scheduled run found nothing to fill.
   */
  async function importOdds() {
    setImporting(true)
    setImportResult('')
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const res = await fetch(`/api/sync-week-odds?week_id=${selectedWeekId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const out = await res.json()
      if (!res.ok || out.ok === false) throw new Error(out.error ?? `HTTP ${res.status}`)

      if (out.skipped) {
        setImportResult(out.skipped)
      } else {
        const short = out.shortfall?.nfl || out.shortfall?.college
        setImportResult(
          `${out.candidates} game${out.candidates === 1 ? '' : 's'} found · ` +
          `${out.inserted} new · ${out.refreshed} refreshed` +
          (out.featuredApplied ? ` · ${out.featuredApplied} starred` : '') +
          (out.featuredSkipped ? ' · kept your existing picks' : '') +
          (short ? ` · short ${out.shortfall.nfl} NFL / ${out.shortfall.college} CFB` : '') +
          (out.warning ? ` · ${out.warning}` : '')
        )
      }
      await loadGames()
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  async function toggleFeatured(game) {
    const next = !game.is_featured
    const { error: err } = await supabase
      .from('games').update({ is_featured: next }).eq('id', game.id)
    if (err) { setError(err.message); return }
    setGames(gs => gs.map(g => (g.id === game.id ? { ...g, is_featured: next } : g)))
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
    // Check the write before dropping the row locally — a failed delete
    // otherwise looks done until the next reload. Same handling as
    // toggleFeatured above.
    const { error: err } = await supabase.from('games').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setGames(gs => gs.filter(g => g.id !== id))
  }

  // ── Odds API picker ──────────────────────────────────────────────────────────

  async function openPicker(sport) {
    const week = weeks.find(w => w.id === selectedWeekId)
    setPickerSport(sport)
    setAvailableGames([])
    setSelectedIds(new Set())
    setPickerError('')

    // Pre-apply the week's plan: an SEC week opens on the SEC chip, a Top 25
    // week opens on Top 25. Saves a tap and makes the plan visible.
    if (sport === 'college' && week?.college_focus === 'top25') setConfFilter('TOP25')
    else if (sport === 'college' && week?.conference) setConfFilter(week.conference)
    else setConfFilter(null)

    // Rankings power the Top 25 chip and the rank badges.
    if (sport === 'college' && week?.week_start) {
      setRankMap(null)
      setRankLabel('')
      fetchTop25ForDate(week.week_start)
        .then(poll => { setRankMap(buildRankMap(poll)); setRankLabel(poll.headline) })
        .catch(() => setRankLabel('rankings unavailable'))
    }

    setFetching(true)
    try {
      // Read-only listing from the same code path as the import, so it applies
      // this week's window and focus. The old fetch-nfl-odds edge function
      // upserted every event it saw, meaning simply opening the picker wrote
      // the league's whole schedule into the week.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const res = await fetch(`/api/sync-week-odds?week_id=${selectedWeekId}&list=1`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${res.status}`)

      setAvailableGames((data.games ?? []).filter(g => g.sport === sport))
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

  /** Select or clear every game currently passing the filters. */
  function setAllFiltered(list, selected) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const g of list) selected ? next.add(g.odds_api_id) : next.delete(g.odds_api_id)
      return next
    })
  }

  async function addSelectedGames() {
    setAddingPicked(true)
    setPickerError('')
    try {
      const toAdd = availableGames.filter(g => selectedIds.has(g.odds_api_id))
      // Anything added here is eligible for players to pick from, however many
      // there are — they choose their own slate out of the pool.
      // One request rather than one per game: a select-all can be 90 rows.
      const { error: err } = await supabase.from('games').upsert(
        toAdd.map(g => ({
          week_id:      selectedWeekId,
          sport:        pickerSport,
          away_team:    g.away_team,
          home_team:    g.home_team,
          spread:       g.spread,
          favorite:     g.favorite,
          kickoff_time: g.kickoff_time,
          odds_api_id:  g.odds_api_id,
          is_featured:  true,
        })),
        { onConflict: 'odds_api_id' }
      )
      if (err) throw err
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
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
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
            {/* The server already limits this to the week's Tue–Mon window */}
            {selectedWeek?.week_start && (
              <p className="text-xs" style={{ color: '#94afd4' }}>
                Showing games for {formatWeekWindow(weekWindow(selectedWeek.week_start))}
              </p>
            )}

            {/* Conference + Top 25 filter chips — college only */}
            {pickerSport === 'college' && (
              <div className="overflow-x-auto">
                <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                  <Chip active={confFilter === null} onClick={() => setConfFilter(null)}>All</Chip>
                  <Chip
                    active={confFilter === 'TOP25'}
                    onClick={() => setConfFilter('TOP25')}
                    disabled={!rankMap}
                    title={rankLabel || 'Loading rankings…'}
                  >
                    ★ Top 25
                  </Chip>
                  {CONFERENCE_ORDER.filter(conf =>
                    availableGames.some(g => getTeamConference(g.home_team) === conf || getTeamConference(g.away_team) === conf)
                  ).map(conf => (
                    <Chip key={conf} active={confFilter === conf} onClick={() => setConfFilter(conf)}>
                      {conf}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              let filtered = availableGames
              if (confFilter === 'TOP25') {
                filtered = filtered.filter(g =>
                  rankOf(g.home_team, rankMap) !== null || rankOf(g.away_team, rankMap) !== null
                )
              } else if (confFilter) {
                filtered = filtered.filter(g =>
                  getTeamConference(g.home_team) === confFilter ||
                  getTeamConference(g.away_team) === confFilter
                )
              }
              const filterLabel = confFilter === 'TOP25' ? 'Top 25' : confFilter
              return (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs" style={{ color: '#94afd4' }}>
                      {filtered.length} game{filtered.length !== 1 ? 's' : ''}{filterLabel ? ` · ${filterLabel}` : ''} · {selectedIds.size} selected
                      {confFilter === 'TOP25' && rankLabel ? ` · ${rankLabel}` : ''}
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                      {(() => {
                        const allOn = filtered.length > 0 &&
                          filtered.every(g => selectedIds.has(g.odds_api_id))
                        return (
                          <button
                            onClick={() => setAllFiltered(filtered, !allOn)}
                            disabled={filtered.length === 0}
                            className="text-xs px-3 py-1 rounded-lg font-semibold border"
                            style={{
                              background: 'rgba(96,150,232,0.15)',
                              borderColor: '#6096e8',
                              color: '#6096e8',
                              opacity: filtered.length === 0 ? 0.4 : 1,
                            }}
                          >
                            {allOn ? 'Deselect all' : `Select all${filterLabel ? ` ${filterLabel}` : ''}`}
                          </button>
                        )
                      })()}
                      {selectedIds.size > 0 && (
                        <button
                          onClick={() => setSelectedIds(new Set())}
                          className="text-xs px-3 py-1 rounded-lg"
                          style={{ background: '#1e293b', color: '#94afd4' }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
                    {filtered.map((game) => {
                const isSelected = selectedIds.has(game.odds_api_id)
                const favTeam = game.favorite === 'home' ? game.home_team : game.away_team
                return (
                  <button
                    key={game.odds_api_id}
                    onClick={() => toggleSelect(game.odds_api_id)}
                    aria-pressed={isSelected}
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
                        <Rank n={rankOf(game.away_team, rankMap)} />{game.away_team}
                        {' @ '}
                        <Rank n={rankOf(game.home_team, rankMap)} />{game.home_team}
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
              {addingPicked
                ? 'Adding...'
                : `Add ${selectedIds.size} Game${selectedIds.size !== 1 ? 's' : ''}`}
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
                aria-pressed={selectedWeekId === w.id}
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
          {/* ── Auto-import (same job the Tuesday cron runs) ── */}
          <div className="space-y-2">
            <button
              onClick={importOdds}
              disabled={importing}
              className="w-full py-2.5 rounded-lg text-sm font-bold border"
              style={{
                background: 'rgba(245,179,1,0.12)',
                borderColor: 'rgba(245,179,1,0.4)',
                color: '#f5b301',
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing ? 'Importing…' : '🔄 Import odds for this week'}
            </button>
            <p className="text-[11px]" style={{ color: '#94afd4' }}>
              Pulls every game in this week's window and stars a suggested slate.
              Use it when a week was added after its Tuesday. Your existing
              starred games are never overwritten.
            </p>
            {importResult && (
              <p className="text-xs px-3 py-2 rounded-lg"
                 style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                {importResult}
              </p>
            )}
          </div>

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
            {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
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
            <>
              {/* Slate counter: how the featured picks compare to what the
                  week's container type requires. */}
              {(() => {
                // Players choose their own slate from everything eligible, so
                // the pool only has to be big enough to pick from.
                const limits = pickLimits(selectedWeek?.container_type)
                const live = games.filter(g => g.is_featured)
                const nfl  = live.filter(g => g.sport === 'nfl').length
                const cfb  = live.filter(g => g.sport === 'college').length
                const ok   = nfl >= limits.nfl && cfb >= limits.college
                return (
                  <div
                    className="rounded-xl border px-4 py-2.5"
                    style={{
                      background:  ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      borderColor: ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold" style={{ color: ok ? '#10b981' : '#f87171' }}>
                        {ok ? '✓ Enough games' : 'Not enough games'}
                      </span>
                      <span className="text-xs" style={{ color: '#94afd4' }}>
                        {nfl} NFL · {cfb} CFB eligible
                      </span>
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: '#94afd4' }}>
                      Players pick {[
                        limits.nfl ? `${limits.nfl} NFL` : null,
                        limits.college ? `${limits.college} college` : null,
                      ].filter(Boolean).join(' + ')} from these
                      {!ok && ' — import more or the week cannot be completed'}
                    </p>
                  </div>
                )
              })()}

              <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center gap-3 px-4 py-3 border-b"
                    style={{ borderColor: '#253347', opacity: game.is_featured ? 1 : 0.55 }}
                  >
                    {/* Star toggles whether the game is in play this week */}
                    <button
                      onClick={() => toggleFeatured(game)}
                      title={game.is_featured ? 'In play — tap to make a candidate' : 'Candidate — tap to put in play'}
                      aria-pressed={game.is_featured}
                      aria-label={`${game.away_team} at ${game.home_team} — in play`}
                      className="text-lg flex-shrink-0 px-1"
                      style={{ color: game.is_featured ? '#f5b301' : '#4a6585' }}
                    >
                      <span aria-hidden="true">{game.is_featured ? '★' : '☆'}</span>
                    </button>
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
                    <button
                      onClick={() => deleteGame(game.id)}
                      aria-label={`Delete ${game.away_team} at ${game.home_team}`}
                      className="text-lg flex-shrink-0 px-2 py-1 rounded"
                      style={{ color: '#94afd4' }}
                    >
                      <span aria-hidden="true">🗑</span>
                    </button>
                  </div>
                ))}
              </div>
            </>
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
  // The wrapper is the <label> so the control inside is associated with it
  // implicitly — previously the label sat as a sibling and pointed at nothing,
  // leaving these inputs unnamed to a screen reader.
  return (
    <label className="block">
      <span className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>{label}</span>
      {children}
    </label>
  )
}

function Spinner({ icon }) {
  return <div className="py-12 text-center"><span className="text-3xl animate-bounce">{icon}</span></div>
}

/** Filter pill used for conference / Top 25 selection. */
function Chip({ active, onClick, disabled = false, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className="px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0"
      style={{
        background:  active ? '#2563eb' : '#1e293b',
        borderColor: active ? '#60a5fa' : '#374e6b',
        color:       active ? '#ffffff' : '#94afd4',
        opacity:     disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

/** AP rank prefix, e.g. the "#3" in "#3 Ohio State Buckeyes". */
function Rank({ n }) {
  if (n == null) return null
  return <span style={{ color: '#f5b301', fontWeight: 700 }}>#{n} </span>
}
