# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, Vite, Tailwind CSS, Tremor, selected Aceternity UI patterns, GSAP, Flask, and Render. The validated analytics pipeline remains Python and Parquet based.

## Users

Marketing executives, revenue leaders, and analysts reviewing B2B SaaS pipeline performance, account coverage, attribution, and measurement quality.

## Product Purpose

Turn eight CRM and marketing exports into an answer-first decision surface. Success means a reader can understand the recommendation, inspect the evidence, see its limitations, and identify the next measurable action without overstated causal claims.

## Positioning

The dashboard makes analytical confidence part of the interface: observed facts, directional evidence, measurement gaps, and recommended experiments are deliberately separated instead of presenting every metric as equally decision-ready.

## Operating Context

The dashboard is used for executive review, analyst exploration, presentation, and public portfolio evaluation. It is generated from the repository's validated data marts, served by Flask, deployed through GitHub to Render, and must remain reproducible from the project pipeline.

## Capabilities and Constraints

- Preserve the validated metric definitions, source scope, caveats, and recommendation.
- Preserve responsive navigation, presentation mode, CSV-accessible evidence, and direct links to analytical sections.
- The frontend consumes generated, compact JSON rather than recalculating metrics in the browser.
- The published build must work as a static artifact and through Flask on Render.

## Evidence on Hand

Validated cleaned and integrated Parquet marts under `data/`, analytical workbooks under `outputs/analysis/`, the executive presentation under `outputs/presentation/`, and automated checks in `analytics_case_study/06_validate_metrics.py`.

## Product Principles

- Lead with the decision, then show the evidence and its limits.
- Use motion to preserve context and reading order.
- Make every visual defensible through labels, denominators, and accessible alternatives.
- Keep the analytical pipeline authoritative; the interface presents rather than reinvents metrics.

## Accessibility & Inclusion

Target WCAG 2.2 AA, full keyboard use, visible focus, reduced-motion behavior, accessible text alternatives for charts, 200% zoom resilience, and mobile layouts without horizontal page scrolling.
