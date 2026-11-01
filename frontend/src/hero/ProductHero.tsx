import { Archive, GitBranch, Sparkles, TrendingUp } from 'lucide-react'
// Imported per module rather than from kit/index, so the brand-mark registry
// (and its SVGs) stays out of the bundle
import { Stage } from '../stage/kit/stage'
import { Bar, Window } from '../stage/kit/window'
import { Count, States } from '../stage/kit/motion'
import { Field } from '../stage/kit/controls'
import type { Act } from '../stage/kit/act'
import type { Layout } from '../stage/kit/looks'
import type { Rect } from '../stage/kit/measure'
import { EXAMPLE_COST, HERO_NUMBERS, type HeroNumbers } from './numbers'
import './hero.css'

// Revenue Command Center, as a hero beside copy (720 x 340, corner bleed on a
// dark page, no plate). One story: the finding, then the pilot that tests it.
//
// 1. Essential View. The headline tile counts up to the marketing-sourced win
//    rate as the view enters (the dashboard's own count-up), Referral beside it.
// 2. The pointer goes to Budget Measurement in the sidebar and clicks; the
//    active marker slides to it and the body crossfades (the product's page swap).
// 3. The pilot you can run now reads: accounts per arm and the detectable lift.
// 4. The pointer clicks Cost per treatment account and types an illustrative
//    cost; a beat later the budget rolls to treatment accounts x cost, labelled
//    "Example" so it never reads as a recorded figure.
// 5. The payoff holds; the pointer clicks Essential View, the view comes back
//    (the cause of the reset) and the loop's count-up starts again.
//
// Real strings: the two nav items, the two tiles, the pilot kicker and its two
// facts, the cost field and the result. Everything else is placeholder bars.
// Every figure comes from the dashboard contract (numbers.ts) except the typed
// example cost.

type View = 'essential' | 'budget'
type S = { view: View; counted: boolean; cost: string; focused: boolean; result: boolean }

const initial: S = { view: 'essential', counted: false, cost: '', focused: false, result: false }

const pct = (n: number) => `${n.toFixed(1)}%`
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const count = (n: number) => Math.round(n).toLocaleString('en-US')

const REST = { wide: { x: 452, y: 292 }, compact: { x: 236, y: 292 } }
// The loop opens where it ends: the pointer on Essential View, just clicked
const START = { at: 'nav-essential', x: 0.82, y: 0.55 }

export interface ProductHeroProps {
  /** Override the recorded figures (defaults: the dashboard contract's summary). */
  numbers?: Partial<HeroNumbers>
  /** The illustrative cost per treatment account typed in the demo, in dollars. */
  exampleCost?: number
  /** Extra class on the outer wrapper (the stage scales to fit its container). */
  className?: string
}

export function ProductHero({ numbers, exampleCost = EXAMPLE_COST, className }: ProductHeroProps) {
  const n = { ...HERO_NUMBERS, ...numbers }
  const typed = String(exampleCost)
  const poster: S = { view: 'budget', counted: true, cost: typed, focused: false, result: true }

  async function script(a: Act<S>) {
    // 1. The view has just entered (the pointer has just clicked it): its
    //    headline tile counts up while the pointer steps off the nav
    await a.wait(120)
    a.mark('count')
    await a.set({ counted: true })
    void a.move('rest', { duration: 700 })
    await a.wait(2100)

    // 2. To the next question: what would a test cost? Open Budget Measurement
    await a.move({ at: 'nav-budget', x: 0.82, y: 0.55 })
    await a.wait(180)
    await a.click()
    a.mark('budget')
    await a.set({ view: 'budget' })

    // 3. Reading time for the pilot block
    await a.wait(1900)

    // 4. Put in a cost: click the field, step off it, type
    await a.move({ at: 'cost', x: 0.72, y: 0.55 })
    await a.wait(150)
    await a.click()
    await a.set({ focused: true })
    // (wide: below the field, over the quiet panel; phone: up beside the\n    // label, since the result sits under the field there)
    await a.move(a.layout === 'compact' ? { at: 'cost', x: 0.92, y: -1.15 } : { at: 'cost', x: 0.86, y: 1.9 }, { duration: 420 })
    a.mark('type')
    await a.type('cost', typed, { interval: 150 })
    await a.wait(320)
    a.mark('result')
    await a.set({ result: true })

    // 5. The payoff holds, then back to the Essential View
    await a.wait(2500)
    await a.move({ at: 'nav-essential', x: 0.82, y: 0.55 })
    await a.wait(180)
    await a.click()
    // The tiles are hidden behind the budget view here: zero them unseen so
    // the view counts up again as it arrives
    await a.snap({ counted: false })
    await a.wait(40)
    a.mark('back')
    await a.set({ view: 'essential' })
    await a.wait(240)
    // The budget view is gone now: clear its field and result while hidden.
    // The loop starts again from here, the pointer still on Essential View.
    await a.snap({ cost: '', focused: false, result: false })
  }

  return (
    <Stage<S>
      width={720}
      height={340}
      compact={{ below: 600, width: 358, height: 320 }}
      theme="dark"
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: START }}
      className={`rcc-hero${className ? ` ${className}` : ''}`}
    >
      {(s, rect, layout) => (
        <>
          <Window
            className="rcc-win"
            sidebarWidth={188}
            sidebar={layout === 'wide' ? <Sidebar view={s.view} rect={rect} /> : undefined}
            lead={
              layout === 'wide' ? (
                <span className="rcc-heading">
                  <span data-on={s.view === 'essential' || undefined}>Essential View</span>
                  <span data-on={s.view === 'budget' || undefined}>Budget Measurement</span>
                </span>
              ) : (
                <Tabs view={s.view} rect={rect} />
              )
            }
          >
            <div className="rcc-body">
              <div className="rcc-views">
                <section className="rcc-view" data-on={s.view === 'essential' || undefined} aria-hidden={s.view !== 'essential'}>
                  <Essential n={n} counted={s.counted} layout={layout} />
                </section>
                <section className="rcc-view" data-on={s.view === 'budget' || undefined} aria-hidden={s.view !== 'budget'}>
                  <Budget n={n} s={s} cost={exampleCost} />
                </section>
              </div>
            </div>
          </Window>
          <span data-target="rest" className="rcc-rest" style={{ left: REST[layout].x, top: REST[layout].y }} />
        </>
      )}
    </Stage>
  )
}

export default ProductHero

/** The product's spine: two groups, real words only on the two views the story uses. */
function Sidebar({ view, rect }: { view: View; rect: (name: string) => Rect }) {
  const offset = view === 'budget' ? rect('nav-budget').y - rect('nav-essential').y : 0
  return (
    <nav className="rcc-side">
      <span className="rcc-group">
        <Sparkles size={13} strokeWidth={2} />
        <Bar w={58} h={5} tone={2} />
      </span>
      <div className="rcc-items" style={{ ['--rcc-active' as string]: `${offset}px` }}>
        <span className="rcc-active" aria-hidden>
          <i />
        </span>
        <span className="rcc-item" data-target="nav-essential" data-cursor="hand" data-on={view === 'essential' || undefined}>
          Essential View
        </span>
        <span className="rcc-item">
          <Bar w={84} h={6} tone={2} />
        </span>
        <span className="rcc-group rcc-group--in">
          <TrendingUp size={13} strokeWidth={2} />
          <Bar w={52} h={5} tone={2} />
        </span>
        {[96, 70, 82].map((w) => (
          <span key={w} className="rcc-item">
            <Bar w={w} h={6} tone={2} />
          </span>
        ))}
        <span className="rcc-item" data-target="nav-budget" data-cursor="hand" data-on={view === 'budget' || undefined}>
          Budget Measurement
        </span>
        <span className="rcc-item">
          <Bar w={76} h={6} tone={2} />
        </span>
        <span className="rcc-group rcc-group--in">
          <GitBranch size={13} strokeWidth={2} />
          <Bar w={46} h={5} tone={2} />
        </span>
        <span className="rcc-group rcc-group--in">
          <Archive size={13} strokeWidth={2} />
          <Bar w={64} h={5} tone={2} />
        </span>
      </div>
    </nav>
  )
}

/** The phone design has no room for the spine: the two views sit as tabs over the body. */
function Tabs({ view, rect }: { view: View; rect: (name: string) => Rect }) {
  const a = rect('nav-essential')
  const on = view === 'budget' ? rect('nav-budget') : a
  return (
    <div className="rcc-tabs">
      <span className="rcc-tab-mark" aria-hidden style={{ width: on.width || undefined, transform: `translateX(${on.x - a.x}px)` }} />
      <span className="rcc-tab" data-target="nav-essential" data-cursor="hand" data-on={view === 'essential' || undefined}>
        Essential View
      </span>
      <span className="rcc-tab" data-target="nav-budget" data-cursor="hand" data-on={view === 'budget' || undefined}>
        Budget Measurement
      </span>
    </div>
  )
}

function Essential({ n, counted, layout }: { n: HeroNumbers; counted: boolean; layout: Layout }) {
  return (
    <>
      <div className="rcc-tiles">
        <div className="rcc-tile rcc-tile--lead">
          <span className="rcc-label">Marketing-sourced win rate</span>
          <Count className="rcc-value rcc-value--risk" data-on={counted || undefined} value={counted ? n.marketingWinRate * 100 : 0} format={pct} duration={900} stagger={70} />
          <Bar w={118} h={5} tone={2} />
        </div>
        <div className="rcc-tile">
          <span className="rcc-label">{n.bestSource}</span>
          <Count className="rcc-value" data-on={counted || undefined} value={counted ? n.bestWinRate * 100 : 0} format={pct} duration={900} stagger={70} />
          <Bar w={72} h={5} tone={2} />
        </div>
        {layout === 'wide' && (
          <div className="rcc-tile rcc-tile--filler">
            <span className="rcc-line rcc-line--label"><Bar w={64} h={6} tone={2} /></span>
            <span className="rcc-line rcc-line--value"><Bar w={58} h={20} r={4} tone={3} /></span>
            <Bar w={90} h={5} tone={2} />
          </div>
        )}
      </div>
      <Panel heights={[34, 48, 28, 56, 42, 64, 32, 52, 44, 58]} />
    </>
  )
}

function Budget({ n, s, cost }: { n: HeroNumbers; s: S; cost: number }) {
  return (
    <>
      <div className="rcc-pilot">
        <span className="rcc-kicker">Pilot you can run now</span>
        <dl className="rcc-facts">
          <div>
            <dt>{count(n.pilotArmSize)}</dt>
            <dd>accounts per arm</dd>
          </div>
          <div>
            <dt>+{n.pilotLiftPp.toFixed(1)} pp</dt>
            <dd>detectable lift</dd>
          </div>
        </dl>
      </div>
      <div className="rcc-calc">
        <Field
          className="rcc-field"
          label="Cost per treatment account ($)"
          value={s.cost}
          focused={s.focused}
          box={{ 'data-target': 'cost' }}
        />
        <div className="rcc-result">
          <span className="rcc-result-label">Pilot budget</span>
          <States
            className="rcc-result-value"
            align="start"
            value={s.result ? 'ok' : 'empty'}
            states={{
              empty: <span className="rcc-result-empty">Enter a unit cost</span>,
              ok: (
                <span className="rcc-result-ok">
                  <span className="rcc-example">Example</span><Count value={s.result ? n.treatmentAccounts * cost : 0} format={money} duration={800} stagger={55} />
                </span>
              ),
            }}
          />
        </div>
      </div>
      <Rows />
    </>
  )
}

/** A chart panel as filler: a title line and quiet columns, running off the bottom. */
function Panel({ heights }: { heights: number[] }) {
  return (
    <div className="rcc-panel" data-crop>
      <div className="rcc-panel-head">
        <Bar w={132} h={6} tone={3} />
        <Bar w={60} h={5} tone={2} />
      </div>
      <div className="rcc-cols">
        {heights.map((h, i) => (
          <Bar key={i} w={18} h={h} r={3} tone={1} shrink={false} />
        ))}
      </div>
    </div>
  )
}


/** Under the calculator: the pilot's lift table as filler rows, running off the bottom. */
function Rows() {
  return (
    <div className="rcc-panel rcc-panel--rows" data-crop>
      <div className="rcc-panel-head">
        <Bar w={168} h={6} tone={3} />
      </div>
      {[
        [52, 44, 60],
        [48, 40, 56],
        [56, 46, 62],
      ].map(([a, b, c], i) => (
        <div key={i} className="rcc-row">
          <Bar w={a} h={6} tone={2} />
          <Bar w={b} h={6} tone={2} />
          <Bar w={c} h={6} tone={2} />
        </div>
      ))}
    </div>
  )
}