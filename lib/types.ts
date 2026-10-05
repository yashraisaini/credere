/**
 * Core data model for Credere.
 *
 * All money is stored as integers in minor units (cents, pence, yen...)
 * to avoid floating point drift. See lib/money.ts.
 */

export type CurrencyCode = string; // ISO 4217, e.g. "CAD", "EUR", "JPY"

export interface Profile {
  id: "me";
  name: string;
  homeCurrency: CurrencyCode;
  cardPlanId: string;
}

export interface Member {
  id: string;
  name: string;
  /** Card the member usually pays with. Drives foreign transaction fees. */
  cardPlanId: string;
  /** Optional, for nudging them in Messages. Stays on this device. */
  phone?: string;
}

export type FeePolicy = "split" | "payer";

/**
 * Cover photo for a group. We store the Unsplash URL rather than a copy of the
 * image: their API terms ask that photos stay hotlinked, and it keeps
 * localStorage small (a base64 photo would blow the quota in a few groups).
 */
export interface GroupPhoto {
  /** Unsplash photo id. */
  id: string;
  /** Hotlinked image URL, sized by the `w` param at render time. */
  url: string;
  /** Unsplash's dominant colour, painted under the image so cards never flash black. */
  color: string;
  alt: string;
  /** Unsplash requires crediting the photographer with a link back to them. */
  credit: { name: string; link: string };
  /** The term that found it, so we don't re-search for a name that hasn't changed. */
  query: string;
}

export interface Group {
  id: string;
  name: string;
  /** Everything in the group settles in this currency. */
  baseCurrency: CurrencyCode;
  members: Member[];
  /** Whether card fees get shared by the people in the expense, or absorbed by whoever paid. */
  feePolicy: FeePolicy;
  /** Cover photo. Undefined means we haven't looked yet; null means the user cleared it. */
  photo?: GroupPhoto | null;
  createdAt: string;
}

export type SplitMethod = "equal" | "exact" | "percent" | "shares" | "itemized";

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  /** Line total in the receipt's currency, minor units. */
  amount: number;
  /** Member ids sharing this item. Empty means everyone in the expense. */
  assignedTo: string[];
}

export interface SplitInput {
  method: SplitMethod;
  /** Members included in the expense. */
  participants: string[];
  /**
   * exact: minor units per member (original currency)
   * percent: percentage per member (sums to 100)
   * shares: weight per member
   */
  values?: Record<string, number>;
  /** itemized only */
  items?: ReceiptItem[];
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  /** ISO date the expense happened */
  date: string;
  paidBy: string;

  /** What was actually charged, in the currency it was charged in. */
  original: { amount: number; currency: CurrencyCode };

  /** Rate locked in when the expense was saved: 1 original = rate base. */
  fx: { rate: number; source: string; asOf: string };

  /** Amount in the group's base currency, minor units, before fees. */
  baseAmount: number;

  fee: { planId: string; amount: number; policy: FeePolicy };

  split: SplitInput;

  /**
   * Final amount each member owes for this expense, in base minor units.
   * Locked at save time so history never changes when rates move.
   */
  shares: Record<string, number>;

  /** Optional receipt details from a scan */
  receipt?: { merchant?: string; tax?: number; tip?: number };

  createdAt: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  from: string;
  to: string;
  /** base minor units */
  amount: number;
  date: string;
}

export interface CardPlan {
  id: string;
  label: string;
  kind: "credit" | "debit" | "cash";
  /** Foreign transaction fee as a percentage, e.g. 2.5 */
  fxFeePct: number;
  /** Flat fee per foreign transaction, in major units of the group currency (e.g. 1.5) */
  fxFlatFee: number;
  note?: string;
}

/** What the receipt scanner returns (amounts already in minor units). */
export interface ScannedReceipt {
  merchant: string | null;
  date: string | null;
  currency: CurrencyCode | null;
  items: { name: string; quantity: number; amount: number }[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number;
}
