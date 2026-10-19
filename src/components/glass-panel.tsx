"use client";

import { motion, useReducedMotion } from "motion/react";

export function GlassPanel({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex w-full max-w-xl flex-col items-center gap-5 rounded-3xl border border-panel-border bg-panel px-6 py-10 text-center shadow-[0_30px_80px_-30px_var(--shadow)] backdrop-blur-xl sm:px-10 sm:py-12"
    >
      {children}
    </motion.main>
  );
}
