"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useMemo } from "react";
import { BalanceNote } from "@/components/BalanceNote";
import { GroupCover } from "@/components/GroupCover";
import { useRipple } from "@/components/Ripple";
import { AvatarStack, Money, Page, SectionTitle } from "@/components/ui";
import { groupBalances } from "@/lib/balances";
import { convertMinor } from "@/lib/money";
import { useGroupPhoto } from "@/lib/photo";
import { useRates } from "@/lib/rates";
import { displayName, useCredere } from "@/lib/store";
import type { Group } from "@/lib/types";

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
          <ul className="mt-4 space-y-4">
            {yours.map(({ group, balance }) => (
              <GroupCard key={group.id} group={group} balance={balance} />
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

/** One group as a photo card, with the green bloom under a press. */
function GroupCard({ group, balance }: { group: Group; balance: number }) {
  const { onPointerDown, layer } = useRipple<HTMLAnchorElement>();
  const photo = useGroupPhoto(group);

  return (
    <li>
      <Link
        href={`/groups/${group.id}`}
        onPointerDown={onPointerDown}
        className="relative block aspect-[16/10] overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_var(--color-rule)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-engrave)]"
      >
        <GroupCover photo={photo} width={440} />

        {/* Scrim: keeps the name readable whatever the photo underneath does. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-ink from-10% via-ink/78 via-45% to-ink/25"
        />

        {layer}

        <div className="relative flex size-full flex-col justify-end p-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-display text-[1.6875rem] leading-[1.12] text-bone">
                {group.name}
              </h3>
              <div className="mt-2 flex items-center gap-3">
                <AvatarStack names={group.members.map((m) => displayName(group, m.id))} size={24} />
                <span className="text-sm text-bone/70">
                  {group.members.length} people, in {group.baseCurrency}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <Money minor={balance} currency={group.baseCurrency} signed tone="balance" />
              <p className="text-xs text-bone/60">
                {balance > 0 ? "owed to you" : balance < 0 ? "you owe" : "settled"}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
