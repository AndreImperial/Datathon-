import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
// Bundle the real validators App.tsx uses (no externals, so a data URL import resolves everything).
const compiled = await build({entryPoints:['frontend/src/dataContract.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const { validateDashboardPayload, validateCaseStudyPayload } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const readJson = async path => JSON.parse(await readFile(path,'utf8'));
// App.tsx fetches these from frontend/public (dev) and public/ (built site); both must satisfy the contract.
for (const path of ['frontend/public/dashboard-data.json','public/dashboard-data.json']) {
  test(`committed ${path} passes the live v2 dashboard validator`, async () => {
    const data = await readJson(path);
    assert.doesNotThrow(() => validateDashboardPayload(data));
  });
}
for (const path of ['frontend/public/dashboard-data-v3.json','public/dashboard-data-v3.json']) {
  test(`committed ${path} passes the presentation validator`, async () => {
    const data = await readJson(path);
    assert.doesNotThrow(() => validateCaseStudyPayload(data));
  });
}
test('manifest distinct chart count must agree with chart metadata', async () => {
  const data = await readJson('frontend/public/dashboard-data.json');
  const inflated = structuredClone(data);
  inflated.manifest.distinct_chart_count += 1;
  inflated.manifest.distinct_chart_definitions.push('c-not-in-metadata');
  assert.throws(() => validateDashboardPayload(inflated), /preservation manifest is incomplete/);
  const miscounted = structuredClone(data);
  miscounted.manifest.distinct_chart_count -= 1;
  assert.throws(() => validateDashboardPayload(miscounted), /preservation manifest is incomplete/);
  const relabelled = structuredClone(data);
  relabelled.chart_metadata[0].canonical_chart_id = 'c-unlisted';
  assert.throws(() => validateDashboardPayload(relabelled), /preservation manifest is incomplete/);
});
test('wrong schema versions are rejected', async () => {
  assert.throws(() => validateDashboardPayload({schema_version:3}), /not version 2/);
  assert.throws(() => validateCaseStudyPayload({schema_version:2}), /not schema version 3/);
});
