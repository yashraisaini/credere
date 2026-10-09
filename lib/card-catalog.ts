/**
 * A reference list of real cards, searched by name when someone adds a card
 * in Settings, so typing "td aeroplan" offers the real thing instead of a
 * blank form.
 *
 * These are published, commonly-cited terms, not quotes pulled from a bank
 * account, and issuers change pricing without much notice. Picking an entry
 * fills the fee fields but leaves them editable, and `describePlan` already
 * shows the number back before it's saved - check it against the card's own
 * terms rather than trusting the list blindly. The 2.5% figure on ordinary
 * bank cards is the Visa/Mastercard-standard foreign exchange assessment,
 * not a number specific to that bank; only the 0% entries are a specific,
 * well-published claim (a card marketed as having no foreign transaction
 * fee), and those are the ones worth getting right.
 *
 * Some brands price differently by country (Amex Platinum waives the fee in
 * the US but not in Canada), so a dual-market card gets one entry per market
 * rather than one guessed-at number.
 */

export interface CardCatalogEntry {
  id: string;
  /** Shown in the list and used as the saved card's name when picked. */
  label: string;
  issuer: string;
  country: "CA" | "US";
  kind: "credit" | "debit";
  fxFeePct: number;
  fxFlatFee: number;
  /** Extra search terms beyond the label and issuer, e.g. a nickname. */
  aliases?: string[];
}

const CA = "CA" as const;
const US = "US" as const;

export const CARD_CATALOG: CardCatalogEntry[] = [
  // --- Cards that market themselves on waiving the foreign transaction fee ---
  { id: "scotia-passport", label: "Scotiabank Passport Visa Infinite", issuer: "Scotiabank", country: CA, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "rogers-world-elite", label: "Rogers World Elite Mastercard", issuer: "Rogers Bank", country: CA, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "rogers-red", label: "Rogers Red Mastercard", issuer: "Rogers Bank", country: CA, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "home-trust-preferred", label: "Home Trust Preferred Visa", issuer: "Home Trust", country: CA, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "brim-world-elite", label: "Brim World Elite Mastercard", issuer: "Brim Financial", country: CA, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "eq-bank-card", label: "EQ Bank Card", issuer: "EQ Bank", country: CA, kind: "debit", fxFeePct: 0, fxFlatFee: 0, aliases: ["eq bank debit"] },
  { id: "koho", label: "KOHO Card", issuer: "KOHO", country: CA, kind: "debit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "wise-ca", label: "Wise Card", issuer: "Wise", country: CA, kind: "debit", fxFeePct: 0, fxFlatFee: 0, aliases: ["transferwise"] },

  { id: "chase-sapphire-preferred", label: "Chase Sapphire Preferred", issuer: "Chase", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "chase-sapphire-reserve", label: "Chase Sapphire Reserve", issuer: "Chase", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "capital-one-venture", label: "Capital One Venture Rewards", issuer: "Capital One", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "capital-one-venture-one", label: "Capital One VentureOne", issuer: "Capital One", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "capital-one-quicksilver", label: "Capital One Quicksilver", issuer: "Capital One", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "discover-it", label: "Discover it Cash Back", issuer: "Discover", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "citi-premier", label: "Citi Premier", issuer: "Citi", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "boa-travel-rewards", label: "Bank of America Travel Rewards", issuer: "Bank of America", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "wells-fargo-autograph", label: "Wells Fargo Autograph", issuer: "Wells Fargo", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0 },
  { id: "amex-platinum-us", label: "American Express Platinum (US)", issuer: "American Express", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0, aliases: ["amex platinum"] },
  { id: "amex-gold-us", label: "American Express Gold (US)", issuer: "American Express", country: US, kind: "credit", fxFeePct: 0, fxFlatFee: 0, aliases: ["amex gold"] },
  { id: "wise-us", label: "Wise Card", issuer: "Wise", country: US, kind: "debit", fxFeePct: 0, fxFlatFee: 0, aliases: ["transferwise"] },

  // --- Ordinary bank cards, at the standard Visa/Mastercard FX assessment ---
  { id: "td-aeroplan-infinite", label: "TD Aeroplan Visa Infinite", issuer: "TD", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0, aliases: ["td aeroplan"] },
  { id: "td-cash-back-infinite", label: "TD Cash Back Visa Infinite", issuer: "TD", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "td-first-class-infinite", label: "TD First Class Travel Visa Infinite", issuer: "TD", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "rbc-avion", label: "RBC Avion Visa Infinite", issuer: "RBC", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "rbc-cash-back", label: "RBC Cash Back Mastercard", issuer: "RBC", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "bmo-cashback-world-elite", label: "BMO CashBack World Elite Mastercard", issuer: "BMO", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "bmo-world-elite", label: "BMO World Elite Mastercard", issuer: "BMO", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "cibc-aventura", label: "CIBC Aventura Visa Infinite", issuer: "CIBC", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "cibc-dividend", label: "CIBC Dividend Visa Infinite", issuer: "CIBC", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "scotia-gold-amex", label: "Scotiabank Gold American Express", issuer: "Scotiabank", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "scotia-momentum", label: "Scotiabank Momentum Visa Infinite", issuer: "Scotiabank", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "amex-cobalt", label: "American Express Cobalt", issuer: "American Express", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "amex-gold-ca", label: "American Express Gold Rewards (Canada)", issuer: "American Express", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "amex-platinum-ca", label: "American Express Platinum (Canada)", issuer: "American Express", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "national-bank-platinum", label: "National Bank World Elite Mastercard", issuer: "National Bank", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "desjardins-odyssey", label: "Desjardins Odyssey Visa Infinite", issuer: "Desjardins", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "pc-financial-world-elite", label: "PC Financial World Elite Mastercard", issuer: "PC Financial", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "tangerine-money-back", label: "Tangerine Money-Back Credit Card", issuer: "Tangerine", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },
  { id: "simplii-cash-back", label: "Simplii Financial Cash Back Visa", issuer: "Simplii Financial", country: CA, kind: "credit", fxFeePct: 2.5, fxFlatFee: 0 },

  { id: "chase-freedom-unlimited", label: "Chase Freedom Unlimited", issuer: "Chase", country: US, kind: "credit", fxFeePct: 3, fxFlatFee: 0 },
  { id: "amex-blue-cash", label: "American Express Blue Cash Preferred", issuer: "American Express", country: US, kind: "credit", fxFeePct: 2.7, fxFlatFee: 0 },
  { id: "amex-delta-gold", label: "American Express Delta SkyMiles Gold", issuer: "American Express", country: US, kind: "credit", fxFeePct: 2.7, fxFlatFee: 0 },
  { id: "citi-double-cash", label: "Citi Double Cash", issuer: "Citi", country: US, kind: "credit", fxFeePct: 3, fxFlatFee: 0 },
];

/** Matches the user typed against this entry, ranked lowest-is-best, or null. */
function score(entry: CardCatalogEntry, tokens: string[]): number | null {
  const haystack = `${entry.label} ${entry.issuer} ${(entry.aliases ?? []).join(" ")}`.toLowerCase();
  let total = 0;
  for (const token of tokens) {
    const at = haystack.indexOf(token);
    if (at === -1) return null;
    // A match at the start of a word (not mid-word) ranks the entry higher.
    const atWordStart = at === 0 || haystack[at - 1] === " ";
    total += (atWordStart ? 0 : 50) + at;
  }
  return total;
}

/** Up to `limit` catalog entries matching every word of `query`, best first. */
export function searchCards(query: string, limit = 7): CardCatalogEntry[] {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  return CARD_CATALOG.map((entry) => ({ entry, s: score(entry, tokens) }))
    .filter((x): x is { entry: CardCatalogEntry; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map((x) => x.entry);
}
