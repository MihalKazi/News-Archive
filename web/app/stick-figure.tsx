// Stick-figure mascot. Three poses drawn as plain strokes (no images), so it stays crisp
// at any size and inherits the theme colour via currentColor.
// "write" is the searching pose: writing arm swings, pen scribbles, body bobs.

type Pose = "idle" | "shrug" | "write" | "hold";

export function StickFigure({ pose = "idle", size = 72 }: { pose?: Pose; size?: number }) {
  const writing = pose === "write";
  const shrug = pose === "shrug";
  const holding = pose === "hold";

  return (
    <svg
      viewBox="0 0 80 84"
      width={size}
      height={(size * 84) / 80}
      role="img"
      aria-label={shrug ? "Stick figure shrugging" : writing ? "Stick figure searching" : "Stick figure"}
      className={`shrink-0 text-[var(--text)] ${writing ? "stick-write" : "stick-bob"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className="stick-body">
        <circle cx="30" cy="16" r="10" />
        <circle cx="26.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="33.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
        <path d="M26.5 19.5 Q30 21.5 33.5 19.5" strokeWidth="1.6" />
        <path d="M30 26 L30 40" />
        <path d="M30 40 L24 66 M30 40 L36 66" />
        {/* left arm: resting, or both up for a shrug */}
        <path d={shrug ? "M30 40 L14 34" : "M30 40 L20 56"} />
        {shrug && <path d="M30 40 L46 34" />}
        {!shrug && !writing && !holding && <path d="M30 40 L40 56" />}
      </g>
      {holding && (
        <>
          {/* right arm raised, holding a sketch Search button at the hand */}
          <path d="M30 40 L46 36" />
          <rect x="46" y="28" width="30" height="13" rx="3" strokeWidth="1.6" fill="var(--bg)" transform="rotate(-8 61 34)" />
          <text x="61" y="37.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="7" transform="rotate(-8 61 34)" style={{ fontFamily: "var(--hand)" }}>Search</text>
        </>
      )}
      {writing && (
        <>
          {/* writing arm swings from the shoulder */}
          <path className="arm-write" d="M30 40 L44 46" />
          <path className="pen" d="M44 46 L52 36" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
