"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect } from "react";
import { LOGO_PIECES, LOGO_TILE_COLOR, LOGO_VIEWBOX } from "@/lib/logo";

const MAX_TILT = 14;

/** Time in seconds until the last piece has snapped into place. */
export const LOGO_ASSEMBLED_AT = 1.25;

export function LogoTile() {
  const reduceMotion = useReducedMotion();

  // Pointer position relative to the tile's surroundings, -1..1 on each axis.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 120, damping: 14, mass: 0.6 };
  const rotateY = useSpring(
    useTransform(px, [-1, 1], [-MAX_TILT, MAX_TILT]),
    spring,
  );
  const rotateX = useSpring(
    useTransform(py, [-1, 1], [MAX_TILT, -MAX_TILT]),
    spring,
  );
  const glowX = useTransform(rotateY, [-MAX_TILT, MAX_TILT], [15, 85]);
  const glowY = useTransform(rotateX, [MAX_TILT, -MAX_TILT], [15, 85]);
  const glow = useMotionTemplate`radial-gradient(circle at ${glowX}% ${glowY}%, rgb(254 128 25 / 0.35), transparent 60%)`;

  useEffect(() => {
    if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
    const onMove = (e: PointerEvent) => {
      // Track the pointer across the whole window, so the tile follows it
      // even when the pointer isn't over it.
      px.set((e.clientX / window.innerWidth) * 2 - 1);
      py.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onLeave = () => {
      px.set(0);
      py.set(0);
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [px, py, reduceMotion]);

  return (
    <div className="perspective-[700px]">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 0.15,
        }}
        style={{ rotateX, rotateY, backgroundColor: LOGO_TILE_COLOR }}
        className="relative size-32 rounded-[22%] shadow-[0_18px_40px_-12px_var(--shadow)] ring-1 ring-black/10 transform-3d sm:size-36"
      >
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: glow }}
        />
        <svg
          viewBox={LOGO_VIEWBOX}
          role="img"
          aria-label="Zach Lefin logo"
          className="absolute inset-[11%] overflow-visible"
        >
          {LOGO_PIECES.map((piece, i) => (
            <motion.path
              key={piece.id}
              d={piece.d}
              fill={piece.fill}
              initial={reduceMotion ? false : { opacity: 0, ...piece.from }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 170,
                damping: 15,
                delay: 0.35 + i * 0.12,
                opacity: { duration: 0.25, delay: 0.35 + i * 0.12 },
              }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))}
        </svg>
      </motion.div>
    </div>
  );
}
