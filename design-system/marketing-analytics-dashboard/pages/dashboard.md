# Dashboard page override

- Preserve the editorial decision-brief character: **Newsreader** for display headlines and large figures; **Manrope** for navigation, controls, labels, body copy, and data.
- Structure the story as **evidence → implication → action**. Lead with the recommendation and confidence limits, interpret each analytical section, and end with a measurable experiment or decision.
- Prefer asymmetric editorial groupings, ledgers, and evidence bands over repeated equal-sized KPI cards.
- Use the semantic palette consistently: navy/ink for authority, blue for primary emphasis and action, amber for caution, teal for positive evidence, and red only for material risk. Paper, canvas, muted text, and rules carry most of the interface; never rely on color alone.
- Every chart needs direct units, an adjacent plain-language interpretation, and an equivalent captioned data table. Keep the page-level CSV export as the discoverable evidence path.
- Load the mixed Tremor/Recharts renderer lazily behind `Suspense`; reserve stable fallback space so analytics code does not delay the decision narrative or shift layout.
- On small screens, navigation becomes a modal, keyboard-safe drawer: lock background scrolling, move focus inside on open, trap Tab, support Escape and backdrop dismissal, and restore focus to the trigger.
- Motion is functional: section reveals, active-navigation continuity, and subtle pointer context only. Under reduced motion, skip GSAP reveals and pointer animation, use a static active state, disable smooth scrolling, and collapse CSS animation/transition durations.
- Avoid glassmorphism, decorative gradients, excessive shadows, ornamental 3D, and motion that competes with evidence.
