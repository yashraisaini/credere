"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { BackLink, Button, Field, Page, cx, inputClass, selectClass } from "@/components/ui";
import { CURRENCIES } from "@/lib/currencies";
import { PRESET_PLANS, describePlan } from "@/lib/fees";
import { useCredere } from "@/lib/store";

export default function SettingsPage() {
  const { profile, updateProfile, customPlans, addCustomPlan, removeCustomPlan, resetToDemo } = useCredere();
  const plans = [...PRESET_PLANS, ...customPlans];

  const [label, setLabel] = useState("");
  const [pct, setPct] = useState("");
  const [flat, setFlat] = useState("");

  const pctNum = Number(pct || 0);
  const flatNum = Number(flat || 0);
  const valid = label.trim() !== "" && pctNum >= 0 && pctNum < 20 && flatNum >= 0;

  return (
    <Page>
      <BackLink href="/">All groups</BackLink>
      <h1 className="mt-5 font-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.015em]">Settings</h1>

      <div className="mt-8 space-y-7">
        <Field label="Show my totals in" htmlFor="home">
          <select
            id="home"
            value={profile.homeCurrency}
            onChange={(e) => updateProfile({ homeCurrency: e.target.value })}
            className={selectClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}, {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Card I usually pay with" htmlFor="card" hint="Used for new groups. Change it per group under People.">
          <select
            id="card"
            value={profile.cardPlanId}
            onChange={(e) => updateProfile({ cardPlanId: e.target.value })}
            className={selectClass}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <section className="space-y-4">
          <h2 className="font-display text-[1.5rem]">Your cards</h2>
          <p className="text-sm text-mist">
            Add the exact cards your group uses, with the foreign transaction fee from the card&apos;s terms.
          </p>

          {customPlans.length > 0 && (
            <ul>
              {customPlans.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-rule py-3">
                  <div className="flex-1">
                    <p className="text-bone">{p.label}</p>
                    <p className="text-xs text-mist">{describePlan(p)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${p.label}`}
                    onClick={() => removeCustomPlan(p.id)}
                    className="grid size-9 place-items-center rounded-full text-mist hover:text-bone"
                  >
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="space-y-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--color-rule)]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              addCustomPlan({ label: label.trim(), kind: "credit", fxFeePct: pctNum, fxFlatFee: flatNum });
              setLabel("");
              setPct("");
              setFlat("");
            }}
          >
            <Field label="Card name" htmlFor="plan-label">
              <input
                id="plan-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. TD Aeroplan Visa"
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Foreign fee, %" htmlFor="plan-pct">
                <input
                  id="plan-pct"
                  inputMode="decimal"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="2.5"
                  className={cx(inputClass, "num")}
                />
              </Field>
              <Field label="Flat fee per purchase" htmlFor="plan-flat">
                <input
                  id="plan-flat"
                  inputMode="decimal"
                  value={flat}
                  onChange={(e) => setFlat(e.target.value)}
                  placeholder="0.00"
                  className={cx(inputClass, "num")}
                />
              </Field>
            </div>
            <Button type="submit" variant="quiet" disabled={!valid}>
              Add card
            </Button>
          </form>
        </section>

        <section className="space-y-3 pt-4">
          <h2 className="font-display text-[1.5rem]">Demo data</h2>
          <p className="text-sm text-mist">Everything is stored on this device for now.</p>
          <Button
            variant="quiet"
            onClick={() => {
              if (confirm("Replace everything on this device with the demo groups?")) resetToDemo();
            }}
          >
            Reset to demo data
          </Button>
        </section>
      </div>
    </Page>
  );
}
