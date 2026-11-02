import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["frontend/src/motion.ts"], bundle: true, format: "esm", write: false, platform: "neutral" });
const motion = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const app = await readFile("frontend/src/App.tsx", "utf8");
const css = await readFile("frontend/src/styles.css", "utf8");

test("number templates count with the displayed format and land on the exact text", () => {
  const cases = [
    ["$24.9M", "$0.0M"],
    ["10.2%", "0.0%"],
    ["2,034 domains", "0 domains"],
    ["+3.1 pp", "+0.0 pp"],
    ["$1.2M/mo", "$0.0M/mo"],
    ["$678K", "$0K"],
    ["Mature-cohort win rate 30.1% → 20.5%", "Mature-cohort win rate 0.0% → 0.0%"],
  ];
  for (const [text, start] of cases) {
    const format = motion.numberTemplate(text);
    assert.ok(format, `${text} is countable`);
    assert.equal(format(0), start, `${text} starts at zero in its own format`);
    assert.equal(format(1), text, `${text} ends on the exact final text`);
  }
  const halfway = motion.numberTemplate("12,500 accounts")(0.5);
  assert.equal(halfway, "6,250 accounts", "grouping is kept while counting");
});

test("years and text without figures are never counted", () => {
  assert.equal(motion.numberTemplate("Referral"), null);
  assert.equal(motion.numberTemplate("Withdrawn"), null);
  assert.equal(motion.numberTemplate("2023–24"), null, "a year range has nothing to count");
  assert.equal(motion.numberTemplate("Lowest of 6 sources, 2023")(0), "Lowest of 0 sources, 2023", "the year stays fixed while other figures count");
});

test("motion tokens are published to CSS from the shared module", () => {
  const props = new Map();
  motion.applyMotionTokens({ style: { setProperty: (key, value) => props.set(key, value) } });
  assert.equal(props.get("--motion-fast"), `${Math.round(motion.DURATION.fast * 1000)}ms`);
  assert.equal(props.get("--motion-base"), `${Math.round(motion.DURATION.base * 1000)}ms`);
  assert.equal(props.get("--motion-ease"), motion.EASE.css);
  assert.deepEqual([...motion.EASE_BEZIER], [0.22, 1, 0.36, 1]);
});

test("the dashboard imports its timings instead of hard-coding them", () => {
  assert.match(app, /from "\.\/motion"/);
  assert.doesNotMatch(app, /duration:\s*0?\.\d/, "no literal tween durations in App.tsx");
  assert.doesNotMatch(app, /ease:\s*"power/, "no literal GSAP eases in App.tsx");
  assert.match(app, /ENTER\.tile\(index\)/, "KPI tiles deal in with the shared tile preset");
  assert.match(app, /countUpDisplayed\(/, "figures count up through the shared helper");
  assert.match(app, /startViewTransition/, "section changes use the View Transitions API");
  assert.match(app, /typeof doc\.startViewTransition !== "function"\) \{ update\(\); return; \}/, "with a plain update as fallback");
});

test("motion can never hide evidence or leak into print or reduced motion", () => {
  assert.match(css, /\.app-shell:not\(\.js-motion\) \[data-enter\] \{ opacity: 1 !important; visibility: visible !important; transform: none !important; \}/);
  assert.match(css, /@media print \{\s*\.app-shell \[data-enter\] \{ opacity: 1 !important;/);
  assert.match(app, /finishEntrances\(\);\s*try \{\s*flushSync/, "print lands running entrances before rendering every section");
  assert.match(app, /if \(!motionAllowed\(\)\) \{ if \(!started\.has\(active\)\)/, "reduced motion and print-prep skip the entrance");
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /::view-transition-old\(\*\)/);
  assert.match(reduced, /\.caveats-drawer/);
});

test("folded text stays in the page and always prints", () => {
  assert.match(app, /querySelectorAll<HTMLDetailsElement>\("details\.evidence-details, details\.text-fold"\)\.forEach\(\(node\) => \{ node\.open = true; \}\)/, "print opens every text fold");
  assert.match(app, /className=\{`chart-takeaway\$\{details \? "" : " is-folded"\}`\}/, "a folded chart summary stays in the DOM as the chart's description");
  assert.match(css, /@media print \{\s*\.chart-heading p\.chart-takeaway\.is-folded \{ display: block; \}/, "a folded chart summary prints");
});
