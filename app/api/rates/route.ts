import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/rates?from=EUR&to=CAD
 * -> { rate: 1.4931, asOf: "2026-10-01", source: "ECB via Frankfurter" }
 *
 * Primary: Frankfurter (free, no key, ECB reference rates, ~30 currencies).
 * Fallback: open.er-api.com (free, no key, 160+ currencies) for things the
 * ECB doesn't publish, like VND, AED, COP, PEN, MAD, EGP.
 * Responses are cached for an hour by Next's fetch cache.
 */

const CODE = /^[A-Z]{3}$/;

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from")?.toUpperCase() ?? "";
  const to = req.nextUrl.searchParams.get("to")?.toUpperCase() ?? "";

  if (!CODE.test(from) || !CODE.test(to)) {
    return NextResponse.json({ error: "Use three-letter currency codes, like EUR and CAD." }, { status: 400 });
  }
  if (from === to) {
    return NextResponse.json({ rate: 1, asOf: new Date().toISOString(), source: "same currency" });
  }

  const primary = await fromFrankfurter(from, to);
  if (primary) return NextResponse.json(primary);

  const fallback = await fromOpenErApi(from, to);
  if (fallback) return NextResponse.json(fallback);

  return NextResponse.json(
    { error: `No live rate for ${from} to ${to} right now. Try again in a minute.` },
    { status: 502 },
  );
}

async function fromFrankfurter(from: string, to: string) {
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { date: string; rates: Record<string, number> };
    const rate = data.rates?.[to];
    if (typeof rate !== "number") return null;
    return { rate, asOf: data.date, source: "ECB via Frankfurter" };
  } catch {
    return null;
  }
}

async function fromOpenErApi(from: string, to: string) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result: string;
      time_last_update_utc?: string;
      rates?: Record<string, number>;
    };
    const rate = data.rates?.[to];
    if (data.result !== "success" || typeof rate !== "number") return null;
    const asOf = data.time_last_update_utc
      ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return { rate, asOf, source: "ExchangeRate-API" };
  } catch {
    return null;
  }
}
