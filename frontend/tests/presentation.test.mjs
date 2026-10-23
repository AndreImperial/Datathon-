import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const compiled = await build({entryPoints:['frontend/src/presentation/PresentationApp.tsx'],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','lucide-react'],loader:{'.css':'empty'}});
// Resolve external imports from a file URL, rather than a data URL.
const { writeFile, unlink } = await import('node:fs/promises');
const output = new URL('../../.presentation-test.mjs', import.meta.url);
await writeFile(output,compiled.outputFiles[0].text);
const { PresentationApp } = await import(output.href);
await unlink(output);
const data=JSON.parse(await readFile('public/dashboard-data-v3.json','utf8'));
async function mounted(hash, run, props={}) {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'+hash});
  const old={};
  for(const key of ['window','document','location','history','HTMLElement']) { old[key]=globalThis[key]; globalThis[key]=dom.window[key]; }
  const oldChannel=globalThis.BroadcastChannel; globalThis.BroadcastChannel=undefined;
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const root=createRoot(document.getElementById('root'));
  try { await act(async()=>root.render(React.createElement(PresentationApp,{data,...props}))); await run(dom); }
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
test('main slides lead with a data-derived action title and keep the topic as the kicker',async()=>mounted('#present/main-06',async()=>{
  const s=data.datasets.summary[0];
  const h1=document.querySelector('h1').textContent;
  assert.ok(h1.includes(`${(s.marketing_recent_win_rate*100).toFixed(1)}%`) && h1.includes(`${(s.recent_best_win_rate*100).toFixed(1)}%`), h1);
  assert.match(document.querySelector('.slide-kicker').textContent,/Recent conversion by source/);
  assert.ok(document.querySelector('.slide-bar.is-accent').textContent.includes('Marketing'));
}));
test('overview groups slides by section with every slide reachable',async()=>mounted('#present/main-05',async()=>{
  await act(async()=>button('Overview').click());
  const groups=[...document.querySelectorAll('.overview-groups h3')].map(x=>x.textContent);
  assert.deepEqual(groups,['Context','Channels','Content','Attribution','Audience','Decision','Appendix']);
  assert.equal(document.querySelectorAll('.overview-groups button').length,22);
  assert.ok(document.querySelector('.overview-groups button[aria-current]').textContent.includes('Channel effectiveness'));
}));
test('the 16 main headlines are all computed takeaways and all distinct (horizontal logic)',async()=>mounted('#present/main-01',async()=>{
  await act(async()=>button('Overview').click());
  const main=data.presentation.slides.filter(s=>s.sequence==='main').sort((a,b)=>a.order-b.order);
  const headlines=[...document.querySelectorAll('.overview-groups button span')].slice(0,16).map(x=>x.textContent);
  assert.equal(new Set(headlines).size,16,headlines.join('\n'));
  headlines.forEach((h,i)=>assert.notEqual(h,main[i].title,`main-${i+1} fell back to its topic title`));
}));
test('the deck opens and closes on the same big idea, and the ask names owner, first measure and review',async()=>mounted('#present/main-01',async(dom)=>{
  const bigIdea=document.querySelector('h1').textContent;
  assert.equal(bigIdea,'Fix conversion before buying volume. Prove reach before scaling spend.');
  await act(async()=>{ location.hash='#present/main-16'; dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange')); });
  assert.equal(document.querySelector('.deck-bigidea').textContent.replace(/^The big idea/,''),bigIdea);
  const rows=[...document.querySelectorAll('.deck-ask tbody tr')];
  assert.equal(rows.length,3,`${rows.length} decisions`);
  assert.match(rows[0].textContent,/marketing-sourced conversion/i); assert.match(rows[1].textContent,/90-day/); assert.match(rows[2].textContent,/contract value/i);
  for(const row of rows) assert.ok([...row.children].every(cell=>cell.textContent.trim().length>0), row.textContent);
  assert.deepEqual([...document.querySelectorAll('.deck-ask thead th')].map(x=>x.textContent),['Decision','Owner','First measure','Review']);
}));
test('presenter console keeps the big idea in view and bridges into the next headline',async()=>mounted('#presenter/r3test',async()=>{
  const next=document.querySelector('.presenter-upnext h2').textContent;
  assert.ok(document.querySelector('.presenter-transition').textContent.includes(next));
  assert.ok(document.querySelector('.presenter-bigidea').textContent.includes(document.querySelector('.presenter-current h1').textContent));
  // The keyboard hint is a <kbd>: its accessible text comes from content, not a prohibited aria-label.
  const keys=document.querySelector('.presenter-keys');
  assert.equal(keys.getAttribute('aria-label'),null); assert.match(keys.querySelector('.sr-only').textContent,/Page Down for next/);
  assert.equal(document.querySelector('main').id,'main-content');
},{presenter:true}));
test('main-09 shows short email labels and keeps each full campaign name as the tooltip',async()=>mounted('#present/main-09',async()=>{
  const top=[...data.datasets.email_content].sort((a,b)=>b.unique_clickers-a.unique_clickers).slice(0,5);
  const names=[...document.querySelectorAll('.slide-bar-name')];
  assert.equal(names.length,5);
  names.forEach((name,i)=>{
    assert.equal(name.title,top[i].content_title);
    assert.ok(name.textContent.length<=44 && !/^EM\d*\b|_/.test(name.textContent),name.textContent);
  });
  assert.equal(new Set(names.map(x=>x.textContent)).size,5);
  assert.equal(names[3].textContent.replace(/\u00a0/g,' '),'Newsletter Jan–Mar W2 · Jan 29');
}));
test('the page skip link focuses the deck instead of leaving it, and elapsed time is named by its text',async()=>mounted('#present/main-03',async(dom)=>{
  const skip=document.createElement('a'); skip.className='skip-link'; skip.href='#main-content'; skip.textContent='Skip'; document.body.prepend(skip);
  const main=document.querySelector('main');
  assert.equal(main.id,'main-content');
  const click=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true});
  await act(async()=>skip.dispatchEvent(click));
  assert.equal(click.defaultPrevented,true); assert.equal(location.hash,'#present/main-03'); assert.equal(document.activeElement,main);
  const elapsed=document.querySelector('.deck-elapsed');
  assert.equal(elapsed.getAttribute('aria-label'),null); assert.match(elapsed.textContent,/^Elapsed presentation time \d\d:\d\d \/ \d\d:\d\d$/);
}));
