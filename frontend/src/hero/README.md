# Product hero

`ProductHero` is an animated product demo of the Revenue Command Center for a
marketing page or README hero, built with the stageshow kit
(`frontend/src/stage/kit`, a verbatim copy of the skill's `kit/`).

```tsx
import { ProductHero } from "./hero/ProductHero";

<div className="hero-slot"><ProductHero /></div>
```

- Design size 720 x 340 (a hero beside copy). It scales down to fit its
  container and switches to a separate `compact` design (358 x 320) when the
  container is narrower than 600px. Give the slot a width; height follows.
- Made for the dashboard's dark page (`#070708`): the stage is transparent,
  with no plate. On a light page it would need a dark ground behind it.
- Props (all optional): `numbers` overrides the recorded figures,
  `exampleCost` sets the illustrative typed cost (default 40), `className`
  adds a class to the outer wrapper.
- Loop of about 11 s: the Essential View tile counts up to the
  marketing-sourced win rate (10.2%) beside Referral (26.8%); the cursor opens
  Budget Measurement; the pilot block shows 1,017 accounts per arm and +3.1 pp;
  the cursor types an illustrative cost of $40, and the budget rolls to
  "Example $40,680"; clicking Essential View returns to the start.
- Under `prefers-reduced-motion` it shows the poster: the budget view with the
  example result. The same frame is `docs/images/product-hero.png`.
- The figures live in `numbers.ts`, copied from
  `frontend/public/dashboard-data-v3.json` `datasets.summary` (not imported:
  the contract is ~400 kB). `frontend/tests/productHero.test.mjs` fails if they
  drift. Only the $40 cost is not a recorded figure, and the result is labelled
  Example so it never reads as one.
- CSS is scoped: kit classes are `ss-*` in `@layer stageshow`, the hero's own
  rules are nested under `.rcc-hero`. Nothing styles the page around it.
- Font: Manrope Variable, already loaded by the app (`main.tsx`).

`REHEARSAL.md` records how it was filmed and checked.
