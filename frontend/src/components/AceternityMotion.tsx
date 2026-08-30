import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { MouseEvent, ReactNode } from "react";

export function PointerSpotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  const x = useSpring(useMotionValue(-300), { stiffness: 160, damping: 30 });
  const y = useSpring(useMotionValue(-300), { stiffness: 160, damping: 30 });

  const move = (event: MouseEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
  };

  return (
    <section className={`pointer-spotlight ${className}`} onMouseMove={move} onMouseLeave={() => { if (!reduceMotion) { x.set(-300); y.set(-300); } }}>
      {!reduceMotion && <motion.span className="pointer-spotlight__light" style={{ x, y }} aria-hidden="true" />}
      {children}
    </section>
  );
}

export function AnimatedSectionNav({
  items,
  active,
}: {
  items: Array<{ id: string; label: string }>;
  active: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <nav className="section-nav" aria-label="Dashboard sections">
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} className={active === item.id ? "is-active" : ""}>
          {active === item.id && (reduceMotion ? <span className="section-nav__active" /> : <motion.span layoutId="active-section" className="section-nav__active" transition={{ type: "spring", stiffness: 380, damping: 34 }} />)}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
