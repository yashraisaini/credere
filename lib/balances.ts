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
