"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const lines = (path: string) => [
  { text: `$ ./zachlef.in ${path}`, className: "text-fg" },
  {
    text: "Segmentation fault (core dumped)",
    className: "text-red font-semibold",
  },
  {
    text: "BUG: kernel NULL pointer dereference, address: 0x0000000000000000",
    className: "text-fg-muted",
  },
  {
    text: "#PF: supervisor read access in kernel mode",
    className: "text-fg-faint",
  },
  {
    text: `RIP: 0010:resolve_route+0x404/0x404 [zachlef.in]`,
    className: "text-fg-faint",
  },
];

export function CoreDump() {
  const reduceMotion = useReducedMotion();
  // The export is static, so the missing path is only known in the browser.
  const path = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => "/",
  );

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-2xl rounded-2xl border border-panel-border bg-panel shadow-[0_30px_80px_-30px_var(--shadow)] backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 border-b border-panel-border px-4 py-3">
        <span className="size-3 rounded-full bg-red" />
        <span className="size-3 rounded-full bg-yellow" />
        <span className="size-3 rounded-full bg-green" />
        <span className="ml-2 text-xs text-fg-faint">zach@zachlef.in: ~</span>
      </div>
      <div className="space-y-1.5 px-5 py-6 text-left text-xs wrap-anywhere sm:text-sm">
        <h1 className="sr-only">404: page not found</h1>
        {lines(path).map((line, i) => (
          <motion.p
            key={i}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.25, duration: 0.05 }}
            className={line.className}
          >
            {line.text}
          </motion.p>
        ))}
        <motion.p
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 + 5 * 0.25 + 0.3 }}
          className="pt-4"
        >
          <span className="text-fg">$ </span>
          <Link
            href="/"
            className="text-orange underline-offset-4 hover:underline"
          >
            cd ~
          </Link>
          <span className="animate-blink ml-1 inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] bg-orange-bright" />
        </motion.p>
      </div>
    </motion.main>
  );
}
