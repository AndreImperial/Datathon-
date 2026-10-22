import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(path) {
 const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const {compareValues,csvCell,formatField,fieldUnit} = await load('frontend/src/evidence.ts');
const {numberValue} = await load('frontend/src/types.ts');
test('raw numeric sort puts missing last in both directions', () => {
 const values=[1500000,null,30000,-12,0,0.5,NaN];
 assert.deepEqual(values.toSorted((a,b)=>compareValues(a,b)).slice(0,5),[-12,0,0.5,30000,1500000]);
 assert.deepEqual(values.toSorted((a,b)=>compareValues(a,b,-1)).slice(0,5),[1500000,30000,0.5,0,-12]);
});
test('missing and malformed values do not become measured zero', () => {
 for (const v of [null,'','   ','bad',false]) assert.ok(Number.isNaN(numberValue({v},'v')));
 assert.equal(numberValue({v:0},'v'),0);
 assert.equal(formatField('pipeline_roi',0),'0.0×');
 assert.equal(formatField('pipeline',null),'—');
});
test('explicit units distinguish ratios dollars fractions and pp', () => {
 assert.equal(fieldUnit('recorded_sourced_pipeline_per_tracked_spend'),'multiple');
 assert.equal(formatField('precision',0.42),'42.00%');
 assert.equal(formatField('abs_gap',0.15),'+15.00 pp');
 assert.equal(formatField('effect_pp',5),'+5.00 pp');
 assert.equal(formatField('ctr',0.000001),'0.0001%');
 assert.equal(fieldUnit('coverage_count'),'source value');
 assert.equal(formatField('asset_id','00012'),'00012');
});
test('spreadsheet formulas escaped while numeric negatives survive', () => {
 for (const v of ['=SUM(A1)','+cmd','-formula','@test','  =test']) assert.ok(csvCell(v).startsWith('"\''));
 assert.equal(csvCell(-5),'"-5"');
 assert.equal(csvCell('a"b'),'"a""b"');
});
