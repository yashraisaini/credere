"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  ActionBar,
  Avatar,
  BackLink,
  Button,
  Money,
  Page,
  Segmented,
  inputBase,
  inputClass,
  selectBase,
  Notice,
  cx,
} from "@/components/ui";
import { RemindButton } from "@/components/Remind";
import { GroupCover, PhotoCredit } from "@/components/GroupCover";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ActionSheet } from "@/components/ActionSheet";
import { groupBalances, simplifyDebts } from "@/lib/balances";
import { groupSummaryText, reminderText } from "@/lib/remind";
import { PRESET_PLANS, describePlan, findPlan } from "@/lib/fees";
import { formatMoney } from "@/lib/money";
import { setPendingReceipt } from "@/lib/pending-receipt";
import { fetchPhoto, photoQuery, useGroupPhoto } from "@/lib/photo";
import { useRate } from "@/lib/rates";
import { displayName, useCredere } from "@/lib/store";
import type { Expense, Group } from "@/lib/types";

type Tab = "expenses" | "balances" | "people";

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const group = useCredere((s) => s.groups.find((g) => g.id === id));
  const allExpenses = useCredere((s) => s.expenses);
  const settlements = useCredere((s) => s.settlements);
  const [tab, setTab] = useState<Tab>("expenses");
  const fileRef = useRef<HTMLInputElement>(null);
  const photo = useGroupPhoto(group);
  const setArchived = useCredere((s) => s.setArchived);
  const deleteGroup = useCredere((s) => s.deleteGroup);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const expenses = useMemo(
    () =>
      allExpenses
        .filter((e) => e.groupId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [allExpenses, id],
  );

  if (!group) {
    return (
      <Page>
        <BackLink href="/">All groups</BackLink>
        <p className="mt-10 text-bone">This group doesn&apos;t exist on this device.</p>
      </Page>
    );
  }

  const others = group.members.filter((m) => m.id !== "me").map((m) => m.name);
  const who =
    others.length === 0
      ? "Just you so far"
      : others.length === 1
        ? `You and ${others[0]}`
        : `You, ${others.slice(0, -1).join(", ")} and ${others.at(-1)}`;

  const lastForeign = expenses.find((e) => e.original.currency !== group.baseCurrency)?.original.currency;

  return (
    <Page>
      <div className="flex items-center justify-between gap-2">
        <BackLink href="/">All groups</BackLink>
        <button
          type="button"
          aria-label="Group options"
          onClick={() => setMenuOpen(true)}
          className="-mr-2 grid size-10 place-items-center rounded-full text-mist transition-colors hover:text-bone"
        >
          <MoreHorizontal size={20} strokeWidth={1.75} />
        </button>
      </div>

      <header className="mt-4">
        {/* Full bleed: the photo runs past the page gutter to the screen edges. */}
        <div className="relative -mx-5 aspect-[16/9] overflow-hidden">
          <GroupCover photo={photo} width={480} />
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-ink from-8% via-ink/60 via-60% to-ink/15"
          />
          <div className="relative flex size-full items-end px-5 pb-4">
            <h1 className="font-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.015em]">
              {group.name}
            </h1>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-mist">{who}</p>
          {group.archivedAt && (
            <span className="rounded-full px-2 py-0.5 text-xs text-mist shadow-[inset_0_0_0_1px_var(--color-rule)]">
              Archived
            </span>
          )}
        </div>
        {lastForeign && <LiveRate from={lastForeign} to={group.baseCurrency} />}
      </header>

      <div className="mt-8">
        <Segmented<Tab>
          label="Group view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "expenses", label: "Expenses" },
            { value: "balances", label: "Balances" },
            { value: "people", label: "People" },
          ]}
        />
      </div>

      <div className="mt-6">
        {tab === "expenses" && <ExpenseList group={group} expenses={expenses} />}
        {tab === "balances" && (
          <Balances group={group} balances={groupBalances(group, expenses, settlements)} />
        )}
        {tab === "people" && <People group={group} />}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setPendingReceipt(file);
          router.push(`/groups/${group.id}/add`);
        }}
      />
      <ActionBar>
        <Button variant="quiet" className="flex-1" onClick={() => fileRef.current?.click()}>
          <Camera size={18} strokeWidth={1.5} aria-hidden />
          Scan receipt
        </Button>
        <Link
          href={`/groups/${group.id}/add`}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-bottle text-[0.9375rem] font-medium text-bone shadow-[inset_0_0_0_1px_rgb(63_122_97/0.55)] transition-colors hover:bg-bottle-hi"
        >
          <Plus size={18} strokeWidth={1.75} aria-hidden />
          Add expense
        </Link>
      </ActionBar>

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={group.name}
        subtitle={`${group.members.length} people · ${group.baseCurrency}`}
        actions={[
          {
            label: group.archivedAt ? "Unarchive" : "Archive",
            hint: group.archivedAt
              ? "Move it back up with your active groups"
              : "Tidy it to the bottom of the home screen, keeping everything",
            onSelect: () => setArchived(group.id, !group.archivedAt),
          },
          {
            label: "Delete group",
            hint: "Removes its expenses and settlements too",
            tone: "danger",
            onSelect: () => setConfirmDelete(true),
          },
        ]}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteGroup(group.id);
          router.push("/");
        }}
        title={`Delete ${group.name}?`}
        confirmLabel="Delete group"
      >
        <p>
          {expenses.length === 0
            ? "This group has no expenses recorded."
            : `Its ${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} will be deleted too, along with any settlements, and will stop appearing in your activity.`}
        </p>
        <p className="mt-2">
          This can&apos;t be undone. If you only want it out of the way, archive it instead.
        </p>
      </ConfirmDialog>
    </Page>
  );
}

function LiveRate({ from, to }: { from: string; to: string }) {
  const state = useRate(from, to);
  if (state.status !== "ready") return null;
  return (
    <p className="num mt-1 text-sm text-mist">
      1 {from} is {state.rate.rate.toFixed(4)} {to} today
    </p>
  );
}

/* ---------------------------------- Expenses ---------------------------------- */

function ExpenseList({ group, expenses }: { group: Group; expenses: Expense[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (expenses.length === 0) {
    return (
      <p className="py-8 text-mist">
        Nothing here yet. Scan a receipt or add the first expense below.
      </p>
    );
  }

  const byDate = new Map<string, Expense[]>();
  for (const e of expenses) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <div className="space-y-8">
      {[...byDate.entries()].map(([date, list]) => (
        <section key={date}>
          <h3 className="text-sm text-mist">{formatDate(date)}</h3>
          <ul className="mt-1">
            {list.map((e) => (
              <ExpenseRow
                key={e.id}
                group={group}
                expense={e}
                open={open === e.id}
                onToggle={() => setOpen(open === e.id ? null : e.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ExpenseRow({
  group,
  expense: e,
  open,
  onToggle,
}: {
  group: Group;
  expense: Expense;
  open: boolean;
  onToggle: () => void;
}) {
  const deleteExpense = useCredere((s) => s.deleteExpense);
  const customPlans = useCredere((s) => s.customPlans);
  const base = group.baseCurrency;
  const total = Object.values(e.shares).reduce((a, b) => a + b, 0);
  const yourShare = e.shares["me"] ?? 0;
  const foreign = e.original.currency !== base;
  const payer = displayName(group, e.paidBy);

  let position: { text: string; minor: number; tone: string };
  if (e.paidBy === "me") position = { text: "you lent", minor: total - yourShare, tone: "text-sage" };
  else if (yourShare > 0) position = { text: "you owe", minor: yourShare, tone: "text-rose" };
  else position = { text: "not involved", minor: 0, tone: "text-mist" };

  return (
    <li className="border-b border-rule">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-bone">{e.description}</p>
          <p className="mt-0.5 text-sm text-mist">
            {payer} paid
            {foreign && (
              <>
                {" "}
                <span className="num">{formatMoney(e.original.amount, e.original.currency)}</span>
              </>
            )}
            {e.split.method === "itemized" && ", split by item"}
          </p>
        </div>
        <div className="text-right">
          <Money minor={total} currency={base} className="text-bone" />
          <p className={cx("text-xs", position.tone)}>
            {position.text}
            {position.minor !== 0 && <> {formatMoney(position.minor, base)}</>}
          </p>
        </div>
      </button>

      {open && (
        <div className="space-y-4 pb-5">
          <dl className="space-y-2 rounded-2xl bg-vault p-4 text-sm shadow-[inset_0_0_0_1px_var(--color-rule)]">
            {Object.entries(e.shares).map(([memberId, share]) => (
              <div key={memberId} className="flex justify-between gap-4">
                <dt className="text-mist">{displayName(group, memberId)}</dt>
                <dd className="num text-bone">{formatMoney(share, base)}</dd>
              </div>
            ))}
            {foreign && (
              <div className="flex justify-between gap-4 border-t border-rule pt-2">
                <dt className="text-mist">Rate used</dt>
                <dd className="num text-bone">
                  1 {e.original.currency} = {e.fx.rate.toFixed(4)} {base}
                </dd>
              </div>
            )}
            {e.fee.amount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-mist">
                  Card fee, {findPlan(e.fee.planId, customPlans).label.toLowerCase()}
                </dt>
                <dd className="num text-bone">
                  {formatMoney(e.fee.amount, base)}
                  {e.fee.policy === "payer" && <span className="text-mist">, covered by {payer}</span>}
                </dd>
              </div>
            )}
          </dl>
          <Button variant="ghost" onClick={() => deleteExpense(e.id)} className="gap-1.5 text-sm">
            <Trash2 size={15} strokeWidth={1.5} aria-hidden />
            Delete expense
          </Button>
        </div>
      )}
    </li>
  );
}

/* ---------------------------------- Balances ---------------------------------- */

function Balances({ group, balances }: { group: Group; balances: Record<string, number> }) {
  const addSettlement = useCredere((s) => s.addSettlement);
  const transfers = simplifyDebts(balances);
  const base = group.baseCurrency;

  return (
    <div className="space-y-10">
      <ul>
        {group.members.map((m) => {
          const v = balances[m.id] ?? 0;
          return (
            <li key={m.id} className="flex items-center gap-4 border-b border-rule py-4">
              <Avatar name={displayName(group, m.id)} />
              <span className="flex-1 text-bone">{displayName(group, m.id)}</span>
              <div className="text-right">
                <Money minor={v} currency={base} signed tone="balance" />
                <p className="text-xs text-mist">{v > 0 ? "gets back" : v < 0 ? "owes" : "settled"}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <section>
        <h3 className="font-display text-[1.5rem]">Settle up</h3>
        {transfers.length === 0 ? (
          <p className="mt-2 text-mist">Everyone is square.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-mist">Pay these and everyone is square.</p>
            <ul className="mt-3">
              {transfers.map((t) => {
                const owesMe = t.to === "me";
                const debtor = group.members.find((m) => m.id === t.from);
                return (
                  <li key={`${t.from}-${t.to}`} className="border-b border-rule py-4">
                    <div className="flex items-center gap-4">
                      <p className="flex-1 text-bone">{describeTransfer(group, t.from, t.to)}</p>
                      <Money minor={t.amount} currency={base} className="text-bone" />
                    </div>
                    <div className="mt-3 flex items-start justify-end gap-2">
                      {owesMe && debtor && (
                        <RemindButton
                          phone={debtor.phone}
                          text={reminderText({
                            name: debtor.name,
                            amount: t.amount,
                            currency: base,
                            groupName: group.name,
                          })}
                        />
                      )}
                      <Button
                        variant="quiet"
                        className="h-9 px-4 text-sm"
                        onClick={() =>
                          addSettlement({
                            groupId: group.id,
                            from: t.from,
                            to: t.to,
                            amount: t.amount,
                            date: new Date().toISOString().slice(0, 10),
                          })
                        }
                      >
                        Mark paid
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6">
              <RemindButton
                block
                label="Message the group"
                text={groupSummaryText(group, balances)}
              />
              <p className="mt-2 text-xs text-mist">
                Opens Messages with the rundown. Add a phone number under People to text someone
                directly.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------- People ----------------------------------- */

function People({ group }: { group: Group }) {
  const { addMember, updateMember, setFeePolicy, customPlans } = useCredere();
  const [name, setName] = useState("");
  const plans = [...PRESET_PLANS, ...customPlans];

  return (
    <div className="space-y-10">
      <ul>
        {group.members.map((m) => {
          const plan = findPlan(m.cardPlanId, customPlans);
          return (
            <li key={m.id} className="border-b border-rule py-4">
              <div className="flex items-center gap-4">
                <Avatar name={displayName(group, m.id)} />
                <div className="min-w-0 flex-1">
                  <p className="text-bone">{displayName(group, m.id)}</p>
                  <p className="text-xs text-mist">{describePlan(plan)}</p>
                </div>
                <label className="sr-only" htmlFor={`plan-${m.id}`}>
                  Card for {displayName(group, m.id)}
                </label>
                <select
                  id={`plan-${m.id}`}
                  value={m.cardPlanId}
                  onChange={(e) => updateMember(group.id, m.id, { cardPlanId: e.target.value })}
                  className={cx(selectBase, "h-10 w-[12rem] shrink-0 text-sm")}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              {m.id !== "me" && (
                <div className="mt-3 flex items-center gap-3 pl-[3.25rem]">
                  <label className="sr-only" htmlFor={`phone-${m.id}`}>
                    Phone number for {m.name}
                  </label>
                  <input
                    id={`phone-${m.id}`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    value={m.phone ?? ""}
                    onChange={(e) => updateMember(group.id, m.id, { phone: e.target.value })}
                    placeholder="Phone, to text a reminder"
                    className={cx(inputBase, "h-10 w-full text-sm")}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addMember(group.id, { name: name.trim(), cardPlanId: "standard-credit" });
          setName("");
        }}
      >
        <label htmlFor="new-member" className="sr-only">
          Name
        </label>
        <input
          id="new-member"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add someone by name"
          className={inputClass}
        />
        <Button type="submit" variant="quiet" disabled={!name.trim()}>
          Add
        </Button>
      </form>

      <GroupPhotoSettings group={group} />

      <section className="space-y-3">
        <h3 className="font-display text-[1.5rem]">Card fees</h3>
        <p className="text-sm text-mist">
          When someone pays in another currency, their card may charge a fee. Choose who covers it.
        </p>
        <Segmented
          label="Who covers card fees"
          value={group.feePolicy}
          onChange={(v) => setFeePolicy(group.id, v)}
          options={[
            { value: "split", label: "Everyone in the expense" },
            { value: "payer", label: "Whoever paid" },
          ]}
        />
      </section>
    </div>
  );
}

/** Swap the cover photo for the next match, or drop back to the guilloche. */
function GroupPhotoSettings({ group }: { group: Group }) {
  const setGroupPhoto = useCredere((s) => s.setGroupPhoto);
  const photo = useGroupPhoto(group);
  const setArchived = useCredere((s) => s.setArchived);
  const deleteGroup = useCredere((s) => s.deleteGroup);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skip, setSkip] = useState(0);
  const [missed, setMissed] = useState(false);

  async function find(next: number) {
    setBusy(true);
    setMissed(false);
    const found = await fetchPhoto(photoQuery(group.name), next);
    if (found) {
      setGroupPhoto(group.id, found);
      setSkip(next);
    } else {
      setMissed(true);
    }
    setBusy(false);
  }

  return (
    <section className="space-y-3">
      <h3 className="font-display text-[1.5rem]">Cover photo</h3>

      {photo ? (
        <>
          <p className="text-sm text-mist">Found on Unsplash for &ldquo;{photo.query}&rdquo;.</p>
          <PhotoCredit photo={photo} />
          <div className="flex gap-3">
            <Button type="button" variant="quiet" onClick={() => find(skip + 1)} disabled={busy}>
              {busy ? "Looking…" : "Try another"}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setGroupPhoto(group.id, null)}>
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-mist">
            This group shows the engraved rosette. Photos are searched on Unsplash by the
            group&apos;s name.
          </p>
          {missed && (
            <Notice>
              Nothing came back for &ldquo;{photoQuery(group.name)}&rdquo;. Check that
              UNSPLASH_ACCESS_KEY is set in .env.local, or rename the group to something more
              searchable.
            </Notice>
          )}
          <Button type="button" variant="quiet" onClick={() => find(0)} disabled={busy}>
            {busy ? "Looking…" : "Find a photo"}
          </Button>
        </>
      )}
    </section>
  );
}

function describeTransfer(group: Group, from: string, to: string) {
  if (from === "me") return `You pay ${displayName(group, to)}`;
  if (to === "me") return `${displayName(group, from)} pays you`;
  return `${displayName(group, from)} pays ${displayName(group, to)}`;
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
}
