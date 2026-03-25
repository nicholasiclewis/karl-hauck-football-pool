import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function DuesTab() {
  const [season, setSeason]     = useState(null)
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [toggling, setToggling] = useState(null)

  // Payout fields
  const [payout1, setPayout1]   = useState('')
  const [payout2, setPayout2]   = useState('')
  const [payout3, setPayout3]   = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [payoutMsg, setPayoutMsg]       = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: s } = await supabase.from('seasons').select('*').eq('is_active', true).maybeSingle()
    if (!s) { setLoading(false); return }
    setSeason(s)
    setPayout1(s.payout_1st ?? '')
    setPayout2(s.payout_2nd ?? '')
    setPayout3(s.payout_3rd ?? '')

    const [{ data: players }, { data: duesRows }] = await Promise.all([
      supabase.from('users').select('*').order('display_name'),
      supabase.from('dues').select('*').eq('season_id', s.id),
    ])
    const duesMap = Object.fromEntries((duesRows ?? []).map(d => [d.user_id, d]))
    setEntries((players ?? []).map(p => ({ player: p, dues: duesMap[p.id] ?? null })))
    setLoading(false)
  }

  // Auto-calculate default payouts from pot size
  function calcDefaults() {
    const playerCount = entries.length
    const pot = playerCount * (season?.dues_amount ?? 0)
    const third = season?.dues_amount ?? 0
    const remaining = pot - third
    const first  = Math.round(remaining * 0.60 * 100) / 100
    const second = Math.round(remaining * 0.40 * 100) / 100
    setPayout1(first)
    setPayout2(second)
    setPayout3(third)
  }

  async function savePayouts(e) {
    e.preventDefault()
    setPayoutSaving(true)
    setPayoutMsg('')
    try {
      const { error } = await supabase.from('seasons').update({
        payout_1st: parseFloat(payout1) || null,
        payout_2nd: parseFloat(payout2) || null,
        payout_3rd: parseFloat(payout3) || null,
      }).eq('id', season.id)
      if (error) throw error
      setSeason(s => ({ ...s, payout_1st: parseFloat(payout1), payout_2nd: parseFloat(payout2), payout_3rd: parseFloat(payout3) }))
      setPayoutMsg('Saved!')
    } catch (err) {
      setPayoutMsg(err.message)
    } finally {
      setPayoutSaving(false)
    }
  }

  async function togglePaid({ player, dues }) {
    setToggling(player.id)
    try {
      if (!dues) {
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
  const pot       = entries.length * (season.dues_amount ?? 0)

  return (
    <div className="space-y-4">

      {/* ── Payouts ── */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94afd4' }}>
            Prize Payouts
          </h3>
          <button
            type="button"
            onClick={calcDefaults}
            className="text-[11px] px-2.5 py-1 rounded-lg border font-medium"
            style={{ color: '#60a5fa', borderColor: '#374e6b', background: 'rgba(96,165,250,0.08)' }}
          >
            Auto-calculate from ${pot} pot
          </button>
        </div>

        <form onSubmit={savePayouts} className="space-y-2">
          {[
            { label: '🥇 1st Place', val: payout1, set: setPayout1 },
            { label: '🥈 2nd Place', val: payout2, set: setPayout2 },
            { label: '🥉 3rd Place', val: payout3, set: setPayout3 },
          ].map(({ label, val, set }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-sm w-24 flex-shrink-0" style={{ color: '#f0f6ff' }}>{label}</span>
              <div className="flex-1 flex items-center gap-1">
                <span className="text-sm" style={{ color: '#94afd4' }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="input-field py-1.5 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={payoutSaving}
              className="flex-1 py-2 rounded-lg text-sm font-bold"
              style={{ background: '#2563eb', color: '#ffffff', opacity: payoutSaving ? 0.6 : 1 }}
            >
              {payoutSaving ? 'Saving...' : 'Save Payouts'}
            </button>
            {payoutMsg && (
              <span className="text-xs font-semibold" style={{ color: payoutMsg === 'Saved!' ? '#4ade80' : '#f87171' }}>
                {payoutMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border" style={{ borderColor: '#374e6b' }}>
        {[
          { val: `$${season.dues_amount ?? 0}`, lbl: 'Per Player' },
          { val: `${paidCount} / ${entries.length}`, lbl: 'Paid' },
          { val: `$${totalPaid.toFixed(2)}`, lbl: 'Collected' },
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
                  ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }
                  : { background: 'rgba(248,113,113,0.1)', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }
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
