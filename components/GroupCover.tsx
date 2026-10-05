"use client";

import { useState } from "react";
import { Guilloche } from "./Guilloche";
import { cx } from "./ui";
import { photoSrc } from "@/lib/photo";
import type { GroupPhoto } from "@/lib/types";

const UTM = "utm_source=credere&utm_medium=referral";

/**
 * The image behind a group's name. A photo once we've found one, otherwise the
 * guilloche, so a group without a match still looks deliberate rather than
 * broken. Unsplash's dominant colour sits underneath so the tile is never a
 * black hole while the photo loads.
 */
export function GroupCover({
  photo,
  width,
  className,
}: {
  photo: GroupPhoto | null;
  /** Rendered width in CSS pixels; we request 2x for retina. */
  width: number;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!photo) {
    return (
      <div className={cx("absolute inset-0 overflow-hidden bg-note", className)} aria-hidden>
        <Guilloche
          size={420}
          className="absolute left-1/2 top-1/2 size-[150%] -translate-x-1/2 -translate-y-1/2 text-engrave/45"
        />
      </div>
    );
  }

  return (
    <div
      className={cx("absolute inset-0 overflow-hidden", className)}
      style={{ backgroundColor: photo.color }}
      aria-hidden
    >
      <img
        src={photoSrc(photo, width * 2)}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cx(
          "size-full object-cover transition-opacity duration-700",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

/**
 * Unsplash's terms ask that the photographer is credited with a link back
 * wherever their photo is shown. This is that credit.
 */
export function PhotoCredit({ photo, className }: { photo: GroupPhoto; className?: string }) {
  return (
    <p className={cx("text-xs text-mist", className)}>
      Photo by{" "}
      <a
        href={photo.credit.link}
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-rule underline-offset-2 transition-colors hover:text-bone"
      >
        {photo.credit.name}
      </a>{" "}
      on{" "}
      <a
        href={`https://unsplash.com/?${UTM}`}
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-rule underline-offset-2 transition-colors hover:text-bone"
      >
        Unsplash
      </a>
    </p>
  );
}
