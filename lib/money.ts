import type { CurrencyCode } from "./types";

const decimalsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (CAD 2, JPY 0, KWD 3). */
export function decimalsFor(currency: CurrencyCode): number {
  const cached = decimalsCache.get(currency);
  if (cached !== undefined) return cached;
  let digits = 2;
  try {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  decimalsCache.set(currency, digits);
  return digits;
}

/** "12.34" -> 1234 (for a 2-decimal currency). Returns null if not a number. */
export function parseToMinor(input: string, currency: CurrencyCode): number | null {
  const cleaned = input.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10 ** decimalsFor(currency));
}

export function toMajor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** decimalsFor(currency);
}

export function fromMajor(major: number, currency: CurrencyCode): number {
  return Math.round(major * 10 ** decimalsFor(currency));
}

/**
 * Convert minor units between currencies.
 * rate = how many `to` major units one `from` major unit buys.
 */
export function convertMinor(
  minor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rate: number,
): number {
  if (from === to) return minor;
  return fromMajor(toMajor(minor, from) * rate, to);
}

export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  opts: { signed?: boolean; compact?: boolean } = {},
): string {
  const major = toMajor(minor, currency);
  const fmt = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    // en-CA keeps "$" for CAD and disambiguates others (US$, A$, MX$)
    currencyDisplay: "symbol",
    signDisplay: opts.signed ? "exceptZero" : "auto",
    notation: opts.compact ? "compact" : "standard",
  });
  // Typographic minus instead of a hyphen
  return fmt.format(major).replace("-", "\u2212");
}

/** Plain number for inputs: 1234 -> "12.34" */
export function minorToInput(minor: number, currency: CurrencyCode): string {
  return toMajor(minor, currency).toFixed(decimalsFor(currency));
}
