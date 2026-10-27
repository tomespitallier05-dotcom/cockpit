"use client";

import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "motion/react";
import { useEffect } from "react";

const formatter = new Intl.NumberFormat("fr-FR");

/**
 * Counts toward `value` with a decelerating curve, on mount and whenever the
 * value changes. It never loops: motion only signals that something changed.
 */
export function NumberTicker({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const display = useTransform(motionValue, (latest) => formatter.format(Math.round(latest)));

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [motionValue, reduceMotion, value]);

  return <motion.span className={className}>{display}</motion.span>;
}
