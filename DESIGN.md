---
name: Revenue Command Center
description: A signal-atlas interface that turns validated marketing evidence into an accountable operating decision.
colors:
  petrol: "#17343b"
  petrol-soft: "#24515a"
  body: "#45565b"
  muted: "#647477"
  muted-light: "#879496"
  mineral-mist: "#f2f5f3"
  mineral-paper: "#ffffff"
  mineral-soft: "#f8faf9"
  mineral-line: "#d7e0dd"
  mineral-line-strong: "#b7c9c4"
  ocean-teal: "#206a78"
  ocean-teal-light: "#4c8e9b"
  evidence-green: "#4d7a6c"
  copper: "#a45a35"
  copper-soft: "#faeee7"
  terracotta: "#a54540"
  terracotta-soft: "#fbedec"
  model-violet: "#7a638f"
typography:
  display:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "clamp(29px, 3.2vw, 38px)"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "23px"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Newsreader Variable, Georgia, serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.16
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  data: "2px"
  tag: "5px"
  control: "6px"
  inset: "8px"
  panel: "10px"
  feature: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "52px"
components:
  button-primary:
    backgroundColor: "{colors.petrol}"
    textColor: "{colors.mineral-paper}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "40px"
  button-utility:
    backgroundColor: "{colors.mineral-paper}"
    textColor: "{colors.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.mineral-paper}"
    textColor: "{colors.petrol}"
    rounded: "{rounded.panel}"
    padding: "14px"
  chip:
    rounded: "{rounded.tag}"
    padding: "0 7px"
    height: "23px"
---

# Design System: Revenue Command Center

## Overview

**Creative North Star: "The Signal Atlas"**

The interface feels like an operator's evidence desk: deep petrol framing, mineral paper, ruled modules, ocean-teal signals, and warm copper or terracotta only where interpretation demands attention. It is dense but not cramped, editorial but not theatrical, and designed to make analytical confidence visible.

The page is a presentation layer over a validated schema-v2 data contract. Preserve the source metrics, caveats, required section order, chart/table parity, export paths, presentation and print modes, and the `/full-analysis` archive. Visual changes must not silently recalculate, omit, or reframe the evidence.

**Key Characteristics:**
- Decision first; evidence, implication, and action remain traceable.
- Petrol command rail, mineral canvas, paper modules, and fine rules.
- Newsreader gives conclusions authority; Manrope keeps controls and data legible.
- Color carries semantic meaning and is reinforced by labels, patterns, or copy.

## Colors

Petrol and mineral neutrals form the environment; ocean teal marks navigation and evidence, copper marks measurement caveats, and terracotta is reserved for material risk.

### Primary
- **Deep Petrol:** The rail, decision fields, primary actions, and strongest text.
- **Ocean Teal:** Active progress, links, focus-adjacent emphasis, and primary chart series.

### Secondary
- **Mineral Green:** Positive or validated evidence; never a generic decorative accent.
- **Copper:** Measurement limitations, caution, and warm navigational traces.

### Tertiary
- **Terracotta:** Material risk or destructive meaning only.
- **Model Violet:** Additional analytical series when teal, green, and copper already have assigned meanings.

### Neutral
- **Mineral Mist:** Page canvas.
- **Mineral Paper / Soft Mineral:** Primary and inset surfaces.
- **Body / Muted / Muted Light:** Reading hierarchy without lowering essential evidence below accessible contrast.
- **Mineral Line / Strong Line:** Structure panels, tables, and chart frames.

**The Accountable Color Rule.** A semantic color keeps the same meaning across KPIs, charts, caveats, and actions; labels and patterns preserve that meaning without color.

## Typography

**Display Font:** Newsreader Variable (with Georgia fallback)  
**Body Font:** Manrope Variable (with system sans-serif fallbacks)

**Character:** Newsreader makes recommendations and section theses feel considered rather than promotional. Manrope carries dense interface copy, labels, tables, and tabular numbers with quiet precision.

### Hierarchy
- **Display** (650, fluid 29–38px, 1.05): Section theses and decisive conclusions.
- **Headline** (650, 23px, 1.12): Decision statements and feature panels.
- **Title** (650, 17px, 1.16): Chart, table, and module titles.
- **Body** (400, 14px, 1.55): Explanations; analytical notes stay near 72ch.
- **Label** (650, 10px, 0.08em): Short uppercase metadata, scopes, and status labels.

**The Two-Voice Rule.** Newsreader speaks for interpretation; Manrope speaks for operation and evidence. Do not introduce a third display or UI family.

## Layout

The desktop shell uses a fixed 252px command rail and a sticky 64px utility header. Content is capped at 1600px and follows a 24px outer rhythm. The command strip pairs one petrol decision field with four aligned KPI cells; sections use a thesis-and-explanation split before ruled evidence modules.

At 1280px the rail narrows and major canvases stack. At 980px two-column evidence and headings become single-column. Below 900px the rail becomes a modal drawer, the main margin clears, and all top-level controls become 44px touch targets. Below 520px KPIs and method metrics stack; below 450px header actions wrap. Print mode reveals all sections, removes navigation and utility chrome, and avoids breaking evidence modules where possible.

**The Content-Preservation Rule.** Responsive and presentation modes may reflow or focus the evidence, but must retain required sections, labels, denominators, accessible summaries, table/download alternatives, and the original analytical order.

## Elevation & Depth

The system is flat by default. Rules, adjacent tonal surfaces, and the petrol rail establish hierarchy. The ambient shadow is reserved for hoverable analytical containers; the stronger hover shadow confirms inspection without turning the dashboard into a floating-card wall. Drawers use a directional shadow to show overlay depth.

**The Ruled-First Rule.** Prefer a one-pixel mineral border or tonal step before adding elevation.

## Shapes

Geometry is compact and engineered: 6px controls, 8px inset callouts, 10px analytical panels, and 12px decision features. Five-pixel tags and two-pixel data marks stay crisp. Full pills are limited to progress rails or values whose continuous form is meaningful. Joined evidence grids remove interior radii and use shared rules.

## Components

### Buttons
- **Shape:** Compact controls use 6px corners; primary text actions are 40px high. Mobile header and chart controls are 44px square.
- **Primary:** Petrol field with white text; hover shifts to soft petrol.
- **Utility:** Mineral paper with a strong mineral border; hover uses an ocean-teal border and pale teal surface.
- **Focus:** Every interactive element receives a high-contrast dual focus treatment: a 2px white inner outline plus a 5px ocean-teal outer ring, both offset from the control.

### Chips
- **Style:** Small, labeled semantic markers with 5px corners. Confidence and priority meaning must be readable in text.

### Cards / Containers
- **Style:** Paper surfaces, 10px corners, strong mineral borders, and 14–15px internal padding.
- **State:** Resting cards are flat. Inspectable chart and table cards gain an ocean-teal border and the ambient shadow on hover; joined narrative cards use a tonal background change instead of lift.

### Tables
- **Style:** Manrope with tabular numerals, mineral-green headers, alternating mineral rows, sortable column buttons, and horizontal containment on narrow screens.

### Navigation
- **Style:** A persistent petrol rail with grouped destinations, search, schema status, and the full-analysis archive. The active route uses a paper label, ocean-teal field, and thin copper trace.
- **Mobile:** The rail becomes an ARIA modal drawer with scroll lock, trapped focus, Escape/backdrop dismissal, and trigger-focus restoration.

### Charts
- **Style:** Mixed Tremor/Recharts views use the semantic palette, direct units, stable card frames, visible caveats, plain-language summaries, and table/download alternatives.
- **Loading:** The renderer is lazy-loaded behind stable Suspense space; Vite modulepreload remains disabled so the chart bundle does not delay the decision surface.

### Motion
- **Style:** Use the standard ease for short state changes and the spring only for active-navigation continuity. Section changes may use GSAP Flip/ScrollTrigger when they preserve reading context.
- **Reduced motion:** Disable smooth scrolling and skip motion-led reveals or transitions while preserving final state, focus, and hierarchy.

## Do's and Don'ts

### Do:
- **Do** lead with the operating decision, then show evidence, limitations, and the measurable action.
- **Do** keep chart summaries, caveats, data tables, downloads, print output, and schema validation intact.
- **Do** use rules and mineral tonal layers as the primary composition system.
- **Do** retain 44px mobile controls and visible keyboard focus.

### Don't:
- **Don't** replace the signal atlas with a generic blue KPI wall, glassmorphism, gradients, or decorative 3D.
- **Don't** use warm colors ornamentally or let color become the only carrier of meaning.
- **Don't** hide analytical sections, change denominators, or overstate observational evidence as causal.
- **Don't** preload the chart module or let chart code block the decision-first shell.
