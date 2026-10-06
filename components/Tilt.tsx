"use client";

import { useCallback, useRef } from "react";

/**
 * Grab the card and it leans. The surface rotates toward wherever you're
 * pressing, and a specular sheen slides to the opposite corner, the way light
 * catches a real card held at an angle. Let go and it springs flat.
 *
 * Everything is written as CSS custom properties on the element, so the work
 * per pointer move is a style write rather than a React render. The visual
 * side lives in globals.css under `.tilt`.
 */
export function useTilt<T extends HTMLElement = HTMLElement>({
  /** Maximum lean in degrees at the far corners. */
  max = 10,
  /** Treat a press that travels further than this as a drag, not a tap. */
  dragSlop = 10,
} = {}) {
  const ref = useRef<T>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  const reduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const apply = useCallback(
    (event: React.PointerEvent<T>) => {
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      // -1 .. 1 from the centre of the card.
      const nx = ((event.clientX - box.left) / box.width) * 2 - 1;
      const ny = ((event.clientY - box.top) / box.height) * 2 - 1;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));

      // Pressing low tips the top toward you, so rotateX takes the sign of -ny.
      el.style.setProperty("--tilt-x", `${clamp(-ny) * max}deg`);
      el.style.setProperty("--tilt-y", `${clamp(nx) * max}deg`);
      // The sheen sits opposite the press, where the light would land.
      el.style.setProperty("--sheen-x", `${50 - clamp(nx) * 55}%`);
      el.style.setProperty("--sheen-y", `${50 - clamp(ny) * 55}%`);
    },
    [max],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<T>) => {
      if (reduced()) return;
      const el = ref.current;
      if (!el) return;
      origin.current = { x: event.clientX, y: event.clientY };
      dragged.current = false;
      el.classList.add("is-tilting");
      el.style.setProperty("--tilt-scale", "0.985");
      el.style.setProperty("--sheen", "1");
      apply(event);
      // Keep receiving moves even if the finger slides off the card.
      el.setPointerCapture?.(event.pointerId);
    },
    [apply],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      if (!origin.current) return;
      const { x, y } = origin.current;
      if (Math.hypot(event.clientX - x, event.clientY - y) > dragSlop) dragged.current = true;
      apply(event);
    },
    [apply, dragSlop],
  );

  const release = useCallback(() => {
    const el = ref.current;
    origin.current = null;
    if (!el) return;
    el.classList.remove("is-tilting");
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
    el.style.setProperty("--tilt-scale", "1");
    el.style.setProperty("--sheen", "0");
  }, []);

  /**
   * The card is a link. Tilting it around shouldn't also open it, so a press
   * that travelled is swallowed here and only a genuine tap navigates.
   */
  const onClickCapture = useCallback((event: React.MouseEvent<T>) => {
    if (!dragged.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragged.current = false;
  }, []);

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onClickCapture,
    },
  };
}

/** The moving highlight. Sits above the artwork, below nothing that matters. */
export function Sheen({ className }: { className?: string }) {
  return <span aria-hidden className={`tilt-sheen ${className ?? ""}`} />;
}
