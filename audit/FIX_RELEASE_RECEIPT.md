# Release, privacy and provenance repair receipt

2026-10-03; local implementation and isolated fixtures. Full regeneration/browser review is coordinated by the parent repair and recorded separately. No commits, deployments, repository access/history changes, source corrections or external publication claims were made.

## Implemented

- F10: v2 public contract exports ten aggregate score bins and aggregate journey counts/amount totals. Legacy Plotly histogram embeds aggregate counts. Private opportunity/account/stage/amount/email/domain fields are rejected recursively by the shared public denylist. Docker runtime copies only the compiled public artifact/server helpers, excluding source workbooks/private marts.
- F11: one CI job regenerates the full pipeline, builds, runs Python/frontend regressions and semantic validation, and uploads the exact successful Pages artifact. Deployment depends on that job. The formerly independent deployment workflow is a pointer only. Render uses a multi-stage Docker pipeline/build/test gate with public-only final image.
- F12–F14: named dataset/placement/schema readiness checks, legitimate declared empty analytical datasets, Vite import/dynamic-import/CSS/assets manifest checks, and public static archive route for both slash forms. Frontend unavailable states/subpath links are in the frontend repair.
- F16: captured Python 3.11.9 constraints, .python-version, input hashes and package versions in run metadata. Upgrade/reconciliation process documented; clean-install reproduction remains unverified.
- F18: historical workbook file/sheet/ordered-column baseline and actionable schema drift checks before regeneration. Historical source dates and build time remain separate. Production expected dates/refresh cadence are explicitly pending source-owner policy.
- F42–F48 generator/docs portions: actual calendar-only model copy, source-window-qualified historical opportunity prevalence, eligibility/exposure/holdout conditions, matched creative tests with qualified-outcome guards, dynamic snapshot lookup, separate unverified published address, and disabled Python/direct JavaScript historical PPTX generation. Existing PPTX retained as explicitly historical archive. v2 preserves all aggregate period/spend status fields and carries snapshot/environment metadata; F44 v3 metadata and F23 population rename are in analytical repair.
- F55–F59: explicit unresolved currency/rubric/publication/missing-amount/delivery records; future private governed drill-through excluded from public product. No external data or policy was invented.

## Verification

- `python -m unittest discover -s tests -p test_app.py -v`: **13 passed**. Includes malformed JSON, incompatible/empty structure, private fields, missing direct assets and missing imported lazy chunk.
- `python -m unittest discover -s tests -p test_artifact_safety.py -v`: **4 passed**. Includes recursive private-field rejection, allowed aggregate/negative totals, declared unavailable model dataset, changed columns and missing workbook inventory.
- All eight supplied workbook file/sheet/column schemas match `source_schema.json` baseline.
- Python compilation passed for app/shared helper/source controls/runner/04 generators/deprecated05/06 validator.
- Legacy archive source/serialized checks: zero exact opportunity-ID matches; two account-name substring matches occur only in bundled Plotly library tokens, not data bindings. Chart generation has no account-name/ID hover bindings. Individual score serialization replaced by aggregate bins.
- `git diff --check` passed (existing line-ending conversion notices only).

## Limits / pending acceptance

Parent must regenerate and validate the final bytes after all agents' edits, test unavailable panels/subpath UI/export semantics, and inspect final print. CI/Render/Docker definitions have not run remotely or in Docker; no live-deployment revision was verified. The field denylist reduces unnecessary public exposure but does not prove lawful publication or sanitize private Git history. Existing private sources/history and historical PPTX bytes remain untouched. F15/F17/F47 export interaction checks are coordinated with frontend; F44 actual dataset/slide provenance belongs to analytics. F18 production policy and F55–F59 external requirements remain open.
