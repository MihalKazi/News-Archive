"use client";

// Hand-drawn border via Rough.js. Draws a rectangle outline behind its children,
// re-drawn when the box resizes. Fixed seed so the wobble stays the same on each render.

import { useEffect, useRef, useState, type ReactNode } from "react";
import rough from "roughjs";

type Props = {
  children: ReactNode;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
};

export function SketchBox({ children, className = "", stroke = "currentColor", strokeWidth = 1.5 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paths =
    size.w > 4 && size.h > 4
      ? (() => {
          const gen = rough.generator();
          return gen.toPaths(
            gen.rectangle(2, 2, size.w - 4, size.h - 4, {
              roughness: 1.4,
              bowing: 1.2,
              strokeWidth,
              seed: 7,
            }),
          );
        })()
      : [];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        width={size.w}
        height={size.h}
      >
        {paths.map((p, i) => (
          <path key={i} d={p.d} stroke={stroke} strokeWidth={p.strokeWidth ?? strokeWidth} fill="none" strokeLinecap="round" />
        ))}
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}
