# Handoff: AI-written commentary for the weekly reports

Adds a "✨ Generate" button to the existing commissioner Reports tab that calls
Claude to write a short, funny, family-trash-talk paragraph for each report —
plus a "Struggling" callout (in addition to the existing perfect-week one) and
a Raisin Cup badge for the season-long last-place joke.

These are **real drop-in files for this repo**, not a mockup — they extend the
actual `ReportsTab.jsx` / `lib` files read from `main`. Copy them over the
matching paths, wire the env vars below, and it works as-is with the existing
Vite + Supabase + Vercel setup.

## What's new

- `api/generate-commentary.js` — new Vercel serverless function. Commissioner-only
  (same auth pattern as `api/sync-week-odds.js`). Calls the Anthropic Messages
  API server-side, so the API key never reaches the browser.
- `src/lib/aiReport.js` — pure prompt builders (`buildGamesPrompt`,
  `buildResultsPrompt`), a `findStrugglers()` helper, and a thin client fetcher
  (`generateCommentary`) that grabs the Supabase session token and posts to the
  function above.
- `src/components/ui/RaisinCupBadge.jsx` — small inline-SVG badge for the
  running "Raisin Cup" joke (last-place trophy at season's end).
- `src/components/commissioner/ReportsTab.jsx` — updated: each report panel
  gets a "✨ Generate" button, an editable AI-commentary box that gets prepended
  to the email body, a "Struggling" callout next to the existing perfect-week
  one, and Raisin Cup badges on both.

## Where files go

Drop each file at the same path relative to the repo root, overwriting
`ReportsTab.jsx`. Everything else is additive.

## Env vars (Vercel project settings)

- `ANTHROPIC_API_KEY` — required.
- `ANTHROPIC_MODEL` — optional, defaults to `claude-sonnet-4-5-20250929`.
  Check console.anthropic.com for the current model id if this drifts.
- Reuses `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and
  `SUPABASE_SERVICE_ROLE_KEY`, already set for `sync-week-odds`.

## Struggling / Raisin Cup rule

`findStrugglers()` flags two things, both feeding the same joke:
- **This week**: anyone who scored 0 points.
- **Season-long**: from week 6 on, whoever sits last in the season standings
  if they're 6+ points (about a week's worth) behind the leader — that's the
  one closing in on the Raisin Cup for real.

The perfect-week callout already existed (`perfect` in `loadResultsData`,
8/8). This handoff just gives Claude both lists so the recap can needle the
strugglers and celebrate the perfect scorers by name, and adds the visual
callout box for strugglers next to the existing perfect-week one.

## Trophy design

I can't generate real images — the badge here is a simple flat SVG (a raisin
box with a ribbon) sized for use as a small in-app/PDF badge, not a full
trophy render. If you want an actual physical trophy designed (for a photo,
a 3D print, or an engraved plaque), point that at a real object/photo
workflow — happy to sketch more concepts as SVG if useful in the meantime.

## Testing

Not previewable outside your dev environment (Vite + Supabase + Vercel
functions) — pull these into a branch, set the env vars locally in `.env`,
and run `npm run dev` / `vercel dev` to try the button end to end.
