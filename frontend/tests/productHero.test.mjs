import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// The hero inlines its figures (the contract is too large to bundle with it);
// this keeps them equal to the dashboard contract they were copied from.
const source = ts.transpileModule(fs.readFileSync('frontend/src/hero/numbers.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { HERO_NUMBERS, EXAMPLE_COST } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const summary = JSON.parse(fs.readFileSync('frontend/public/dashboard-data-v3.json', 'utf8')).datasets.summary[0];

test('product hero figures match the dashboard contract summary', () => {
  assert.equal(HERO_NUMBERS.marketingWinRate, summary.marketing_recent_win_rate);
  assert.equal(HERO_NUMBERS.bestSource, summary.recent_best_rate_source);
  assert.equal(HERO_NUMBERS.bestWinRate, summary.recent_best_win_rate);
  assert.equal(HERO_NUMBERS.pilotArmSize, summary.pilot_arm_size);
  assert.equal(HERO_NUMBERS.pilotLiftPp, summary.pilot_detectable_lift_pp_at_5pct);
  assert.equal(HERO_NUMBERS.treatmentAccounts, summary.pilot_treatment_accounts);
});

test('the shown strings are the rounded contract values', () => {
  assert.equal((HERO_NUMBERS.marketingWinRate * 100).toFixed(1), '10.2');
  assert.equal((HERO_NUMBERS.bestWinRate * 100).toFixed(1), '26.8');
  assert.equal(HERO_NUMBERS.pilotArmSize.toLocaleString('en-US'), '1,017');
  assert.equal(HERO_NUMBERS.pilotLiftPp.toFixed(1), '3.1');
});

test('the example budget is treatment accounts x the illustrative cost', () => {
  assert.equal(EXAMPLE_COST, 40);
  assert.equal((HERO_NUMBERS.treatmentAccounts * EXAMPLE_COST).toLocaleString('en-US'), '40,680');
});
