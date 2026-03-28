import { useState } from 'react'
import { downloadReport } from '../../lib/exportPdf'

export default function ReportsTab() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleDownload() {
    setLoading(true)
    setError('')
    try {
      await downloadReport()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 mt-2">
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: '#374e6b', background: '#121d35' }}
      >
        <h3 className="text-sm font-bold mb-1" style={{ color: '#f0f6ff' }}>
          Season Report
        </h3>
        <p className="text-xs mb-4" style={{ color: '#94afd4' }}>
          Downloads a PDF with current season standings and all scored weekly results.
        </p>

        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full py-3 rounded-lg text-sm font-bold transition-opacity"
          style={{
            background: loading ? '#1e3566' : '#2563eb',
            color: '#ffffff',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Generating PDF...' : '⬇ Download PDF Report'}
        </button>

        {error && (
          <p
            className="text-sm mt-3 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
