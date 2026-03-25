import { useState, useEffect } from 'react'
import TopNav from '../components/layout/TopNav'
import BottomNav from '../components/layout/BottomNav'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const { user, profile, signOut, updateDisplayName } = useAuth()

  // Display name edit
  const [nameVal, setNameVal]       = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg]       = useState('')

  // Password change
  const [currPass, setCurrPass]     = useState('')
  const [newPass, setNewPass]       = useState('')
  const [confPass, setConfPass]     = useState('')
  const [passSaving, setPassSaving] = useState(false)
  const [passMsg, setPassMsg]       = useState('')
  const [passErr, setPassErr]       = useState('')

  // Dues
  const [dues, setDues]             = useState(null)
  const [season, setSeason]         = useState(null)

  useEffect(() => {
    if (profile) setNameVal(profile.display_name ?? '')
  }, [profile])

  useEffect(() => {
    if (user) loadDues()
  }, [user])

  async function loadDues() {
    const { data: s } = await supabase.from('seasons').select('id, year, dues_amount').eq('is_active', true).maybeSingle()
    if (!s) return
    setSeason(s)
    const { data: d } = await supabase.from('dues').select('*').eq('user_id', user.id).eq('season_id', s.id).maybeSingle()
    setDues(d ?? null)
  }

  async function saveName(e) {
    e.preventDefault()
    if (!nameVal.trim()) return
    setNameSaving(true)
    setNameMsg('')
    try {
      await updateDisplayName(nameVal.trim())
      setNameMsg('Saved!')
    } catch (err) {
      setNameMsg(err.message)
    } finally {
      setNameSaving(false)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setPassErr('')
    setPassMsg('')
    if (newPass !== confPass) { setPassErr('Passwords do not match.'); return }
    if (newPass.length < 6)   { setPassErr('Password must be at least 6 characters.'); return }
    setPassSaving(true)
    try {
      // Re-authenticate then update
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currPass,
      })
      if (signInErr) throw new Error('Current password is incorrect.')
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPass })
      if (updateErr) throw updateErr
      setPassMsg('Password updated!')
      setCurrPass(''); setNewPass(''); setConfPass('')
    } catch (err) {
      setPassErr(err.message)
    } finally {
      setPassSaving(false)
    }
  }

  const initials = (profile?.display_name || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0f172a' }}>
      <TopNav />

      {/* ── Header ── */}
      <div
        className="pt-14 border-b"
        style={{ background: 'linear-gradient(135deg, #141e2e 0%, #1e293b 100%)', borderColor: '#374e6b' }}
      >
        <div className="px-4 pt-5 pb-6 flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0"
            style={{ background: '#374e6b', color: '#ffffff' }}
          >
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{profile?.display_name ?? '—'}</h1>
            <p className="text-xs mt-0.5" style={{ color: '#94afd4' }}>{profile?.email}</p>
            <div className="flex gap-2 mt-1.5">
              {profile?.is_commissioner && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,127,212,0.2)', color: '#60a5fa' }}>
                  ⚙️ Commissioner
                </span>
              )}
              {profile?.is_treasurer && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  💰 Treasurer
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── Dues status ── */}
        {season && (
          <Section title="Dues">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#f0f6ff' }}>{season.year} Season</p>
                <p className="text-xs mt-0.5" style={{ color: '#94afd4' }}>
                  ${season.dues_amount ?? 0} entry fee
                </p>
              </div>
              <span
                className="text-sm font-bold px-3 py-1.5 rounded-full border"
                style={dues?.is_paid
                  ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }
                  : { background: 'rgba(239,68,68,0.1)',   color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }
                }
              >
                {dues?.is_paid ? '✓ Paid' : 'Unpaid'}
              </span>
            </div>
            {dues?.paid_at && (
              <p className="text-xs mt-2" style={{ color: '#94afd4' }}>
                Paid {new Date(dues.paid_at).toLocaleDateString()}
              </p>
            )}
          </Section>
        )}

        {/* ── Display name ── */}
        <Section title="Display Name">
          <form onSubmit={saveName} className="space-y-3">
            <input
              type="text"
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              className="input-field w-full"
              placeholder="Your name"
            />
            {nameMsg && (
              <p className="text-xs" style={{ color: nameMsg === 'Saved!' ? '#10b981' : '#ef4444' }}>
                {nameMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={nameSaving || nameVal.trim() === profile?.display_name}
              className="w-full py-2.5 rounded-lg text-sm font-bold"
              style={{ background: '#2563eb', color: '#ffffff', opacity: nameSaving ? 0.6 : 1 }}
            >
              {nameSaving ? 'Saving...' : 'Save Name'}
            </button>
          </form>
        </Section>

        {/* ── Password change ── */}
        <Section title="Change Password">
          <form onSubmit={savePassword} className="space-y-3">
            <input
              type="password"
              placeholder="Current password"
              value={currPass}
              onChange={e => setCurrPass(e.target.value)}
              className="input-field w-full"
              autoComplete="current-password"
            />
            <input
              type="password"
              placeholder="New password"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              className="input-field w-full"
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confPass}
              onChange={e => setConfPass(e.target.value)}
              className="input-field w-full"
              autoComplete="new-password"
            />
            {passErr && <p className="text-xs" style={{ color: '#ef4444' }}>{passErr}</p>}
            {passMsg && <p className="text-xs" style={{ color: '#10b981' }}>{passMsg}</p>}
            <button
              type="submit"
              disabled={passSaving || !currPass || !newPass || !confPass}
              className="w-full py-2.5 rounded-lg text-sm font-bold"
              style={{ background: '#2563eb', color: '#ffffff', opacity: passSaving ? 0.6 : 1 }}
            >
              {passSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </Section>

        {/* ── Sign out ── */}
        <button
          onClick={signOut}
          className="w-full py-2.5 rounded-lg text-sm font-bold"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          Sign Out
        </button>

      </div>
      <BottomNav />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94afd4' }}>{title}</h2>
      {children}
    </div>
  )
}
