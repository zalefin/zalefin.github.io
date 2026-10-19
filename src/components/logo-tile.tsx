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

const ASSEMBLY_START = 0.45;
const STEP_DURATION = 0.42;
const STEP_GAP = 0.06;
// Accelerate, then decelerate to a dead stop: no overshoot, like a servo.
const MACHINE_EASE = [0.65, 0, 0.35, 1] as const;

/** Time in seconds until the last piece has locked into place. */
export const LOGO_ASSEMBLED_AT =
  ASSEMBLY_START + LOGO_PIECES.length * (STEP_DURATION + STEP_GAP);

const LIFTED = "drop-shadow(0px 3px 2px rgba(0,0,0,0.35))";
const PLACED = "drop-shadow(0px 0px 0px rgba(0,0,0,0))";

// Keyframes for one piece: travel along the first axis, dwell briefly at the
// corner, then travel along the second and set the piece down.
function assembly({ from, path }: (typeof LOGO_PIECES)[number]) {
  const first = path === "yx" ? "y" : "x";
  const second = path === "yx" ? "x" : "y";
  return {
    [first]: [from[first], 0, 0, 0],
    [second]: [from[second], from[second], from[second], 0],
    filter: [LIFTED, LIFTED, LIFTED, PLACED],
  };
}

// Paint later steps on top, so a piece in transit passes over placed ones.
const PIECES_BY_STEP = [...LOGO_PIECES].sort((a, b) => a.step - b.step);

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
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
        style={{ rotateX, rotateY, backgroundColor: LOGO_TILE_COLOR }}
        className="relative size-32 rounded-[22%] shadow-[0_18px_40px_-12px_var(--shadow)] ring-1 ring-black/10 transform-3d sm:size-36"
      >
        {/* Pieces travel in from the tile's edges, so clip them to it. */}
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
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
            {PIECES_BY_STEP.map((piece) => {
              const delay =
                ASSEMBLY_START + piece.step * (STEP_DURATION + STEP_GAP);
              return (
                <motion.path
                  key={piece.id}
                  d={piece.d}
                  fill={piece.fill}
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, ...piece.from, filter: LIFTED }
                  }
                  animate={{ opacity: 1, ...assembly(piece) }}
                  transition={{
                    duration: STEP_DURATION,
                    delay,
                    times: [0, 0.45, 0.55, 1],
                    ease: [MACHINE_EASE, "linear", MACHINE_EASE],
                    opacity: { duration: 0.08, delay },
                  }}
                />
              );
            })}
          </svg>
        </div>
      </motion.div>
    </div>
  );
}
