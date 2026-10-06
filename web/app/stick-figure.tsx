// Stick-figure mascot, drawn as plain strokes (no images). Inherits theme colour via currentColor.
// Search as fishing: "cast" while loading, "reel" when articles are hooked, "shrug" on a miss.
// All motion is CSS scoped to this svg via classes; reduced-motion disables it in globals.css.

type Pose = "idle" | "shrug" | "hold" | "cast" | "reel";

export function StickFigure({ pose = "idle", size = 72 }: { pose?: Pose; size?: number }) {
  const label =
    pose === "cast"
      ? "Stick figure casting a search line"
      : pose === "reel"
        ? "Stick figure reeling in articles"
        : pose === "shrug"
          ? "Stick figure shrugging, nothing caught"
          : "Stick figure";

  return (
    <svg
      viewBox="0 0 84 84"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={`shrink-0 text-(--text) ${pose === "cast" ? "stick-cast" : pose === "reel" ? "stick-reel" : "stick-bob"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* body */}
      <circle cx="30" cy="16" r="10" />
      <circle cx="26.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="33.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <path d="M26.5 19.5 Q30 21.5 33.5 19.5" strokeWidth="1.6" />
      <path d="M30 26 L30 40" />
      <path d="M30 40 L24 66 M30 40 L36 66" />

      {pose === "shrug" && (
        <>
          <path d="M30 40 L14 34" />
          <path d="M30 40 L46 34" />
          {/* empty hook dangling from a limp line */}
          <path d="M46 34 L52 52" strokeWidth="1.2" strokeDasharray="2 3" />
          <path d="M52 52 q2 4 0 6 q-2 -2 -1 -5" strokeWidth="1.6" />
        </>
      )}

      {pose === "hold" && <path d="M30 40 L20 56 M30 40 L40 56" />}

      {pose === "cast" && (
        <>
          <path d="M30 40 L20 56" />
          {/* rod swings from the shoulder; line runs off its tip */}
          <g className="rod">
            <path d="M30 40 L46 36" strokeWidth="2.2" />
            <path className="cast-line" d="M46 36 L70 10" strokeWidth="1" strokeDasharray="3 3" />
          </g>
        </>
      )}

      {pose === "reel" && (
        <>
          <path d="M30 40 L20 56" />
          <path d="M30 40 L44 42" strokeWidth="2.2" />
          {/* bent rod tip down to a hooked article card */}
          <path d="M44 42 L54 30" strokeWidth="2.2" />
          <path className="reel-line" d="M54 30 L56 62" strokeWidth="1" />
          <g className="article-card">
            <rect x="48" y="62" width="18" height="13" rx="2" strokeWidth="1.6" fill="var(--bg)" />
            <path d="M51 67 H63 M51 70 H60" strokeWidth="1.2" />
          </g>
        </>
      )}
    </svg>
  );
}
