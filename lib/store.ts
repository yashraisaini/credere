"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppEvent, AppEventKind } from "./events";
import { computeCardFee, findPlan } from "./fees";
import { uid } from "./id";
import { convertMinor } from "./money";
import { computeExpense } from "./split";
import type {
  CardPlan,
  Expense,
  FeePolicy,
  Group,
  GroupPhoto,
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
  /** What changed, newest first. Feeds the notification area. */
  events: AppEvent[];

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
  /** Cover photo. Pass null to clear it and fall back to the guilloche. */
  setGroupPhoto: (groupId: string, photo: GroupPhoto | null) => void;
  setArchived: (groupId: string, archived: boolean) => void;
  /** Removes the group and everything recorded against it. Not undoable. */
  deleteGroup: (groupId: string) => void;

  addExpense: (expense: Omit<Expense, "id" | "createdAt">) => string;
  deleteExpense: (id: string) => void;

  addSettlement: (s: Omit<Settlement, "id">) => void;
  deleteSettlement: (id: string) => void;

  markEventsRead: () => void;

  addCustomPlan: (plan: Omit<CardPlan, "id">) => string;
  removeCustomPlan: (id: string) => void;

  resetToDemo: () => void;
}

/**
 * Build one log line. `actor` is always "me" while the store is local; the
 * field is there so a server can drop other people's changes in untouched.
 */
function logged(
  state: CredereState,
  entry: {
    kind: AppEventKind;
    groupId?: string;
    groupName: string;
    subject: string;
    amount?: { minor: number; currency: string };
  },
): AppEvent[] {
  const event: AppEvent = {
    ...entry,
    id: uid("ev"),
    at: new Date().toISOString(),
    actor: "me",
    actorName: state.profile.name,
    readAt: null,
  };
  // Keep the log bounded; localStorage is not a database.
  return [event, ...state.events].slice(0, 200);
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
        set((s) => ({
          groups: [group, ...s.groups],
          events: logged(s, { kind: "group-created", groupId: id, groupName: name, subject: name }),
        }));
        return id;
      },

      addMember: (groupId, member) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId ? { ...g, members: [...g.members, { ...member, id: uid("m") }] } : g,
          ),
          events: logged(s, {
            kind: "member-added",
            groupId,
            groupName: s.groups.find((g) => g.id === groupId)?.name ?? "a group",
            subject: `${member.name} to ${s.groups.find((g) => g.id === groupId)?.name ?? "a group"}`,
          }),
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

      setGroupPhoto: (groupId, photo) =>
        set((s) => ({
          groups: s.groups.map((g) => (g.id === groupId ? { ...g, photo } : g)),
        })),

      setArchived: (groupId, archived) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId ? { ...g, archivedAt: archived ? new Date().toISOString() : null } : g,
          ),
          events: logged(s, {
            kind: archived ? "group-archived" : "group-unarchived",
            groupId,
            groupName: s.groups.find((g) => g.id === groupId)?.name ?? "a group",
            subject: s.groups.find((g) => g.id === groupId)?.name ?? "a group",
          }),
        })),

      // Expenses and settlements point at a group, so they go with it rather
      // than lingering as orphans the activity feed would still try to read.
      deleteGroup: (groupId) =>
        set((s) => {
          const name = s.groups.find((g) => g.id === groupId)?.name ?? "a group";
          return {
            groups: s.groups.filter((g) => g.id !== groupId),
            expenses: s.expenses.filter((e) => e.groupId !== groupId),
            settlements: s.settlements.filter((x) => x.groupId !== groupId),
            // No groupId: the group is gone, so nothing to link back to.
            events: logged(s, { kind: "group-deleted", groupName: name, subject: name }),
          };
        }),

      addExpense: (expense) => {
        const id = uid("e");
        set((s) => ({
          expenses: [{ ...expense, id, createdAt: new Date().toISOString() }, ...s.expenses],
          events: logged(s, {
            kind: "expense-added",
            groupId: expense.groupId,
            groupName: s.groups.find((g) => g.id === expense.groupId)?.name ?? "a group",
            subject: expense.description,
            amount: { minor: expense.baseAmount + expense.fee.amount, currency: expense.original.currency },
          }),
        }));
        return id;
      },

      deleteExpense: (id) =>
        set((s) => {
          const gone = s.expenses.find((e) => e.id === id);
          return {
            expenses: s.expenses.filter((e) => e.id !== id),
            events: gone
              ? logged(s, {
                  kind: "expense-deleted",
                  groupId: gone.groupId,
                  groupName: s.groups.find((g) => g.id === gone.groupId)?.name ?? "a group",
                  subject: gone.description,
                })
              : s.events,
          };
        }),

      addSettlement: (settlement) =>
        set((s) => {
          const group = s.groups.find((g) => g.id === settlement.groupId);
          return {
            settlements: [{ ...settlement, id: uid("s") }, ...s.settlements],
            events: logged(s, {
              kind: "settlement-added",
              groupId: settlement.groupId,
              groupName: group?.name ?? "a group",
              subject: `${displayName(group, settlement.from)} to ${displayName(group, settlement.to)}`,
              amount: { minor: settlement.amount, currency: group?.baseCurrency ?? "" },
            }),
          };
        }),

      deleteSettlement: (id) =>
        set((s) => {
          const gone = s.settlements.find((x) => x.id === id);
          const group = gone && s.groups.find((g) => g.id === gone.groupId);
          return {
            settlements: s.settlements.filter((x) => x.id !== id),
            events: gone
              ? logged(s, {
                  kind: "settlement-deleted",
                  groupId: gone.groupId,
                  groupName: group?.name ?? "a group",
                  subject: `${displayName(group || undefined, gone.from)} to ${displayName(group || undefined, gone.to)}`,
                  amount: { minor: gone.amount, currency: group?.baseCurrency ?? "" },
                })
              : s.events,
          };
        }),

      markEventsRead: () =>
        set((s) => {
          const at = new Date().toISOString();
          return { events: s.events.map((e) => (e.readAt ? e : { ...e, readAt: at })) };
        }),

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
    events: [] as AppEvent[],
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
