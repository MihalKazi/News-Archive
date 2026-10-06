"use client";

// Hook-and-line search mascot. Ported from the StickMan "ceiling file" reference:
// rig poses, face expressions, red cape, ceiling rail, article card, captions, and haul timing.
// Driven by real search state: cast while loading, reel on results, miss on error.
// Scoped: no ids, no global selectors. Reduced motion shows the resting pose instead.

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "done" | "error";
type Pose = "stand" | "windup" | "overhead" | "release" | "follow" | "spent" | "haul" | "wave" | "flat";

// Rig: [spineTopX, spineTopY, hipX, hipY, elbow1X, elbow1Y, hand1X, hand1Y,
//       elbow2X, elbow2Y, hand2X, hand2Y, knee1X, knee1Y, foot1X, foot1Y,
//       knee2X, knee2Y, foot2X, foot2Y]
const POSE: Record<Pose, number[]> = {
  stand: [0, -50, 0, -26, -12, -37, -12, -25, 12, -37, 12, -25, -7, -12, -13, 0, 7, -12, 13, 0],
  windup: [18, -49, 6, -25, 35, -59, 42, -72, 2, -37, -10, -29, -7, -13, -22, 0, 19, -12, 26, 0],
  overhead: [2, -56, 1, -27, 14, -76, -8, -89, -7, -39, -15, -30, -13, -14, -25, 0, 16, -13, 27, 0],
  release: [-12, -53, -5, -27, -31, -65, -46, -74, -10, -36, -4, -26, -19, -13, -28, 0, 13, -15, 27, 0],
  follow: [-20, -43, -7, -25, -39, -42, -54, -32, -12, -30, 0, -25, -20, -12, -28, 0, 11, -14, 27, -3],
  spent: [-5, -38, 2, -22, -14, -24, -17, -13, 9, -24, 14, -13, -5, -10, -13, 0, 12, -10, 20, 0],
  haul: [14, -43, 20, -24, -3, -37, -28, -48, 1, -29, -27, -45, 1, -13, -18, 0, 25, -12, 35, 0],
  wave: [0, -50, 0, -26, -12, -37, -12, -25, 17, -43, 19, -61, -7, -12, -13, 0, 7, -12, 13, 0],
  flat: [28, -8, 5, -5, 17, -2, 35, 0, 23, -14, 35, -19, -8, -5, -20, 0, -7, -1, -23, 0],
};

const lerpPose = (a: number[], b: number[], t: number) => a.map((n, i) => n + (b[i] - n) * t);
const ease = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
const phase = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

function limb(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const bx1 = ax + (bx - ax) * 0.85;
  const by1 = ay + (by - ay) * 0.85;
  const cx1 = cx + (bx - cx) * 0.15;
  const cy1 = cy + (by - cy) * 0.15;
  return `M${ax} ${ay}L${bx1} ${by1}Q${bx} ${by} ${cx1} ${cy1}L${cx} ${cy}`;
}

// Face per pose, from the reference: effort squint, relaxed, spent, happy wave, flat (miss).
const FACE: Record<Pose, { mouth: string; eyes: string; brows: string }> = {
  stand: { mouth: "M-4-61q4 3 8 0", eyes: "M-5-69v1m9-1v1", brows: "" },
  windup: { mouth: "M-4-61q4 3 8 0", eyes: "M-5-69v1m9-1v1", brows: "" },
  overhead: { mouth: "M-5-60q5-5 10 0", eyes: "M-7-70l4 2-4 2m14-4-4 2 4 2", brows: "M-8-74l5 2m6 0 5-2" },
  release: { mouth: "M-5-60q5-5 10 0", eyes: "M-7-70l4 2-4 2m14-4-4 2 4 2", brows: "M-8-74l5 2m6 0 5-2" },
  follow: { mouth: "M-4-61q4 3 8 0", eyes: "M-5-69v1m9-1v1", brows: "" },
  spent: { mouth: "M-5-59q4-2 9 0", eyes: "M-5-69v1m9-1v1", brows: "M-8-73l5 2m6 0 5-2" },
  haul: { mouth: "M-5-60q5-5 10 0", eyes: "M-7-70l4 2-4 2m14-4-4 2 4 2", brows: "M-8-74l5 2m6 0 5-2" },
  wave: { mouth: "M-5-62q5 7 11-1", eyes: "M-5-69v1m9-1v1", brows: "" },
  flat: { mouth: "M-4-60h8", eyes: "M-7-71l5 5m0-5-5 5m9-5 5 5m0-5-5 5", brows: "" },
};

type Frame = {
  pose: Pose;
  v: number[];
  hook: { x: number; y: number; rot: number; sag: number };
  fileY: number | null;
  showFile: boolean;
  caption: string;
};

// Pose and hook for the current time. Loading casts on a loop. Results reel in.
// A miss drops the hook to the ground. Captions follow the reference's wording.
function sample(status: Status, t: number): Frame {
  const hook = { x: 386, y: 262, rot: 0, sag: 10 };
  let pose: Pose = "stand";
  let v = POSE.stand;
  let fileY: number | null = null;
  let showFile = false;
  let caption = "";

  if (status === "loading" || status === "idle") {
    const c = t % 2.6;
    if (c < 0.5) {
      v = lerpPose(POSE.stand, POSE.windup, ease(phase(c, 0, 0.5)));
      pose = c < 0.25 ? "stand" : "windup";
    } else if (c < 0.9) {
      v = lerpPose(POSE.windup, POSE.overhead, ease(phase(c, 0.5, 0.9)));
      pose = "overhead";
    } else if (c < 1.0) {
      v = lerpPose(POSE.overhead, POSE.release, ease(phase(c, 0.9, 1.0)));
      pose = "release";
    } else if (c < 1.25) {
      v = lerpPose(POSE.release, POSE.follow, ease(phase(c, 1.0, 1.25)));
      pose = "follow";
    } else {
      v = lerpPose(POSE.follow, POSE.spent, ease(phase(c, 1.25, 2.0)));
      pose = "spent";
    }
    if (status === "idle") {
      v = POSE.stand;
      pose = "stand";
    }
    const q = phase(c, 0.9, 1.9);
    if (status === "loading") {
      hook.x = 386 + 40 * q;
      hook.y = 262 - Math.sin(q * Math.PI) * 120 + 60 * q;
      hook.rot = q * 210;
      hook.sag = 30 * (1 - q);
      caption = t < 1.24 ? "He has a plan." : "Casting for articles…";
    }
  } else if (status === "done") {
    const h = Math.min(t, 5);
    if (h < 0.7) {
      v = lerpPose(POSE.stand, POSE.haul, ease(phase(h, 0, 0.7)));
      pose = "haul";
    } else if (h < 1.6) {
      v = POSE.haul;
      pose = "haul";
      hook.x = 337 + Math.sin(h * 40) * 0.6;
      hook.y = 262 - ease(phase(h, 0.7, 1.6)) * 90;
      hook.sag = 6;
    } else {
      v = lerpPose(POSE.haul, POSE.wave, ease(phase(h, 1.6, 2.1)));
      pose = h < 2.1 ? "haul" : "wave";
      hook.x = 337;
      hook.y = 172;
    }
    const drop = phase(h, 1.6, 2.2);
    showFile = true;
    fileY = 130 + 200 * drop * drop;
    caption = h < 0.7 ? "Got it." : h < 1.6 ? "Just. A little. Tug." : "Articles retrieved.";
  } else {
    // Miss: overhead throw, hook lands short on the ground, spent face.
    const m = Math.min(t, 2.2);
    if (m < 0.6) {
      v = lerpPose(POSE.stand, POSE.overhead, ease(phase(m, 0, 0.6)));
      pose = "overhead";
    } else {
      v = lerpPose(POSE.overhead, POSE.flat, ease(phase(m, 0.6, 1.4)));
      pose = m < 1.4 ? "flat" : "spent";
    }
    hook.x = 430 + 20 * ease(phase(m, 0.6, 1.2));
    hook.y = 300;
    hook.sag = 4;
    caption = m < 0.6 ? "That was a practice throw." : "Nothing this time. Casting again?";
  }

  return { pose, v, hook, fileY, showFile, caption };
}

// Red cape trailing behind the body, shaped from the spine's top point.
function capePath(v: number[], pose: Pose, t: number) {
  const trail = pose === "flat" ? 1 : 4;
  const flutter = Math.sin(t * 8 - 1) * 3;
  return `M${v[0]} ${v[1] + 1}C${v[0] - 13} ${v[1] + 4 - trail} ${v[0] - 28} ${v[1] + 6 + flutter} ${v[0] - 39} ${v[1] + 15 + flutter}L${v[0] - 29} ${v[1] + 19 + flutter}Q${v[0] - 27} ${v[1] + 28} ${v[0] - 22} ${v[1] + 26}Q${v[0] - 9} ${v[1] + 21} ${v[0]} ${v[1] + 1}Z`;
}

export function CatchSearch({
  status,
  size = 110,
  onSequenceEnd,
}: {
  status: Status;
  size?: number;
  onSequenceEnd?: () => void;
}) {
  const [frame, setFrame] = useState<Frame>(() => sample("idle", 0));
  const statusRef = useRef<Status>(status);
  const endRef = useRef(onSequenceEnd);
  const firedRef = useRef(false);
  const reduced = useRef(false);
  const [t, setT] = useState(0);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    endRef.current = onSequenceEnd;
  }, [onSequenceEnd]);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      const s = statusRef.current;
      setFrame(sample(s === "done" ? "done" : s === "error" ? "error" : "idle", 99));
      return;
    }
    let raf = 0;
    const start = performance.now();
    let lastStatus = statusRef.current;
    let t0 = 0;
    const tick = (now: number) => {
      const s = statusRef.current;
      if (s !== lastStatus) {
        lastStatus = s;
        t0 = now - start;
        firedRef.current = false;
      }
      const tt = (now - start - t0) / 1000;
      setFrame(sample(s, tt));
      setT(tt);
      const endAt = s === "done" ? 2.3 : s === "error" ? 1.5 : Infinity;
      if (!firedRef.current && tt >= endAt) {
        firedRef.current = true;
        endRef.current?.();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { pose, v, hook, fileY, showFile, caption } = frame;
  const face = FACE[pose];
  const label =
    status === "loading"
      ? "Casting for articles"
      : status === "done"
        ? "Articles hooked"
        : status === "error"
          ? "Nothing caught"
          : "Stick figure with a fishing line";

  return (
    <figure className="m-0 flex flex-col items-center gap-2">
      <svg
        viewBox="250 90 230 260"
        width={size}
        height={(size * 260) / 230}
        role="img"
        aria-label={label}
        className="shrink-0 text-(--text)"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ceiling rail with hatch marks */}
        <path d="M268 105h104M273 105l-6-8m22 8-6-8m22 8-6-8m22 8-6-8m22 8-6-8m22 8-6-8" strokeWidth="1.2" opacity="0.65" />

        {/* ground */}
        <path d="M296 328h170" strokeWidth="0.8" opacity="0.4" />

        {/* hook line and hook */}
        <path
          d={`M${v[6] + 411} ${v[7] + 328} Q${(v[6] + 411 + hook.x) / 2} ${(v[7] + 328 + hook.y) / 2 + hook.sag} ${hook.x} ${hook.y}`}
          strokeWidth="1.1"
        />
        <g transform={`translate(${hook.x} ${hook.y}) rotate(${hook.rot}) scale(0.65)`}>
          <circle r="2.2" strokeWidth="1.6" fill="var(--bg)" />
          <path d="M0 2.2V16Q0 26 13 26T26 12V8l-5 6" strokeWidth="1.8" />
        </g>

        {/* article card, hooked and pulled in */}
        {showFile && fileY !== null && (
          <g transform={`translate(${hook.x - 14} ${fileY}) rotate(${(hook.rot / 4) % 20})`}>
            <path d="M-18 1L6 0l13 12-1 35-37-1Z" fill="var(--bg)" strokeWidth="1.6" />
            <path d="M6 0l1 12h12M-10 26l19 1M-10 33l14 1" strokeWidth="1.3" />
          </g>
        )}

        {/* body */}
        <g transform="translate(411 328)">
          <path d={capePath(v, pose, t)} fill="#ff565d" stroke="none" />
          <circle cx={v[0]} cy={v[1] - 16} r="10" fill="var(--bg)" />
          <path d={`M${v[0]} ${v[1] - 6}L${v[2]} ${v[3]}`} />
          <path d={limb(v[0], v[1], v[4], v[5], v[6], v[7]) + limb(v[0], v[1], v[8], v[9], v[10], v[11])} />
          <path d={limb(v[2], v[3], v[12], v[13], v[14], v[15]) + limb(v[2], v[3], v[16], v[17], v[18], v[19])} />
          {/* face */}
          <g transform={`translate(${v[0]} ${v[1] + 50})`}>
            <path d={face.mouth} strokeWidth="1.6" />
            <path d={face.eyes} strokeWidth="1.7" />
            {face.brows && <path d={face.brows} strokeWidth="1.3" />}
          </g>
        </g>
      </svg>
      <figcaption className="min-h-[1.5em] font-(family-name:--hand) text-[20px] text-(--muted)">{caption}</figcaption>
    </figure>
  );
}
