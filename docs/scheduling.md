# What runs on a clock

Everything scheduled lives in one workflow: `.github/workflows/pool-scheduler.yml`.
It calls the two API endpoints; those endpoints decide whether there is
anything to do, so the schedules themselves are deliberately blunt.

| When (UTC) | Hits | Does |
| --- | --- | --- |
| Tue + Wed, 13:00 (9am ET) | `/api/sync-week-odds` | Imports the odds that have reached their release day |
| Daily, 11:00 (7am ET) | `/api/sync-week-odds?state=1` | Opens/closes weeks. No external API calls |
| Every 15 min, 16:00–07:00, Aug–Feb | `/api/sync-scores` | Writes finals as games end, resolves points, closes finished weeks |

## Setup — required before any of this runs

Add two **repository secrets** (Settings → Secrets and variables → Actions):

- `POOL_URL` — `https://your-app.vercel.app`, no trailing slash
- `CRON_SECRET` — the same value already set in the Vercel project env

Without both, the workflow fails loudly on its first run rather than silently
doing nothing.

The Vercel crons were removed from `vercel.json` on purpose. Hobby allows two,
at most once a day each, and the score sync needs far more than that. Do not
add them back alongside this workflow — two schedulers would double every odds
import, and that is the part that costs money.

> GitHub disables scheduled workflows in a repo with no pushes for 60 days.
> In the off-season that is fine; any push, or the **Run workflow** button,
> turns them back on.

## Odds: Wednesday morning, with two exceptions

The pool week still starts Tuesday. Lines post **Wednesday at 9am ET**, so they
have a day to settle and NFL and college arrive together.

A sport moves to **Tuesday** when a game would otherwise kick off before its own
odds were up:

- **MAC weeks** — MACtion plays Tuesday night, so college posts Tuesday. This is
  an explicit conference check, so it holds even if the schedule lookup fails.
- **Tuesday NFL games** — NFL posts Tuesday in any week carrying one.

Both exceptions are checked against the real schedule via the Odds API's
`events` endpoint, which does not count against the usage quota — asking costs
nothing. The same safety net covers a non-MAC college game that happens to fall
on a Tuesday.

Wednesday's run also covers anything that should have posted Tuesday and did
not, so a missed release repairs itself instead of leaving the week half open.

Rules live in `src/lib/oddsRelease.js`, tested in `tests/oddsRelease.test.mjs`.

## Scores: at the end of each game

A game is watched from kickoff until it has a score. Each tick reads ESPN's
scoreboard, which reports whether a game is **finished** — so nothing is on a
timer:

- a game that goes to double overtime lands when it actually ends
- a game called early for weather lands then too
- a college game suspended overnight for lightning resolves the next morning
- a tick with no game in progress makes no external request at all

Only completed games are written. ESPN reports a score at halftime the same way
it reports one at the end, and grading picks off a partial score would settle
the week wrong.

Each write is followed immediately by re-resolving that week — game results,
pick outcomes, weekly totals — using `src/lib/scoring.js`, the same rules the
Results tab and the `resolve-picks` edge function use. Points move a few
minutes after the whistle instead of all at once on Tuesday.

Once a week's window is over and its games are all in, the week closes itself
(`is_complete`). It waits for a Monday-night final rather than closing at the
calendar midnight, and gives up 12 hours after the last kickoff if a score
never arrives — naming the game it gave up on in the response.

Logic lives in `src/lib/scoreSync.js` and `src/lib/espnScores.js`, tested in
`tests/scoreSync.test.mjs` and `tests/espnScores.test.mjs`.

## What this costs

**The Odds API** — roughly **12–15 credits a month**, against a 500 limit:

| | Credits |
| --- | --- |
| College odds, per week | 1 |
| NFL odds, per week | 1 (2 in August — preseason is a separate key) |
| Schedule lookups (`events`) | 0 — free endpoint |
| Score syncs | 0 — ESPN |

Scores only touch The Odds API if ESPN fails to answer *at all* on a tick. A
board that answers and simply has no final yet is the normal mid-game case and
costs nothing.

**GitHub Actions** — ~64 runs a day during the season, billed at a minute each,
so ~1,900 minutes a month Aug–Feb and nothing outside it. Free tier is 2,000
minutes a month for a private repo, unlimited for a public one.

## Running things by hand

The **Run workflow** button on the Actions tab takes a `job` input — `scores`,
`odds`, or `state`.

Both endpoints also accept a commissioner's session token instead of the cron
secret, which is how the dashboard buttons reach them:

```
/api/sync-scores?dry=1                # what it would do, no writes, no calls
/api/sync-scores?week_id=<uuid>       # one week now (the Results tab button)
/api/sync-week-odds?week_id=<uuid>    # import a week, ignoring release day
/api/sync-week-odds?dry=1             # report only
```

A run aimed at a specific `week_id` or `week_start` is never held back for a
release day — that is the commissioner working, not the schedule.

## Lines are frozen at kickoff

Running the odds import twice a week means it can see a game that has already
been played. Spreads are only refreshed for games that have not kicked off yet:
after kickoff the stored line is the number the week is graded against.
Scheduled runs also will not add a game that has already started, since nobody
could have picked it.
