import type { Transition } from "motion/react";

// One motion vocabulary for the whole app: short, decelerating, never bouncy.
export const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.22,
  slow: 0.4,
} as const;

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 40,
  mass: 0.8,
};

export const fadeUp: Transition = {
  duration: DURATION.slow,
  ease: EASE_OUT_EXPO,
};

/** Stagger children by a few frames: enough to feel alive, not enough to wait. */
export const staggerChildren = (index: number) => ({
  ...fadeUp,
  delay: Math.min(index, 8) * 0.035,
});
