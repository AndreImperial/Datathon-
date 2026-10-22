import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(path) {
 const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const {compareValues,csvCell,formatField,fieldUnit,formatDollarsCompact,columnLabel,serializeEvidenceCsv} = await load('frontend/src/evidence.ts');
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
test('display dollars are whole for amounts, keep cents for unit costs, CSV keeps full precision', () => {
 assert.equal(formatField('channel_spend',3255957.4),'$3,255,957');
 assert.equal(formatField('channel_spend',1186809.5),'$1,186,810');
 assert.equal(formatField('total_pipeline',-1500.25),'-$1,500');
 assert.equal(formatField('cpc',4.567),'$4.57');
 assert.equal(formatDollarsCompact(3255957.4),'$3.3M');
 assert.equal(formatDollarsCompact(678400),'$678K');
 assert.match(serializeEvidenceCsv([{channel_spend:3255957.4}]),/"3255957\.4"/);
});
test('observation windows read as month-year and headers are humanised', () => {
 assert.equal(formatField('spend_period_start','2023-01-31T08:55:01+00:00'),'Jan 2023');
 assert.equal(formatField('pipeline_period_end','2024-10-07T01:20:57+00:00'),'Oct 2024');
 assert.equal(columnLabel('channel_spend'),'Channel spend ($)');
 assert.equal(columnLabel('pipeline_roi'),'Pipeline ROI (×)');
 assert.equal(columnLabel('channel_category'),'Channel category');
});
test('spreadsheet formulas escaped while numeric negatives survive', () => {
 for (const v of ['=SUM(A1)','+cmd','-formula','@test','  =test']) assert.ok(csvCell(v).startsWith('"\''));
 assert.equal(csvCell(-5),'"-5"');
 assert.equal(csvCell('a"b'),'"a""b"');
});
