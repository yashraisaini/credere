/**
 * EMV chip and contactless waves, drawn to match a real card.
 *
 * The chip is the one warm thing on the note: brushed gold against bottle
 * green, with the contact pads engraved in a darker tone so it reads as metal
 * rather than a flat rectangle.
 */

export function Chip({ className, width = 44 }: { className?: string; width?: number }) {
  return (
    <svg
      viewBox="0 0 44 34"
      width={width}
      height={(width * 34) / 44}
      className={className}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="chip-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6dfa6" />
          <stop offset="38%" stopColor="#d8b26a" />
          <stop offset="62%" stopColor="#c89f54" />
          <stop offset="100%" stopColor="#e7cb8f" />
        </linearGradient>
      </defs>

      {/* Body */}
      <rect x="0.5" y="0.5" width="43" height="33" rx="5.5" fill="url(#chip-face)" />
      <rect
        x="0.5"
        y="0.5"
        width="43"
        height="33"
        rx="5.5"
        stroke="#8a6d2f"
        strokeOpacity="0.55"
        strokeWidth="1"
      />

      {/* Contact pads */}
      <g stroke="#8a6d2f" strokeOpacity="0.75" strokeWidth="1.1" strokeLinecap="round">
        <path d="M13.5 0.5 V33.5" />
        <path d="M30.5 0.5 V33.5" />
        <path d="M0.5 11 H13.5" />
        <path d="M30.5 11 H43.5" />
        <path d="M0.5 23 H13.5" />
        <path d="M30.5 23 H43.5" />
        <rect x="13.5" y="8.5" width="17" height="17" rx="3" />
        <path d="M30.5 17 H43.5" />
        <path d="M0.5 17 H13.5" />
      </g>
    </svg>
  );
}

/** The four arcs that mean "tap to pay". */
export function Contactless({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M7 8.5a6 6 0 0 1 0 7" opacity="0.95" />
        <path d="M11 6a10 10 0 0 1 0 12" opacity="0.75" />
        <path d="M15 3.5a14 14 0 0 1 0 17" opacity="0.55" />
        <path d="M19 1a18 18 0 0 1 0 22" opacity="0.35" />
      </g>
    </svg>
  );
}
