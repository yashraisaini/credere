"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BackLink, Money, Page } from "@/components/ui";
import { buildActivity, byMonth, dayLabel } from "@/lib/activity";
import { convertMinor, formatMoney } from "@/lib/money";
import { useRates } from "@/lib/rates";
import { displayName, useCredere } from "@/lib/store";
import type { ActivityEntry } from "@/lib/activity";

/**
 * Everything that moved your balance, newest first, in your home currency.
 * Reached by tapping the note on the home screen.
 */
export default function ActivityPage() {
  const { groups, expenses, settlements, profile } = useCredere();
  const home = profile.homeCurrency;

  const entries = useMemo(
    () => buildActivity(groups, expenses, settlements),
    [groups, expenses, settlements],
  );

  const pairs = useMemo(
    () =>
      Array.from(new Set(groups.map((g) => g.baseCurrency).filter((c) => c !== home))).map(
        (c) => [c, home] as [string, string],
      ),
    [groups, home],
  );
  const rates = useRates(pairs);

  const rateFor = (currency: string) =>
    currency === home ? 1 : rates[`${currency}:${home}`];

  // Totals in home currency. Anything still waiting on a rate is left out and
  // flagged, rather than silently counted at the wrong number.
  let fronted = 0;
  let yourShare = 0;
  let settled = 0;
  let pending = false;

  for (const group of groups) {
    const rate = rateFor(group.baseCurrency);
    if (rate === undefined) {
      pending = true;
      continue;
    }
    const into = (minor: number) => convertMinor(minor, group.baseCurrency, home, rate);

    for (const e of expenses) {
      if (e.groupId !== group.id) continue;
      if (e.paidBy === "me") {
        fronted += into(Object.values(e.shares).reduce((a, b) => a + b, 0));
      }
      yourShare += into(e.shares["me"] ?? 0);
    }
    for (const s of settlements) {
      if (s.groupId !== group.id) continue;
      if (s.from === "me" || s.to === "me") settled += into(s.amount);
    }
  }

  const months = byMonth(entries);

  return (
    <Page>
      <BackLink href="/">Home</BackLink>

      <header className="mt-5">
        <h1 className="font-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.015em]">
          Your activity
        </h1>
        <p className="mt-3 text-mist">
          {entries.length === 0
            ? "Nothing yet."
            : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} across ${groups.length} ${
                groups.length === 1 ? "group" : "groups"
              }`}
        </p>
      </header>

      <dl className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-rule shadow-[0_0_0_1px_var(--color-rule)]">
        <Stat label="You fronted" value={formatMoney(fronted, home)} />
        <Stat label="Your share" value={formatMoney(yourShare, home)} />
        <Stat label="Settled" value={formatMoney(settled, home)} />
      </dl>
      {pending && (
        <p className="mt-3 text-xs text-mist">Converting some groups to {home}&hellip;</p>
      )}

      {months.length === 0 ? (
        <p className="mt-10 text-bone">
          Add an expense and it&apos;ll show up here.{" "}
          <Link href="/" className="text-sage">
            Pick a group
          </Link>
          .
        </p>
      ) : (
        <div className="mt-10 space-y-9">
          {months.map(({ label, entries: group }) => (
            <section key={label}>
              <h2 className="text-sm text-mist">{label}</h2>
              <ul className="mt-2">
                {group.map((entry) => (
                  <Row key={`${entry.kind}-${entry.id}`} entry={entry} home={home} rate={rateFor(entry.group.baseCurrency)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink px-3 py-4">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="num mt-1 text-[0.9375rem] text-bone">{value}</dd>
    </div>
  );
}

function Row({
  entry,
  home,
  rate,
}: {
  entry: ActivityEntry;
  home: string;
  rate: number | undefined;
}) {
  const base = entry.group.baseCurrency;
  const inHome = rate === undefined ? undefined : convertMinor(entry.delta, base, home, rate);

  const title =
    entry.kind === "expense"
      ? entry.expense.description
      : settlementTitle(entry);

  const detail =
    entry.kind === "expense" && entry.expense.original.currency !== base
      ? `${entry.group.name} · ${formatMoney(entry.expense.original.amount, entry.expense.original.currency)}`
      : entry.group.name;

  return (
    <li>
      <Link
        href={`/groups/${entry.group.id}`}
        className="flex items-center gap-4 border-b border-rule py-4 transition-colors hover:border-engrave/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] text-bone">{title}</p>
          <p className="mt-1 truncate text-xs text-mist">
            {dayLabel(entry.date)} &middot; {detail}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {inHome === undefined ? (
            <span className="text-sm text-mist">&hellip;</span>
          ) : (
            <Money minor={inHome} currency={home} signed tone="balance" />
          )}
          <p className="text-xs text-mist">
            {entry.kind === "settlement"
              ? "settled"
              : entry.delta > 0
                ? "you paid"
                : entry.delta < 0
                  ? "your share"
                  : "no effect"}
          </p>
        </div>
      </Link>
    </li>
  );
}

function settlementTitle(entry: Extract<ActivityEntry, { kind: "settlement" }>): string {
  const { from, to } = entry.settlement;
  const fromName = displayName(entry.group, from);
  const toName = displayName(entry.group, to);
  if (from === "me") return `You paid ${toName}`;
  if (to === "me") return `${fromName} paid you`;
  return `${fromName} paid ${toName}`;
}
