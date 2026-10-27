"use client";

import {
  type Transition,
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

// The LEDs flicker on together once the logo has assembled.
const POWER_ON: Transition = {
  duration: 0.45,
  delay: LOGO_ASSEMBLED_AT,
  times: [0, 0.15, 0.3, 0.5, 0.65, 1],
  ease: "linear",
};

// A neon strip wrapped around the tile's edge: a white-hot core, an orange
// halo around it, and a little light spilling onto the tile. Every level has
// the same shadows, so they animate between each other.
function neon(level: number) {
  return [
    `0 0 0 2px rgb(255 248 238 / ${level})`,
    `0 0 3px 2px rgb(255 214 168 / ${level})`,
    `0 0 10px 3px rgb(${LED} / ${0.9 * level})`,
    `0 0 26px 6px rgb(${LED} / ${0.5 * level})`,
    `inset 0 0 8px 0px rgb(${LED} / ${0.5 * level})`,
  ].join(", ");
}
const STRIP_OFF = neon(0);
const STRIP_DIM = neon(0.35);
const STRIP_ON = neon(1);

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
  // Shade the side of the tile tilted away, deeper the further it tilts.
  const shadeX = useTransform(rotateY, [-MAX_TILT, MAX_TILT], [0, 100]);
  const shadeY = useTransform(rotateX, [MAX_TILT, -MAX_TILT], [0, 100]);
  const shadeAlpha = useTransform(
    () =>
      Math.min(1, Math.hypot(rotateX.get(), rotateY.get()) / MAX_TILT) * 0.22,
  );
  const shade = useMotionTemplate`radial-gradient(circle at ${shadeX}% ${shadeY}%, rgb(40 40 40 / ${shadeAlpha}), transparent 70%)`;
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
    <div className="perspective-[700px]">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
        style={{ rotateX, rotateY }}
        className="relative size-32 sm:size-36"
      >
        {/* Orange LEDs mounted under the tile, so the glow tilts with it and
            stays behind it. They flicker on once the logo has assembled, then
            breathe. The glow comes before the tile rather than sitting behind
            it in 3D: Safari paints 3D layers in the wrong order and stops
            redrawing the logo while it assembles. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: reduceMotion ? 1 : [0, 1, 0.2, 1, 0.6, 1] }}
          transition={POWER_ON}
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
          </motion.div>
        </motion.div>
        {/* Pieces travel in from the tile's edges, so clip them to it. */}
        <motion.div
          initial={reduceMotion ? false : { boxShadow: STRIP_OFF }}
          animate={{
            boxShadow: reduceMotion
              ? STRIP_ON
              : [STRIP_OFF, STRIP_ON, STRIP_DIM, STRIP_ON, STRIP_DIM, STRIP_ON],
          }}
          transition={POWER_ON}
          style={{ backgroundColor: LOGO_TILE_COLOR }}
          className="absolute inset-0 overflow-hidden rounded-[22%]"
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ background: shade }}
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
        </motion.div>
      </motion.div>
    </div>
  );
}
