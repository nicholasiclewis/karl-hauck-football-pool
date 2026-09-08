/**
 * Whether an admin's pick was entered for them after their game had started.
 *
 * The entry tab exists so a commissioner can key in picks that arrive by text,
 * and it deliberately works after kickoff. For an ordinary player that is the
 * tab doing its job, however late the message lands — flagging those would be
 * noise, and noise that implicates people who did nothing.
 *
 * The admins are the ones worth a receipt, because they are the ones who can
 * do the writing. An admin can no longer enter their own picks at all, so the
 * single route left is a second admin entering them, and that is the case this
 * reports: in the open, on the slate it affected, naming who and when.
 *
 * Four things have to be true, and each silence means something different:
 *
 *   the player is not an admin — an ordinary late entry. Routine, unremarked.
 *   entered_by is null         — the pick predates the audit columns. Unknown,
 *                                which is not the same as innocent, so it says
 *                                nothing rather than implying a clean bill.
 *   entered_by is theirs       — they entered it themselves. Ordinary.
 *   entered_at is early        — entered for them before kickoff, with no more
 *                                information than anybody else had.
 */

/**
 * @param {object} pick  a picks row, with entered_by/entered_at and the
 *                       embedded entered_by_user from the select
 * @param {object} game  the game the pick is against, for kickoff_time
 * @param {boolean} subjectIsAdmin  whether the pick belongs to an admin — the
 *                       player it was entered *for*, not whoever typed it
 * @returns {{ by: string, at: string } | null}  null when there is nothing to report
 */
export function lateEntry(pick, game, subjectIsAdmin = false) {
  if (!subjectIsAdmin) return null
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
    by: pick.entered_by_user?.display_name?.trim() || 'another admin',
    at: pick.entered_at,
  }
}
