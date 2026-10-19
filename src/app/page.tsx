"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { DagCanvas } from "@/components/dag-canvas";
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
    // Phones stack card, graph, editor. From lg up, the card and editor share
    // a left column and the graph gets the rest of the screen.
    <main className="flex min-h-dvh flex-col items-center gap-4 px-4 pt-20 pb-4 lg:grid lg:h-dvh lg:grid-cols-[34rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:items-stretch lg:gap-x-0 lg:gap-y-4 lg:p-6 lg:pr-0">
      <GlassPanel>
        <LogoTile />
        <div className="flex flex-col items-center gap-2">
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: LOGO_ASSEMBLED_AT - 0.35, duration: 0.5 }}
            className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-4xl"
          >
            {SITE.name}
          </motion.h1>
          <TypedTagline text={SITE.tagline} delay={LOGO_ASSEMBLED_AT} />
        </div>
        <SocialLinks delay={LOGO_ASSEMBLED_AT + 0.2} />
      </GlassPanel>

      <section
        aria-label={`Graph of the ${graph.dagId} DAG`}
        className="relative h-[60svh] max-h-[34rem] min-h-80 w-full lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:max-h-none"
      >
        <DagCanvas graph={graph} />
        <p className="absolute top-0 left-4 text-xs text-fg-faint lg:top-1 lg:left-8">
          dag: <span className="text-fg-muted">{graph.dagId}</span> ·{" "}
          {graph.tasks.length} tasks
        </p>
      </section>

      <div className="flex w-full justify-center lg:col-start-1 lg:row-start-2 lg:min-h-0">
        <DagEditor onCompiled={setGraph} preloadAfter={LOGO_ASSEMBLED_AT} />
      </div>

      <Footer className="lg:fixed lg:right-0 lg:bottom-0 lg:left-[34rem]" />
    </main>
  );
}
