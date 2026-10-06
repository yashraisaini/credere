import type { PayMethod, PayTo } from "./types";

/**
 * Ways people actually send money back, and how to say them in a message.
 *
 * Credere never moves money. These are labels and handles that go into the
 * reminder text, so the person owing you can open their own banking app and
 * send it. Nothing here touches a payment network.
 */
export const PAY_METHODS: { id: PayMethod; label: string; asks: "email" | "phone" | "either" }[] = [
  { id: "etransfer", label: "Interac e-Transfer", asks: "either" },
  { id: "zelle", label: "Zelle", asks: "either" },
  { id: "venmo", label: "Venmo", asks: "either" },
  { id: "paypal", label: "PayPal", asks: "either" },
  { id: "revolut", label: "Revolut", asks: "either" },
  { id: "cash", label: "Cash", asks: "either" },
  { id: "other", label: "Something else", asks: "either" },
];

export function payMethodLabel(method: PayMethod): string {
  return PAY_METHODS.find((m) => m.id === method)?.label ?? "Transfer";
}

/** The sentence a reminder ends with, or null when nothing is set up. */
export function payLine(payTo: PayTo | undefined): string | null {
  if (!payTo?.handle.trim()) return null;
  if (payTo.method === "cash") return "Cash is fine whenever you see me.";
  return `${payMethodLabel(payTo.method)} to ${payTo.handle.trim()}.`;
}
