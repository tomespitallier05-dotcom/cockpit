"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { staggerChildren } from "@/lib/motion";

/** Fades a block in on mount, staggered by `index` within its group. */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={staggerChildren(index)}
      className={className}
    >
      {children}
    </motion.div>
  );
}
