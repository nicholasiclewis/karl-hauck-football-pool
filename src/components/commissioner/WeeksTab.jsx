import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const CONTAINER_TYPES = [
  { value: 'nfl_college',   label: '4 NFL + 2 College' },
  { value: 'nfl_only',      label: '6 NFL Only' },
  { value: 'college_only',  label: '6 College Only' },
]

const COLLEGE_FOCUSES = [
  { value: 'power4',    label: 'Power 4' },
  { value: 'group5',    label: 'Group of 5' },
  { value: 'top25',     label: 'Top 25' },
  { value: 'rivalry',   label: 'Rivalry' },
  { value: 'confchamp', label: 'Conf. Championships' },
  { value: 'cfp',       label: 'CFP' },
]

const CONFERENCES = {
  power4: ['SEC', 'Big Ten', 'Big 12', 'ACC'],
  group5: ['AAC', 'Mountain West', 'Conference USA', 'MAC', 'Sun Belt'],
}

const BLANK = {
  week_number: '',
  container_type: 'nfl_college',
  college_focus: 'power4',
  conference: '',
  week_start: '',
}

export default function WeeksTab() {
  const [season, setSeason] = useState(null)
  const [weeks, setWeeks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]     = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: s } = await supabase.from('seasons').select('id,year').eq('is_active', true).maybeSingle()
    if (!s) { setLoading(false); return }
    setSeason(s)
    const { data: w } = await supabase.from('weeks').select('*').eq('season_id', s.id).order('week_number')
    const rows = w ?? []
    setWeeks(rows)
    setForm(f => ({ ...f, week_number: rows.length + 1 }))
    setLoading(false)
  }

  async function createWeek(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const needsCollege = form.container_type !== 'nfl_only'
      const needsConf    = needsCollege && ['power4', 'group5'].includes(form.college_focus)
      const { error: err } = await supabase.from('weeks').insert({
        season_id:     season.id,
        week_number:   parseInt(form.week_number),
        container_type: form.container_type,
        college_focus: needsCollege ? (form.college_focus || null) : null,
        conference:    needsConf    ? (form.conference || null)    : null,
        picks_open:    false,
        is_complete:   false,
        week_start:    form.week_start,
      })
      if (err) throw err
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleOpen(week) {
    const newVal = !week.picks_open
    await supabase.from('weeks').update({ picks_open: newVal }).eq('id', week.id)
    setWeeks(ws => ws.map(w => w.id === week.id ? { ...w, picks_open: newVal } : w))
  }

  async function markComplete(week) {
    if (!confirm(`Mark Week ${week.week_number} complete? This closes picks.`)) return
    await supabase.from('weeks').update({ is_complete: true, picks_open: false }).eq('id', week.id)
    setWeeks(ws => ws.map(w => w.id === week.id ? { ...w, is_complete: true, picks_open: false } : w))
  }

  async function deleteWeek(week) {
    if (!confirm(`Delete Week ${week.week_number}? All games and picks will be permanently deleted.`)) return
    await supabase.from('weeks').delete().eq('id', week.id)
    setWeeks(ws => ws.filter(w => w.id !== week.id))
  }

  const needsCollege = form.container_type !== 'nfl_only'
  const needsConf    = needsCollege && ['power4', 'group5'].includes(form.college_focus)

  if (loading) return <Spinner icon="📅" />

  return (
    <div className="space-y-5">
      {/* ── Create form ── */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
        <h2 className="text-sm font-bold" style={{ color: '#93c5fd' }}>Create Week</h2>
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
        <form onSubmit={createWeek} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Week #">
              <input
                type="number" min="1" required
                value={form.week_number}
                onChange={e => setForm(f => ({ ...f, week_number: e.target.value }))}
                className="input-field w-full"
              />
            </Field>
            <Field label="Week Start Date">
              <input
                type="date" required
                value={form.week_start}
                onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))}
                className="input-field w-full"
              />
            </Field>
          </div>
          <Field label="Type">
            <select
              value={form.container_type}
              onChange={e => setForm(f => ({ ...f, container_type: e.target.value }))}
              className="input-field w-full"
            >
              {CONTAINER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          {needsCollege && (
            <Field label="College Focus">
              <select
                value={form.college_focus}
                onChange={e => setForm(f => ({ ...f, college_focus: e.target.value, conference: '' }))}
                className="input-field w-full"
              >
                {COLLEGE_FOCUSES.map(cf => <option key={cf.value} value={cf.value}>{cf.label}</option>)}
              </select>
            </Field>
          )}
          {needsConf && (
            <Field label="Conference">
              <select
                value={form.conference}
                onChange={e => setForm(f => ({ ...f, conference: e.target.value }))}
                className="input-field w-full"
              >
                <option value="">— select —</option>
                {(CONFERENCES[form.college_focus] ?? []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}
          <button
            type="submit" disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-bold"
            style={{ background: '#2563eb', color: '#ffffff' }}
          >
            {saving ? 'Creating...' : '+ Create Week'}
          </button>
        </form>
      </div>

      {/* ── Weeks list ── */}
      {weeks.length === 0 ? (
        <p className="text-center text-sm py-8" style={{ color: '#94afd4' }}>No weeks yet. Create one above.</p>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
          {weeks.map((week) => (
            <div
              key={week.id}
              className="flex items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: '#253347' }}
            >
              {/* Number circle */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 border-2"
                style={{
                  color:        week.is_complete ? '#10b981' : week.picks_open ? '#60a5fa' : '#94afd4',
                  borderColor:  week.is_complete ? '#10b981' : week.picks_open ? '#60a5fa' : '#374e6b',
                }}
              >
                {week.week_number}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#f0f6ff' }}>Week {week.week_number}</p>
                <p className="text-xs mt-0.5" style={{ color: '#94afd4' }}>
                  {week.container_type === 'nfl_college' ? '4 NFL · 2 CFB'
                    : week.container_type === 'nfl_only' ? '6 NFL' : '6 CFB'}
                  {week.conference ? ` · ${week.conference}` : ''}
                  {' · '}{week.week_start}
                </p>
              </div>

              {/* Status */}
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={week.is_complete
                  ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
                  : week.picks_open
                  ? { background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }
                  : { background: 'rgba(58,96,144,0.15)',  color: '#94afd4' }
                }
              >
                {week.is_complete ? 'Complete' : week.picks_open ? 'Open' : 'Closed'}
              </span>

              {/* Actions */}
              <div className="flex gap-1.5 flex-shrink-0">
                {!week.is_complete && (
                  <button
                    onClick={() => toggleOpen(week)}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                    style={week.picks_open
                      ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
                      : { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
                    }
                  >
                    {week.picks_open ? 'Close' : 'Open'}
                  </button>
                )}
                {!week.is_complete && (
                  <button
                    onClick={() => markComplete(week)}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                    style={{ background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }}
                  >
                    ✓ Done
                  </button>
                )}
                <button
                  onClick={() => deleteWeek(week)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ color: '#94afd4' }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
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
  return (
    <div className="py-12 text-center">
      <span className="text-3xl animate-bounce">{icon}</span>
    </div>
  )
}
