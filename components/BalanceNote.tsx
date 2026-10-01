"use client";

import { Guilloche } from "./Guilloche";
import { formatMoney } from "@/lib/money";

/**
 * The home screen's hero: your net position, printed like a banknote.
 */
export function BalanceNote({
  net,
  owed,
  owe,
  currency,
  groupCount,
  pending,
}: {
  net: number;
  owed: number;
  owe: number;
  currency: string;
  groupCount: number;
  pending: boolean;
}) {
  const headline = net > 0 ? "You're owed" : net < 0 ? "You owe" : "You're all square";

  return (
    <section
      aria-label="Your balance"
      className="relative overflow-hidden rounded-[20px] bg-note p-[7px] shadow-[0_30px_60px_-30px_rgb(15_61_46/0.9)]"
    >
      <div className="relative min-h-[13.5rem] overflow-hidden rounded-[14px] px-6 pb-6 pt-7 shadow-[inset_0_0_0_1px_rgb(63_122_97/0.45)]">
        <Guilloche className="pointer-events-none absolute -right-28 top-1/2 h-[23rem] w-[23rem] -translate-y-1/2 text-engrave" />

        <div className="relative">
          <p className="text-[0.9375rem] text-sage/85">{headline}</p>
          <p className="num mt-1 font-display text-[3.75rem] font-medium leading-[0.95] tracking-[-0.02em] text-bone">
            {formatMoney(Math.abs(net), currency)}
          </p>

          <div className="mt-8 flex gap-6 text-sm">
            <p>
              <span className="block text-mist">Owed to you</span>
              <span className="num text-sage">{formatMoney(owed, currency)}</span>
            </p>
            <p>
              <span className="block text-mist">You owe</span>
              <span className="num text-rose">{formatMoney(owe, currency)}</span>
            </p>
          </div>

          <p className="mt-4 text-xs text-mist">
            {pending
              ? "Converting balances to " + currency + "…"
              : `Across ${groupCount} ${groupCount === 1 ? "group" : "groups"}, shown in ${currency}`}
          </p>
        </div>
      </div>
    </section>
  );
}
