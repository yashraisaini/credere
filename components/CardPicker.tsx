"use client";

import { useEffect, useRef, useState } from "react";
import { cx, inputClass } from "./ui";
import { searchCards, type CardCatalogEntry } from "@/lib/card-catalog";

/**
 * A card name field that offers real cards as you type - "td aeroplan" finds
 * TD Aeroplan Visa Infinite - and picking one fills in its fee. Typing
 * something the list doesn't have is never blocked: the text you typed is
 * the card name, same as before this existed.
 */
export function CardPicker({
  id,
  value,
  onChange,
  onPick,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (label: string) => void;
  onPick: (entry: CardCatalogEntry) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const results = open ? searchCards(value) : [];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function pick(entry: CardCatalogEntry) {
    onChange(entry.label);
    onPick(entry);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={inputClass}
      />

      {open && results.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl bg-vault py-1.5 shadow-[inset_0_0_0_1px_var(--color-rule),0_20px_40px_-20px_rgb(0_0_0/0.9)]"
        >
          {results.map((entry, i) => (
            <li key={entry.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                // Fires before the input's blur, so the click lands cleanly.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(entry)}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                  i === active ? "bg-bottle/40" : "hover:bg-bottle/20",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] text-bone">{entry.label}</span>
                  <span className="block truncate text-xs text-mist">
                    {entry.issuer}
                    {entry.kind === "debit" ? " · Debit" : ""}
                  </span>
                </span>
                <span
                  className={cx(
                    "num shrink-0 text-xs",
                    entry.fxFeePct === 0 ? "text-sage" : "text-mist",
                  )}
                >
                  {entry.fxFeePct === 0 ? "No FX fee" : `${entry.fxFeePct}%`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
