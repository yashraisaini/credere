"use client";

import { simplifyDebts } from "./balances";
import { formatMoney } from "./money";
import { payLine } from "./pay";
import { displayName } from "./store";
import type { Group, PayTo } from "./types";

/**
 * Nudging people, without a backend.
 *
 * There's no server to send from, so nothing here sends anything by itself.
 * The message is handed to whatever the device already uses, with everything
 * filled in, and the person taps send: `sms:` opens Messages, `mailto:` opens
 * Mail, and the Web Share sheet covers WhatsApp, Signal and the rest.
 * Clipboard is the last resort on desktop browsers.
 */

export type ReminderResult =
  | "messages"
  | "email"
  | "shared"
  | "copied"
  | "cancelled"
  | "unavailable";

export type Channel = "sms" | "email" | "share";

/** One person, one amount. Friendly, short, no guilt, and a way to pay. */
export function reminderText(opts: {
  name: string;
  amount: number;
  currency: string;
  groupName: string;
  payTo?: PayTo;
}): string {
  const { name, amount, currency, groupName, payTo } = opts;
  const first = name.split(/\s+/)[0];
  const ask =
    `Hey ${first}, it's ${formatMoney(amount, currency)} for ${groupName} whenever you get a chance. ` +
    `No rush, just so it doesn't get lost.`;
  const how = payLine(payTo);
  return how ? `${ask}

${how}` : ask;
}

/** "Lisbon", or "Lisbon and Apartment", for a debt that spans groups. */
export function joinGroupNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "what we have going";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Subject line for the email channel. */
export function reminderSubject(groupName: string): string {
  return `Settling up for ${groupName}`;
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
 * Hand it over. Opens Messages or Mail with everything already written; the
 * person still taps send, because a web page cannot send on their behalf.
 */
export async function sendReminder(
  text: string,
  opts: { channel?: Channel; phone?: string; email?: string; subject?: string } = {},
): Promise<ReminderResult> {
  if (typeof window === "undefined") return "unavailable";
  const { channel = "share", phone, email, subject } = opts;

  // iOS wants `sms:number&body=`, Android wants `sms:number?body=`.
  // `?&body=` is the spelling both of them accept.
  const digits = phone?.replace(/[^\d+]/g, "");
  if (channel === "sms" && digits) {
    window.location.href = `sms:${digits}?&body=${encodeURIComponent(text)}`;
    return "messages";
  }

  if (channel === "email" && email?.trim()) {
    const query = new URLSearchParams();
    if (subject) query.set("subject", subject);
    query.set("body", text);
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?${query.toString()}`;
    return "email";
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
      return "Couldn't open Messages or Mail on this device.";
    case "messages":
    case "email":
    case "shared":
    case "cancelled":
      return null;
  }
}
