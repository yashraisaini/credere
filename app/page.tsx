"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useMemo } from "react";
import { BalanceNote } from "@/components/BalanceNote";
import { AvatarStack, Money, Page, SectionTitle } from "@/components/ui";
import { groupBalances } from "@/lib/balances";
import { convertMinor } from "@/lib/money";
import { useRates } from "@/lib/rates";
import { displayName, useCredere } from "@/lib/store";

export default function Home() {
  const { groups, expenses, settlements, profile } = useCredere();
  const home = profile.homeCurrency;

  const yours = useMemo(
    () =>
      groups.map((g) => ({
        group: g,
        balance: groupBalances(g, expenses, settlements)["me"] ?? 0,
      })),
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

  let owed = 0;
  let owe = 0;
  let pending = false;
  for (const { group, balance } of yours) {
    const rate = group.baseCurrency === home ? 1 : rates[`${group.baseCurrency}:${home}`];
    if (rate === undefined) {
      pending = true;
      continue;
    }
    const inHome = convertMinor(balance, group.baseCurrency, home, rate);
    if (inHome > 0) owed += inHome;
    else owe += -inHome;
  }

  return (
    <Page>
      <header className="mb-7 flex items-center justify-between">
        <h1 className="font-display text-[2rem] font-normal tracking-[-0.01em]">Credere</h1>
        <Link
          href="/settings"
          aria-label="Settings"
          className="grid size-10 place-items-center rounded-full text-mist transition-colors hover:text-bone"
        >
          <Settings2 size={20} strokeWidth={1.5} />
        </Link>
      </header>

      <BalanceNote
        net={owed - owe}
        owed={owed}
        owe={owe}
        currency={home}
        groupCount={groups.length}
        pending={pending}
      />

      <section className="mt-12">
        <SectionTitle
          action={
            <Link href="/groups/new" className="text-sm text-sage hover:text-bone">
              New group
            </Link>
          }
        >
          Groups
        </SectionTitle>

        {groups.length === 0 ? (
          <div className="mt-6 rounded-2xl p-6 shadow-[inset_0_0_0_1px_var(--color-rule)]">
            <p className="text-bone">Start a group for a trip, a house or a night out.</p>
            <Link href="/groups/new" className="mt-3 inline-block text-sm text-sage">
              Create your first group
            </Link>
          </div>
        ) : (
          <ul className="mt-3">
            {yours.map(({ group, balance }) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex items-center gap-4 border-b border-rule py-5 transition-colors hover:border-engrave/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.0625rem] text-bone">{group.name}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <AvatarStack names={group.members.map((m) => displayName(group, m.id))} size={24} />
                      <span className="text-sm text-mist">
                        {group.members.length} people, in {group.baseCurrency}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Money minor={balance} currency={group.baseCurrency} signed tone="balance" />
                    <p className="text-xs text-mist">
                      {balance > 0 ? "owed to you" : balance < 0 ? "you owe" : "settled"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
