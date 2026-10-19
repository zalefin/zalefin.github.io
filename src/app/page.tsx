"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { DagBackground } from "@/components/dag-background";
import { DagEditor } from "@/components/dag-editor";
import { Footer } from "@/components/footer";
import { GlassPanel } from "@/components/glass-panel";
import { LOGO_ASSEMBLED_AT, LogoTile } from "@/components/logo-tile";
import { SocialLinks } from "@/components/social-links";
import { TypedTagline } from "@/components/typed-tagline";
import { DEFAULT_GRAPH } from "@/dag/generated";
import { SITE } from "@/lib/site";

export default function Home() {
  const reduceMotion = useReducedMotion();
  // Starts as the DAG compiled at build time; the editor replaces it.
  const [graph, setGraph] = useState(DEFAULT_GRAPH);

  return (
    <div className="flex min-h-dvh flex-col">
      <DagBackground graph={graph} />
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        {/* Side by side on wide screens, at the height of the taller window. */}
        <div className="flex w-full max-w-[76rem] flex-col items-center gap-6 xl:flex-row xl:items-stretch xl:justify-center">
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
          <DagEditor onCompiled={setGraph} preloadAfter={LOGO_ASSEMBLED_AT} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
