"use client";

import { Camera, CircleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prepareReceiptImage } from "@/lib/image";
import type { ScannedReceipt } from "@/lib/types";
import { Button } from "./ui";

type State =
  | { status: "idle" }
  | { status: "reading"; preview: string }
  | { status: "done"; preview: string; itemCount: number }
  | { status: "error"; message: string };

/**
 * Takes a photo (camera on phones), shrinks it, sends it to /api/receipt and
 * hands back structured line items.
 */
export function ReceiptScanner({
  hintCurrency,
  initialFile,
  onScanned,
}: {
  hintCurrency: string;
  initialFile?: File | null;
  onScanned: (receipt: ScannedReceipt) => void;
}) {
  const [state, setState] = useState<State>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  async function scan(file: File) {
    try {
      const img = await prepareReceiptImage(file);
      setState({ status: "reading", preview: img.previewUrl });

      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: img.base64, mediaType: img.mediaType, hintCurrency }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't read that receipt.");

      const receipt = body as ScannedReceipt;
      onScanned(receipt);
      setState({ status: "done", preview: img.previewUrl, itemCount: receipt.items.length });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't read that receipt." });
    }
  }

  useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true;
      scan(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) scan(f);
        e.target.value = "";
      }}
    />
  );

  if (state.status === "reading" || state.status === "done") {
    return (
      <div className="flex items-center gap-4 rounded-2xl bg-vault p-3 shadow-[inset_0_0_0_1px_var(--color-rule)]">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.preview} alt="Your receipt" className="h-full w-full object-cover opacity-80" />
          {state.status === "reading" && (
            <span
              className="reading-line absolute inset-x-0 top-0 h-px bg-sage shadow-[0_0_12px_2px_rgb(181_210_192/0.6)]"
              style={{ ["--travel" as string]: "80px" }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {state.status === "reading" ? (
            <>
              <p className="text-bone">Reading the receipt</p>
              <p className="text-sm text-mist">Finding items, tax and tip</p>
            </>
          ) : (
            <>
              <p className="text-bone">
                Found {state.itemCount} {state.itemCount === 1 ? "item" : "items"}
              </p>
              <p className="text-sm text-mist">Tap people under each item to assign it.</p>
            </>
          )}
        </div>
        {state.status === "done" && (
          <Button variant="ghost" className="pr-2 text-sm" onClick={() => inputRef.current?.click()}>
            Rescan
          </Button>
        )}
        {picker}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-4 rounded-2xl bg-vault p-4 text-left shadow-[inset_0_0_0_1px_var(--color-rule)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-engrave)]"
      >
        <span className="grid size-11 place-items-center rounded-full bg-bottle text-bone">
          <Camera size={20} strokeWidth={1.5} aria-hidden />
        </span>
        <span>
          <span className="block text-bone">Scan a receipt</span>
          <span className="block text-sm text-mist">Fills in the items so you can split them</span>
        </span>
      </button>
      {state.status === "error" && (
        <p role="alert" className="flex items-start gap-2 text-sm text-rose">
          <CircleAlert size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      {picker}
    </div>
  );
}
