import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(path) {
 const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const {requiredPerArm, detectableLift, parsePilotDesign, parseMoneyInput, pilotBudget, formatBudget} = await load('frontend/src/evidence.ts');
const contract = JSON.parse(fs.readFileSync('frontend/public/dashboard-data-v3.json', 'utf8'));

test('per-arm sizing matches every experiment_scenarios row', () => {
 for (const row of contract.datasets.experiment_scenarios) assert.equal(requiredPerArm(row.baseline_rate, row.absolute_lift), row.required_per_arm, row.scenario);
});
test('detectable lift is the inverse of the sizing formula at 1,017 per arm', () => {
 for (const baseline of [0.02, 0.05, 0.10]) {
  const lift = detectableLift(baseline, 1017);
  assert.ok(requiredPerArm(baseline, lift) <= 1017);
  assert.ok(requiredPerArm(baseline, lift - 0.0005) > 1017);
 }
 assert.equal((detectableLift(0.05, 1017) * 100).toFixed(1), '3.1');
 assert.ok(Number.isNaN(detectableLift(0, 1017)));
 assert.ok(Number.isNaN(detectableLift(0.05, 0)));
});
test('pilot design parses contract rows and degrades when absent', () => {
 assert.equal(parsePilotDesign(undefined), null);
 assert.equal(parsePilotDesign([]), null);
 const rows = [0.10, 0.02, 0.05].map((b) => ({design: 'All eligible, 50/50', baseline_rate: b, arm_size: 1017, total_accounts: 2034, horizon_days: 90, outcome: 'New CRM opportunity within 90 days', alpha: 0.05, power: 0.8}));
 const design = parsePilotDesign(rows);
 assert.equal(design.armSize, 1017);
 assert.equal(design.totalAccounts, 2034);
 assert.deepEqual(design.rows.map((r) => r.baseline), [0.02, 0.05, 0.10]);
 assert.equal(design.rows[1].liftPp.toFixed(1), '3.1');
 assert.ok(Math.abs(design.rows[1].treatmentRate - (0.05 + design.rows[1].liftPp / 100)) < 1e-12);
 const supplied = parsePilotDesign([{baseline_rate: 0.05, arm_size: 1017, total_accounts: 2034, detectable_lift_pp: 2.9, treatment_rate: 0.079}]);
 assert.equal(supplied.rows[0].liftPp, 2.9);
 assert.equal(supplied.rows[0].treatmentRate, 0.079);
 assert.equal(supplied.horizonDays, 90);
});
test('money input validation: empty, numeric, negative, non-numeric', () => {
 assert.deepEqual(parseMoneyInput(''), {state: 'empty'});
 assert.deepEqual(parseMoneyInput('   '), {state: 'empty'});
 assert.deepEqual(parseMoneyInput('40'), {state: 'ok', value: 40});
 assert.deepEqual(parseMoneyInput('$1,250.50'), {state: 'ok', value: 1250.5});
 assert.deepEqual(parseMoneyInput('.5'), {state: 'ok', value: 0.5});
 assert.deepEqual(parseMoneyInput('0'), {state: 'ok', value: 0});
 assert.equal(parseMoneyInput('-3', 'Cost').state, 'invalid');
 assert.match(parseMoneyInput('-3', 'Cost').message, /cannot be negative/);
 for (const bad of ['abc', '12abc', '1e3', 'NaN', '--2', '1.2.3']) assert.equal(parseMoneyInput(bad).state, 'invalid', bad);
});
test('pilot budget = treatment accounts x unit cost + fixed, nothing invented', () => {
 const empty = pilotBudget(1017, '');
 assert.equal(empty.state, 'empty');
 assert.match(empty.message, /Enter a unit cost to size the pilot budget/);
 assert.equal(pilotBudget(1017, '', '5000').state, 'empty');
 const unit = pilotBudget(1017, '40');
 assert.equal(unit.state, 'ok');
 assert.equal(unit.total, 40680);
 assert.equal(unit.fixed, 0);
 assert.match(unit.message, /\$40,680 \(1,017 treatment accounts × \$40\)/);
 const both = pilotBudget(1017, '12.5', '2,000');
 assert.equal(both.total, 1017 * 12.5 + 2000);
 assert.match(both.message, /\$14,712\.50/);
 assert.equal(pilotBudget(1017, '-1').state, 'invalid');
 assert.equal(pilotBudget(1017, '10', 'x').state, 'invalid');
 assert.equal(pilotBudget(NaN, '10').state, 'invalid');
 assert.equal(formatBudget(40680), '$40,680');
 assert.equal(formatBudget(0.5), '$0.50');
});
