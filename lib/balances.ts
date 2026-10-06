import type { Expense, Group, Settlement } from "./types";

/** Net position per member in base minor units. Positive means the group owes them. */
export function groupBalances(
  group: Group,
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, number> {
  const net: Record<string, number> = Object.fromEntries(group.members.map((m) => [m.id, 0]));

  for (const e of expenses) {
    if (e.groupId !== group.id) continue;
    const credit = Object.values(e.shares).reduce((a, b) => a + b, 0);
    net[e.paidBy] = (net[e.paidBy] ?? 0) + credit;
    for (const [memberId, share] of Object.entries(e.shares)) {
      net[memberId] = (net[memberId] ?? 0) - share;
    }
  }

  for (const s of settlements) {
    if (s.groupId !== group.id) continue;
    net[s.from] = (net[s.from] ?? 0) + s.amount;
    net[s.to] = (net[s.to] ?? 0) - s.amount;
  }

  return net;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Fewest-payments settle up (greedy): repeatedly match the person owed the
 * most with the person who owes the most.
 */
export function simplifyDebts(balances: Record<string, number>): Transfer[] {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }));
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }));

  const transfers: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.v - a.v);
    debtors.sort((a, b) => b.v - a.v);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.v, d.v);
    if (amount > 0) transfers.push({ from: d.id, to: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
  }
  return transfers;
}

export interface PersonBalance {
  /** Matched across groups by name, since members are identified per group. */
  name: string;
  /** Positive: they owe you. Negative: you owe them. In the home currency. */
  net: number;
}

/**
 * Who owes who, netted across every group and shown in one currency.
 *
 * Per-group balances already exist, but they answer "where does this trip
 * stand", not "who do I actually owe". Someone can be behind in Lisbon and
 * ahead on rent; this nets that out so the home screen can name a person and
 * one number.
 *
 * `convert` returns undefined while a rate is still loading. Those groups are
 * left out and reported as pending rather than counted at the wrong number.
 */
export function peopleBalances(
  groups: Group[],
  expenses: Expense[],
  settlements: Settlement[],
  convert: (minor: number, from: string) => number | undefined,
): { people: PersonBalance[]; pending: boolean } {
  const byName = new Map<string, number>();
  let pending = false;

  for (const group of groups) {
    if (group.archivedAt) continue;

    // Settling up first means we net against each person, rather than against
    // the group as a whole, which is the question being asked here.
    for (const t of simplifyDebts(groupBalances(group, expenses, settlements))) {
      const youPay = t.from === "me";
      const theyPay = t.to === "me";
      if (!youPay && !theyPay) continue;

      const inHome = convert(t.amount, group.baseCurrency);
      if (inHome === undefined) {
        pending = true;
        continue;
      }

      const otherId = youPay ? t.to : t.from;
      const name = group.members.find((m) => m.id === otherId)?.name ?? "Someone";
      byName.set(name, (byName.get(name) ?? 0) + (youPay ? -inHome : inHome));
    }
  }

  const people = [...byName.entries()]
    .map(([name, net]) => ({ name, net }))
    // Rounding across currencies can leave a stray cent that is not a real debt.
    .filter((p) => Math.abs(p.net) > 1)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  return { people, pending };
}
