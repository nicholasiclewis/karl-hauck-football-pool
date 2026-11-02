import { useEffect, useState } from 'react'
import { activeTheme } from '../../lib/seasonalTheme'

// Seen once per device on the day; the candle by the logo brings it back.
const SEEN_KEY = 'karl-tribute-2026-seen'
export const OPEN_TRIBUTE = 'open-karl-tribute'

// Specks of light drifting up behind the card, placed once.
const MOTES = Array.from({ length: 22 }, () => ({
  left: Math.random() * 100,
  size: 2 + Math.random() * 4,
  rise: 9 + Math.random() * 9,
  delay: -Math.random() * 18,
}))

/**
 * On 7 December, Karl Hauck's birthday, the pool opens with a card in his
 * memory. Renders nothing on any other day.
 */
export default function KarlTribute() {
  const tribute = activeTheme() === 'karl'
  const [open, setOpen] = useState(() => tribute && !localStorage.getItem(SEEN_KEY))

  useEffect(() => {
    if (!tribute) return
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_TRIBUTE, reopen)
    return () => window.removeEventListener(OPEN_TRIBUTE, reopen)
  }, [tribute])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    localStorage.setItem(SEEN_KEY, '1')
    setOpen(false)
  }

  if (!tribute || !open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="karl-tribute-name"
      className="heaven fixed inset-0 z-[60] flex items-center justify-center p-5 overflow-y-auto"
    >
      {/* Light from above, clouds below, and specks of light rising between. */}
      <div className="heaven-rays" aria-hidden="true" />
      <div className="heaven-clouds" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="heaven-mote"
          aria-hidden="true"
          style={{ left: `${m.left}%`, width: m.size, height: m.size, '--rise': `${m.rise}s`, '--delay': `${m.delay}s` }}
        />
      ))}

      <div className="heaven-card tribute-in relative w-full max-w-sm rounded-3xl text-center px-6 pt-9 pb-6 my-auto">
        <div className="heaven-halo mx-auto w-32 h-32 rounded-full">
          <img
            src="/karl-hauck.jpg"
            alt="Karl Hauck, smiling, in a St. Xavier jacket"
            className="w-full h-full rounded-full object-cover"
            style={{ objectPosition: '64% 22%' }}
          />
        </div>

        <h2
          id="karl-tribute-name"
          className="mt-6 text-3xl font-semibold"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#fffaf0', letterSpacing: '0.01em' }}
        >
          Karl B. Hauck
        </h2>

        <div className="heaven-divider my-5 mx-auto" aria-hidden="true">✦</div>

        <p
          className="text-xl italic"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#fde9b0' }}
        >
          Happy heavenly birthday.
        </p>
        <p className="mt-2 text-sm" style={{ color: 'rgb(255 250 240 / 0.7)' }}>
          He would have been 92 today.
        </p>
        <p className="mt-4 text-base font-medium" style={{ color: '#fffaf0' }}>
          We love and miss you!
        </p>

        <button
          type="button"
          onClick={close}
          className="heaven-button mt-7 w-full rounded-full py-3 text-sm font-bold"
        >
          Happy birthday, Karl 🕯️
        </button>
      </div>
    </div>
  )
}
