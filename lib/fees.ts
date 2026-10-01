import { fromMajor } from "./money";
import type { CardPlan, CurrencyCode } from "./types";

/**
 * Starter card plans. These are typical figures, not quotes from a specific bank.
 * Add real plans (your bank, your card tier) in Settings or extend this list.
 */
export const PRESET_PLANS: CardPlan[] = [
  {
    id: "standard-credit",
    label: "Standard credit card",
    kind: "credit",
    fxFeePct: 2.5,
    fxFlatFee: 0,
    note: "Most Canadian credit cards add about 2.5% on purchases in another currency.",
  },
  {
    id: "no-fx-credit",
    label: "No foreign fee card",
    kind: "credit",
    fxFeePct: 0,
    fxFlatFee: 0,
    note: "Travel cards that waive foreign transaction fees.",
  },
  {
    id: "debit",
    label: "Debit card",
    kind: "debit",
    fxFeePct: 2.5,
    fxFlatFee: 0,
    note: "Many banks add a conversion fee on debit purchases abroad. Check your account terms.",
  },
  {
    id: "cash",
    label: "Cash",
    kind: "cash",
    fxFeePct: 0,
    fxFlatFee: 0,
    note: "Exchange costs happen when you get the cash, not when you spend it.",
  },
];

export function findPlan(id: string, custom: CardPlan[] = []): CardPlan {
  return (
    custom.find((p) => p.id === id) ??
    PRESET_PLANS.find((p) => p.id === id) ??
    PRESET_PLANS[0]
  );
}

/**
 * Card fee for a purchase, in the group's base currency (minor units).
 * Fees only apply when the purchase currency differs from the card's billing
 * currency. For now the billing currency is assumed to be the group currency.
 * TODO: per-member billing currency for mixed-country groups.
 */
export function computeCardFee(params: {
  baseAmount: number;
  purchaseCurrency: CurrencyCode;
  billingCurrency: CurrencyCode;
  plan: CardPlan;
}): number {
  const { baseAmount, purchaseCurrency, billingCurrency, plan } = params;
  if (purchaseCurrency === billingCurrency) return 0;
  const pct = Math.round((Math.abs(baseAmount) * plan.fxFeePct) / 100);
  const flat = fromMajor(plan.fxFlatFee, billingCurrency);
  return pct + flat;
}

export function describePlan(plan: CardPlan): string {
  if (plan.fxFeePct === 0 && plan.fxFlatFee === 0) return "No foreign fees";
  const parts = [];
  if (plan.fxFeePct) parts.push(`${plan.fxFeePct}% foreign fee`);
  if (plan.fxFlatFee) parts.push(`${plan.fxFlatFee.toFixed(2)} flat`);
  return parts.join(" plus ");
}
