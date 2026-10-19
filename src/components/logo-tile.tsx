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

const ASSEMBLY_START = 0.3;
const STEP_DURATION = 0.24;
const STEP_GAP = 0.03;
// Accelerate, then decelerate to a dead stop: no overshoot, like a servo.
const MACHINE_EASE = [0.65, 0, 0.35, 1] as const;

/** Time in seconds until the last piece has locked into place. */
export const LOGO_ASSEMBLED_AT =
  ASSEMBLY_START + LOGO_PIECES.length * (STEP_DURATION + STEP_GAP);

// The underglow is the same LED orange in both themes.
const LED = "254 128 25";
const LED_COUNT = 7;

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
  const glow = useMotionTemplate`radial-gradient(circle at ${glowX}% ${glowY}%, rgb(${LED} / 0.35), transparent 60%)`;
  // The light the LEDs throw on the panel slides against the tilt, as if
  // the tile hovers above it.
  const underX = useTransform(rotateY, [-MAX_TILT, MAX_TILT], [5, -5]);
  const underY = useTransform(rotateX, [MAX_TILT, -MAX_TILT], [-4, 4]);

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
    <div className="relative perspective-[700px]">
      {/* Orange LEDs under the tile: they flicker on once the logo has
          assembled, then breathe. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: reduceMotion ? 1 : [0, 1, 0.2, 1, 0.6, 1] }}
        transition={{
          duration: 0.45,
          delay: LOGO_ASSEMBLED_AT,
          times: [0, 0.15, 0.3, 0.5, 0.65, 1],
          ease: "linear",
        }}
      >
        <motion.div
          className="absolute inset-0"
          animate={reduceMotion ? undefined : { opacity: [1, 0.7, 1] }}
          transition={{
            duration: 3.2,
            delay: LOGO_ASSEMBLED_AT + 0.45,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* The light thrown on the panel around the tile. */}
          <motion.div
            className="absolute -inset-[7%] rounded-[30%] blur-xl"
            style={{
              x: underX,
              y: underY,
              backgroundColor: `rgb(${LED} / 0.4)`,
            }}
          />
          {/* The strip's own glow, spilling out evenly around the edges. */}
          <div
            className="absolute -inset-[1.5%] rounded-[23%] blur-md"
            style={{ backgroundColor: `rgb(${LED} / 0.75)` }}
          />
          {/* The LEDs themselves, half hidden under the bottom edge. */}
          <div className="absolute inset-x-[16%] -bottom-[1.5%] flex justify-between">
            {Array.from({ length: LED_COUNT }, (_, i) => (
              <span
                key={i}
                className="size-1.5 rounded-full blur-[1.5px]"
                style={{
                  backgroundColor: "rgb(255 220 180)",
                  boxShadow: `0 0 10px 4px rgb(${LED} / 0.8)`,
                }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
        style={{ rotateX, rotateY, backgroundColor: LOGO_TILE_COLOR }}
        className="relative size-32 rounded-[22%] ring-1 ring-black/10 transform-3d sm:size-36"
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
