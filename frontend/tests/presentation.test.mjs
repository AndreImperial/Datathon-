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
async function mounted(hash, run, props={}, setup=()=>{}) {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'+hash});
  setup(dom);
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

/* ---------- executive cut ---------- */
const go=async(dom,id)=>act(async()=>{ location.hash='#present/'+id; dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange')); });
const cutButton=name=>[...document.querySelectorAll('.deck-cut-header button')].find(x=>x.textContent.startsWith(name));
const counter=()=>document.querySelector('.deck-counter').textContent;
const elapsedTarget=()=>document.querySelector('.deck-elapsed').textContent.split('/').pop().trim();
test('the full 16-slide deck is the default and the header toggle names both cuts with their length',async()=>mounted('#present/main-01',async()=>{
  const group=document.querySelector('.presentation-header [role=group]');
  assert.equal(group.getAttribute('aria-label'),'Presentation length');
  assert.deepEqual([...group.querySelectorAll('button')].map(x=>[x.textContent,x.getAttribute('aria-pressed')]),[['Full · 18 min','true'],['Executive · 10 min','false']]);
  assert.equal(counter(),'1 / 16'); assert.equal(elapsedTarget(),'18:00');
}));
test('executive cut: Next walks the 8-slide path, the counter, progress and timer follow it, and Previous walks back',async()=>mounted('#present/main-01',async()=>{
  await act(async()=>cutButton('Executive').click());
  assert.equal(cutButton('Executive').getAttribute('aria-pressed'),'true'); assert.equal(cutButton('Full').getAttribute('aria-pressed'),'false');
  assert.equal(counter(),'1 / 8'); assert.equal(elapsedTarget(),'10:00');
  assert.ok(![...document.querySelectorAll('.deck-progress small')].some(x=>x.textContent==='Content'),'Content has no slide in the executive cut');
  const visited=[location.hash];
  for(let i=0;i<7;i++){ await act(async()=>button('Next').click()); visited.push(location.hash); }
  assert.deepEqual(visited.map(h=>h.replace('#present/','')),['main-01','main-02','main-04','main-06','main-10','main-12','main-14','main-16']);
  assert.equal(counter(),'8 / 8'); assert.equal(document.querySelector('.slide-kicker b').textContent,'08 / 8');
  assert.ok(button('Appendix'),'the last slide of the cut offers the appendix');
  await act(async()=>button('Previous').click()); assert.equal(location.hash,'#present/main-14');
  const key=Object.keys(window.sessionStorage).find(k=>k.startsWith('deck-state-'));
  assert.equal(JSON.parse(window.sessionStorage.getItem(key)).cut,'executive');
}));
test('executive cut keeps every route valid: a skipped slide shows as extra and Next rejoins the path',async()=>mounted('#present/main-05',async(dom)=>{
  await act(async()=>cutButton('Executive').click());
  assert.equal(location.hash,'#present/main-04','switching from a skipped slide lands on the nearest earlier slide of the cut');
  await go(dom,'main-08');
  assert.equal(location.hash,'#present/main-08'); assert.match(counter(),/^Extra/);
  await act(async()=>button('Next').click()); assert.equal(location.hash,'#present/main-10');
  await act(async()=>cutButton('Full').click()); assert.equal(counter(),'10 / 16');
  await act(async()=>button('Next').click()); assert.equal(location.hash,'#present/main-11');
}));
test('the overview carries the toggle and lists only the active cut',async()=>mounted('#present/main-01',async()=>{
  await act(async()=>button('Overview').click());
  const dialog=document.querySelector('[role=dialog]');
  const toggle=name=>[...dialog.querySelectorAll('[role=group] button')].find(x=>x.textContent.startsWith(name));
  assert.equal(dialog.querySelectorAll('.overview-groups button').length,22);
  await act(async()=>toggle('Executive').click());
  assert.equal(toggle('Executive').getAttribute('aria-pressed'),'true');
  assert.equal(dialog.querySelectorAll('.overview-groups button').length,14);
  assert.match(dialog.querySelector('.overview-hint').textContent,/Executive cut · 8 of 16 main slides/);
  assert.ok(![...dialog.querySelectorAll('.overview-groups h3')].some(x=>x.textContent==='Content'));
  await act(async()=>toggle('Full').click());
  assert.equal(dialog.querySelectorAll('.overview-groups button').length,22);
}));
test('the presenter console follows the stored cut: counter, timer target and next slide',async()=>mounted('#presenter/cut-test',async()=>{
  assert.match(document.querySelector('.presenter-current p').textContent,/2 \/ 8/);
  assert.match(document.querySelector('.presenter-clock .timer').textContent,/\/ 10:00/);
  assert.match(document.querySelector('.presenter-upnext p').textContent,/3 \/ 8/);
  assert.ok(document.querySelector('.presenter-transition').textContent.includes(document.querySelector('.presenter-upnext h2').textContent));
  assert.equal(document.querySelector('.presenter-console [role=group] [aria-pressed=true]').textContent,'Executive · 10 min');
},{presenter:true},dom=>{
  dom.window.sessionStorage.setItem(`deck-state-cut-test-${data.meta.snapshot_id}`,JSON.stringify({slideId:'main-02',sequence:'main',revision:3,timerStatus:'idle',elapsedBeforeStartMs:0,startedAtEpochMs:null,cut:'executive'}));
}));

/* ---------- pilot design and MRR relationship (contract fields that may be absent) ---------- */
const withPilot=structuredClone(data);
{
  const s=withPilot.datasets.summary[0];
  withPilot.datasets.pilot_design=[[0.02,2.1],[0.05,3.1],[0.10,4.0]].map(([b,lift])=>({design:`${b*100}% baseline`,baseline_rate:b,arm_size:1017,total_accounts:2034,detectable_lift:lift/100,detectable_lift_pp:lift,treatment_rate:b+lift/100,horizon_days:90,outcome:'New CRM opportunity within 90 days',alpha:0.05,power:0.8}));
  Object.assign(s,{pilot_arm_size:1017,pilot_detectable_lift_pp_at_5pct:3.1,pilot_treatment_accounts:1017,mrr_both_positive_wins:231,mrr_equals_amount_share:0.41});
  withPilot.datasets.mrr_amount_relationship=[{relationship:'MRR only, no amount',wins:638,share:0.596},{relationship:'Amount and MRR both recorded',wins:231,share:0.216},{relationship:'Amount only, no MRR',wins:140,share:0.131},{relationship:'Neither recorded',wins:61,share:0.057}];
}
// The same contract without the new fields, so the fallback stays tested once the pipeline ships them.
const withoutPilot=structuredClone(data);
delete withoutPilot.datasets.pilot_design; delete withoutPilot.datasets.mrr_amount_relationship;
for(const key of ['pilot_arm_size','pilot_detectable_lift_pp_at_5pct','pilot_treatment_accounts','mrr_both_positive_wins','mrr_equals_amount_share']) delete withoutPilot.datasets.summary[0][key];
test('main-14 turns the scenario grid into an actionable pilot when pilot_design exists',async()=>mounted('#present/main-14',async()=>{
  assert.equal(document.querySelector('h1').textContent,'A +2 pp test needs 4,426 domains, but all 2,034 split 50/50 can detect +3.1 pp in 90 days');
  assert.equal(document.querySelectorAll('.deck-scenarios tbody td').length,9,'the 3×3 grid stays');
  const pilot=document.querySelector('.deck-pilot');
  assert.match(pilot.textContent,/2,034/); assert.match(pilot.textContent,/1,017 per arm · 90 days/); assert.match(pilot.textContent,/New CRM opportunity within 90 days/);
  assert.deepEqual([...pilot.querySelectorAll('tbody tr')].map(r=>r.querySelector('strong').textContent),['+2.1 pp','+3.1 pp','+4.0 pp']);
  assert.match(pilot.querySelector('tr.is-accent').textContent,/^5%/);
},{data:withPilot}));
test('main-15 budget is the pilot account count times an unsupplied unit cost, with no invented money',async()=>mounted('#present/main-15',async()=>{
  const formula=document.querySelector('.deck-formula-terms');
  assert.match(formula.querySelector('li.known').textContent,/1,017/);
  assert.equal([...formula.querySelectorAll('li.unknown strong')].map(x=>x.textContent).join(),'Not supplied,Not supplied');
  assert.ok(!/\$/.test(document.querySelector('.deck-visual').textContent),'no dollar figure');
  assert.match(document.querySelector('h1').textContent,/1,017 treatment accounts × cost per account \+ fixed cost/);
},{data:withPilot}));
test('main-16 names the pilot in the coverage-test decision',async()=>mounted('#present/main-16',async()=>{
  const rows=[...document.querySelectorAll('.deck-ask tbody tr')];
  assert.match(rows[1].querySelector('th').textContent,/Run the 90-day pilot on all 2,034 domains, 50\/50$/);
  assert.match(document.querySelector('h1').textContent,/90-day pilot on all 2,034 domains/);
},{data:withPilot}));
test('appendix-06 shows the amount / MRR relationship beside the KPI tiles only when supplied',async()=>{
  await mounted('#present/appendix-06',async()=>{
    const split=document.querySelector('.deck-summary-split');
    assert.ok(split.querySelector('.deck-kpis'));
    assert.deepEqual([...split.querySelectorAll('.slide-bar strong')].map(x=>x.textContent),['60%','22%','13%','6%']);
  },{data:withPilot});
  await mounted('#present/appendix-06',async()=>{ assert.ok(!document.querySelector('.deck-mrr-relationship')); assert.ok(document.querySelector('.deck-kpis')); },{data:withoutPilot});
});
test('without pilot_design the main-14 to 16 headlines and visuals fall back to the scenario framing',async()=>{
  await mounted('#present/main-14',async(dom)=>{
    assert.ok(!document.querySelector('.deck-pilot'));
    assert.match(document.querySelector('h1').textContent,/test designs fit|sample-size scenarios fit/);
    await go(dom,'main-16');
    assert.match(document.querySelector('h1').textContent,/run the 90-day coverage test/);
  },{data:withoutPilot});
});
