import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function PlayersTab() {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null) // "userId_role"

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('display_name')
    setPlayers(data ?? [])
    setLoading(false)
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
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#374e6b' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: '#1e293b', borderBottom: '1px solid #253347' }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94afd4' }}>
          Players ({players.length})
        </span>
        <span className="text-[10px]" style={{ color: '#1e3a5f' }}>Tap badge to toggle role</span>
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
