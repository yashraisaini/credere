"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { forwardRef } from "react";
import { formatMoney } from "@/lib/money";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={cx(
        "mx-auto w-full max-w-[30rem] px-5 pb-40 pt-[calc(env(safe-area-inset-top)+1.25rem)]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm text-mist transition-colors hover:text-bone"
    >
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
      {children}
    </Link>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "ghost";
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", block, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.9375rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "bg-bottle text-bone shadow-[inset_0_0_0_1px_rgb(63_122_97/0.55)] hover:bg-bottle-hi",
        variant === "quiet" && "bg-transparent text-bone shadow-[inset_0_0_0_1px_var(--color-rule)] hover:shadow-[inset_0_0_0_1px_var(--color-engrave)]",
        variant === "ghost" && "h-auto px-0 text-mist hover:text-bone",
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
});

/** Fixed bar for the main action on a screen, clear of the phone's home indicator. */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-linear-to-t from-ink from-60% to-transparent pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8">
      <div className="mx-auto flex w-full max-w-[30rem] gap-3 px-5">{children}</div>
    </div>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({
  name,
  size = 36,
  active,
}: {
  name: string;
  size?: number;
  active?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium tracking-wide transition-colors",
        active
          ? "bg-bottle text-bone shadow-[inset_0_0_0_1px_var(--color-engrave)]"
          : "bg-vault text-mist shadow-[inset_0_0_0_1px_var(--color-rule)]",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, size = 26 }: { names: string[]; size?: number }) {
  const shown = names.slice(0, 4);
  return (
    <span className="flex -space-x-1.5">
      {shown.map((n, i) => (
        <span key={i} className="rounded-full ring-2 ring-ink">
          <Avatar name={n} size={size} />
        </span>
      ))}
    </span>
  );
}

/** Money with tabular figures. tone="balance" colours owed/owe. */
export function Money({
  minor,
  currency,
  signed,
  tone = "none",
  className,
}: {
  minor: number;
  currency: string;
  signed?: boolean;
  tone?: "none" | "balance";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "num whitespace-nowrap",
        tone === "balance" && minor > 0 && "text-sage",
        tone === "balance" && minor < 0 && "text-rose",
        tone === "balance" && minor === 0 && "text-mist",
        className,
      )}
    >
      {formatMoney(minor, currency, { signed })}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 overflow-x-auto rounded-full bg-vault p-1 shadow-[inset_0_0_0_1px_var(--color-rule)] [scrollbar-width:none]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-9 shrink-0 grow rounded-full px-2.5 text-[0.8125rem] transition-colors disabled:opacity-30 sm:px-3.5 sm:text-sm",
            value === o.value ? "bg-bottle text-bone" : "text-mist hover:text-bone",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm text-mist">
        {label}
      </label>
      {children}
      {hint && <div className="text-sm text-mist">{hint}</div>}
    </div>
  );
}

/** Input styling without a width, for places that set their own. */
export const inputBase =
  "h-12 rounded-xl bg-vault px-4 text-bone placeholder:text-mist/60 shadow-[inset_0_0_0_1px_var(--color-rule)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--color-engrave)]";
export const inputClass = `${inputBase} w-full`;

/** Native select with a custom caret (see .select-caret in globals.css). */
export const selectBase = `${inputBase} select-caret`;
export const selectClass = `${selectBase} w-full`;

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="font-display text-[1.75rem] leading-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Notice({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "error" }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cx("text-sm", tone === "error" ? "text-rose" : "text-mist")}
    >
      {children}
    </p>
  );
}
