"use client";

import { motion } from "motion/react";
import { fadeUp } from "@/lib/motion";

/** Every navigation fades the page in with a short rise: present, never showy. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp}>
      {children}
    </motion.div>
  );
}
