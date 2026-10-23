import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(path) {
 const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const {listPhrase, topRows} = await load('frontend/src/evidence.ts');

test('listPhrase joins names as prose', () => {
 assert.equal(listPhrase([]), '');
 assert.equal(listPhrase(['A']), 'A');
 assert.equal(listPhrase(['A', 'B']), 'A and B');
 assert.equal(listPhrase(['A', 'B', 'C']), 'A, B, and C');
});

test('topRows ranks positive finite values only, largest first', () => {
 const rows = [{c:'a',v:5},{c:'b',v:null},{c:'c',v:9},{c:'d',v:0},{c:'e',v:NaN},{c:'f',v:7}];
 assert.deepEqual(topRows(rows, 'v', 2).map((r) => r.c), ['c', 'f']);
 assert.deepEqual(topRows(rows, 'v', 5, (r) => r.c !== 'c').map((r) => r.c), ['f', 'a']);
});

test('dashboard explanation copy quotes no hard-coded figures (B11)', () => {
 const app = fs.readFileSync('frontend/src/App.tsx', 'utf8');
 const start = app.indexOf('const explain:');
 const end = app.indexOf('const GENERIC_CAVEAT');
 assert.ok(start > 0 && end > start, 'explain table not found');
 const copy = app.slice(start, end);
 // Dollar amounts and thousands-separated counts must come from the data contract.
 assert.deepEqual(copy.match(/\$\d[\d.,]*[KMB]?/g) ?? [], []);
 assert.deepEqual(copy.match(/\b\d{1,3}(?:,\d{3})+\b/g) ?? [], []);
 // Cohort win rates and quarters are read from context metrics, not typed in.
 assert.doesNotMatch(copy, /\b20\d\dQ[1-4]\b/);
});
