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
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(null)   // game id being written
  const [error, setError]       = useState('')

  useEffect(() => { init() }, [])
  useEffect(() => { if (weekId) loadGames() }, [weekId])
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
    if (w?.length) setWeekId(w[0].id)
    setLoading(false)
  }

  async function loadGames() {
    const { data } = await supabase
      .from('games').select('*').eq('week_id', weekId).eq('is_featured', true).order('kickoff_time')
    setGames(data ?? [])
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
    try {
      // Tapping the current pick clears it.
      if (picks[game.id]?.picked_team === side) {
        const { error: err } = await supabase
          .from('picks').delete().eq('game_id', game.id).eq('user_id', userId).select('id')
        if (err) throw err
        setPicks(p => { const n = { ...p }; delete n[game.id]; return n })
        return
      }

      if (!picks[game.id] && remaining[game.sport] === 0) {
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
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="py-12 text-center"><span className="text-3xl animate-bounce">✍️</span></div>
  if (weeks.length === 0) return <p className="text-center text-sm py-8" style={{ color: '#94afd4' }}>No weeks yet.</p>

  const player = players.find(p => p.id === userId)

  return (
    <div className="space-y-4">
      {/* ── Week + player selection ── */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
        <h2 className="text-sm font-bold" style={{ color: '#93c5fd' }}>Enter Picks For a Player</h2>
        <p className="text-xs" style={{ color: '#94afd4' }}>
          For picks phoned, texted or emailed in. Works after kickoff.
        </p>

        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>Week</label>
          <select value={weekId ?? ''} onChange={e => setWeekId(e.target.value)} className="input-field w-full">
            {weeks.map(w => (
              <option key={w.id} value={w.id}>
                Week {w.week_number} — {w.container_type === 'nfl_college' ? '4 NFL + 2 CFB'
                  : w.container_type === 'nfl_only' ? '6 NFL' : '6 CFB'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>Player</label>
          <select value={userId} onChange={e => setUserId(e.target.value)} className="input-field w-full">
            <option value="">— select a player —</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
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
