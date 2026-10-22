import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const compiled = await build({entryPoints:['frontend/src/presentation/PresentationApp.tsx'],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','lucide-react']});
// Resolve external imports from a file URL, rather than a data URL.
const { writeFile, unlink } = await import('node:fs/promises');
const output = new URL('../../.presentation-test.mjs', import.meta.url);
await writeFile(output,compiled.outputFiles[0].text);
const { PresentationApp } = await import(output.href);
await unlink(output);
const data=JSON.parse(await readFile('public/dashboard-data-v3.json','utf8'));
async function mounted(hash, run) {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'+hash});
  const old={};
  for(const key of ['window','document','location','history','HTMLElement']) { old[key]=globalThis[key]; globalThis[key]=dom.window[key]; }
  const oldChannel=globalThis.BroadcastChannel; globalThis.BroadcastChannel=undefined;
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const root=createRoot(document.getElementById('root'));
  try { await act(async()=>root.render(React.createElement(PresentationApp,{data}))); await run(dom); }
  finally { await act(async()=>root.unmount()); dom.window.close(); for(const key of Object.keys(old)) globalThis[key]=old[key]; globalThis.BroadcastChannel=oldChannel; }
}
const button = name => [...document.querySelectorAll('button')].find(x=>x.textContent.trim()===name || x.getAttribute('aria-label')===name);
test('Space keeps native button activation and PageDown keeps evidence scrolling',async()=>mounted('#present/main-04',async(dom)=>{
  const previous=button('Previous'); previous.focus();
  const space=new dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});
  await act(async()=>previous.dispatchEvent(space));
  assert.equal(space.defaultPrevented,false); assert.equal(location.hash,'#present/main-04');
  await act(async()=>previous.click()); assert.equal(location.hash,'#present/main-03');
  const region=document.querySelector('[data-evidence-scroll]'); region.focus();
  await act(async()=>region.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'PageDown',bubbles:true,cancelable:true})));
  assert.equal(location.hash,'#present/main-03');
}));
test('overview makes background inert and Escape from its focused button closes it',async()=>mounted('#present/main-04',async(dom)=>{
  await act(async()=>button('Overview').click());
  assert.ok(document.querySelector('[role=dialog]'));
  assert.equal(document.querySelector('.presentation-shell>div').inert,true);
  const close=button('Close slide overview'); close.focus();
  await act(async()=>close.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  assert.equal(document.querySelector('[role=dialog]'),null);
  assert.equal(document.querySelector('.presentation-shell>div').inert,false);
}));
test('unknown routes canonicalize and a known hash change updates the visible slide',async()=>mounted('#present/main-999',async(dom)=>{
  assert.equal(location.hash,'#present/main-01');
  await act(async()=>{ location.hash='#present/appendix-02'; dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange')); });
  assert.equal(document.querySelector('h1').textContent,'Metric definitions and unavailable denominators');
  assert.equal(location.hash,'#present/appendix-02');
}));
test('attribution lookback changes the whole-window population without repeating it per channel',async()=>mounted('#present/main-11',async(dom)=>{
  assert.match(document.querySelector('.slide-canvas').textContent,/Whole-window linked population: 684 opportunities/);
  const select=[...document.querySelectorAll('select')].find(x=>x.parentElement.textContent.includes('Lookback'));
  await act(async()=>{ select.value='30'; select.dispatchEvent(new dom.window.Event('change',{bubbles:true})); });
  assert.match(document.querySelector('.slide-canvas').textContent,/Whole-window linked population: 423 opportunities/);
  assert.ok(!document.querySelector('.slide-table').textContent.includes('linked opportunities'));
}));
