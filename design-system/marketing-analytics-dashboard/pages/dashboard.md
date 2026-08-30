# Dashboard page override

- Preserve the Signal Atlas decision-brief character: **Newsreader Variable** for display headlines and narrative moments; **Manrope Variable** for navigation, controls, labels, body copy, tables, and chart text. Do not introduce a third display or UI family.
- Structure the story as **evidence → implication → action**. Lead with the recommendation and confidence limits, interpret each analytical section, and end with a measurable experiment or decision.
- Prefer asymmetric editorial groupings, ledgers, and evidence bands over repeated equal-sized KPI cards.
- Use the semantic palette consistently: deep petrol for authority, ocean teal for primary evidence, mineral green for observed positive outcomes, copper for measurement limits, terracotta only for material risk, and violet only for a fourth attribution series. Paper, mineral mist, muted text, and rules carry most of the interface; never rely on color alone.
- Every chart needs direct units, an adjacent plain-language interpretation, and an equivalent captioned data table. Keep the page-level CSV export as the discoverable evidence path.
- Load the mixed Tremor/Recharts renderer lazily behind `Suspense`; reserve stable fallback space so analytics code does not delay the decision narrative or shift layout.
- On small screens, navigation becomes a modal, keyboard-safe drawer: lock background scrolling, move focus inside on open, trap Tab, support Escape and backdrop dismissal, and restore focus to the trigger.
- Motion is functional: section reveals, active-navigation continuity, and subtle pointer context only. Under reduced motion, skip GSAP reveals and pointer animation, use a static active state, disable smooth scrolling, and collapse CSS animation/transition durations.
- Avoid glassmorphism, decorative gradients, excessive shadows, ornamental 3D, and motion that competes with evidence.
