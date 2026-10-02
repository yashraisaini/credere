"use client";

import { useEffect, useState } from "react";
import { Guilloche } from "./Guilloche";

/**
 * Data lives in localStorage for now, so render only after mount to avoid
 * server/client mismatches. When you move to a real database this can go.
 *
 * The same engraving from the note is repeated behind every screen, barely
 * there, turning slowly. It sits under the content and ignores the pointer.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="min-h-dvh bg-ink" />;

  return (
    <div className="relative min-h-dvh">
      <div className="guilloche-field" aria-hidden>
        <Guilloche className="absolute left-1/2 top-[22%] h-[52rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 text-engrave" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
