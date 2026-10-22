import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const load = async file => {
  const result = await build({ entryPoints: [file], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
};
const deck = await load('frontend/src/presentation/deckState.ts');
const evidence = await load('frontend/src/evidence.ts');
const slides = [{id:'main-01',sequence:'main'},{id:'main-02',sequence:'main'},{id:'appendix-01',sequence:'appendix'},{id:'appendix-02',sequence:'appendix'}];
test('rapid next commands use latest state and sequence switching uses new list', () => {
  let s = deck.initialState(slides);
  s = deck.applyCommand(s,{kind:'go',slideId:'appendix-01'},slides,0);
  s = deck.applyCommand(s,{kind:'next'},slides,0);
  assert.equal(s.slideId,'appendix-02');
  s = deck.applyCommand(s,{kind:'go',slideId:'main-01'},slides,0);
  for (let i=0;i<3;i++) s=deck.applyCommand(s,{kind:'next'},slides,0);
  assert.equal(s.slideId,'main-02');
});
test('pause uses event time and refresh state remains valid', () => {
  let s=deck.applyCommand(deck.initialState(slides),{kind:'start'},slides,1000);
  s=deck.applyCommand(s,{kind:'pause'},slides,1379);
  assert.equal(s.elapsedBeforeStartMs,379);
  s=deck.applyCommand(s,{kind:'start'},slides,2000);
  assert.equal(deck.elapsedAt(s,2141),520);
  assert.ok(deck.validState(JSON.parse(JSON.stringify(s)),slides));
});
test('invalid routes and malformed messages are rejected', () => {
  for(const hash of ['#present/main-999','#present/main-01/extra','#present/main-01?x']) assert.equal(deck.slideFromHash(hash,slides),undefined);
  assert.equal(deck.slideFromHash('#present/appendix-01',slides).sequence,'appendix');
  assert.equal(deck.validState({...deck.initialState(slides),revision:-1},slides),false);
  assert.equal(deck.validCommand({kind:'timer',state:{}}),false);
});
test('blocked storage falls back without throwing', () => {
  const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
  assert.equal(deck.storageRead(denied,'x'),null); assert.equal(deck.storageWrite(denied,'x','y'),false);
});
test('numeric amounts sort by magnitude with missing last in either direction', () => {
  const rows=[1500000,30000,null,-10,0,1100000];
  assert.deepEqual([...rows].sort((a,b)=>evidence.compareValues(a,b)),[-10,0,30000,1100000,1500000,null]);
  assert.deepEqual([...rows].sort((a,b)=>evidence.compareValues(a,b,-1)),[1500000,1100000,30000,0,-10,null]);
});
test('CSV neutralizes textual formulas and preserves numeric negatives/opaque identifiers', () => {
  assert.equal(evidence.csvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"');
  assert.equal(evidence.csvCell(-10),'"-10"');
  assert.equal(evidence.formatField('asset_id','file_name_01'),'file_name_01');
  assert.equal(evidence.formatField('roi',0),'0.0×');
});
test('actual contract keys preserve coverage, counts, dollar costs and percentage fields', () => {
  for (const key of ['positive_amount_coverage','won_positive_amount_coverage','pipeline_pct','mktg_pct','pct_of_total','importance']) assert.equal(evidence.formatField(key,.23),'23.00%');
  for (const key of ['canonical_resolved_rows','eligible_domain_date_amount']) assert.equal(evidence.formatField(key,2834),'2,834');
  assert.equal(evidence.formatField('cpc',.23),'$0.23');
  assert.equal(evidence.formatField('auc',.516),'0.516');
});
test('the downloaded CSV serializer retains snapshot, units, source and supplied row order', () => {
  const csv=evidence.serializeEvidenceCsv([{asset_id:'file_name_01',amount:-10},{asset_id:'=formula',amount:30}],{snapshot_id:'snapshot-fixture',snapshot_generated_at:'2026-10-03T00:00:00Z',source:'fixture-source',scope:'same-period',methodology:'fixture-method'});
  assert.match(csv,/snapshot-fixture/); assert.match(csv,/amount: recorded dollars/);
  assert.ok(csv.indexOf('file_name_01')<csv.indexOf("'=formula"));
  assert.match(csv,/"-10"/); assert.match(csv,/fixture-source/);
});
