"use client";

import { useEffect, useState } from "react";
import type { CurrencyCode } from "./types";

export interface Rate {
  rate: number;
  asOf: string;
  source: string;
}

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: Promise<Rate> }>();

/** Fetch a live rate through our own API route (cached for 10 minutes in memory). */
export function getRate(from: CurrencyCode, to: CurrencyCode): Promise<Rate> {
  if (from === to) {
    return Promise.resolve({ rate: 1, asOf: new Date().toISOString(), source: "same currency" });
  }
  const key = `${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const value = fetch(`/api/rates?from=${from}&to=${to}`).then(async (res) => {
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Rate unavailable");
    return body as Rate;
  });
  value.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), value });
  return value;
}

type RateState =
  | { status: "loading"; rate?: undefined }
  | { status: "ready"; rate: Rate }
  | { status: "error"; error: string; rate?: undefined };

export function useRate(from: CurrencyCode, to: CurrencyCode): RateState {
  const [state, setState] = useState<RateState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    getRate(from, to)
      .then((rate) => alive && setState({ status: "ready", rate }))
      .catch((e: Error) => alive && setState({ status: "error", error: e.message }));
    return () => {
      alive = false;
    };
  }, [from, to]);

  return state;
}

/** Several rates at once, keyed "FROM:TO". Missing keys are still loading or failed. */
export function useRates(pairs: [CurrencyCode, CurrencyCode][]): Record<string, number> {
  const [rates, setRates] = useState<Record<string, number>>({});
  const signature = pairs.map(([a, b]) => `${a}:${b}`).sort().join(",");

  useEffect(() => {
    let alive = true;
    for (const [from, to] of pairs) {
      getRate(from, to)
        .then((r) => alive && setRates((prev) => ({ ...prev, [`${from}:${to}`]: r.rate })))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return rates;
}
