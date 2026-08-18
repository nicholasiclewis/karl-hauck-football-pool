import { useState, useEffect } from 'react'
import { downloadReport } from '../../lib/exportPdf'
import { supabase } from '../../lib/supabase'
import {
  loadResultsData, loadGamesData,
  buildResultsEmail, buildGamesEmail,
  buildResultsPdf, buildGamesPdf,
} from '../../lib/weeklyExports'
import { generateCommentary, findStrugglers } from '../../lib/aiReport'
import RaisinCupBadge from '../ui/RaisinCupBadge'

/**
 * Weekly handouts and the season report.
 *
 * Results and the new slate go out as two separate messages, so each is built
 * on its own. Both produce a PDF to attach and plain text to paste into the
 * message body — these are sent by hand, not delivered by the app. Each also
 * gets an optional AI-written commentary paragraph (Claude), prepended to the
 * email body when generated.
 */
export default function ReportsTab() {
  const [weeks, setWeeks]   = useState([])
  const [weekId, setWeekId] = useState('')
  const [busy, setBusy]     = useState('')
  const [error, setError]   = useState('')
  const [preview, setPreview] = useState(null)   // { kind, subject, body, callouts }
  const [copied, setCopied] = useState(false)
  const [commentary, setCommentary] = useState('')
  const [genBusy, setGenBusy] = useState(false)

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

  function resetPreview() {
    setPreview(null)
    setCommentary('')
  }

  const makeResultsPdf = () => run('rpdf', async () => {
    const d = await loadResultsData(weekId)
    buildResultsPdf(d).save(`week-${d.week.week_number}-results.pdf`)
  })

  const makeResultsText = () => run('rtxt', async () => {
    const d = await loadResultsData(weekId)
    const strugglers = findStrugglers(d)
    setPreview({ kind: 'Results', ...buildResultsEmail(d), data: d, strugglers })
    setCommentary('')
  })

  const makeGamesPdf = () => run('gpdf', async () => {
    const d = await loadGamesData(weekId)
    if (!d.games.length) throw new Error('No games in play for that week yet.')
    buildGamesPdf(d).save(`week-${d.week.week_number}-games.pdf`)
  })

  const makeGamesText = () => run('gtxt', async () => {
    const d = await loadGamesData(weekId)
    if (!d.games.length) throw new Error('No games in play for that week yet.')
    setPreview({ kind: 'Games', ...buildGamesEmail(d), data: d })
    setCommentary('')
  })

  async function generate() {
    if (!preview) return
    setGenBusy(true)
    setError('')
    try {
      const kind = preview.kind === 'Games' ? 'games' : 'results'
      const payload = kind === 'results'
        ? { ...preview.data, strugglers: preview.strugglers }
        : preview.data
      const text = await generateCommentary(kind, payload)
      setCommentary(text)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenBusy(false)
    }
  }

  async function copyAll() {
    try {
      const body = commentary ? `${commentary}\n\n${preview.body}` : preview.body
      await navigator.clipboard.writeText(`${preview.subject}\n\n${body}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the text and copy it manually.')
    }
  }

  const perfect = preview?.data?.perfect ?? []
  const strugglers = preview?.strugglers

  return (
    <div className="space-y-4 mt-2">
      {/* ── Week picker ── */}
      <div className="rounded-xl border p-4" style={{ borderColor: '#374e6b', background: '#121d35' }}>
        <label className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>Week</label>
        <select value={weekId} onChange={e => { setWeekId(e.target.value); resetPreview() }}
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
              <button onClick={resetPreview} className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: '#1e293b', color: '#94afd4' }}>
                ✕
              </button>
            </div>
          </div>

          {/* ── Callouts (results only) ── */}
          {preview.kind === 'Results' && (perfect.length > 0 || strugglers?.zeroThisWeek.length > 0 || strugglers?.seasonBehind) && (
            <div className="flex flex-col gap-2">
              {perfect.length > 0 && (
                <div className="rounded-lg px-3 py-2 text-xs font-semibold flex items-center justify-between"
                     style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                  <span>🎯 Perfect week: {perfect.map(p => p.name).join(', ')}</span>
                </div>
              )}
              {(strugglers?.zeroThisWeek.length > 0 || strugglers?.seasonBehind) && (
                <div className="rounded-lg px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2"
                     style={{ background: 'rgba(251,191,36,0.10)', color: '#fbbf24' }}>
                  <span>
                    {strugglers.zeroThisWeek.length > 0 && `Zero this week: ${strugglers.zeroThisWeek.join(', ')}`}
                    {strugglers.zeroThisWeek.length > 0 && strugglers.seasonBehind && ' · '}
                    {strugglers.seasonBehind && `On pace for the Raisin Cup: ${strugglers.seasonBehind.name} (${strugglers.seasonBehind.gap} back)`}
                  </span>
                  <RaisinCupBadge size={18} />
                </div>
              )}
            </div>
          )}

          {/* ── AI commentary ── */}
          <div className="rounded-lg p-3" style={{ background: '#0f172a', border: '1px solid #374e6b' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wide" style={{ color: '#94afd4' }}>AI commentary (optional)</p>
              <button onClick={generate} disabled={genBusy} className="text-xs px-3 py-1 rounded-lg font-semibold"
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', opacity: genBusy ? 0.6 : 1 }}>
                {genBusy ? 'Writing…' : `✨ Generate ${preview.kind === 'Games' ? 'hype' : 'recap'}`}
              </button>
            </div>
            <textarea
              value={commentary}
              onChange={e => setCommentary(e.target.value)}
              placeholder="Generate, then edit freely — this gets pasted above the email body."
              rows={4}
              className="w-full text-xs px-3 py-2 rounded-lg"
              style={{ background: '#121d35', color: '#ddeeff', border: '1px solid #374e6b' }}
            />
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
              value={commentary ? `${commentary}\n\n${preview.body}` : preview.body}
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
