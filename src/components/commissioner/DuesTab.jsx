import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function DuesTab() {
  const [season, setSeason]   = useState(null)
  const [entries, setEntries] = useState([]) // [{ player, dues }]
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: s } = await supabase.from('seasons').select('*').eq('is_active', true).maybeSingle()
    if (!s) { setLoading(false); return }
    setSeason(s)

    const [{ data: players }, { data: duesRows }] = await Promise.all([
      supabase.from('users').select('*').order('display_name'),
      supabase.from('dues').select('*').eq('season_id', s.id),
    ])
    const duesMap = Object.fromEntries((duesRows ?? []).map(d => [d.user_id, d]))
    setEntries((players ?? []).map(p => ({ player: p, dues: duesMap[p.id] ?? null })))
    setLoading(false)
  }

  async function togglePaid({ player, dues }) {
    setToggling(player.id)
    try {
      if (!dues) {
        // No dues row yet — create as paid
        const { data, error } = await supabase.from('dues').insert({
          user_id:      player.id,
          season_id:    season.id,
          amount_owed:  season.dues_amount,
          amount_paid:  season.dues_amount,
          is_paid:      true,
          paid_at:      new Date().toISOString(),
        }).select().single()
        if (error) throw error
        setEntries(es => es.map(e => e.player.id === player.id ? { ...e, dues: data } : e))
      } else {
        const newPaid = !dues.is_paid
        const { error } = await supabase.from('dues').update({
          is_paid:      newPaid,
          paid_at:      newPaid ? new Date().toISOString() : null,
          amount_paid:  newPaid ? season.dues_amount : 0,
        }).eq('id', dues.id)
        if (error) throw error
        setEntries(es => es.map(e =>
          e.player.id === player.id
            ? { ...e, dues: { ...dues, is_paid: newPaid, amount_paid: newPaid ? season.dues_amount : 0 } }
            : e
        ))
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setToggling(null)
    }
  }

  if (loading) return <Spinner />
  if (!season)  return <p className="text-center text-sm py-8" style={{ color: '#94afd4' }}>No active season.</p>

  const paidCount = entries.filter(e => e.dues?.is_paid).length
  const totalPaid = paidCount * (season.dues_amount ?? 0)

  return (
    <div className="space-y-4">
      {/* ── Summary bar ── */}
      <div
        className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border"
        style={{ borderColor: '#374e6b' }}
      >
        {[
          { val: `$${season.dues_amount ?? 0}`,           lbl: 'Per Player' },
          { val: `${paidCount} / ${entries.length}`,      lbl: 'Paid' },
          { val: `$${totalPaid.toFixed(2)}`,              lbl: 'Collected' },
        ].map(({ val, lbl }) => (
          <div key={lbl} className="flex flex-col items-center py-3" style={{ background: '#1e293b' }}>
            <span className="text-lg font-bold" style={{ color: '#60a5fa' }}>{val}</span>
            <span className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: '#6b8fbb' }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* ── Players list ── */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
        {entries.map(({ player, dues }) => {
          const initials = (player.display_name || '?')
            .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
          const isPaid = dues?.is_paid ?? false
          return (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: '#253347' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                style={{ background: '#374e6b', color: '#ffffff' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#f0f6ff' }}>{player.display_name}</p>
                {dues?.paid_at && (
                  <p className="text-xs" style={{ color: '#94afd4' }}>
                    Paid {new Date(dues.paid_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => togglePaid({ player, dues })}
                disabled={toggling === player.id}
                className="text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0"
                style={isPaid
                  ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }
                  : { background: 'rgba(239,68,68,0.1)',   color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }
                }
              >
                {toggling === player.id ? '...' : isPaid ? '✓ Paid' : 'Unpaid'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Spinner() {
  return <div className="py-12 text-center"><span className="text-3xl animate-bounce">💰</span></div>
}
