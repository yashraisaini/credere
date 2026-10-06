"use client";

import { parseReceiptText, type ParsedReceipt } from "./receipt-text";

/**
 * Reading a receipt without a model or a network.
 *
 * Tesseract runs in the browser, so this works with no key, no account and no
 * image ever leaving the device. It is the fallback for when the vision model
 * is unavailable - no key configured, rate limited, or offline.
 *
 * The engine is imported lazily. It pulls in a WASM build and a language file
 * of a few megabytes, and most scans never need it, so it stays out of the
 * main bundle until something actually asks for it.
 */
export async function scanWithOcr(
  imageDataUrl: string,
  hintCurrency?: string,
  onProgress?: (fraction: number) => void,
): Promise<ParsedReceipt> {
  const { createWorker } = await import("tesseract.js");

  // Always a function: tesseract calls the logger unconditionally, so passing
  // undefined throws on every progress tick.
  const worker = await createWorker("eng", undefined, {
    logger: (m: { status: string; progress: number }) => {
      if (onProgress && m.status === "recognizing text") onProgress(m.progress);
    },
  });

  try {
    const { data } = await worker.recognize(imageDataUrl);
    return parseReceiptText(data.text, hintCurrency);
  } finally {
    // Frees the WASM heap; without this a few scans will exhaust memory.
    await worker.terminate();
  }
}

/** Tesseract reads pixels, so a PDF has to go through the model instead. */
export function canReadOffline(mediaType: string): boolean {
  return mediaType.startsWith("image/");
}
