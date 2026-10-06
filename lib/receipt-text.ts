import { fromMajor } from "./money";
import type { ScannedReceipt } from "./types";

/**
 * Turning the text off a receipt into figures.
 *
 * This is the offline path: no model, just the words OCR found and rules about
 * how receipts are laid out. It is deliberately a pure function of the text so
 * it can be tested without a browser or a network.
 *
 * It is worse than a vision model and is meant to be. The total is the figure
 * it tries hardest to get right, because that is the one the user would
 * otherwise have to type; items are best-effort, and the add-expense form
 * stays editable for when it guesses wrong.
 */

/** A number with cents, optionally signed and symbol-prefixed. */
const MONEY = /-?\s*[$€£¥₹]?\s*\d{1,3}(?:[ ,.]\d{3})*[.,]\d{2}(?![\d])|-?\s*[$€£¥₹]?\s*\d+[.,]\d{2}(?![\d])/g;

const SUBTOTAL = /sub\s*-?\s*total|subtotal/i;
const TOTAL = /\btotal\b|amount\s+due|balance\s+due|\btotaal\b|\bsumme\b|\btotale\b/i;
const TAX = /\btax\b|\bvat\b|\biva\b|\bgst\b|\bhst\b|\btps\b|\btvq\b|\bmwst\b|\btva\b/i;
const TIP = /\btip\b|gratuity|service\s*charge|servi[cç]o|\bcoperto\b/i;
/** Lines that carry a number but are never an item. */
const NOISE =
  /tip\s*guide|\bdate\b|\btime\b|\btable\b|\bserver\b|\bcashier\b|\btel\b|phone|signature|thank\s*you|\bcard\b|\bcash\b|\bchange\b|\bvisa\b|master|amex|multibanco|\bnif\b|\bvat\s*no\b|\breg\b|\border\b|\bcheck\s*#|\bauth\b|\bapproval\b|\*{3,}/i;

export interface ParsedReceipt extends ScannedReceipt {
  /** How the total was found, so the UI can say when it was a guess. */
  totalConfidence: "labelled" | "guessed" | "none";
}

export function parseReceiptText(text: string, hintCurrency?: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const currency = detectCurrency(text) ?? hintCurrency ?? null;
  const toMinor = (n: number) => fromMajor(n, currency ?? "USD");

  let subtotal: number | null = null;
  let tax: number | null = null;
  let tip: number | null = null;
  let total: number | null = null;
  let totalConfidence: ParsedReceipt["totalConfidence"] = "none";
  const items: ScannedReceipt["items"] = [];
  const allAmounts: number[] = [];

  for (const line of lines) {
    const amounts = amountsIn(line);
    if (amounts.length) allAmounts.push(...amounts);

    // The figure on a labelled line is the last one, so "2 x DRINK @ 2.99
    // 5.98" reports what was charged rather than the unit price.
    const last = amounts.length ? amounts[amounts.length - 1] : null;

    if (SUBTOTAL.test(line)) {
      if (last !== null) subtotal = last;
      continue;
    }
    // A tip guide prints percentages that are not the tip, and a blank
    // "TOTAL: ____" line on a card slip carries no figure at all.
    if (/tip\s*guide/i.test(line)) continue;

    if (TOTAL.test(line)) {
      if (last !== null) {
        total = last;
        totalConfidence = "labelled";
      }
      continue;
    }
    if (TAX.test(line)) {
      if (last !== null) tax = last;
      continue;
    }
    if (TIP.test(line)) {
      if (last !== null) tip = last;
      continue;
    }
    if (NOISE.test(line)) continue;

    const item = toItem(line, amounts);
    if (item) items.push({ ...item, amount: toMinor(item.amount) });
  }

  // No labelled total is common when the bottom of the receipt is cut off or
  // smudged. The largest figure on a receipt is almost always the total, so
  // offer it rather than nothing - the user sees it in an editable field.
  if (total === null && allAmounts.length) {
    total = Math.max(...allAmounts);
    totalConfidence = "guessed";
  }

  return {
    merchant: detectMerchant(lines),
    date: detectDate(text),
    currency,
    items,
    subtotal: subtotal === null ? null : toMinor(subtotal),
    tax: tax === null ? null : toMinor(tax),
    tip: tip === null ? null : toMinor(tip),
    total: total === null ? 0 : toMinor(total),
    totalConfidence,
  };
}

/** Every money-looking figure on a line, in order. */
function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const raw of line.match(MONEY) ?? []) {
    const n = toNumber(raw);
    if (n !== null) out.push(n);
  }
  return out;
}

/**
 * "1.234,56" and "1,234.56" both mean the same thing. Whichever separator
 * comes last is the decimal point; the rest are thousands separators.
 */
function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;
  const negative = cleaned.startsWith("-");
  const digits = cleaned.replace(/-/g, "");

  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");
  const cut = Math.max(lastDot, lastComma);
  if (cut === -1) return null;

  const whole = digits.slice(0, cut).replace(/[.,\s]/g, "");
  const frac = digits.slice(cut + 1);
  const n = Number(`${whole || "0"}.${frac}`);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** A purchased line: some words, then a price. */
function toItem(
  line: string,
  amounts: number[],
): { name: string; quantity: number; amount: number } | null {
  if (!amounts.length) return null;
  const amount = amounts[amounts.length - 1];
  if (amount === 0) return null;

  // Strip the trailing price and any "@ 2.99" unit price from the name.
  let name = line
    .replace(MONEY, " ")
    .replace(/@/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let quantity = 1;
  const qty = name.match(/^(\d{1,3})\s*[x×*]\s*/i);
  if (qty) {
    quantity = Number(qty[1]) || 1;
    name = name.slice(qty[0].length).trim();
  } else {
    // The other common layout is a trailing count: "SOFT DRINK 2".
    const trailing = name.match(/\s(\d{1,3})$/);
    if (trailing) {
      quantity = Number(trailing[1]) || 1;
      name = name.slice(0, trailing.index).trim();
    }
  }

  name = name.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9%)\]]+$/g, "").trim();
  // A line with no letters is a column of figures, not something anyone ate.
  if (name.length < 2 || !/[A-Za-z]/.test(name)) return null;

  return { name: name.slice(0, 80), quantity, amount };
}

function detectCurrency(text: string): string | null {
  if (/[€]|\bEUR\b/.test(text)) return "EUR";
  if (/[£]|\bGBP\b/.test(text)) return "GBP";
  if (/[¥]|\bJPY\b/.test(text)) return "JPY";
  if (/[₹]|\bINR\b/.test(text)) return "INR";
  const code = text.match(/\b(USD|CAD|AUD|NZD|CHF|SEK|NOK|DKK|PLN|CZK|MXN|BRL|ZAR|SGD|HKD|THB)\b/);
  if (code) return code[1];
  if (/\$/.test(text)) return "USD";
  return null;
}

/** The shop name is near the top, in words, before any prices. */
function detectMerchant(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    if (amountsIn(line).length) continue;
    if (NOISE.test(line)) continue;
    const letters = line.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 3) return line.slice(0, 60);
  }
  return null;
}

function detectDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return pad(iso[1], iso[2], iso[3]);

  // Day/month order is ambiguous; a value over 12 settles it, otherwise
  // assume the US order, which is what prints "03/18/2026".
  const slashed = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (slashed) {
    const a = Number(slashed[1]);
    const b = Number(slashed[2]);
    return a > 12 ? pad(slashed[3], String(b), String(a)) : pad(slashed[3], String(a), String(b));
  }
  return null;
}

function pad(y: string, m: string, d: string): string | null {
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
