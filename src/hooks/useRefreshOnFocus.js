import { useEffect, useRef } from 'react'

/**
 * Re-read data when the app comes back to the foreground.
 *
 * Points now land a few minutes after each game ends, but a screen that is
 * already open fetched its numbers once and never asks again — so anyone who
 * leaves the standings up through a Sunday afternoon watches a frozen page
 * while the database moves underneath it. Returning to the tab, or unlocking a
 * phone, is the moment worth re-reading on: it is exactly when someone is
 * about to look.
 *
 * Refreshes are deliberately quiet. They must not put the page back into its
 * loading state, or every glance at the app would blank out numbers that are
 * already on screen and replace them with a spinner. Callers pass a fetch that
 * skips the loading flag.
 *
 * @param {Function} refresh    the quiet fetch to run
 * @param {object}  [options]
 * @param {boolean} [options.enabled]   skip while there is nothing to load yet
 * @param {number}  [options.minGapMs]  floor between refreshes
 */
export function useRefreshOnFocus(refresh, { enabled = true, minGapMs = 30_000 } = {}) {
  // Held in a ref so the listeners never need rebinding: most callers pass a
  // new closure on every render, and re-subscribing each time would be a
  // listener leak in slow motion.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const lastRun = useRef(Date.now())

  useEffect(() => {
    if (!enabled) return

    const maybeRefresh = () => {
      // focus fires for reasons that are not "the user came back", and both
      // events can fire for one switch. The visibility check and the gap
      // between them keep a round trip to alt-tabbing.
      if (document.visibilityState !== 'visible') return

      const now = Date.now()
      if (now - lastRun.current < minGapMs) return
      lastRun.current = now

      refreshRef.current?.()
    }

    document.addEventListener('visibilitychange', maybeRefresh)
    window.addEventListener('focus', maybeRefresh)

    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh)
      window.removeEventListener('focus', maybeRefresh)
    }
  }, [enabled, minGapMs])
}
