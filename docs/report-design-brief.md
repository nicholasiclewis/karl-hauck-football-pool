# Weekly Results Sheet — design brief

Paste-ready prompt for a visual design tool. Describes the artifact the pool's
weekly PDF should become. Kept in the repo so the brief and the implementation
in `src/lib/weeklyPdf.js` can be compared when either changes.

---

Design a **weekly results sheet** for the Karl Hauck Football Pool — a
long-running private NFL/college football pool. It goes out every week as a PDF
attached to an email, and it should feel like a broadcast graphics package: the
kind of scoreboard a sports network puts on screen, not a spreadsheet export.

## The job it does

Twelve or so friends pick games against the spread each week. This sheet tells
them who won the week, where everyone stands for the season, and — most
importantly — gives them something to argue about. It is the thing that makes
the pool feel like an institution rather than a group text. People should want
to open it.

## Canvas and output

- **A4 portrait, 210 × 297 mm**, single page preferred, two acceptable
- Delivered as PDF, viewed mostly on phones, occasionally printed
- Dark theme — it must look deliberate on screen, and remain legible if someone
  prints it on a mono office printer
- Text must stay selectable and sharp: this is a vector document, not an image

## Palette

Use the pool's existing app colours. Do not introduce a new brand palette.

| Role | Hex |
|---|---|
| Page background | `#0b1120` |
| Header band | `#0a1226` |
| Card surface | `#121d35` |
| Card surface, alt row | `#1a2848` |
| Hairline / border | `#1e3566` |
| Primary accent | `#1a47b8` |
| Primary light | `#6096e8` |
| Body text | `#ddeeff` |
| Secondary text | `#7799cc` |
| Winner / highlight gold | `#fbbf24` |
| Positive / perfect green | `#22c55e` |
| Negative red | `#ef4444` |

## Content, in priority order

**1. Header** — week number should be the largest thing on the page. Also
carries the season year, the word RESULTS, and the week's format
(e.g. `4 NFL + 2 College · Power 4 (SEC)`).

**2. Winner** — the hero. One name, or two when shared. Their points set large.
Gold is reserved for this.

**3. Perfect week** — a distinct band, green, only present when someone scored
the maximum 8/8. Most weeks this is absent; the layout must not look broken
without it.

**4. Storyline tiles** — a row of up to four. Each is a label, a value, and a
short detail:

- `BIGGEST MOVER` · Dana Whitfield · up 2 to 1st
- `ON A RUN` · Dana Whitfield · 2 weeks running
- `TRAP GAME` · Chiefs / Ravens · only 2 of 6 got it
- `RACE FOR FIRST` · 2 pts · Dana leads Marcus

Any of these can be absent, and sometimes all are. Design for one to four tiles.

**5. Week scoreboard** — rank, player, record as `W-L-P`, bonus points, total.
Top three distinguished (gold / silver / bronze).

**6. Season standings** — rank, movement indicator, player, weeks played, weeks
won, points back from the lead, season total. Movement is up / down / level /
new, and should read at a glance.

## Sample data to lay out against

```
Week 3 · 2026 Season · 4 NFL + 2 College · Power 4 (SEC)

WINNER   Dana Whitfield   8 pts   (perfect week)

WEEK                          SEASON
1  Dana Whitfield  6-0-0  8.0   1  ▲2  Dana Whitfield   3  2  —      19.0
2  Marcus Bell     5-1-0  6.0   2  ▼1  Marcus Bell      3  1  -2.0   17.0
3  Alex Romero     5-1-0  5.0   3  ▼1  Alex Romero      3  0  -5.0   14.0
4  Sam Okafor      3-2-1  3.5   4  —   Sam Okafor       3  0  -7.5   11.5
5  Pat Lindqvist   3-3-0  3.0   5  ▲1  Pat Lindqvist    3  0  -10.0   9.0
6  Jordan Reyes    2-4-0  2.0   6  NEW Jordan Reyes     2  0  -13.0   6.0
```

## Edge cases the layout has to survive

These are real and will occur. A design that only works on the happy path is
not finished.

- **Shared wins** — two or three names in the winner slot, so it cannot assume
  one short name
- **No perfect week** — the usual case
- **No storylines** — an uneventful week produces one tile or none
- **Long names** — up to ~22 characters
- **Twelve to twenty players** — the season table grows through the year
- **Week one** — no movement data exists at all, everyone is NEW
- **Half points** — pushes score 0.5, so totals show one decimal

## Implementation reality

This is generated in code every week from a database, not hand-set. Whatever
you design has to be reproducible programmatically:

- Currently drawn with jsPDF vector primitives — rectangles, lines, triangles,
  text. Rounded rectangles are available.
- Typography is limited to the PDF built-ins (Helvetica) unless a font is
  embedded. If the design needs a specific typeface, say which and why.
- **Built-in PDF fonts are WinAnsi-encoded and contain no arrows, stars, or box
  drawing characters.** Any such element must be a drawn shape. Do not rely on
  `▲ ★ ● ■` as text.
- Photographs and team logos are not available for players, only for teams.

Prefer solutions that come from layout, type scale, weight and colour rather
than imagery.

## What to avoid

- Generic dashboard or business-report styling
- Fake sponsor logos or invented branding marks
- Decoration that carries no information
- Anything that collapses when a section is missing

## Deliver

1. The full sheet laid out with the sample data above
2. A variant showing the sparse case — shared winner, no perfect week, one
   storyline tile — to prove the layout holds
3. Brief notes on the type scale and spacing rules used, so the result can be
   translated into drawing code
