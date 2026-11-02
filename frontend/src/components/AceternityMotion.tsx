import { useLayoutEffect, useRef } from "react";
import { DURATION, EASE, motionAllowed } from "../motion";

// Where the indicator last stood, recorded as it unmounts from the previous link.
let lastRect: DOMRect | null = null;

/**
 * Sliding active-section indicator for the sidebar.
 *
 * Only one indicator exists: it renders inside the active link. When the active
 * link changes, the new one plays a FLIP from the old link's box to its own
 * (transform only, Web Animations API), so the eye follows where you went. The
 * pill carries the active background and accent rail, so nothing else on the
 * link changes abruptly. Reduced motion and print preparation render the same
 * pill with no transition: final state immediately.
 */
export function AnimatedNavIndicator() {
  const pill = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = pill.current;
    if (!element) return;
    const from = lastRect;
    const to = element.getBoundingClientRect();
    if (from && to.width && to.height && motionAllowed() && (from.top !== to.top || from.left !== to.left)) {
      element.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: DURATION.base * 1000, easing: EASE.css },
      );
    }
    return () => { lastRect = element.getBoundingClientRect(); };
  }, []);
  return <span ref={pill} className="nav-active" aria-hidden="true"><i /></span>;
}
