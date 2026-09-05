---
name: Revenue Command Center
description: A black-first executive command room that turns validated marketing evidence into a precise decision ledger.
colors:
  canvas: "#070708"
  paper: "#111113"
  paper-soft: "#171719"
  paper-tint: "#261013"
  carbon: "#070708"
  carbon-soft: "#251013"
  ink: "#f7f4f4"
  ink-soft: "#ded8d9"
  body: "#c2babb"
  muted: "#aaa1a2"
  line: "#2d2829"
  line-strong: "#433a3b"
  crimson: "#e12636"
  crimson-dark: "#b70f1c"
  scarlet: "#ff7b84"
  graphite: "#f2eeee"
  graphite-soft: "#242122"
  oxblood: "#c4616a"
  blush: "#29171a"
  risk: "#ff4f5d"
  risk-soft: "#301216"
  burgundy: "#9f5660"
typography:
  display:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(25px, 2.25vw, 36px)"
    fontWeight: 720
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(21px, 1.7vw, 28px)"
    fontWeight: 720
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 720
    lineHeight: 1.25
    letterSpacing: "-0.018em"
  body:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 720
    lineHeight: 1.35
    letterSpacing: "0.05em"
rounded:
  mark: "4px"
  tag: "5px"
  compact: "7px"
  control: "8px"
  menu: "10px"
  ledger: "11px"
  panel: "12px"
  schedule: "13px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  xxl: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "38px"
  button-utility:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "34px"
  card-evidence:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "17px 18px 16px"
  chip-status:
    backgroundColor: "{colors.graphite-soft}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.tag}"
    padding: "0 7px"
    height: "22px"
  input-navigation:
    backgroundColor: "{colors.carbon-soft}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
---

# Design System: Revenue Command Center

## Overview

**Creative North Star: "The Executive Evidence Ledger"**

The interface behaves like a black-glass executive command room crossed with an auditor's decision ledger. A fixed near-black spine holds navigation, search, archive access, and validation status; charcoal evidence planes carry an asymmetric record of ruled schedules, charts, ledgers, and action notes. Warm-white type supplies clarity while crimson registration marks create urgency without overpowering the evidence. It is compact, exacting, and calm—more accountable instrument than decorative dashboard.

The opening composition is deliberately singular: a dark decision memo joined to a four-cell KPI schedule, followed by a horizontal evidence → implication → action strip. The main analytical spread gives the strongest evidence most of the width and pairs it with smaller evidence ledgers and an action queue. Across all ten sections, preserve the real `dashboard-data.json` contract, 24 chart placements backed by 21 reusable chart definitions, six sortable tables, chart/data parity, export and print paths, deep links, presentation mode, and the `/full-analysis` archive.

**Key Characteristics:**

- Near-black canvas with stepped charcoal evidence planes.
- Asymmetric executive memo, ruled schedules, and compact evidence ledgers.
- Self-hosted Manrope only, with tabular numerals throughout quantitative surfaces.
- Crimson registration marks supported only by warm white, gray, oxblood, scarlet, and burgundy tones.
- Dense evidence remains inspectable, accessible, printable, and traceable to source data.

## Colors

Black and charcoal neutrals carry most of the interface; warm white establishes hierarchy and legibility, while the crimson family appears only where it communicates evidence, state, or urgency.

### Primary

- **Command Black** (`#070708`): Application canvas, fixed spine, decision memo, and strongest framing surfaces.
- **Registration Crimson** (`#e12636`): Primary analytical series, progress rules, active controls, focus rings, and small registration marks.

### Secondary

- **Validation White** (`#f2eeee`): Validated or positive evidence and the principal neutral analytical comparison.
- **Measured Oxblood** (`#c4616a`): Caveats, uncertainty, holdouts, provisional cohorts, and measurement limitations.

### Tertiary

- **Risk Crimson** (`#ff4f5d`): Material risk and priority-one warnings only.
- **Model Burgundy** (`#9f5660`): The fourth attribution series after crimson, white, and oxblood have defined roles.
- **Comparative Scarlet** (`#ff7b84`): Secondary registration and comparative emphasis inside black surfaces.

### Neutral

- **Command Canvas** (`#070708`): The primary application environment.
- **Evidence Plane** (`#111113`): Cards, schedules, tables, controls, and drawers.
- **Raised Charcoal** (`#171719`): Inset explanations, table headings, and low-emphasis ledgers.
- **Warm White Ink** (`#f7f4f4`): Primary text and chart reference ink.
- **Quiet Silver** (`#c2babb`, `#aaa1a2`): Body copy, metadata, axes, and supporting labels.
- **Charcoal Rules** (`#2d2829`, `#433a3b`): Dividers, table rules, chart frames, and joined schedule boundaries.

**The Accountable Color Rule.** Crimson means primary evidence; graphite means validated or neutral comparison; oxblood means limitation; dark crimson means material risk; burgundy means the fourth analytical series. Reinforce every meaning with text, iconography, pattern, or shape.

**The Black Majority Rule.** Black and charcoal must occupy most of every screen. White is hierarchy; crimson is registration and semantics, never decoration.

## Typography

**Display Font:** Manrope Variable (self-hosted, with Manrope and system sans-serif fallbacks)

**Body Font:** Manrope Variable (same family and fallback stack)

**Label/Chart Font:** Manrope Variable with tabular numerals

**Character:** One disciplined sans-serif voice keeps the binder coherent from executive recommendation to dense evidence table. Authority comes from weight, compression, alignment, and scale—not from a contrasting editorial font.

### Hierarchy

- **Display** (720, fluid 25–36px, 1.05): Section titles and major analytical theses.
- **Headline** (720, fluid 21–28px, 1.12): Decision memo and large conclusion statements.
- **Title** (720, 13.5–14px, 1.25): Chart, table, method, and ledger headings.
- **Body** (400–620, 10.5–12px, 1.5–1.6): Explanations, evidence summaries, and operational copy, typically capped near 70ch.
- **Label** (690–750, 9–10px, up to 0.085em): Compact uppercase metadata, scope, status, and navigation group labels.
- **Metric** (720–740, fluid 20–30px, 1): KPI values and method metrics; always use tabular numerals.

**The One-Voice Rule.** Do not add a serif, display face, or chart-specific font. Use Manrope's variable weight and tight spacing to separate interpretation from metadata.

## Layout

Desktop uses a fixed 240px black command spine, narrowing to 224px below 1320px, with a sticky 68px utility bar. The charcoal evidence field is capped at 1600px with 28px side gutters. Its first register is a 13px-radius joined schedule: a near-black decision memo at roughly one third and four equal KPI cells at two thirds. A three-part horizontal story strip follows, then a two-column analytical spread where the principal evidence field receives roughly 2.2 parts and the action/quality ledger receives 0.8.

Evidence layouts use a 12-column grid and 14px gutters. A primary chart can span all 12 columns; paired charts each span six. Joined evidence, priority, and conclusion ledgers share borders rather than repeating disconnected cards. Section introductions split thesis from explanation before collapsing to one column.

At 1120px the command schedule and primary analytical spread stack. At 900px the spine becomes a slide-in modal drawer and charts become single-column. At 680px the story strip stacks into one ruled panel and multi-cell ledgers stack. At 520px top-bar utilities move into the overflow menu, all exposed actions become at least 44px, and outer gutters reduce to 12px. Presentation mode removes the spine, expands the sheet to 1740px, and privileges the evidence canvas. Print mode reveals all ten sections, removes navigation and utilities, returns dark fields to ink-safe paper, and avoids breaks inside evidence modules.

**The Content-Preservation Rule.** Responsive, presentation, and print modes may reflow or focus the evidence, but must retain the ten-section order, denominators, caveats, accessible summaries, Data/Chart alternatives, downloads, and sortable tables.

## Elevation & Depth

Depth is structural and restrained. One-pixel charcoal rules and small black-to-charcoal tonal steps do most of the work. The fixed spine uses a faint directional shadow; resting evidence cards stay almost flat; hoverable analytical cards may rise one pixel and take a stronger black ambient shadow. The caveats drawer receives the only pronounced directional shadow because it genuinely overlays the evidence field.

**The Ruled-First Rule.** Prefer a border, shared divider, or paper-tone change before adding shadow. Never build a floating-card wall.

## Shapes

The form language is compact and engineered. Four-pixel chart marks and heatmap cells, five-pixel semantic tags, seven-pixel compact chart controls, eight-pixel controls and navigation fields, ten-pixel menus and evidence strips, eleven-pixel joined ledgers, twelve-pixel analytical panels, and thirteen-pixel executive schedules form the allowed radius vocabulary. Full pills are limited to continuous progress rails, circular chart marks, scrollbars, and loaders.

Joined schedules remove interior radii and use shared one-pixel rules. Registration marks are short two-pixel crimson strokes, compact squares, dots, diamonds, stripes, or hatch patterns—not ornamental blobs.

## Components

### Buttons

- **Shape:** Utility controls are 34px high with 8px corners; narrow-mobile controls are 44px square. Chart Data/Chart controls use 7px corners.
- **Primary:** Crimson field with white text; hover deepens to dark crimson and active state moves down one pixel.
- **Utility:** Charcoal plane, strong dark rule, and warm-white ink; hover adds an oxblood-tinted surface and a restrained black shadow.
- **Focus:** A two-pixel white inner outline plus a five-pixel crimson outer ring is mandatory.

### Chips

- **Style:** Compact 22px labels with 5px corners, explicit wording, a semantic border, and a pale semantic field.
- **State:** Validation uses graphite, limitations use oxblood, material risk uses dark crimson, and neutral evidence uses pale blush. Never communicate confidence by color alone.

### Cards / Containers

- **Corner Style:** Analytical cards use 12px corners; joined ledgers use 11px; the executive schedule uses 13px.
- **Background:** Evidence Plane over Command Canvas, with Raised Charcoal for inset evidence and headings.
- **Shadow Strategy:** Flat or low-shadow at rest; inspectable chart cards alone gain a stronger ambient hover shadow.
- **Internal Padding:** Typically 14–18px, with shared rules between related cells.

### Inputs / Fields

- **Style:** Navigation search is a 36px translucent carbon field with an 8px radius; caret and focus move to crimson.
- **Focus:** Border contrast increases without changing layout; the global dual focus ring remains visible.
- **Placeholder:** Quiet graphite remains readable against carbon black without competing with entered text.

### Navigation

- **Desktop:** Fixed carbon-black spine with grouped destinations, compact search, validation note, and archive link. The active destination uses Carbon Soft plus a thin crimson registration mark.
- **Mobile:** Slide-in modal drawer with scroll lock, `inert` background, focus trap, Escape and backdrop dismissal, and focus restoration to the menu trigger.

### Evidence Charts

- **Frame:** Charcoal 12px panel with title, subtitle, explicit Data/Chart toggle, download action, visual, plain-language summary, visible caveat, and expandable explanation.
- **Semantics:** Crimson is the default series; warm white is validated or comparison; oxblood is caveat/provisional; bright risk red is material risk; burgundy is the fourth attribution model. Patterns, marker shapes, labels, and legends preserve meaning without color.
- **Data parity:** Each of the 24 placements must retain source metadata, direct units, accessible summary, caveat, CSV download, and a captioned data alternative.

### Tables and Ledgers

- **Style:** Compact Manrope, tabular numerals, sticky raised-charcoal headers, right-aligned quantitative columns, dark row rules, subtle alternating rows, and visible sortable controls.
- **Responsive:** Tables scroll within their own frame; they do not force the evidence field wider than the viewport.

### Drawers and Menus

- **Caveats drawer:** Right-side charcoal overlay, semantic source note, modal semantics, focus containment, Escape dismissal, and trigger-focus restoration.
- **Overflow menu:** At 520px and below, consolidates export, print, presentation, and reset into 44px-safe actions with a 10px charcoal panel.

## Do's and Don'ts

### Do:

- **Do** lead with the operating decision, then preserve the evidence → implication → action chain.
- **Do** use shared rules, asymmetric schedules, and ledgers to show relationships.
- **Do** keep all ten sections, 24 chart placements, six sortable tables, real data, deep links, export, print, presentation, and archive access intact.
- **Do** keep visible caveats, accessible chart summaries, explicit Data/Chart toggles, keyboard focus, and 44px narrow-mobile targets.
- **Do** honor reduced motion by collapsing durations, disabling smooth scroll, and preserving the final state.

### Don't:

- **Don't** introduce white card islands or dilute the black-primary hierarchy; use charcoal elevation and rules for separation.
- **Don't** replace the working-paper composition with a generic KPI-card grid, use any blue/green/purple accents, add glassmorphism, decorative gradients, pill-heavy controls, or ornamental 3D.
- **Don't** use semantic colors decoratively or make color the only carrier of meaning.
- **Don't** hide sections, alter denominators, detach charts from caveats/data, or overstate observational evidence as causal.
- **Don't** let presentation, mobile, or print modes remove evidence or break the original analytical order.
