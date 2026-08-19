import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * Season settings — currently the pool-wide join code.
 *
 * The code is never selected from the seasons table: members cannot read that
 * column, so it comes and goes through commissioner-gated RPCs. Signup checks
 * it with verify_season_join_code(), which only ever answers yes or no.
 */
export default function SeasonTab() {
  const [season, setSeason]   = useState(null)
  const [code, setCode]       = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [copied, setCopied]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data: s } = await supabase
      .from('seasons').select('id,year,dues_amount,is_active')
      .eq('is_active', true).maybeSingle()
    setSeason(s ?? null)

    if (s) {
      const { data, error: err } = await supabase.rpc('get_season_join_code')
      if (err) setError(err.message)
      else setCode(data ?? null)
    }
    setLoading(false)
  }

  async function regenerate() {
    if (!confirm(
      'Generate a new join code?\n\n' +
      'The current code stops working immediately. Anyone who has it but ' +
      'has not signed up yet will need the new one.'
    )) return

    setBusy(true)
    setError('')
    try {
      const { data, error: err } = await supabase.rpc('regenerate_season_join_code')
      if (err) throw err
      setCode(data)
      setRevealed(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the code and copy it manually.')
    }
  }

  if (loading) {
    return <div className="py-12 text-center"><span className="text-3xl animate-bounce">🔑</span></div>
  }

  if (!season) {
    return <p className="text-center text-sm py-8" style={{ color: '#94afd4' }}>No active season.</p>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
        <div>
          <h2 className="text-sm font-bold" style={{ color: '#93c5fd' }}>Join Code</h2>
          <p className="text-xs mt-1" style={{ color: '#94afd4' }}>
            New players enter this when signing up for the {season.year} season.
          </p>
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
            {error}
          </p>
        )}

        {code ? (
          <>
            <div
              className="rounded-lg border px-4 py-3 flex items-center justify-between gap-3"
              style={{ background: '#0f172a', borderColor: '#374e6b' }}
            >
              <span
                className="font-bold tracking-[0.3em] text-lg"
                style={{ color: revealed ? '#f5b301' : '#4a6585' }}
              >
                {revealed ? code : '••••••'}
              </span>
              <button
                onClick={() => setRevealed(v => !v)}
                className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: '#1e293b', color: '#94afd4' }}
              >
                {revealed ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copy}
                disabled={!revealed}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'rgba(74,127,212,0.15)',
                  color: '#60a5fa',
                  opacity: revealed ? 1 : 0.4,
                }}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
              <button
                onClick={regenerate}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(245,179,1,0.12)', color: '#f5b301', opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Generating…' : '🔄 New Code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs" style={{ color: '#94afd4' }}>
              No join code set for this season — nobody can sign up until there is one.
            </p>
            <button
              onClick={regenerate}
              disabled={busy}
              className="w-full py-2.5 rounded-lg text-sm font-bold"
              style={{ background: '#2563eb', color: '#ffffff', opacity: busy ? 0.6 : 1 }}
            >
              {busy ? 'Generating…' : 'Generate Join Code'}
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border p-4" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
        <h2 className="text-sm font-bold mb-2" style={{ color: '#93c5fd' }}>How it works</h2>
        <ul className="text-xs space-y-1.5" style={{ color: '#94afd4' }}>
          <li>• Only commissioners can see or change this code.</li>
          <li>• Signup checks it without the code ever leaving the server.</li>
          <li>• Generating a new one takes effect immediately and cannot be undone.</li>
          <li>• Players already signed up are unaffected — the code is only for joining.</li>
        </ul>
      </div>
    </div>
  )
}
