"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { computeCardFee, findPlan } from "./fees";
import { uid } from "./id";
import { convertMinor } from "./money";
import { computeExpense } from "./split";
import type {
  CardPlan,
  Expense,
  FeePolicy,
  Group,
  Member,
  Profile,
  Settlement,
  SplitInput,
} from "./types";

/**
 * Local-first store (persists to localStorage).
 * Every mutation goes through an action here, so swapping this for a real
 * backend later (Supabase, Postgres + API routes) only touches this file.
 */
interface CredereState {
  profile: Profile;
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  customPlans: CardPlan[];

  updateProfile: (patch: Partial<Omit<Profile, "id">>) => void;

  createGroup: (input: {
    name: string;
    baseCurrency: string;
    feePolicy: FeePolicy;
    members: { name: string; cardPlanId: string }[];
  }) => string;
  addMember: (groupId: string, member: { name: string; cardPlanId: string }) => void;
  updateMember: (groupId: string, memberId: string, patch: Partial<Omit<Member, "id">>) => void;
  setFeePolicy: (groupId: string, policy: FeePolicy) => void;

  addExpense: (expense: Omit<Expense, "id" | "createdAt">) => string;
  deleteExpense: (id: string) => void;

  addSettlement: (s: Omit<Settlement, "id">) => void;

  addCustomPlan: (plan: Omit<CardPlan, "id">) => string;
  removeCustomPlan: (id: string) => void;

  resetToDemo: () => void;
}

export const useCredere = create<CredereState>()(
  persist(
    (set, get) => ({
      ...demoData(),

      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      createGroup: ({ name, baseCurrency, feePolicy, members }) => {
        const id = uid("g");
        const me: Member = { id: "me", name: get().profile.name, cardPlanId: get().profile.cardPlanId };
        const group: Group = {
          id,
          name,
          baseCurrency,
          feePolicy,
          members: [me, ...members.map((m) => ({ ...m, id: uid("m") }))],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ groups: [group, ...s.groups] }));
        return id;
      },

      addMember: (groupId, member) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId ? { ...g, members: [...g.members, { ...member, id: uid("m") }] } : g,
          ),
        })),

      updateMember: (groupId, memberId, patch) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId
              ? { ...g, members: g.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)) }
              : g,
          ),
        })),

      setFeePolicy: (groupId, policy) =>
        set((s) => ({
          groups: s.groups.map((g) => (g.id === groupId ? { ...g, feePolicy: policy } : g)),
        })),

      addExpense: (expense) => {
        const id = uid("e");
        set((s) => ({
          expenses: [{ ...expense, id, createdAt: new Date().toISOString() }, ...s.expenses],
        }));
        return id;
      },

      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      addSettlement: (settlement) =>
        set((s) => ({ settlements: [{ ...settlement, id: uid("s") }, ...s.settlements] })),

      addCustomPlan: (plan) => {
        const id = uid("plan");
        set((s) => ({ customPlans: [...s.customPlans, { ...plan, id }] }));
        return id;
      },

      removeCustomPlan: (id) => set((s) => ({ customPlans: s.customPlans.filter((p) => p.id !== id) })),

      resetToDemo: () => set(demoData()),
    }),
    { name: "credere-v1", version: 1 },
  ),
);

/** "You" for the current user, otherwise the member's name. */
export function displayName(group: Group | undefined, memberId: string): string {
  if (memberId === "me") return "You";
  return group?.members.find((m) => m.id === memberId)?.name ?? "Someone";
}

/* ------------------------------------------------------------------ */
/* Demo data so the app has something to show on first run.            */
/* ------------------------------------------------------------------ */

function demoData() {
  const profile: Profile = { id: "me", name: "You", homeCurrency: "CAD", cardPlanId: "standard-credit" };

  const lisbon: Group = {
    id: "g-lisbon",
    name: "Lisbon, reading week",
    baseCurrency: "CAD",
    feePolicy: "split",
    createdAt: "2026-09-10T12:00:00.000Z",
    members: [
      { id: "me", name: "You", cardPlanId: "standard-credit" },
      { id: "m-maya", name: "Maya", cardPlanId: "no-fx-credit" },
      { id: "m-theo", name: "Theo", cardPlanId: "debit" },
      { id: "m-priya", name: "Priya", cardPlanId: "standard-credit" },
    ],
  };

  const apartment: Group = {
    id: "g-apartment",
    name: "Apartment",
    baseCurrency: "CAD",
    feePolicy: "split",
    createdAt: "2026-09-01T12:00:00.000Z",
    members: [
      { id: "me", name: "You", cardPlanId: "standard-credit" },
      { id: "m-jordan", name: "Jordan", cardPlanId: "debit" },
    ],
  };

  const everyone = lisbon.members.map((m) => m.id);
  const eurRate = 1.493; // locked demo rate

  const expenses: Expense[] = [
    seedExpense(lisbon, {
      id: "e-airbnb",
      description: "Airbnb in Alfama",
      date: "2026-09-12",
      paidBy: "me",
      amount: 118000,
      currency: "CAD",
      rate: 1,
      split: { method: "equal", participants: everyone },
    }),
    seedExpense(lisbon, {
      id: "e-market",
      description: "Time Out Market",
      date: "2026-09-13",
      paidBy: "m-theo",
      amount: 5830,
      currency: "EUR",
      rate: eurRate,
      split: {
        method: "itemized",
        participants: everyone,
        items: [
          { id: "i1", name: "Bifana", quantity: 1, amount: 650, assignedTo: ["m-theo"] },
          { id: "i2", name: "Bacalhau à brás", quantity: 1, amount: 1890, assignedTo: ["m-priya"] },
          { id: "i3", name: "Polvo à lagareiro", quantity: 1, amount: 1440, assignedTo: ["m-maya"] },
          { id: "i4", name: "Pastéis de nata", quantity: 4, amount: 600, assignedTo: [] },
          { id: "i5", name: "Super Bock", quantity: 3, amount: 1050, assignedTo: ["me", "m-theo", "m-maya"] },
        ],
      },
      receipt: { merchant: "Time Out Market Lisboa", tip: 200 },
    }),
    seedExpense(lisbon, {
      id: "e-dinner",
      description: "Dinner in Bairro Alto",
      date: "2026-09-13",
      paidBy: "m-maya",
      amount: 9640,
      currency: "EUR",
      rate: eurRate,
      split: { method: "equal", participants: everyone },
    }),
    seedExpense(lisbon, {
      id: "e-sintra",
      description: "Train to Sintra",
      date: "2026-09-14",
      paidBy: "m-priya",
      amount: 1840,
      currency: "EUR",
      rate: eurRate,
      split: { method: "equal", participants: everyone },
    }),
    seedExpense(apartment, {
      id: "e-groceries",
      description: "Groceries",
      date: "2026-09-20",
      paidBy: "m-jordan",
      amount: 8642,
      currency: "CAD",
      rate: 1,
      split: { method: "equal", participants: ["me", "m-jordan"] },
    }),
    seedExpense(apartment, {
      id: "e-internet",
      description: "Internet, September",
      date: "2026-09-02",
      paidBy: "me",
      amount: 6500,
      currency: "CAD",
      rate: 1,
      split: { method: "equal", participants: ["me", "m-jordan"] },
    }),
  ];

  return {
    profile,
    groups: [lisbon, apartment],
    expenses,
    settlements: [] as Settlement[],
    customPlans: [] as CardPlan[],
  };
}

function seedExpense(
  group: Group,
  e: {
    id: string;
    description: string;
    date: string;
    paidBy: string;
    amount: number;
    currency: string;
    rate: number;
    split: SplitInput;
    receipt?: Expense["receipt"];
  },
): Expense {
  const payer = group.members.find((m) => m.id === e.paidBy)!;
  const plan = findPlan(payer.cardPlanId);
  const baseAmount = convertMinor(e.amount, e.currency, group.baseCurrency, e.rate);
  const fee = computeCardFee({
    baseAmount,
    purchaseCurrency: e.currency,
    billingCurrency: group.baseCurrency,
    plan,
  });
  const math = computeExpense({
    total: e.amount,
    currency: e.currency,
    baseCurrency: group.baseCurrency,
    rate: e.rate,
    split: e.split,
    feeAmount: fee,
    feePolicy: group.feePolicy,
  });
  if (!math.ok) throw new Error(`Bad seed expense ${e.id}: ${math.error}`);

  return {
    id: e.id,
    groupId: group.id,
    description: e.description,
    date: e.date,
    paidBy: e.paidBy,
    original: { amount: e.amount, currency: e.currency },
    fx: { rate: e.rate, source: "demo", asOf: e.date },
    baseAmount: math.baseAmount,
    fee: { planId: plan.id, amount: fee, policy: group.feePolicy },
    split: e.split,
    shares: math.shares,
    receipt: e.receipt,
    createdAt: `${e.date}T18:00:00.000Z`,
  };
}
