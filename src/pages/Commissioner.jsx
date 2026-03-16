import { useState } from 'react'
import TopNav from '../components/layout/TopNav'
import BottomNav from '../components/layout/BottomNav'
import WeeksTab   from '../components/commissioner/WeeksTab'
import GamesTab   from '../components/commissioner/GamesTab'
import ResultsTab from '../components/commissioner/ResultsTab'
import PlayersTab from '../components/commissioner/PlayersTab'
import DuesTab    from '../components/commissioner/DuesTab'

const TABS = [
  { key: 'weeks',   label: 'Weeks',   icon: '📅' },
  { key: 'games',   label: 'Games',   icon: '🏈' },
  { key: 'results', label: 'Results', icon: '📊' },
  { key: 'players', label: 'Players', icon: '👥' },
  { key: 'dues',    label: 'Dues',    icon: '💰' },
]

export default function Commissioner() {
  const [activeTab, setActiveTab] = useState('weeks')

  return (
    <div className="min-h-screen pb-24" style={{ background: '#00061a' }}>
      <TopNav />

      {/* ── Page header + tab nav ── */}
      <div
        className="pt-14 border-b"
        style={{ background: 'linear-gradient(135deg, #0f1320 0%, #111827 100%)', borderColor: '#001a5c' }}
      >
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-xl font-bold text-white">⚙️ Commissioner</h1>
          <p className="text-xs mt-1" style={{ color: '#3a6090' }}>Admin Dashboard</p>
        </div>

        {/* Tab strip — scrollable on narrow screens */}
        <div className="overflow-x-auto">
          <div className="flex border-t" style={{ borderColor: '#001040', width: 'max-content', minWidth: '100%' }}>
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap"
                style={{
                  borderColor: activeTab === key ? '#4a7fd4' : 'transparent',
                  color:       activeTab === key ? '#a8c8ff' : '#3a6090',
                  background:  activeTab === key ? 'rgba(74,127,212,0.06)' : 'transparent',
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 py-4">
        {activeTab === 'weeks'   && <WeeksTab />}
        {activeTab === 'games'   && <GamesTab />}
        {activeTab === 'results' && <ResultsTab />}
        {activeTab === 'players' && <PlayersTab />}
        {activeTab === 'dues'    && <DuesTab />}
      </div>

      <BottomNav />
    </div>
  )
}
