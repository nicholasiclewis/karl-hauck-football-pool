/**
 * Whether a pick was entered for someone else after their game had started.
 *
 * The entry tab exists so a commissioner can key in picks that arrive by text,
 * and it deliberately works after kickoff. That is legitimate and routine. It
 * is also the one write in the app made with knowledge nobody else had, so
 * when it happens the pick says so, on the history of the player it belongs
 * to. Nothing here accuses anyone: it reports who entered it and when, and
 * lets the pool draw its own conclusions.
 *
 * Three things have to be true, and each silence means something different:
 *
 *   entered_by is null   — the pick predates the audit columns. Unknown, which
 *                          is not the same as innocent, so it says nothing at
 *                          all rather than implying a clean bill.
 *   entered_by is theirs — the player entered it themselves. Ordinary.
 *   entered_at is early  — someone entered it for them before kickoff, which
 *                          is the tab doing exactly its job.
 */

/**
 * @param {object} pick  a picks row, with entered_by/entered_at and the
 *                       embedded entered_by_user from the select
 * @param {object} game  the game the pick is against, for kickoff_time
 * @returns {{ by: string, at: string } | null}  null when there is nothing to report
 */
export function lateEntry(pick, game) {
  if (!pick?.entered_by || !pick.entered_at) return null
  if (pick.entered_by === pick.user_id) return null

  const kickoff = game?.kickoff_time
  if (!kickoff) return null

  const entered = new Date(pick.entered_at)
  const started = new Date(kickoff)
  if (!(entered > started)) return null

  return {
    // Named if we can, but the fact survives a missing join — a receipt that
    // disappears because a name failed to load is worse than an unsigned one.
    by: pick.entered_by_user?.display_name?.trim() || 'another player',
    at: pick.entered_at,
  }
}
