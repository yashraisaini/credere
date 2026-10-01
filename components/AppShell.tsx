"use client";

import { useEffect, useState } from "react";

/**
 * Data lives in localStorage for now, so render only after mount to avoid
 * server/client mismatches. When you move to a real database this can go.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="min-h-dvh bg-ink" />;
  return <div className="min-h-dvh">{children}</div>;
}
