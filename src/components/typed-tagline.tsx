"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const CHAR_MS = 38;

/** Types `text` out once after `delay` seconds, ending on a blinking block cursor. */
export function TypedTagline({ text, delay }: { text: string; delay: number }) {
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = (n: number) => {
      setCount(n);
      if (n < text.length) timer = setTimeout(() => tick(n + 1), CHAR_MS);
    };
    timer = setTimeout(() => tick(1), delay * 1000);
    return () => clearTimeout(timer);
  }, [text, delay, reduceMotion]);

  const shown = reduceMotion ? text : text.slice(0, count);

  return (
    <p className="min-h-[1.5em] text-sm text-fg-muted sm:text-base lg:text-sm">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {shown}
        <span className="animate-blink ml-0.5 inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] bg-orange-bright" />
      </span>
    </p>
  );
}
