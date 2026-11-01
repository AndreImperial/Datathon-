/**
 * The recorded figures the hero shows, copied from
 * frontend/public/dashboard-data-v3.json -> datasets.summary[0] (the same
 * contract the dashboard reads). They are inlined rather than imported because
 * the contract is ~400 kB and the hero must not pull it into the entry chunk;
 * frontend/tests/productHero.test.mjs fails if they drift from the JSON.
 *
 * Only `exampleCost` is not recorded: the dashboard assumes no cost, so the
 * hero types an illustrative one (the product's own hint suggests "40") and
 * labels the result "Example".
 */
export interface HeroNumbers {
  /** summary.marketing_recent_win_rate */
  marketingWinRate: number
  /** summary.recent_best_rate_source */
  bestSource: string
  /** summary.recent_best_win_rate */
  bestWinRate: number
  /** summary.pilot_arm_size */
  pilotArmSize: number
  /** summary.pilot_detectable_lift_pp_at_5pct */
  pilotLiftPp: number
  /** summary.pilot_treatment_accounts */
  treatmentAccounts: number
}

export const HERO_NUMBERS: HeroNumbers = {
  marketingWinRate: 0.10231023102310231,
  bestSource: 'Referral',
  bestWinRate: 0.26811594202898553,
  pilotArmSize: 1017,
  pilotLiftPp: 3.1,
  treatmentAccounts: 1017,
}

/** Illustrative cost per treatment account typed in the demo (dollars). Not a recorded figure. */
export const EXAMPLE_COST = 40
