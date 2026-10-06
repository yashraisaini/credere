"use client";

import { useEffect, useRef } from "react";
import { cx } from "./ui";

export interface SheetAction {
  label: string;
  /** One line under the label, for anything that needs a consequence spelled out. */
  hint?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * Actions for one thing, slid up from the bottom where a thumb already is.
 *
 * Built on the native <dialog> for the same reason as ConfirmDialog: the focus
 * trap, Escape and top-layer stacking are the platform's job, not ours.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
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
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="sheet sheet-bottom"
      aria-label={title}
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-rule" aria-hidden />

        <p className="truncate text-[1.0625rem] text-bone">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-sm text-mist">{subtitle}</p>}

        <ul className="mt-4 space-y-1">
          {actions.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  // Close first so the sheet is gone before anything it
                  // triggers (a confirm, a route change) takes over.
                  ref.current?.close();
                  action.onSelect();
                }}
                className={cx(
                  "w-full rounded-xl px-4 py-3 text-left transition-colors disabled:opacity-35",
                  action.tone === "danger"
                    ? "text-rose hover:bg-rose/10"
                    : "text-bone hover:bg-bottle/40",
                )}
              >
                <span className="block text-[0.9375rem]">{action.label}</span>
                {action.hint && <span className="mt-0.5 block text-xs text-mist">{action.hint}</span>}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="mt-3 w-full rounded-xl px-4 py-3 text-[0.9375rem] text-mist transition-colors hover:text-bone"
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}
