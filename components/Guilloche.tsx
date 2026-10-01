import { useMemo } from "react";

/**
 * Banknote-style guilloche rosette, generated from math so it's crisp at any
 * size. Two families of wavy rings with opposite phase weave into each other.
 */
export function Guilloche({ className, size = 400 }: { className?: string; size?: number }) {
  const paths = useMemo(() => buildPaths(size), [size]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`guilloche ${className ?? ""}`}
      fill="none"
      aria-hidden
      focusable="false"
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          pathLength={1}
          stroke="currentColor"
          strokeWidth={p.w}
          strokeOpacity={p.o}
          style={{ animationDelay: `${p.delay}ms` }}
        />
      ))}
    </svg>
  );
}

function ring(cx: number, cy: number, R: number, amp: number, lobes: number, phase: number) {
  const steps = 540;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = R + amp * Math.sin(lobes * t + phase);
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
  }
  return d + "Z";
}

function buildPaths(size: number) {
  const c = size / 2;
  const out: { d: string; w: number; o: number; delay: number }[] = [];

  // Outer woven band
  for (let j = 0; j < 14; j++) {
    const R = size * 0.3 + j * size * 0.011;
    out.push({ d: ring(c, c, R, size * 0.028, 24, j * 0.22), w: 0.6, o: 0.55, delay: j * 40 });
    out.push({ d: ring(c, c, R, size * 0.028, 24, Math.PI - j * 0.22), w: 0.6, o: 0.35, delay: 200 + j * 40 });
  }
  // Inner rosette
  for (let j = 0; j < 10; j++) {
    const R = size * 0.12 + j * size * 0.009;
    out.push({ d: ring(c, c, R, size * 0.04, 12, j * 0.31), w: 0.5, o: 0.5, delay: 600 + j * 50 });
  }
  return out;
}
