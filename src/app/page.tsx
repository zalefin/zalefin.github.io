"use client";

import { motion, useReducedMotion } from "motion/react";
import { DagBackground } from "@/components/dag-background";
import { Footer } from "@/components/footer";
import { GlassPanel } from "@/components/glass-panel";
import { LOGO_ASSEMBLED_AT, LogoTile } from "@/components/logo-tile";
import { SocialLinks } from "@/components/social-links";
import { TypedTagline } from "@/components/typed-tagline";
import { SITE } from "@/lib/site";

export default function Home() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-20">
      <DagBackground />
      <GlassPanel>
        <LogoTile />
        <div className="flex flex-col items-center gap-2">
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: LOGO_ASSEMBLED_AT - 0.35, duration: 0.5 }}
            className="text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            {SITE.name}
          </motion.h1>
          <TypedTagline text={SITE.tagline} delay={LOGO_ASSEMBLED_AT} />
        </div>
        <SocialLinks delay={LOGO_ASSEMBLED_AT + 0.2} />
      </GlassPanel>
      <Footer />
    </div>
  );
}
