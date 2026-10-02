import type { Expense, Group, Settlement } from "./types";

/**
 * One timeline across every group.
 *
 * `delta` is what the entry did to your position, in the group's base
 * currency, using the same arithmetic as groupBalances so the feed and the
 * balances can never disagree.
 */
export type ActivityEntry =
  | {
      kind: "expense";
      id: string;
      date: string;
      sortKey: string;
      group: Group;
      delta: number;
      expense: Expense;
    }
  | {
      kind: "settlement";
      id: string;
      date: string;
      sortKey: string;
      group: Group;
      delta: number;
      settlement: Settlement;
    };

/** What an expense did to one member's net position, in base minor units. */
export function expenseDelta(expense: Expense, memberId: string): number {
  const paid =
    expense.paidBy === memberId
      ? Object.values(expense.shares).reduce((a, b) => a + b, 0)
      : 0;
  return paid - (expense.shares[memberId] ?? 0);
}

/** What a settlement did to one member's net position. */
export function settlementDelta(settlement: Settlement, memberId: string): number {
  if (settlement.from === memberId) return settlement.amount;
  if (settlement.to === memberId) return -settlement.amount;
  return 0;
}

export function buildActivity(
  groups: Group[],
  expenses: Expense[],
  settlements: Settlement[],
  memberId = "me",
): ActivityEntry[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const entries: ActivityEntry[] = [];

  for (const e of expenses) {
    const group = byId.get(e.groupId);
    if (!group) continue;
    entries.push({
      kind: "expense",
      id: e.id,
      date: e.date,
      sortKey: `${e.date}T${e.createdAt}`,
      group,
      delta: expenseDelta(e, memberId),
      expense: e,
    });
  }

  for (const s of settlements) {
    const group = byId.get(s.groupId);
    if (!group) continue;
    entries.push({
      kind: "settlement",
      id: s.id,
      date: s.date,
      sortKey: `${s.date}T`,
      group,
      delta: settlementDelta(s, memberId),
      settlement: s,
    });
  }

  return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/** Group a sorted feed into month buckets, newest first. */
export function byMonth(entries: ActivityEntry[]): { label: string; entries: ActivityEntry[] }[] {
  const out: { label: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const label = monthLabel(entry.date);
    const last = out.at(-1);
    if (last && last.label === label) last.entries.push(entry);
    else out.push({ label, entries: [entry] });
  }
  return out;
}

export function monthLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Undated";
  return d.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

export function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
