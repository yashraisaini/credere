import type { CurrencyCode } from "./types";

/**
 * A log of what changed, so the notification area has something true to show.
 *
 * `actor` is who did it. On this device that is always "me", because the store
 * is local and there is nobody else in the system yet. The field exists so that
 * when there is a server, other people's changes land here unchanged and the
 * screen that renders them needs no rewrite.
 */
export type AppEventKind =
  | "expense-added"
  | "expense-deleted"
  | "settlement-added"
  | "settlement-deleted"
  | "group-created"
  | "group-deleted"
  | "group-archived"
  | "group-unarchived"
  | "member-added";

export interface AppEvent {
  id: string;
  kind: AppEventKind;
  /** ISO timestamp of when it happened. */
  at: string;
  actor: string;
  actorName: string;
  groupId?: string;
  /** Copied in, so an event still reads after its group is deleted. */
  groupName: string;
  subject: string;
  amount?: { minor: number; currency: CurrencyCode };
  readAt?: string | null;
}

/** The sentence shown in the list. Kept here so the page stays about layout. */
export function eventLine(event: AppEvent): string {
  const who = event.actor === "me" ? "You" : event.actorName;
  switch (event.kind) {
    case "expense-added":
      return `${who} added ${event.subject}`;
    case "expense-deleted":
      return `${who} deleted ${event.subject}`;
    case "settlement-added":
      return `${who} recorded a payment: ${event.subject}`;
    case "settlement-deleted":
      return `${who} removed a payment: ${event.subject}`;
    case "group-created":
      return `${who} started ${event.subject}`;
    case "group-deleted":
      return `${who} deleted ${event.subject}`;
    case "group-archived":
      return `${who} archived ${event.subject}`;
    case "group-unarchived":
      return `${who} unarchived ${event.subject}`;
    case "member-added":
      return `${who} added ${event.subject}`;
  }
}

export function isUnread(event: AppEvent): boolean {
  return !event.readAt;
}

/** "just now", "12 min ago", "3 h ago", then the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((now - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

/** Newest first, bucketed by day for the list. */
export function byDay(events: AppEvent[]): { label: string; events: AppEvent[] }[] {
  const out: { label: string; events: AppEvent[] }[] = [];
  for (const event of [...events].sort((a, b) => b.at.localeCompare(a.at))) {
    const label = dayBucket(event.at);
    const last = out.at(-1);
    if (last && last.label === label) last.events.push(event);
    else out.push({ label, events: [event] });
  }
  return out;
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
}
