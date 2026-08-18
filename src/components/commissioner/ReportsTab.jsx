import { useState, useEffect } from 'react'
import { downloadReport } from '../../lib/exportPdf'
import { supabase } from '../../lib/supabase'
import {
  loadResultsData, loadGamesData,
  buildResultsEmail, buildGamesEmail,
  buildResultsPdf, buildGamesPdf,
} from '../../lib/weeklyExports'

/**
 * Weekly handouts and the season report.
 *
 * Results and the new slate go out as two separate messages, so each is built
 * on its own. Both produce a PDF to attach and plain text to paste into the
 * message body — these are sent by hand, not delivered by the app.
 */
export default function ReportsTab() {
  const [weeks, setWeeks]   = useState([])
  const [weekId, setWeekId] = useState('')
  const [busy, setBusy]     = useState('')
  const [error, setError]   = useState('')
  const [preview, setPreview] = useState(null)   // { kind, subject, body }
  const [copied, setCopied] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: s } = await supabase
      .from('seasons').select('id').eq('is_active', true).maybeSingle()
    if (!s) return
    const { data: w } = await supabase
      .from('weeks').select('id,week_number,container_type,college_focus,conference,week_start,is_complete')
      .eq('season_id', s.id).order('week_number', { ascending: false })
    setWeeks(w ?? [])
    if (w?.length) setWeekId(w[0].id)
  }

  async function run(kind, fn) {
    setBusy(kind)
    setError('')
    try { await fn() } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  const makeResultsPdf = () => run('rpdf', async () => {
    const d = await loadResultsData(weekId)
    buildResultsPdf(d).save(`week-${d.week.week_number}-results.pdf`)
  })

  const makeResultsText = () => run('rtxt', async () => {
    const d = await loadResultsData(weekId)
    setPreview({ kind: 'Results', ...buildResultsEmail(d) })
  })

  const makeGamesPdf = () => run('gpdf', async () => {
    const d = await loadGamesData(weekId)
    if (!d.games.length) throw new Error('No games in play for that week yet.')
    buildGamesPdf(d).save(`week-${d.week.week_number}-games.pdf`)
  })

  const makeGamesText = () => run('gtxt', async () => {
    const d = await loadGamesData(weekId)
    if (!d.games.length) throw new Error('No games in play for that week yet.')
    setPreview({ kind: 'Games', ...buildGamesEmail(d) })
  })

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`${preview.subject}\n\n${preview.body}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the text and copy it manually.')
    }
  }

  return (
    <div className="space-y-4 mt-2">
      {/* ── Week picker ── */}
      <div className="rounded-xl border p-4" style={{ borderColor: '#374e6b', background: '#121d35' }}>
        <label className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>Week</label>
        <select value={weekId} onChange={e => { setWeekId(e.target.value); setPreview(null) }}
                className="input-field w-full">
          {weeks.length === 0 && <option value="">No weeks yet</option>}
          {weeks.map(w => (
            <option key={w.id} value={w.id}>
              Week {w.week_number}{w.is_complete ? ' (complete)' : ''}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          {error}
        </p>
      )}

      {/* ── Results ── */}
      <Panel
        title="Weekly Results"
        blurb="Week winner, any perfect weeks, the week's scores and the season standings. Send after the week closes."
      >
        <div className="flex gap-2">
          <Btn onClick={makeResultsPdf} busy={busy === 'rpdf'} primary>⬇ PDF</Btn>
          <Btn onClick={makeResultsText} busy={busy === 'rtxt'}>✉ Email text</Btn>
        </div>
      </Panel>

      {/* ── Upcoming games ── */}
      <Panel
        title="Week's Games"
        blurb="The playable slate with lines and kickoffs, and how many picks are due. Send when the week opens."
      >
        <div className="flex gap-2">
          <Btn onClick={makeGamesPdf} busy={busy === 'gpdf'} primary>⬇ PDF</Btn>
          <Btn onClick={makeGamesText} busy={busy === 'gtxt'}>✉ Email text</Btn>
        </div>
      </Panel>

      {/* ── Text preview ── */}
      {preview && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: '#374e6b', background: '#121d35' }}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold" style={{ color: '#f0f6ff' }}>{preview.kind} email</h3>
            <div className="flex gap-2">
              <button onClick={copyAll} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }}>
                {copied ? '✓ Copied' : '📋 Copy all'}
              </button>
              <button onClick={() => setPreview(null)} className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: '#1e293b', color: '#94afd4' }}>
                ✕
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#94afd4' }}>Subject</p>
            <p className="text-xs px-3 py-2 rounded-lg font-semibold"
               style={{ background: '#0f172a', color: '#f0f6ff' }}>{preview.subject}</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#94afd4' }}>Body</p>
            <textarea
              readOnly
              value={preview.body}
              onFocus={e => e.target.select()}
              rows={16}
              className="w-full text-[11px] px-3 py-2 rounded-lg"
              style={{ background: '#0f172a', color: '#ddeeff', border: '1px solid #374e6b',
                       fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre' }}
            />
          </div>
        </div>
      )}

      {/* ── Season report ── */}
      <Panel title="Season Report" blurb="Full standings and every scored week so far.">
        <Btn onClick={() => run('season', downloadReport)} busy={busy === 'season'} primary full>
          ⬇ Download Season PDF
        </Btn>
      </Panel>
    </div>
  )
}

function Panel({ title, blurb, children }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: '#374e6b', background: '#121d35' }}>
      <h3 className="text-sm font-bold mb-1" style={{ color: '#f0f6ff' }}>{title}</h3>
      <p className="text-xs mb-4" style={{ color: '#94afd4' }}>{blurb}</p>
      {children}
    </div>
  )
}

function Btn({ onClick, busy, primary = false, full = false, children }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`${full ? 'w-full' : 'flex-1'} py-3 rounded-lg text-sm font-bold transition-opacity`}
      style={{
        background: primary ? '#2563eb' : 'rgba(74,127,212,0.15)',
        color:      primary ? '#ffffff' : '#60a5fa',
        opacity:    busy ? 0.6 : 1,
      }}
    >
      {busy ? 'Working…' : children}
    </button>
  )
}
