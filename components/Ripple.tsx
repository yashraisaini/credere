"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A dark green bloom that spreads from wherever you pressed.
 *
 * Returns the handler to put on the element and the layer to render inside it.
 * The host element needs `relative` and `overflow-hidden`; the layer sits
 * under the content, so text stays readable while the colour moves.
 */
interface Drop {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function useRipple<T extends HTMLElement = HTMLElement>() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<T>) => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    // Reach the furthest corner, so the bloom always covers the element.
    const size =
      2 * Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));

    const id = nextId.current++;
    setDrops((prev) => [...prev, { id, x, y, size }]);

    const timer = setTimeout(() => {
      setDrops((prev) => prev.filter((d) => d.id !== id));
      timers.current = timers.current.filter((t) => t !== timer);
    }, 620);
    timers.current.push(timer);
  }, []);

  const layer = (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {drops.map((d) => (
        <span
          key={d.id}
          className="ripple"
          style={{ left: d.x, top: d.y, width: d.size, height: d.size }}
        />
      ))}
    </span>
  );

  return { onPointerDown, layer };
}
