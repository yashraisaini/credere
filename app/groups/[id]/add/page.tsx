"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ReceiptScanner } from "@/components/ReceiptScanner";
import {
  ActionBar,
  Avatar,
  BackLink,
  Button,
  Field,
  Money,
  Notice,
  Page,
  Segmented,
  cx,
  inputBase,
  inputClass,
  selectBase,
} from "@/components/ui";
import { CURRENCIES } from "@/lib/currencies";
import { computeCardFee, describePlan, findPlan } from "@/lib/fees";
import { convertMinor, formatMoney, minorToInput, parseToMinor } from "@/lib/money";
import { takePendingReceipt } from "@/lib/pending-receipt";
import { useRate } from "@/lib/rates";
import { allocate, computeExpense } from "@/lib/split";
import { displayName, useCredere } from "@/lib/store";
import type { FeePolicy, Group, ReceiptItem, ScannedReceipt, SplitInput, SplitMethod } from "@/lib/types";

export default function AddExpensePage() {
  const { id } = useParams<{ id: string }>();
  const group = useCredere((s) => s.groups.find((g) => g.id === id));
  // Default to the currency of the group's most recent expense (usually the local one on a trip)
  const lastCurrency = useCredere(
    (s) =>
      s.expenses
        .filter((e) => e.groupId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
        ?.original.currency,
  );
  // Photo taken from the group screen's camera button, if any
  const [pendingFile] = useState(() => takePendingReceipt());

  if (!group) {
    return (
      <Page>
        <BackLink href="/">All groups</BackLink>
        <p className="mt-10 text-bone">This group doesn&apos;t exist on this device.</p>
      </Page>
    );
  }
  return (
    <ExpenseForm group={group} startCurrency={lastCurrency ?? group.baseCurrency} pendingFile={pendingFile} />
  );
}

function ExpenseForm({
  group,
  startCurrency,
  pendingFile,
}: {
  group: Group;
  startCurrency: string;
  pendingFile: File | null;
}) {
  const router = useRouter();
  const addExpense = useCredere((s) => s.addExpense);
  const customPlans = useCredere((s) => s.customPlans);
  const base = group.baseCurrency;
  const everyone = group.members.map((m) => m.id);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(startCurrency);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState("me");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [participants, setParticipants] = useState<string[]>(everyone);
  const [values, setValues] = useState<Record<string, string>>({});
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [receiptMeta, setReceiptMeta] = useState<{ merchant?: string; tax?: number; tip?: number }>();
  const [feePolicy, setFeePolicy] = useState<FeePolicy>(group.feePolicy);
  const [manualRate, setManualRate] = useState("");

  /* ---------- derived ---------- */

  const total = parseToMinor(amount, currency) ?? 0;
  const rateState = useRate(currency, base);
  const manual = Number(manualRate);
  const rate =
    currency === base
      ? 1
      : manual > 0
        ? manual
        : rateState.status === "ready"
          ? rateState.rate.rate
          : null;

  const baseAmount = rate ? convertMinor(total, currency, base, rate) : 0;
  const payer = group.members.find((m) => m.id === paidBy) ?? group.members[0];
  const plan = findPlan(payer.cardPlanId, customPlans);
  const fee = rate ? computeCardFee({ baseAmount, purchaseCurrency: currency, billingCurrency: base, plan }) : 0;

  const split: SplitInput = useMemo(() => {
    const num = (p: string, fallback: number) => {
      const n = Number(values[p]);
      return Number.isFinite(n) && values[p] !== undefined && values[p] !== "" ? n : fallback;
    };
    switch (method) {
      case "exact":
        return {
          method,
          participants,
          values: Object.fromEntries(participants.map((p) => [p, parseToMinor(values[p] ?? "", currency) ?? 0])),
        };
      case "percent":
        return { method, participants, values: Object.fromEntries(participants.map((p) => [p, num(p, 0)])) };
      case "shares":
        return { method, participants, values: Object.fromEntries(participants.map((p) => [p, num(p, 1)])) };
      case "itemized":
        return { method, participants, items };
      default:
        return { method: "equal", participants };
    }
  }, [method, participants, values, items, currency]);

  const math =
    rate && total > 0
      ? computeExpense({ total, currency, baseCurrency: base, rate, split, feeAmount: fee, feePolicy })
      : null;

  const itemsTotal = items.reduce((a, i) => a + i.amount, 0);
  const extras = total - itemsTotal;

  /* ---------- actions ---------- */

  function applyReceipt(r: ScannedReceipt) {
    const cur = r.currency ?? currency;
    setCurrency(cur);
    setAmount(minorToInput(r.total, cur));
    if (r.merchant) setDescription((d) => d || r.merchant!);
    if (r.date) setDate(r.date);
    setReceiptMeta({ merchant: r.merchant ?? undefined, tax: r.tax ?? undefined, tip: r.tip ?? undefined });
    if (r.items.length > 0) {
      setItems(
        r.items.map((it, i) => ({
          id: `r${i}`,
          name: it.name,
          quantity: it.quantity,
          amount: it.amount,
          assignedTo: [],
        })),
      );
      setMethod("itemized");
    }
  }

  function changeMethod(next: SplitMethod) {
    setMethod(next);
    if (next === "percent") {
      const parts = allocate(100, participants.map(() => 1));
      setValues(Object.fromEntries(participants.map((p, i) => [p, String(parts[i])])));
    } else if (next === "shares") {
      setValues(Object.fromEntries(participants.map((p) => [p, "1"])));
    } else if (next === "exact") {
      const parts = allocate(total, participants.map(() => 1));
      setValues(Object.fromEntries(participants.map((p, i) => [p, total ? minorToInput(parts[i], currency) : ""])));
    }
  }

  function toggleParticipant(memberId: string) {
    setParticipants((ps) =>
      ps.includes(memberId)
        ? ps.length > 1
          ? ps.filter((p) => p !== memberId)
          : ps
        : everyone.filter((m) => ps.includes(m) || m === memberId),
    );
  }

  function toggleItemPerson(itemId: string, memberId: string) {
    setItems((list) =>
      list.map((item) => {
        if (item.id !== itemId) return item;
        const effective = item.assignedTo.length ? item.assignedTo : participants;
        const next = effective.includes(memberId)
          ? effective.filter((m) => m !== memberId)
          : participants.filter((m) => effective.includes(m) || m === memberId);
        if (next.length === 0) return item; // someone has to pay for it
        return { ...item, assignedTo: next.length === participants.length ? [] : next };
      }),
    );
  }

  function save() {
    if (!math?.ok || !rate) return;
    addExpense({
      groupId: group.id,
      description: description.trim() || receiptMeta?.merchant || "Expense",
      date,
      paidBy,
      original: { amount: total, currency },
      fx: {
        rate,
        source: currency === base ? "same currency" : manual > 0 ? "entered by hand" : rateState.rate?.source ?? "live",
        asOf: rateState.rate?.asOf ?? date,
      },
      baseAmount: math.baseAmount,
      fee: { planId: plan.id, amount: fee, policy: feePolicy },
      split,
      shares: math.shares,
      receipt: receiptMeta,
    });
    router.push(`/groups/${group.id}`);
  }

  const name = (id: string) => displayName(group, id);
  const possessive = (id: string) => (id === "me" ? "Your" : `${name(id)}'s`);
  const currencyOptions = CURRENCIES.some((c) => c.code === currency)
    ? CURRENCIES
    : [{ code: currency, name: currency }, ...CURRENCIES];

  /* ---------- view ---------- */

  return (
    <Page>
      <BackLink href={`/groups/${group.id}`}>{group.name}</BackLink>
      <h1 className="mt-5 font-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.015em]">
        New expense
      </h1>

      <div className="mt-8 space-y-7">
        <ReceiptScanner hintCurrency={currency} initialFile={pendingFile} onScanned={applyReceipt} />

        <Field label="What was it" htmlFor="desc">
          <input
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dinner, tickets, groceries"
            className={inputClass}
          />
        </Field>

        <Field
          label="Amount"
          htmlFor="amount"
          hint={
            currency === base ? null : manual > 0 ? (
              <span className="num">
                {formatMoney(baseAmount, base)} at your rate of {manual}
              </span>
            ) : rateState.status === "ready" ? (
              <span className="num">
                {formatMoney(baseAmount, base)} at 1 {currency} = {rateState.rate.rate.toFixed(4)} {base}
              </span>
            ) : rateState.status === "loading" ? (
              "Getting today's rate"
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                No live rate right now. Enter one to keep going:
                <input
                  aria-label={`${base} per ${currency}`}
                  inputMode="decimal"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  placeholder={`${base} per 1 ${currency}`}
                  className={cx(inputBase, "h-9 w-40 text-sm")}
                />
              </span>
            )
          }
        >
          <div className="flex gap-2">
            <input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={cx(inputBase, "num min-w-0 flex-1 font-display text-[1.375rem]")}
            />
            <label htmlFor="currency" className="sr-only">
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={cx(selectBase, "w-[6.5rem] shrink-0")}
            >
              {currencyOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Paid by">
          <div role="radiogroup" aria-label="Paid by" className="flex flex-wrap gap-2">
            {group.members.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={paidBy === m.id}
                onClick={() => setPaidBy(m.id)}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-4 transition-colors",
                  paidBy === m.id
                    ? "bg-bottle text-bone shadow-[inset_0_0_0_1px_var(--color-engrave)]"
                    : "text-mist shadow-[inset_0_0_0_1px_var(--color-rule)] hover:text-bone",
                )}
              >
                <Avatar name={name(m.id)} size={30} active={paidBy === m.id} />
                {name(m.id)}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Date" htmlFor="date">
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <section className="space-y-4">
          <h2 className="font-display text-[1.5rem]">Split</h2>
          <Segmented<SplitMethod>
            label="Split method"
            value={method}
            onChange={changeMethod}
            options={[
              { value: "equal", label: "Equal" },
              { value: "exact", label: "Exact" },
              { value: "percent", label: "Percent" },
              { value: "shares", label: "Shares" },
              { value: "itemized", label: "By item", disabled: items.length === 0 },
            ]}
          />

          {method !== "itemized" && (
            <ul>
              {group.members.map((m) => {
                const included = participants.includes(m.id);
                const share = math?.ok ? math.shares[m.id] : undefined;
                return (
                  <li key={m.id} className="flex items-center gap-3 border-b border-rule py-3">
                    <button
                      type="button"
                      aria-pressed={included}
                      onClick={() => toggleParticipant(m.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar name={name(m.id)} active={included} />
                      <span className={included ? "text-bone" : "text-mist line-through decoration-rule"}>
                        {name(m.id)}
                      </span>
                    </button>
                    {method !== "equal" && included && (
                      <div className="flex items-center gap-1.5">
                        <input
                          aria-label={`${name(m.id)} ${method === "percent" ? "percent" : method === "shares" ? "shares" : "amount"}`}
                          inputMode="decimal"
                          value={values[m.id] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                          className={cx(inputBase, "num h-10 w-20 px-3 text-right text-sm")}
                        />
                        <span className="w-8 text-xs text-mist">
                          {method === "percent" ? "%" : method === "shares" ? "x" : currency}
                        </span>
                      </div>
                    )}
                    <span className="w-20 text-right text-sm">
                      {included && share !== undefined ? <Money minor={share} currency={base} /> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {method === "itemized" && (
            <div className="space-y-3">
              <ul className="space-y-3">
                {items.map((item) => {
                  const effective = item.assignedTo.length ? item.assignedTo : participants;
                  return (
                    <li key={item.id} className="rounded-2xl bg-vault p-4 shadow-[inset_0_0_0_1px_var(--color-rule)]">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-bone">
                          {item.quantity > 1 && <span className="num text-mist">{item.quantity} </span>}
                          {item.name}
                        </p>
                        <Money minor={item.amount} currency={currency} className="text-bone" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {participants.map((pid) => {
                          const on = effective.includes(pid);
                          return (
                            <button
                              key={pid}
                              type="button"
                              aria-pressed={on}
                              aria-label={`${name(pid)} shares ${item.name}`}
                              onClick={() => toggleItemPerson(item.id, pid)}
                              className={cx(
                                "flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-3 text-sm transition-colors",
                                on ? "text-bone" : "text-mist/70",
                              )}
                            >
                              <Avatar name={name(pid)} size={28} active={on} />
                              {name(pid)}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {extras !== 0 && total > 0 && (
                <Notice>
                  Items come to {formatMoney(itemsTotal, currency)}. The other{" "}
                  {formatMoney(Math.abs(extras), currency)}
                  {receiptMeta?.tax || receiptMeta?.tip ? " in tax and tip" : ""} is shared in proportion to
                  what each person had.
                </Notice>
              )}

              {math?.ok && (
                <dl className="space-y-2 pt-2">
                  {participants.map((pid) => (
                    <div key={pid} className="flex justify-between gap-4 border-b border-rule pb-2">
                      <dt className="text-mist">{name(pid)}</dt>
                      <dd>
                        <Money minor={math.shares[pid] ?? 0} currency={base} className="text-bone" />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </section>

        {currency !== base && rate && total > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-[1.5rem]">Card fee</h2>
            {fee > 0 ? (
              <>
                <p className="text-mist">
                  {possessive(paidBy)} {plan.label.toLowerCase()} charges {describePlan(plan).toLowerCase()}, so
                  this costs <Money minor={fee} currency={base} className="text-bone" /> more than the
                  receipt.
                </p>
                <Segmented<FeePolicy>
                  label="Who covers this fee"
                  value={feePolicy}
                  onChange={setFeePolicy}
                  options={[
                    { value: "split", label: "Split it" },
                    { value: "payer", label: paidBy === "me" ? "I'll cover it" : `${name(paidBy)} covers it` },
                  ]}
                />
              </>
            ) : (
              <p className="text-mist">
                {possessive(paidBy)} {plan.label.toLowerCase()} has no foreign fees, so nothing extra.
              </p>
            )}
          </section>
        )}

        {math && !math.ok && <Notice tone="error">{math.error}</Notice>}
      </div>

      <ActionBar>
        <Button block disabled={!math?.ok} onClick={save}>
          {math?.ok ? `Save ${formatMoney(math.payerCredit, base)} expense` : "Save expense"}
        </Button>
      </ActionBar>
    </Page>
  );
}
