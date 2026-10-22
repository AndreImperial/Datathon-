# Follow-up engineering audit — 2026-10-03

Read-only review of application serving, deployment, build pipeline, exports, privacy, dependency reproducibility, tests, documentation, and the historical PowerPoint path. No project source or generated artifacts were changed. Temporary isolated fixtures were used for health checks. This complements the other analytical/UI review tracks.

## Prioritized findings

### E1 — P1: Public evidence contract contains individual CRM deal records

`C:/Users/andre/Downloads/Datathon/analytics_case_study/04_dashboard_data.py:466` exports opportunity ID, account name, current stage, amount, channel, segment, and score for 411 active opportunities. `C:/Users/andre/Downloads/Datathon/app.py:89` serves the JSON without authentication. Verified locally with Flask test client: GET `/dashboard-data.json` returned the contract containing 411 rows in `datasets.win_probability`. The browser needs a score distribution, not identifiable deal-level records. A hidden panel would not protect the downloadable JSON.

The repository also tracks all eight raw Excel files and cleaned datasets. Schema inspection found email/name/phone in the 17,130-row email engagement file and contact_name/email in the 3,288-row opportunity archive. Repository visibility and the right to publish these source records were NOT verified, so this is a confirmed exposure mechanism and an unresolved authorization question, not a claim of an unlawful disclosure.

Fix: produce a public aggregate score histogram, remove individual IDs/names/stages/amounts from public contracts and export scopes, and separate private source data from deployable artifacts. Verify publication rights before changing repository access or attempting history cleanup. Add a public-artifact identifier-field check.

### E2 — P1: GitHub Pages can publish before validation, with no build/semantic gate

`C:/Users/andre/Downloads/Datathon/.github/workflows/deploy-pages.yml:4` deploys on pushes to main independently of the validation workflow. Its verification at line 61 checks only index.html and .nojekyll, then uploads the committed public directory. Validation at `C:/Users/andre/Downloads/Datathon/.github/workflows/validate.yml:56` runs only a pipeline dry-run, then rebuilds the browser from committed marts/contracts. `C:/Users/andre/Downloads/Datathon/render.yaml:6` installs Python dependencies but neither rebuilds nor validates artifacts.

Thus a source analytics edit with stale tracked marts/build files can pass through deployment, and Pages may publish even if the separate validation workflow fails. README honestly documents the absence of full source regeneration in CI; the architecture still needs a release gate.

Fix: build and validate a single artifact in a required job, make deployment depend on its success, and deploy that exact artifact. Run the source-data pipeline in that job when source or methodology changes; a scheduled/full validation path may be appropriate if costs require selective triggers.

### E3 — P1: Safe unavailable-model output prevents the entire dashboard loading

`C:/Users/andre/Downloads/Datathon/frontend/src/App.tsx:342` rejects every empty chart placement. The repaired advanced model deliberately emits empty score/calibration/importance outputs when outcome history is insufficient (`tests/test_model_temporal.py:57` verifies this safe path). Those become empty `c-win-prob` / `c-feat-imp` chart data in the public contract, so `validatePayload` turns a supported analytical unavailable state into a dashboard-wide load error.

Fix: distinguish required structural arrays from valid unavailable analytical datasets; render local empty states with the model reason and continue displaying the rest of the dashboard. Add a frontend fixture test covering the unavailable model path.

### E4 — P2: Full-analysis archive link breaks under a Pages project subpath

`C:/Users/andre/Downloads/Datathon/frontend/src/App.tsx:762` links to `/full-analysis` with an origin-root absolute path. `vite.config.ts` uses `base: './'`; the Pages deployment publishes a static `full-analysis/index.html` under the repository site. The Git remote names repo `Datathon-`, so a project site at `/Datathon-/` would navigate to the origin's `/full-analysis`, bypassing the project path.

Fix: use `./full-analysis/` consistently. It also resolves to Flask's public static archive path. Include a browser smoke check with the app served under a non-root prefix.

### E5 — P2: Health check gives false readiness for broken dynamic chunks and malformed contracts

`C:/Users/andre/Downloads/Datathon/app.py:30` checks JS/CSS referenced directly by index.html, not imported/lazy chunks. Lines 74–76 check data existence only. Isolated temporary fixture removed `Charts-CepU7AaM.js` and replaced v3 JSON with `{invalid json`; GET `/health` still returned 200 with every flag true. This does not imply the current local artifact is malformed; it demonstrates a missing readiness check.

Fix: validate JSON parse/schema/reference essentials and verify a Vite build manifest covering imported assets, or ship a generated inventory/checksum manifest and check it. Add regression fixtures for missing lazy chunks and invalid/stale data contracts.

### E6 — P2: Regenerated legacy archive still contradicts corrected methods and source coverage

`C:/Users/andre/Downloads/Datathon/analytics_case_study/04_html_dashboard.py:2287` says the model uses channel, CRM market segment, amount and create-date features. The repaired model uses only creation year/quarter because the other fields lack proven historical availability. At line 2310 the legacy view says unreached accounts "have never received a single marketing touchpoint", while the data only establish no tracked email/6sense touch in supplied sources/window.

Fix: use the actual feature policy from model diagnostics rather than handwritten copy; replace lifetime touch claims with supplied-source/window-qualified coverage language. Verify the regenerated HTML, not only the React/browser deck.

### E7 — P2: Historical PPTX generator reintroduces retired definitions and budget recommendation

README correctly labels the existing 12-slide PPTX historical and excludes it from the default runner. Its embedded slide text nevertheless contains 3,288 opportunities, 447 active, AUC 0.712 and 80/20. More importantly, `C:/Users/andre/Downloads/Datathon/analytics_case_study/05_presentation.py:48` loads the unfiltered opportunity reconciliation archive, and lines 60–65 compute totals without the shared canonical nondeleted population. `presentation_builder.mjs:264` retains the retired 80/20 evaluation explanation, and line 274 prescribes activate 80% / holdout 10% / experiment pool 10%. Regeneration can therefore recreate misleading material.

The optional generator additionally requires Codex's bundled `@oai/artifact-tool` runtime (05_presentation.py:122–144), absent from the ordinary npm dependencies; it is not reproducible from just the README's normal Python/Node install.

Fix: either explicitly archive/deprecate this generator and watermark the existing deck as historical, or align its payload/rendering with the schema-v3 contract and document the special runtime. Do not regenerate a seemingly current deck with the old policy.

### E8 — P2: Frontend interactions and failure paths have no automated test gate

`C:/Users/andre/Downloads/Datathon/package.json:6` defines dev/build/preview/typecheck, with no test script or frontend test dependency. Current tests cover Python population/model logic and simple Flask readiness, not presentation route mapping, filter redraws, safe unavailable states, CSV export scope, keyboard dialogs, Pages base paths, or chart field/unit bindings. Typechecking cannot detect the confirmed E3/E4 behavior.

Fix: introduce a small set of high-value integration/browser fixtures for critical routes, data-bound chart values, empty/unavailable datasets, non-root hosting and keyboard controls. Avoid screenshot-only tests that miss numerical semantics.

### E9 — P2: Python dependency versions are unconstrained for reproducible model outputs

`C:/Users/andre/Downloads/Datathon/requirements.txt:1` through line 10 contain only minimum versions, including pandas/numpy/scikit-learn/plotly/pyarrow. CI and Render always install the current compatible versions; no Python lock records the known-working environment. The model seed is fixed, which is good, but dependency behavior/serializers can still drift.

Fix: preserve a locked or constrained tested Python environment with Python version, add an upgrade process, and capture environment versions in the analytical run metadata. No vulnerability claim is made; dependency advisory databases were not queried.

### E10 — P3: CSV export quotes text but does not neutralize spreadsheet formulas

`C:/Users/andre/Downloads/Datathon/frontend/src/App.tsx:283` escapes quotes and wraps all cells in quotes. Spreadsheet programs can still evaluate formula-prefixed strings. Current public dataset inspection found zero strings beginning with =, +, -, @, tab or carriage return, so there is no observed exploit in current data.

Fix: sanitize only textual fields at the export boundary, with a documented escape strategy; preserve real numeric negatives as numbers. Test a supplied label such as `=1+1` and normal negative numeric values.

## Inventory and positive checks

- Flask serves only its public folder and the explicit legacy archive; raw source directory is not directly mapped to static HTTP routes.
- Asset path validation resolves paths and rejects references outside public. Flask send_from_directory supplies traversal protection.
- No external messaging or deployment occurred. No account names, email addresses or raw values were printed in this review.
- Node package-lock exists; npm ci is used in validation. Python/model random_state is explicitly 42.
- README distinguishes source inputs, generated copies, historical PowerPoint and current browser deck, and explains CI's current scope.
- Cross-contract validator checks canonical counts, amounts, model timestamps and v3 byte equality, and existing Python tests protect prior analytical repairs.

## Limits

Local source/static artifacts and Flask test-client responses were examined. This track did not browse the deployed Render/Pages sites, determine GitHub repository visibility, inspect hosting secrets, audit dependency advisory databases, rerun full analytics, or verify every frontend chart visually. The parent audit coordinates those other tracks. No source changes were made.
