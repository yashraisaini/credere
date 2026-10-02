"use client";

import { simplifyDebts } from "./balances";
import { formatMoney } from "./money";
import { displayName } from "./store";
import type { Group } from "./types";

/**
 * Nudging people, without a backend.
 *
 * There's no server to send from, so we hand the message to whatever the
 * phone already uses: an `sms:` link opens iMessage on iOS (green bubbles on
 * Android), and the Web Share sheet covers WhatsApp, Signal and the rest.
 * Clipboard is the last resort on desktop browsers.
 */

export type ReminderResult = "messages" | "shared" | "copied" | "cancelled" | "unavailable";

/** One person, one amount. Friendly, short, no guilt. */
export function reminderText(opts: {
  name: string;
  amount: number;
  currency: string;
  groupName: string;
}): string {
  const { name, amount, currency, groupName } = opts;
  const first = name.split(/\s+/)[0];
  return (
    `Hey ${first}, it's ${formatMoney(amount, currency)} for ${groupName} whenever you get a chance. ` +
    `No rush, just so it doesn't get lost.`
  );
}

/** A whole-group rundown, for dropping in the group chat. */
export function groupSummaryText(group: Group, balances: Record<string, number>): string {
  const transfers = simplifyDebts(balances);
  const base = group.baseCurrency;

  if (transfers.length === 0) {
    return `${group.name}: everyone's square. Nothing to send.`;
  }

  const lines = transfers.map((t) => {
    const from = t.from === "me" ? "I" : displayName(group, t.from);
    const to = t.to === "me" ? "me" : displayName(group, t.to);
    const verb = t.from === "me" ? "owe" : "owes";
    return `- ${from} ${verb} ${to} ${formatMoney(t.amount, base)}`;
  });

  return `${group.name}, where we landed:\n${lines.join("\n")}\n\nSettle up whenever.`;
}

/**
 * Send it. A phone number goes straight to Messages; otherwise we open the
 * share sheet, and fall back to the clipboard.
 */
export async function sendReminder(text: string, phone?: string): Promise<ReminderResult> {
  if (typeof window === "undefined") return "unavailable";

  // iOS wants `sms:number&body=`, Android wants `sms:number?body=`.
  // `?&body=` is the spelling both of them accept.
  const digits = phone?.replace(/[^\d+]/g, "");
  if (digits) {
    window.location.href = `sms:${digits}?&body=${encodeURIComponent(text)}`;
    return "messages";
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      // The user closing the sheet is not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Anything else (no share target, permission policy): fall through to copy.
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "unavailable";
  }
}

export function resultMessage(result: ReminderResult): string | null {
  switch (result) {
    case "copied":
      return "Copied, paste it wherever you like.";
    case "unavailable":
      return "Couldn't open Messages on this device.";
    case "messages":
    case "shared":
    case "cancelled":
      return null;
  }
}
