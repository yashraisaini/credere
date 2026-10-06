"use client";

import { useEffect, useRef } from "react";
import { Button } from "./ui";

/**
 * A confirmation built on the native <dialog>, so the focus trap, Escape to
 * dismiss and top-layer stacking come from the platform rather than from us
 * reimplementing them. Styling lives in globals.css under `.sheet`.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  tone = "danger",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // `close` covers Escape and the backdrop alike, so state can't drift
      // out of sync with what's actually on screen.
      onClose={onClose}
      onClick={(e) => {
        // Clicks on the backdrop land on the dialog itself, not its contents.
        if (e.target === ref.current) ref.current?.close();
      }}
      className="sheet"
      aria-labelledby="confirm-title"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="font-display text-[1.75rem] leading-tight text-bone">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-mist">{children}</div>

        <div className="mt-7 flex gap-3">
          <Button type="button" variant="quiet" block onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={tone}
            block
            onClick={() => {
              onConfirm();
              ref.current?.close();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
