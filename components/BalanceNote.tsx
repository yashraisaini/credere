"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Chip, Contactless } from "./Chip";
import { Guilloche } from "./Guilloche";
import { useRipple } from "./Ripple";
import { formatMoney } from "@/lib/money";

/**
 * The home screen's hero: your net position, printed like a banknote and
 * carried like a card. Tapping it opens everything that got you here.
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
  const { onPointerDown, layer } = useRipple<HTMLAnchorElement>();

  return (
    <section aria-label="Your balance">
      <Link
        href="/activity"
        onPointerDown={onPointerDown}
        className="group relative block overflow-hidden rounded-[20px] bg-note p-[7px] shadow-[0_30px_60px_-30px_rgb(15_61_46/0.9)] transition-transform duration-200 active:scale-[0.993]"
      >
        {layer}
        <div className="relative min-h-[13.5rem] overflow-hidden rounded-[14px] px-6 pb-6 pt-7 shadow-[inset_0_0_0_1px_rgb(63_122_97/0.45)]">
          <Guilloche className="pointer-events-none absolute -right-28 top-1/2 h-[23rem] w-[23rem] -translate-y-1/2 text-engrave" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[0.9375rem] text-sage/85">{headline}</p>
              <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
                <Chip width={40} className="drop-shadow-[0_1px_2px_rgb(0_0_0/0.45)]" />
                <Contactless size={19} className="text-sage/60" />
              </div>
            </div>

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

            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="text-xs text-mist">
                {pending
                  ? "Converting balances to " + currency + "…"
                  : `Across ${groupCount} ${groupCount === 1 ? "group" : "groups"}, shown in ${currency}`}
              </p>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-sage/80 transition-colors group-hover:text-sage">
                All activity
                <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
