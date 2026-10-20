"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/site";

const linkClass =
  "text-fg-muted grid size-11 place-items-center rounded-xl transition-[color,transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-bg1/60";

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export function SocialLinks({ delay }: { delay: number }) {
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  async function copyEmail(e: React.MouseEvent<HTMLAnchorElement>) {
    // Without clipboard access, let the mailto: link do its thing.
    if (!navigator.clipboard) return;
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(SITE.email);
    } catch {
      window.location.href = `mailto:${SITE.email}`;
      return;
    }
    setCopied(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setCopied(false), 2200);
  }

  return (
    <>
      <motion.ul
        className="flex items-center gap-3"
        initial={reduceMotion ? false : "hidden"}
        animate="show"
        transition={{ delayChildren: delay, staggerChildren: 0.08 }}
      >
        <motion.li variants={item}>
          <a
            href={SITE.github}
            aria-label="GitHub"
            className={`${linkClass} hover:text-aqua`}
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-6"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
          </a>
        </motion.li>
        <motion.li variants={item}>
          <a
            href={SITE.linkedin}
            aria-label="LinkedIn"
            className={`${linkClass} hover:text-yellow`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-6"
              fill="currentColor"
            >
              <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
            </svg>
          </a>
        </motion.li>
        <motion.li variants={item}>
          <a
            href={`mailto:${SITE.email}`}
            onClick={copyEmail}
            aria-label={`Copy email address (${SITE.email})`}
            title="copy email"
            className={`${linkClass} hover:text-green`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 6L2 7" />
            </svg>
          </a>
        </motion.li>
      </motion.ul>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-14 z-30 flex justify-center"
      >
        <AnimatePresence>
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="rounded-lg border border-panel-border bg-panel px-4 py-2 text-sm text-fg shadow-lg backdrop-blur-md"
            >
              <span className="text-green">✓</span> copied {SITE.email}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
