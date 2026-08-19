import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function PlayersTab() {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null) // "userId_role"

  // Add-player form. Account creation needs the service-role key, so it goes
  // through the commissioner-gated /api/add-player function.
  const [form, setForm]       = useState({ name: '', email: '' })
  const [adding, setAdding]   = useState(false)
  const [addError, setAddError] = useState('')
  const [created, setCreated] = useState(null)   // { email, display_name, tempPassword }
  const [copied, setCopied]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('display_name')
    setPlayers(data ?? [])
    setLoading(false)
  }

  async function addPlayer(e) {
    e.preventDefault()
    setAddError('')
    setCreated(null)
    setAdding(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const res = await fetch('/api/add-player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ display_name: form.name, email: form.email }),
      })
      const out = await res.json()
      if (!res.ok || out.ok === false) throw new Error(out.error ?? `HTTP ${res.status}`)

      setCreated(out)
      setForm({ name: '', email: '' })
      await load()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function copyCreds() {
    try {
      await navigator.clipboard.writeText(
        'Karl Hauck Football Pool login\n' +
        `Site: ${window.location.origin}\n` +
        `Email: ${created.email}\n` +
        `Temporary password: ${created.tempPassword}`
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setAddError('Could not copy — select the details and copy them manually.')
    }
  }

  async function toggleRole(player, role) {
    if (player.id === user?.id && role === 'is_commissioner') {
      alert("You can't remove your own commissioner role.")
      return
    }
    const key = player.id + role
    setUpdating(key)
    const newVal = !player[role]
    const { error } = await supabase.from('users').update({ [role]: newVal }).eq('id', player.id)
    if (!error) {
      setPlayers(ps => ps.map(p => p.id === player.id ? { ...p, [role]: newVal } : p))
    } else {
      alert(error.message)
    }
    setUpdating(null)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">

    {/* ── Add player ── */}
    <div className="rounded-xl border p-4 space-y-3" style={{ background: '#1e293b', borderColor: '#374e6b' }}>
      <div>
        <h2 className="text-sm font-bold" style={{ color: '#93c5fd' }}>Add Player</h2>
        <p className="text-xs mt-1" style={{ color: '#94afd4' }}>
          Creates the account for someone who won't sign themselves up. You get
          a temporary password to pass along — no confirmation email involved.
        </p>
      </div>

      {addError && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
          {addError}
        </p>
      )}

      <form onSubmit={addPlayer} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input
              type="text" required placeholder="First Last"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field w-full"
            />
          </Field>
          <Field label="Email">
            <input
              type="email" required placeholder="them@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="input-field w-full"
            />
          </Field>
        </div>
        <button
          type="submit" disabled={adding}
          className="w-full py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#2563eb', color: '#ffffff' }}
        >
          {adding ? 'Creating…' : '+ Add Player'}
        </button>
      </form>

      {created && (
        <div className="rounded-lg border px-4 py-3 space-y-2" style={{ background: '#0f172a', borderColor: 'rgba(16,185,129,0.35)' }}>
          <p className="text-xs font-semibold" style={{ color: '#10b981' }}>
            ✓ {created.display_name} can sign in now
          </p>
          <p className="text-xs leading-relaxed" style={{ color: '#94afd4' }}>
            Email: <span style={{ color: '#f0f6ff' }}>{created.email}</span>
            <br />
            Temporary password:{' '}
            <span className="font-bold tracking-widest" style={{ color: '#f5b301' }}>
              {created.tempPassword}
            </span>
          </p>
          <p className="text-[11px]" style={{ color: '#94afd4' }}>
            Shown once — copy it now. They can change it in Profile, or use
            “Forgot your password?” on the sign-in screen to pick their own.
          </p>
          <button
            onClick={copyCreds}
            className="w-full py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(74,127,212,0.15)', color: '#60a5fa' }}
          >
            {copied ? '✓ Copied' : '📋 Copy login details'}
          </button>
        </div>
      )}
    </div>

    {/* ── Player list ── */}
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: '#1e293b', borderBottom: '1px solid #253347' }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94afd4' }}>
          Players ({players.length})
        </span>
        <span className="text-[10px]" style={{ color: '#94afd4' }}>Tap badge to toggle role</span>
      </div>

      {players.map((player) => {
        const initials = (player.display_name || '?')
          .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        return (
          <div
            key={player.id}
            className="flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: '#253347' }}
          >
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ background: '#374e6b', color: '#ffffff' }}
            >
              {initials}
            </div>

            {/* Name / email */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#f0f6ff' }}>
                {player.display_name}
                {player.id === user?.id && (
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#60a5fa', color: '#1e293b' }}>
                    You
                  </span>
                )}
              </p>
              <p className="text-xs truncate" style={{ color: '#94afd4' }}>{player.email}</p>
            </div>

            {/* Role badges */}
            <div className="flex gap-1.5 flex-shrink-0">
              <RoleBadge
                label="Admin"
                active={player.is_commissioner}
                disabled={updating === player.id + 'is_commissioner'}
                onClick={() => toggleRole(player, 'is_commissioner')}
              />
              <RoleBadge
                label="Treas."
                active={player.is_treasurer}
                disabled={updating === player.id + 'is_treasurer'}
                onClick={() => toggleRole(player, 'is_treasurer')}
              />
            </div>
          </div>
        )
      })}
    </div>

    </div>
  )
}

function Field({ label, children }) {
  // The wrapper is the <label> so the control inside is associated with it
  // implicitly — same as the other commissioner forms.
  return (
    <label className="block">
      <span className="text-xs font-semibold block mb-1" style={{ color: '#94afd4' }}>{label}</span>
      {children}
    </label>
  )
}

function RoleBadge({ label, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors"
      style={active
        ? { background: 'rgba(74,127,212,0.2)', color: '#60a5fa', borderColor: '#60a5fa' }
        : { background: 'transparent', color: '#94afd4', borderColor: '#374e6b' }
      }
    >
      {label}
    </button>
  )
}

function Spinner() {
  return <div className="py-12 text-center"><span className="text-3xl animate-bounce">👥</span></div>
}
