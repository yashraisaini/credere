import { convertMinor } from "./money";
import type { CurrencyCode, FeePolicy, SplitInput } from "./types";

/**
 * Split `total` minor units across `weights` so the parts always add up
 * exactly to `total` (largest remainder method). No lost or invented cents.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (weights.length === 0 || sum <= 0) return weights.map(() => 0);

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);

  const raw = weights.map((w) => (Math.max(0, w) / sum) * abs);
  const floors = raw.map(Math.floor);
  let remainder = abs - floors.reduce((a, b) => a + b, 0);

  // Hand out leftover cents to the largest fractional parts first
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (const { i } of order) {
    if (remainder <= 0) break;
    if (weights[i] <= 0) continue;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors.map((v) => v * sign);
}

export type SplitResult =
  | { ok: true; shares: Record<string, number> }
  | { ok: false; error: string };

/** Work out what each participant owes in the expense's original currency. */
export function splitOriginal(total: number, split: SplitInput): SplitResult {
  const people = split.participants;
  if (people.length === 0) return { ok: false, error: "Pick at least one person to split with." };

  const toRecord = (parts: number[]) =>
    Object.fromEntries(people.map((p, i) => [p, parts[i]]));

  switch (split.method) {
    case "equal":
      return { ok: true, shares: toRecord(allocate(total, people.map(() => 1))) };

    case "exact": {
      const parts = people.map((p) => Math.round(split.values?.[p] ?? 0));
      const sum = parts.reduce((a, b) => a + b, 0);
      if (sum !== total) {
        return { ok: false, error: "The amounts need to add up to the expense total." };
      }
      return { ok: true, shares: toRecord(parts) };
    }

    case "percent": {
      const weights = people.map((p) => split.values?.[p] ?? 0);
      const sum = weights.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.01) {
        return { ok: false, error: `Percentages add up to ${round2(sum)}%. They need to reach 100%.` };
      }
      return { ok: true, shares: toRecord(allocate(total, weights)) };
    }

    case "shares": {
      const weights = people.map((p) => split.values?.[p] ?? 0);
      if (weights.every((w) => w <= 0)) {
        return { ok: false, error: "Give at least one person a share above zero." };
      }
      return { ok: true, shares: toRecord(allocate(total, weights)) };
    }

    case "itemized": {
      const items = split.items ?? [];
      if (items.length === 0) return { ok: false, error: "Add at least one item." };

      // 1. Each item is shared equally by whoever is assigned to it
      const subtotals: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]));
      for (const item of items) {
        const assignees = item.assignedTo.filter((id) => people.includes(id));
        const sharers = assignees.length > 0 ? assignees : people;
        allocate(item.amount, sharers.map(() => 1)).forEach((part, i) => {
          subtotals[sharers[i]] += part;
        });
      }

      // 2. Tax, tip and anything else on the bill gets spread in proportion
      //    to what each person ordered, by allocating the full total.
      const weights = people.map((p) => subtotals[p]);
      if (weights.every((w) => w <= 0)) {
        return { ok: false, error: "Items need amounts above zero." };
      }
      return { ok: true, shares: toRecord(allocate(total, weights)) };
    }
  }
}

export interface ExpenseMathInput {
  total: number; // original currency, minor units
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  rate: number; // 1 currency = rate baseCurrency
  split: SplitInput;
  feeAmount: number; // base minor units
  feePolicy: FeePolicy;
}

export type ExpenseMath =
  | {
      ok: true;
      baseAmount: number;
      /** What the payer gets credited in the group ledger */
      payerCredit: number;
      /** Final share per participant in base minor units (includes shared fees) */
      shares: Record<string, number>;
    }
  | { ok: false; error: string };

/**
 * Turn an expense into final base-currency shares.
 * Shares are computed in the original currency first, then the converted
 * total (plus any shared card fee) is allocated using those shares as weights.
 * That keeps the sum exact after conversion.
 */
export function computeExpense(input: ExpenseMathInput): ExpenseMath {
  const original = splitOriginal(input.total, input.split);
  if (!original.ok) return original;

  const baseAmount = convertMinor(input.total, input.currency, input.baseCurrency, input.rate);
  const sharedFee = input.feePolicy === "split" ? input.feeAmount : 0;
  const payerCredit = baseAmount + sharedFee;

  const people = input.split.participants;
  const parts = allocate(payerCredit, people.map((p) => original.shares[p] ?? 0));
  const shares = Object.fromEntries(people.map((p, i) => [p, parts[i]]));

  return { ok: true, baseAmount, payerCredit, shares };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
