import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatKickoff, formatSpread } from '../../lib/gameUtils'
import { remainingPicks } from '../../lib/gameSelection'

/**
 * Enter picks on a player's behalf.
 *
 * Some players text or email their picks in rather than using the app, and the
 * commissioner enters them. That has to work after kickoff too, since the
 * message often arrives late — the commissioner RLS policy allows it where a
 * player's own policy would not.
 *
 * The per-sport limits still apply: those are enforced by a database trigger,
 * so there is no way to enter a seventh pick from here either.
 */
export default function EntryTab() {
  const [weeks, setWeeks]       = useState([])
  const [players, setPlayers]   = useState([])
  const [weekId, setWeekId]     = useState(null)
  const [userId, setUserId]     = useState('')
  const [games, setGames]       = useState([])
  const [picks, setPicks]       = useState({})
  const [counts, setCounts]     = useState(null) // user id -> { nfl, college }, null until loaded
  const [showDone, setShowDone] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(null)   // game id being written
  const [error, setError]       = useState('')

  useEffect(() => { init() }, [])
  useEffect(() => { if (weekId) { loadGames(); loadCounts() } }, [weekId])
  useEffect(() => { if (weekId && userId) loadPicks() }, [weekId, userId])

  async function init() {
    setLoading(true)
    const { data: s } = await supabase
      .from('seasons').select('id').eq('is_active', true).maybeSingle()
    if (!s) { setLoading(false); return }

    const [{ data: w }, { data: u }] = await Promise.all([
      supabase.from('weeks').select('*').eq('season_id', s.id).order('week_number', { ascending: false }),
      supabase.from('users').select('id,display_name,email').order('display_name'),
    ])
    setWeeks(w ?? [])
    setPlayers(u ?? [])
    // The open week is the one the commissioner is chasing picks for. Weeks
    // are newest-first, so w[0] is the fallback once the season is over.
    if (w?.length) setWeekId((w.find(x => x.picks_open) ?? w[0]).id)
    setLoading(false)
  }

  async function loadGames() {
    const { data } = await supabase
      .from('games').select('*').eq('week_id', weekId).eq('is_featured', true).order('kickoff_time')
    setGames(data ?? [])
  }

  /**
   * How many picks every player has in this week — the summary above the form.
   * Reads the sport off the joined game rather than the local `games` list, so
   * a pick against a game since un-featured still counts.
   */
  async function loadCounts() {
    setCounts(null)
    const { data } = await supabase
      .from('picks')
      .select('user_id, games:game_id ( sport )')
      .eq('week_id', weekId)

    const map = {}
    for (const p of data ?? []) {
      const sport = p.games?.sport
      if (!sport) continue
      map[p.user_id] ??= { nfl: 0, college: 0 }
      map[p.user_id][sport] += 1
    }
    setCounts(map)
  }

  /** Keep the summary in step with a pick the commissioner just entered. */
  function bumpCount(playerId, sport, delta) {
    setCounts(prev => {
      const cur = prev?.[playerId] ?? { nfl: 0, college: 0 }
      return { ...prev, [playerId]: { ...cur, [sport]: Math.max(0, cur[sport] + delta) } }
    })
  }

  async function loadPicks() {
    const { data } = await supabase
      .from('picks').select('*').eq('week_id', weekId).eq('user_id', userId)
    const map = {}
    for (const p of data ?? []) map[p.game_id] = p
    setPicks(map)
  }

  const week = weeks.find(w => w.id === weekId)
  const pickedGames = games.filter(g => picks[g.id])
  const { used, limits, remaining, complete } = remainingPicks(pickedGames, week?.container_type)

  async function setPick(game, side) {
    setError('')
    setSaving(game.id)
    const existing = picks[game.id]
    try {
      // Tapping the current pick clears it.
      if (existing?.picked_team === side) {
        const { error: err } = await supabase
          .from('picks').delete().eq('game_id', game.id).eq('user_id', userId).select('id')
        if (err) throw err
        setPicks(p => { const n = { ...p }; delete n[game.id]; return n })
        bumpCount(userId, game.sport, -1)
        return
      }

      if (!existing && remaining[game.sport] === 0) {
        throw new Error(
          `${limits[game.sport]} ${game.sport === 'nfl' ? 'NFL' : 'college'} pick(s) already entered. ` +
          `Clear one first.`
        )
      }

      const { data, error: err } = await supabase
        .from('picks')
        .upsert({
          user_id:     userId,
          game_id:     game.id,
          week_id:     weekId,
          picked_team: side,
          // A pick entered after kickoff is already final.
          is_locked:   new Date(game.kickoff_time) <= new Date(),
          updated_at:  new Date().toISOString(),
        }, { onConflict: 'user_id,game_id' })
        .select()
      if (err) throw err
      if (data?.[0]) setPicks(p => ({ ...p, [game.id]: data[0] }))
      // Switching sides on a game already picked is not a new pick.
      if (!existing) bumpCount(userId, game.sport, 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="py-12 text-center"><span className="text-3xl animate-bounce">✍️</span></div>
  if (weeks.length === 0) return <p className="text-center text-sm py-8" style={{ color: '#94afd4' }}>No weeks yet.</p>

  const player = players.find(p => p.id === userId)

  // ── Week roster ──
  // Every player with their count for this week, short ones first so the
  // commissioner sees who still owes picks without reading the whole list.
  const slate = limits.nfl + limits.college
  const roster = players
    .map(p => {
      const c = counts?.[p.id] ?? { nfl: 0, college: 0 }
      return {
        ...p,
        ...c,
        total:    c.nfl + c.college,
        complete: c.nfl === limits.nfl && c.college === limits.college,
      }
    })
    .sort((a, b) =>
      a.complete !== b.complete ? (a.complete ? 1 : -1)
      : a.total   !== b.total   ? a.total - b.total
      : a.display_name.localeCompare(b.display_name)
    )
  const short = roster.filter(r => !r.complete)
  const done  = roster.filter(r => r.complete)

  return (
    <div className="space-y-4">
      {/* ── Week + player selection ── */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
        <h2 className="text-sm font-bold" style={{ color: '#93c5fd' }}>Enter Picks For a Player</h2>
        <p className="text-xs" style={{ color: '#94afd4' }}>
          For picks phoned, texted or emailed in. Works after kickoff.
        </p>

        <label className="block">
          <span className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>Week</span>
          <select value={weekId ?? ''} onChange={e => setWeekId(e.target.value)} className="input-field w-full">
            {weeks.map(w => (
              <option key={w.id} value={w.id}>
                Week {w.week_number} — {w.container_type === 'nfl_college' ? '4 NFL + 2 CFB'
                  : w.container_type === 'nfl_only' ? '6 NFL' : '6 CFB'}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>Player</span>
          <select value={userId} onChange={e => setUserId(e.target.value)} className="input-field w-full">
            <option value="">— select a player —</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Who still owes picks ── */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold" style={{ color: '#93c5fd' }}>
            Week {week?.week_number} roster
          </h2>
          {counts && (
            <span
              className="text-xs font-semibold"
              style={{ color: short.length ? '#f5b301' : '#10b981' }}
            >
              {roster.length === 0
                ? 'No players yet'
                : short.length === 0
                ? `All ${roster.length} in`
                : `${short.length} of ${roster.length} still short`}
            </span>
          )}
        </div>

        {!counts ? (
          <p className="text-xs" style={{ color: '#94afd4' }}>Counting picks…</p>
        ) : (
          <>
            {short.length > 0 && (
              <div className="space-y-1.5">
                {short.map(p => (
                  <RosterRow
                    key={p.id}
                    player={p}
                    slate={slate}
                    limits={limits}
                    selected={p.id === userId}
                    onSelect={() => setUserId(p.id)}
                  />
                ))}
              </div>
            )}

            {done.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDone(v => !v)}
                  className="text-[11px] underline"
                  style={{ color: '#94afd4' }}
                >
                  {showDone ? 'Hide' : 'Show'} {done.length} with a full slate
                </button>
                {showDone && (
                  <div className="space-y-1.5">
                    {done.map(p => (
                      <RosterRow
                        key={p.id}
                        player={p}
                        slate={slate}
                        limits={limits}
                        selected={p.id === userId}
                        onSelect={() => setUserId(p.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
          {error}
        </p>
      )}

      {!userId ? (
        <p className="text-center text-sm py-8" style={{ color: '#94afd4' }}>
          Pick a player to enter their week.
        </p>
      ) : games.length === 0 ? (
        <p className="text-center text-sm py-8" style={{ color: '#94afd4' }}>
          No games in play for this week yet.
        </p>
      ) : (
        <>
          {/* ── Progress ── */}
          <div
            className="rounded-xl border px-4 py-2.5 flex items-center justify-between"
            style={{
              background:  complete ? 'rgba(16,185,129,0.08)' : 'rgba(74,127,212,0.08)',
              borderColor: complete ? 'rgba(16,185,129,0.35)' : 'rgba(74,127,212,0.35)',
            }}
          >
            <span className="text-xs font-semibold" style={{ color: complete ? '#10b981' : '#60a5fa' }}>
              {complete ? `✓ ${player?.display_name} is set` : `${player?.display_name}'s picks`}
            </span>
            <span className="text-xs" style={{ color: '#94afd4' }}>
              {limits.nfl > 0 && `NFL ${used.nfl}/${limits.nfl}`}
              {limits.nfl > 0 && limits.college > 0 && ' · '}
              {limits.college > 0 && `CFB ${used.college}/${limits.college}`}
            </span>
          </div>

          {/* ── Games ── */}
          <div className="space-y-2">
            {games.map(game => {
              const pick    = picks[game.id]
              const started = new Date(game.kickoff_time) <= new Date()
              const blocked = !pick && remaining[game.sport] === 0
              return (
                <div
                  key={game.id}
                  className="rounded-xl border p-3"
                  style={{
                    background: '#1e293b',
                    borderColor: pick ? '#60a5fa' : '#374e6b',
                    opacity: blocked ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded"
                      style={game.sport === 'nfl'
                        ? { background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }
                        : { background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                    >
                      {game.sport.toUpperCase()}
                    </span>
                    <span className="text-[11px]" style={{ color: '#94afd4' }}>
                      {formatKickoff(game.kickoff_time)}
                    </span>
                    {started && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,179,1,0.15)', color: '#f5b301' }}>
                        started
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {['away', 'home'].map(side => {
                      const team   = side === 'home' ? game.home_team : game.away_team
                      const spread = side === 'home' ? game.spread : -game.spread
                      const on     = pick?.picked_team === side
                      return (
                        <button
                          key={side}
                          onClick={() => setPick(game, side)}
                          disabled={saving === game.id || (blocked && !on)}
                          className="flex-1 py-2 px-2 rounded-lg border-2 text-center"
                          style={{
                            borderColor: on ? '#60a5fa' : '#374e6b',
                            background:  on ? 'rgba(74,127,212,0.15)' : '#0f172a',
                            color:       on ? '#93c5fd' : '#94afd4',
                          }}
                        >
                          <span className="block text-[12px] font-bold leading-tight">{team}</span>
                          <span className="block text-[10px] opacity-80">{formatSpread(spread)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * One line of the week roster. Tapping it loads that player into the form
 * below, which is the whole point of the list — the short names are the ones
 * the commissioner is about to chase.
 */
function RosterRow({ player, slate, limits, selected, onSelect }) {
  const isShort = !player.complete
  // Only a mixed week needs the split spelled out; in a single-sport week the
  // total already says everything.
  const split = limits.nfl > 0 && limits.college > 0
    ? `NFL ${player.nfl}/${limits.nfl} · CFB ${player.college}/${limits.college}`
    : ''

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left"
      style={{
        background:  isShort ? 'rgba(245,179,1,0.08)' : '#0f172a',
        borderColor: selected ? '#60a5fa' : isShort ? 'rgba(245,179,1,0.35)' : '#374e6b',
      }}
    >
      <span
        className="text-xs font-semibold truncate"
        style={{ color: isShort ? '#f0f6ff' : '#94afd4' }}
      >
        {player.display_name}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {split && <span className="text-[10px]" style={{ color: '#94afd4' }}>{split}</span>}
        <span
          className="text-xs font-bold"
          style={{ color: isShort ? '#f5b301' : '#10b981' }}
        >
          {isShort ? `${player.total}/${slate}` : '✓'}
        </span>
      </span>
    </button>
  )
}
