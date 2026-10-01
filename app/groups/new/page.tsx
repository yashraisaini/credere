"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useState } from "react";
import { ActionBar, Avatar, BackLink, Button, Field, Page, Segmented, cx, inputClass, selectBase, selectClass } from "@/components/ui";
import { CURRENCIES } from "@/lib/currencies";
import { PRESET_PLANS } from "@/lib/fees";
import { useCredere } from "@/lib/store";
import type { FeePolicy } from "@/lib/types";

export default function NewGroupPage() {
  const router = useRouter();
  const { createGroup, profile, customPlans } = useCredere();
  const plans = [...PRESET_PLANS, ...customPlans];

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(profile.homeCurrency);
  const [feePolicy, setFeePolicy] = useState<FeePolicy>("split");
  const [people, setPeople] = useState<{ name: string; cardPlanId: string }[]>([]);
  const [draft, setDraft] = useState("");

  function addPerson() {
    const n = draft.trim();
    if (!n) return;
    setPeople((p) => [...p, { name: n, cardPlanId: "standard-credit" }]);
    setDraft("");
  }

  function create() {
    const id = createGroup({ name: name.trim(), baseCurrency: currency, feePolicy, members: people });
    router.push(`/groups/${id}`);
  }

  return (
    <Page>
      <BackLink href="/">All groups</BackLink>
      <h1 className="mt-5 font-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.015em]">New group</h1>

      <div className="mt-8 space-y-7">
        <Field label="Name" htmlFor="name">
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tokyo in May, Apartment 4B"
            className={inputClass}
          />
        </Field>

        <Field
          label="Settle in"
          htmlFor="currency"
          hint="Expenses in any currency get converted to this one at the live rate."
        >
          <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}, {c.name}
              </option>
            ))}
          </select>
        </Field>

        <section className="space-y-3">
          <h2 className="font-display text-[1.5rem]">People</h2>
          <ul>
            <li className="flex items-center gap-3 border-b border-rule py-3">
              <Avatar name="You" active />
              <span className="flex-1 text-bone">You</span>
            </li>
            {people.map((p, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-rule py-3">
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1 truncate text-bone">{p.name}</span>
                <label className="sr-only" htmlFor={`plan-${i}`}>
                  Card for {p.name}
                </label>
                <select
                  id={`plan-${i}`}
                  value={p.cardPlanId}
                  onChange={(e) =>
                    setPeople((list) => list.map((x, j) => (j === i ? { ...x, cardPlanId: e.target.value } : x)))
                  }
                  className={cx(selectBase, "h-10 w-[12rem] shrink-0 text-sm")}
                >
                  {plans.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => setPeople((list) => list.filter((_, j) => j !== i))}
                  className="grid size-9 place-items-center rounded-full text-mist hover:text-bone"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              addPerson();
            }}
          >
            <label htmlFor="person" className="sr-only">
              Name
            </label>
            <input
              id="person"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add someone by name"
              className={inputClass}
            />
            <Button type="submit" variant="quiet" disabled={!draft.trim()}>
              Add
            </Button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-[1.5rem]">Card fees</h2>
          <p className="text-sm text-mist">Who covers foreign transaction fees when someone pays abroad.</p>
          <Segmented<FeePolicy>
            label="Who covers card fees"
            value={feePolicy}
            onChange={setFeePolicy}
            options={[
              { value: "split", label: "Everyone in the expense" },
              { value: "payer", label: "Whoever paid" },
            ]}
          />
        </section>
      </div>

      <ActionBar>
        <Button block disabled={!name.trim()} onClick={create}>
          Create group
        </Button>
      </ActionBar>
    </Page>
  );
}
