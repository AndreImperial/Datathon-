# Rehearsal: ProductHero (Revenue Command Center)

Plan: a hero beside copy, 720 x 340, looping, on the dashboard's dark page
(#070708, no plate). Focal object: the dashboard window, its headline tile, then
the pilot budget. Action: open Budget Measurement and type a cost. Payoff: the
pilot budget the dashboard computes from the recorded 1,017 treatment accounts,
labelled Example. Left out: brand, search, archive, every chart's content, the
fixed-cost field, the lift table's words.

Gold: `hero-demo` for the layout and the script's shape (720 x 340, named
targets, cursor beats, payoff hold, loop that ends where it began), `dark-hero`
for the dark look (window a step lighter than the page with a hairline, a
sidebar window, one lit color) and `table-edit` for the edit-then-total beat.
Changed: corner bleed with no well (the page is the ground), a sidebar window in
the product's tokens (Manrope, #111113 / #171719 surfaces, #2d2829 lines,
crimson #e12636 with #ff6672 text), the product's own nav marker (crimson
hairline on #251013 with a 2px bar), its page swap (200 ms crossfade, 8 px
rise), its count-up on entering a view, its pilot block (inset crimson top
rule) and calculator. The compact design (358 x 320) is a redesign: no spine,
the two views become tabs in the window bar, tiles drop to two, the facts stack,
the result shares a line with its label.

Beats (about 11 s): 1 Essential View enters, the marketing-sourced win rate
counts up to 10.2% beside Referral 26.8% (0 to 2.3 s) ... 2 the pointer opens
Budget Measurement; the marker slides, the body swaps (2.3 to 3.3 s) ... 3 the
pilot block reads 1,017 accounts per arm, +3.1 pp (1.9 s hold) ... 4 the pointer
clicks Cost per treatment account, steps off the field, types 40; a beat later
the result rolls to Example $40,680 ... payoff holds 2.5 s ... 5 the pointer clicks
Essential View: the view returns (the reset's cause), the tiles count up again.
Data never rewinds in view: the tiles are zeroed while hidden behind the budget
view, the field and result are cleared once the budget view has gone.

Poster (reduced motion, thumbnails, print, `docs/images/product-hero.png`): the
budget view with 40 typed and Example $40,680, no cursor.

Figures: from `dashboard-data-v3.json` `datasets.summary[0]`, inlined in
`numbers.ts` and checked by `frontend/tests/productHero.test.mjs`. $40 is the
only invented value: the product's own hint suggests 40 as an example input,
and the result carries an EXAMPLE tag.

Captured: playground `?capture` route at 1280 (wide) and 390 (compact), whole
loop contact sheets (500 to 600 ms), `--states` sheet, `--reduced` stills at
both widths, frame probes around the loop seam; then the built component in a
scratch harness with the app's toolchain (react + tailwind v4 plugins) and the
dashboard's full `styles.css` loaded, gated again at both widths.
Look: dark only (the product is dark-first; no light look shipped).

Film (gate lines, all at 0 at the end; `rehearsal passed` on wide loop, 390
loop, `--states`, and both widths in the app-styled harness):
- `tight inset` (sidebar row 6.7 px from its edge) -> widened the sidebar to 188.
- `framing: window narrower than tall` at 390 -> compact stage 320 tall, tabs
  moved into the window bar.
- `loose stack` kicker/facts and result label/value -> tightened to 3 px and 2 px.
- `empty pane` during the page swap (both views faint at once) -> the views
  now crossfade on one clock.
- `near-tangent` compact calc 1 px from the stage foot -> result on one line,
  card ends about 30 px clear.
- `touching` "Example" against the figure -> fixed gap, then an EXAMPLE tag.
- Candidates left standing, reviewed: `jump: ss-field__chars` (typed characters
  land whole, as typing does); `near-empty frames` (the hidden view's elements
  counted while the other view shows; the frame is full); `appears with no
  entrance` on the three `Count`s: the values fade and rise in (`.rcc-value`) or
  arrive inside the States crossfade; a per-frame probe of their effective
  opacity found no step over 0.5 between frames anywhere in a 24 s run.
- Coverage is `inconclusive` on every film: this machine sampled with gaps up to
  about 150 ms, so 40 to 80 ms beats were judged from sheets and probes, not
  frame by frame.

Review (fresh-eye subagent with review.md and the frames, not this file):
1 content column ends a gutter short of the crop -> kept: framing rule 11 (a
full gutter or well past) and the `dark-hero` gold do the same; the Essential
filler tile and the chart are what bleed. 2 void card under the payoff ->
replaced with the pilot table as filler rows. 3 opening eye on the gray chart
-> columns shortened and toned down; the KPI row leads. 4 sidebar a loose list
of bars -> not changed: the reviewer measured at 2x; the pitch is 28 px on 26 px
rows. 5 "Example:" as heavy as $40,680 -> a small muted EXAMPLE tag. 6 KPI tiles
blank at the seam -> blank time cut to about 0.4 s and the figures rise in. 7
phone cursor parked on the payoff -> the compact pointer now steps up beside
the field label. 8 typed digit jump -> intentional (typing).

Assumptions: the slot is at least 600 px wide for the wide design and the page
is dark; Manrope is loaded by the host (`main.tsx` does). The nav labels and
heading are the app's ("Essential View", "Budget Measurement"); the tile label
is the brief's shorter "Marketing-sourced win rate" (the app says
"Marketing-sourced new-logo win rate").

Unresolved: none blocking. Not checked: touch devices, Safari and Firefox (Chrome
only), a light page, pause/offscreen/resume on the real page (the hero is not
mounted yet), live rAF pacing on the real page, 4x glyph zooms.
