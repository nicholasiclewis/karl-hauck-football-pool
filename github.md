repo: nicholasiclewis/karl-hauck-football-pool
branch: main

## Last sync
date: 2026-08-18T18:32:36Z
commit: 56f8f4dd66a9

### Updated in this project
- Built a handoff package (handoff/) that extends the existing commissioner Reports tab with AI-written commentary (Claude, via a new serverless function), a "struggling" callout, and a Raisin Cup badge — real drop-in files, ready to copy back into the repo.
- Reference read: scoring rules (src/lib/scoring.js), game format/eligibility (src/lib/gameSelection.js), auth pattern (api/sync-week-odds.js), PDF theme (src/lib/pdfTheme.js), useAuth.jsx.

## Screen map
| Screen | Repo files |
| --- | --- |
| Commissioner → Reports tab | src/components/commissioner/ReportsTab.jsx, src/lib/weeklyEmail.js, src/lib/weeklyExports.js, src/lib/exportPdf.js, src/lib/aiReport.js (new), src/components/ui/RaisinCupBadge.jsx (new), api/generate-commentary.js (new) |
| Scoring rules | src/lib/scoring.js |
| Weekly game format/eligibility | src/lib/gameSelection.js, src/lib/conferences.js, src/lib/rankings.js |
| Standings page | src/pages/Standings.jsx, src/hooks/useStandings.js |
