import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_BEZIER, motionAllowed } from "../motion";

/**
 * Sliding active-section indicator for the sidebar.
 *
 * One shared layoutId means only one indicator exists; when the active link
 * changes, motion animates it (transform only) from the old link to the new
 * one, so the eye follows where you went. The pill carries the active
 * background and accent rail, so nothing else on the link changes abruptly.
 * Reduced motion and print preparation render the same pill with no
 * transition: final state immediately.
 */
export function AnimatedNavIndicator({ id = "dashboard-nav-active" }: { id?: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || !motionAllowed()) return <span className="nav-active" aria-hidden="true"><i /></span>;
  return <motion.span layoutId={id} className="nav-active" transition={{ duration: DURATION.base, ease: [...EASE_BEZIER] }} aria-hidden="true"><i /></motion.span>;
}
