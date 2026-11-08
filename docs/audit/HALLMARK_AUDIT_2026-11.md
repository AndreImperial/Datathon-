# Hallmark design audit — v1.5.1

2026-11-08 · [Hallmark](https://github.com/Nutlope/hallmark) v2.0.0 (MIT), installed as a Claude Code skill and run in **polish** depth (the system and the layout stay, only what a gate names changes).

Scope: Hallmark's static linter on `styles.css`, `App.tsx`, `hero.css`, `deck.css` and `index.html` (genre modern-minimal, scope app). Hallmark's render tier (screenshots, contrast and hero-fold checks) was **not run**: it needs `puppeteer`, which is not installed here. The visual read comes from the project's own browser checks.

## The project has a locked design system

`DESIGN.md` at the root is a locked system, so Hallmark's themes and taste rules do not override it. Where a Hallmark rule and `DESIGN.md` disagree, the file wins and the finding is listed below as **your call**.

## Result

742 findings (339 FAIL, 364 REFLEX, 39 WARN). Two repetitive rules make up 626 of them; about ten are real usability defects.

### Fixed in v1.5.2

| Gate | Finding | Fix |
|---|---|---|
| 15 | A focused control's ring could fade in through a `box-shadow` transition | `transition: none` on `:focus-visible`; checked in Chromium: the ring appears instantly on every control |
| 39a | Disabled buttons (deck Previous/Next, presenter console) were shown by dimming alone | Not-allowed cursor, dashed edge, muted ink; a disabled primary also loses its fill (lint: 3 → 0) |
| 26b | Deck buttons had no pressed state | Small `:active` press, skipped under reduced motion |
| 25 | Two prose blocks ran 88 and 84 characters wide | Capped at 72 (lint: 3 → 1) |

### Looked real, was not

- **Hover contrast "2.35:1"** (gate 40): the real pair (`#ff6672` on `#281114`) measures about 6.3:1.
- **Two sticky elements** (gate 56): table headers stick inside their own scroll box, so they never slide under the top bar.
- **No reduced-motion block in `hero.css`** (gate 27): the shared stage kit and `motionAllowed()` handle it; the checklist's reduced-motion check passes.
- **Hero hidden until a script runs** (gate 62): the app is a script-rendered page, so there is nothing to show with scripting off. Waivable.
- **Hero tab marker animates width** (gate 10a): part of the stageshow hero; small and decorative. Left alone.

### Your call (conflicts with `DESIGN.md` or changes the look)

1. **Uppercase, tracked labels** (gate 67, 46 places across the dashboard and deck) and **three eyebrows above headings** (gate 54, e.g. "Pilot you can run now"). `DESIGN.md` defines labels as 9px uppercase with 0.05em tracking. Hallmark wants sentence-case, untracked labels.
2. **Small type.** `DESIGN.md` sets body at 11px and labels at 9px; Hallmark's floor is 16px body. This is the largest legibility gap, and raising it would reflow every section.
3. **Two middle-dot meta strings** (gate 63) and **one em dash** in copy (gate 19).
4. **Colour and spacing hygiene:** 267 colour literals outside the token block (gate 48) and 359 spacings off a 4px scale (gate 24b). Maintainability, not visible.
5. **Taste in the deck:** side stripes on the caveat and big-idea blocks (gate 3), one hover-lift recipe on three card types (gate 11), chromatic glow on feasible cells (gate 29).

### Not applied on purpose

- Hallmark's stamp comment on line 1 of each stylesheet (gate 20): process marker, not a defect.
- Hallmark's edit-time lint hook (it rewrites Claude settings), and its image generator (needs a `TOGETHER_API_KEY`, none set).
