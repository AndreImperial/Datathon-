import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["frontend/src/motion.ts"], bundle: true, format: "esm", write: false, platform: "neutral" });
const motion = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));

test("count-up eases out and lands exactly on the final value", () => {
  assert.equal(motion.countValueAt(0, 100, 0), 0);
  assert.equal(motion.countValueAt(0, 100, 1), 100);
  assert.ok(motion.countValueAt(0, 100, 0.5) > 50, "ease-out is past halfway at the midpoint");
  assert.equal(motion.countValueAt(0, 100, 2), 100, "progress beyond 1 clamps");
});

test("tile entrance alternates its tilt", () => {
  assert.equal(motion.ENTER.tile(0).rotate, -2.5);
  assert.equal(motion.ENTER.tile(1).rotate, 2.5);
  assert.equal(motion.ENTER.tile(2).rotate, -2.5);
});
