import { motion, useReducedMotion } from "motion/react";

/**
 * Source-owned Aceternity-style navigation indicator.
 *
 * The layout transition gives the amber rail a useful sense of continuity
 * when a section changes, while the reduced-motion branch keeps the same
 * visual affordance without any transform or spring animation.
 */
export function AnimatedNavIndicator() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <span className="nav-active" aria-hidden="true" />;
  return <motion.span layoutId="dashboard-nav-active" className="nav-active" transition={{ type: "spring", stiffness: 500, damping: 36 }} aria-hidden="true" />;
}
