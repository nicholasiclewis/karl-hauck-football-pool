/**
 * AI commentary for the weekly reports: prompt builders (pure, server-side
 * safe) plus a thin client fetcher that calls api/generate-commentary.
 */
import { supabase } from './supabase'
import { formatLabel, picksNeeded, MAX_WEEK_POINTS } from './weeklyEmail'

/**
 * Who's in trouble — this week or for the season.
 *
 * Zero for the week is always worth a needle. A season-long callout only
 * starts in week 6 (early standings swing too much to mean anything before
 * then), and only for whoever sits dead last and is at least a week's worth
 * of points (6) behind the leader — close races don't get roasted.
 */
export function findStrugglers({ week, weekTable, season_table }) {
  const zeroThisWeek = weekTable.filter((r) => r.points === 0).map((r) => r.name)

  let seasonBehind = null
  if (week.week_number >= 6 && season_table.length > 1) {
    const leader = season_table[0]
    const last = season_table[season_table.length - 1]
    const gap = leader.points - last.points
    if (gap >= 6) seasonBehind = { name: last.name, gap, leaderPoints: leader.points }
  }

  return { zeroThisWeek, seasonBehind }
}

/** Hype paragraph for the upcoming-games email. */
export function buildGamesPrompt({ week, season, games, limits }) {
  const need = picksNeeded(limits)
  const list = games
    .map((g) => `${g.away_team} @ ${g.home_team} (${g.favorite === 'home' ? g.home_team : g.away_team} favored)`)
    .join('\n')

  return [
    `You write the intro for a family football pick'em pool's weekly email. The tone is playful, funny, family trash-talk — think a group chat, not a press release. Keep it PG.`,
    ``,
    `Week ${week.week_number}, ${season.year} season. Format: ${formatLabel(week)}. Each player picks ${need} from the games below.`,
    ``,
    `Games:`,
    list,
    ``,
    `Write 3-5 sentences hyping this week's slate for the group. Call out anything notable about the mix (NFL vs. college, ranked teams, rivalries) if it's there in the list — don't invent stats, records, or storylines you don't have. Plain text only, no markdown, no headers, no sign-off.`,
  ].join('\n')
}

/** Funny recap paragraph for the results email, including the running Raisin Cup bit. */
export function buildResultsPrompt({ week, season, weekTable, winners, perfect, strugglers, season_table }) {
  const winnerLine = winners.length
    ? `Winner${winners.length > 1 ? 's' : ''} this week: ${winners.map((w) => `${w.name} (${w.points} pts)`).join(', ')}`
    : 'No scores recorded yet.'
  const perfectLine = perfect.length
    ? `Perfect week (${MAX_WEEK_POINTS}/${MAX_WEEK_POINTS}): ${perfect.map((p) => p.name).join(', ')}`
    : 'Nobody went perfect this week.'
  const zeroLine = strugglers.zeroThisWeek.length
    ? `Scored zero this week: ${strugglers.zeroThisWeek.join(', ')}`
    : ''
  const behindLine = strugglers.seasonBehind
    ? `Currently last in the season standings, ${strugglers.seasonBehind.gap} points behind the leader: ${strugglers.seasonBehind.name}`
    : ''
  const leaderLine = `Season leader: ${season_table[0]?.name ?? 'nobody yet'} (${season_table[0]?.points ?? 0} pts)`

  return [
    `You write the recap paragraph for a family football pick'em pool's weekly results email. The tone is playful, funny, family trash-talk — think a group chat, not a press release. Keep it PG and good-natured, never mean.`,
    ``,
    `Running joke for this pool: last place for the whole SEASON gets an actual box of raisins as a trophy — "the Raisin Cup". Use that joke where it fits naturally; don't force it into every sentence.`,
    ``,
    `Week ${week.week_number} results:`,
    winnerLine,
    perfectLine,
    zeroLine,
    behindLine,
    leaderLine,
    ``,
    `Write 120-180 words. Congratulate the winner(s) by name. If anyone went perfect, celebrate them specifically. If anyone is named as struggling (zero this week, or closing in on the Raisin Cup for the season), needle them by name but keep it affectionate. Don't invent any names, scores, or stats not given above. Plain text only, no markdown, no headers.`,
  ].filter(Boolean).join('\n')
}

/** Calls the serverless function with the signed-in commissioner's session token. */
export async function generateCommentary(kind, payload) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const r = await fetch('/api/generate-commentary', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ kind, payload }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.ok) throw new Error(data.error ?? `Request failed (${r.status})`)
  return data.commentary
}
