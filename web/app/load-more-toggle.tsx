"use client";

// "Load more" as a stubborn toggle switch: the figure braces and strains while the next
// page loads, then the switch snaps, flings him back, and he waves once results land.
// Same rig/limb convention as catch-search.tsx (ported from the same StickMan demo family).

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "done";

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const phase = (t: number, a: number, b: number) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const lerpPose = (a: number[], b: number[], f: number) => a.map((n, i) => lerp(n, b[i], f));

// index: 0,1 head  2,3 hip  4-7 arm1  8-11 arm2  12-15 leg1  16-19 leg2
const POSE: Record<string, number[]> = {
  stand: [0, -50, 0, -26, -12, -37, -12, -25, 12, -37, 12, -25, -7, -12, -13, 0, 7, -12, 13, 0],
  toggleContact: [6, -46, -6, -25, 25, -43, 45, -39, 25, -28, 45, -27, -20, -13, -35, 0, 12, -15, 16, 0],
  toggleBrace: [20, -39, -8, -24, 32, -40, 45, -39, 28, -29, 45, -27, -21.5, -12, -35, 0, 16, -16, 16, 0],
  reach: [0, -50, 0, -26, -16, -62, -16, -79, 16, -62, 16, -79, -9, -13, -17, 0, 9, -13, 17, 0],
  flat: [28, -8, 5, -5, 17, -2, 35, 0, 23, -14, 35, -19, -8, -5, -20, 0, -7, -1, -23, 0],
  spent: [-5, -38, 2, -22, -14, -24, -17, -13, 9, -24, 14, -13, -5, -10, -13, 0, 12, -10, 20, 0],
  wave: [0, -50, 0, -26, -12, -37, -12, -25, 17, -43, 19, -61, -7, -12, -13, 0, 7, -12, 13, 0],
};

const FACE: Record<string, { mouth: string; eyes: string; brows: string }> = {
  stand: { mouth: "M-4-61q4 3 8 0", eyes: "M-5-69v1m9-1v1", brows: "" },
  toggleContact: { mouth: "M-5-60q5-5 10 0", eyes: "M-7-70l4 2-4 2m14-4-4 2 4 2", brows: "M-8-74l5 2m6 0 5-2" },
  toggleBrace: { mouth: "M-5-60q5-5 10 0", eyes: "M-7-70l4 2-4 2m14-4-4 2 4 2", brows: "M-8-74l5 2m6 0 5-2" },
  reach: { mouth: "M-4-61q4 3 8 0", eyes: "M-5-69v1m9-1v1", brows: "" },
  flat: { mouth: "M-4-60h8", eyes: "M-7-71l5 5m0-5-5 5m9-5 5 5m0-5-5 5", brows: "" },
  spent: { mouth: "M-5-59q4-2 9 0", eyes: "M-5-69v1m9-1v1", brows: "M-8-73l5 2m6 0 5-2" },
  wave: { mouth: "M-5-62q5 7 11-1", eyes: "M-5-69v1m9-1v1", brows: "" },
};

function limb(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const before = [lerp(bx, ax, 0.15), lerp(by, ay, 0.15)];
  const after = [lerp(bx, cx, 0.15), lerp(by, cy, 0.15)];
  return `M${ax} ${ay}L${before[0]} ${before[1]}Q${bx} ${by} ${after[0]} ${after[1]}L${cx} ${cy}`;
}

// Coordinates match the original design 1:1 (worker braced at x=239, switch at x=276..364,
// ground at y=307) so proportions between the figure and the switch stay correct.
type Frame = { pose: string; v: number[]; x: number; y: number; rot: number; knob: number; caption: string };

function sample(status: Status, t: number): Frame {
  let x = 239,
    y = 307,
    rot = 0,
    knob = 0,
    pose = "stand",
    v = POSE.stand,
    caption = "Load more";

  if (status === "loading") {
    const c = t % 1.1; // strain loop: brace and shake until results arrive
    if (c < 0.3) {
      v = lerpPose(POSE.stand, POSE.toggleContact, ease(phase(c, 0, 0.3)));
      pose = "toggleContact";
    } else {
      const shake = 0.91 + Math.sin(t * 30) * 0.07;
      v = lerpPose(POSE.toggleContact, POSE.toggleBrace, shake);
      pose = "toggleBrace";
    }
    caption = "Just… a little… push.";
  } else if (status === "done") {
    const h = Math.min(t, 2.1);
    if (h < 0.15) {
      const f = ease(phase(h, 0, 0.15));
      v = lerpPose(POSE.toggleBrace, POSE.reach, f);
      pose = "reach";
      x = 239 - 7 * f;
      y = 307 - 12 * f;
      rot = -18 * f;
      knob = f;
    } else if (h < 0.65) {
      const f = ease(phase(h, 0.15, 0.65));
      x = lerp(232, 180, f);
      y = 295 - Math.sin(f * Math.PI) * 55 + 12 * f;
      rot = lerp(-18, -300, f);
      pose = "reach";
      knob = 1;
    } else if (h < 1.1) {
      pose = "flat";
      x = 180;
      y = 307;
      knob = 1;
      caption = "That worked a little too well.";
    } else if (h < 1.6) {
      v = lerpPose(POSE.flat, POSE.spent, ease(phase(h, 1.1, 1.6)));
      pose = "spent";
      x = 180;
      y = 307;
      knob = 1;
    } else {
      v = lerpPose(POSE.spent, POSE.wave, ease(phase(h, 1.6, 2.0)));
      pose = h < 2.0 ? "spent" : "wave";
      x = 180;
      y = 307;
      knob = 1;
      caption = "Worth it.";
    }
  }

  return { pose, v, x, y, rot, knob, caption };
}

export function LoadMoreToggle({
  loading,
  hasMore,
  onClick,
  onSettled,
}: {
  loading: boolean;
  hasMore: boolean;
  onClick: () => void;
  /** Called once the "done" flight/land sequence finishes, so the caller can reveal appended results. */
  onSettled?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [t, setT] = useState(0);
  const startRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const wasLoading = useRef(false);

  useEffect(() => {
    if (loading) {
      setStatus("loading");
      wasLoading.current = true;
      startRef.current = null;
    } else if (wasLoading.current) {
      // loading just finished: play the release/land beat once, then settle
      setStatus("done");
      settledRef.current = false;
      startRef.current = null;
      wasLoading.current = false;
    }
  }, [loading]);

  useEffect(() => {
    if (status === "idle") return;
    let raf: number;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const tt = (now - startRef.current) / 1000;
      setT(tt);
      if (status === "done" && !settledRef.current && tt >= 2.0) {
        settledRef.current = true;
        onSettled?.();
      }
      if (status === "done" && tt < 2.6) raf = requestAnimationFrame(tick);
      else if (status === "loading") raf = requestAnimationFrame(tick);
      else if (status === "done") setStatus("idle"); // sequence finished: button becomes clickable again
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!hasMore && status === "idle") return null;

  const frame = sample(status, t);
  const face = FACE[frame.pose];
  const playing = status !== "idle";

  return (
    <div className="flex flex-col items-center gap-1 py-4">
      {!playing && (
        <button
          type="button"
          onClick={onClick}
          className="btn-sketch font-(family-name:--hand) text-[18px]"
        >
          Load more
        </button>
      )}
      {playing && (
        <figure className="m-0 flex flex-col items-center gap-1">
          <svg
            viewBox="130 190 300 150"
            width={240}
            height={(240 * 150) / 300}
            role="img"
            aria-label="Stick figure wrestling the load-more switch"
            className="shrink-0 text-(--text)"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* ground */}
            <path d="M150 307h260" strokeWidth="0.8" opacity="0.4" />
            {/* toggle switch */}
            <rect
              x="276"
              y="251"
              width="88"
              height="46"
              rx="23"
              fill={frame.knob > 0.5 ? "var(--accent)" : "var(--line)"}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx={299 + 42 * frame.knob} cy="274" r="16" fill="var(--bg)" strokeWidth="1.5" />
            {/* body */}
            <g transform={`translate(${frame.x} ${frame.y}) rotate(${frame.rot})`}>
              <circle cx={frame.v[0]} cy={frame.v[1] - 16} r="10" fill="var(--bg)" />
              <path d={`M${frame.v[0]} ${frame.v[1] - 6}L${frame.v[2]} ${frame.v[3]}`} />
              <path
                d={
                  limb(frame.v[0], frame.v[1], frame.v[4], frame.v[5], frame.v[6], frame.v[7]) +
                  limb(frame.v[0], frame.v[1], frame.v[8], frame.v[9], frame.v[10], frame.v[11])
                }
              />
              <path
                d={
                  limb(frame.v[2], frame.v[3], frame.v[12], frame.v[13], frame.v[14], frame.v[15]) +
                  limb(frame.v[2], frame.v[3], frame.v[16], frame.v[17], frame.v[18], frame.v[19])
                }
              />
              <g transform={`translate(${frame.v[0]} ${frame.v[1] + 50})`}>
                <path d={face.mouth} strokeWidth="1.6" />
                <path d={face.eyes} strokeWidth="1.7" />
                {face.brows && <path d={face.brows} strokeWidth="1.3" />}
              </g>
            </g>
          </svg>
          <figcaption className="min-h-[1.3em] font-(family-name:--hand) text-[15px] text-(--muted)">
            {frame.caption}
          </figcaption>
        </figure>
      )}
    </div>
  );
}
