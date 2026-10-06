# Credere
Yash x Yash fun build
Split costs with friends in any currency. Scan a receipt, assign items to people,
and see what everyone owes with live exchange rates and real card fees included.

## Run it

```bash
npm install
cp .env.example .env.local   # add your keys (see below)
npm run dev                  # http://localhost:3000
```

Live rates work without a key. Receipt scanning works without one too: with `GEMINI_API_KEY` set
(free, from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) it uses Gemini, and
without it falls back to OCR in your browser. It reads any photo the browser can open and iPhone
HEIC; PDF receipts need the model, since OCR reads pixels. Group cover photos
need `UNSPLASH_ACCESS_KEY` (free, from [unsplash.com/developers](https://unsplash.com/developers));
without it every group falls back to the engraved guilloche.
To try it on your phone, run `npm run dev -- -H 0.0.0.0` and open your laptop's
local IP on the same Wi-Fi, or deploy to Vercel (add the env var in project settings).

## What's in the base

| Feature | Where |
|---|---|
| Live conversion (ECB via Frankfurter, fallback to ExchangeRate-API for VND, AED, COP...) | `app/api/rates/route.ts`, `lib/rates.ts` |
| Receipt scanning with Claude vision, forced tool call for clean JSON | `app/api/receipt/route.ts`, `components/ReceiptScanner.tsx` |
| Split engine: equal, exact, percent, shares, by item (tax and tip spread proportionally) | `lib/split.ts` |
| Card fees per person (foreign fee %, flat fee), shared or covered by the payer | `lib/fees.ts` |
| Balances and settle-up suggestions | `lib/balances.ts` |
| Activity across every group, reached by tapping the card | `app/activity/page.tsx`, `lib/activity.ts` |
| Reminders into iMessage, the share sheet or the clipboard | `lib/remind.ts`, `components/Remind.tsx` |
| Card chip and contactless mark on the balance note | `components/Chip.tsx` |
| Green bloom under a press, guilloche drifting behind every screen | `components/Ripple.tsx`, `components/AppShell.tsx` |
| Local-first store with demo data | `lib/store.ts` |

### How the money math works

- Every amount is an integer in minor units (cents, yen) via `lib/money.ts`. No floats in the ledger.
- `allocate()` uses the largest remainder method, so splits always add up to the exact total.
- An expense is split in its original currency first, then the converted total (plus any shared
  card fee) is allocated using those shares as weights. The rate is locked when you save, so
  history doesn't change when rates move.
- Card fee = converted amount x the payer's foreign fee % + flat fee, only when the purchase
  currency differs from the group currency.

### Reminders

There's no server to send from, so a reminder is handed to whatever the phone
already has. A member with a phone number saved (People tab) gets an `sms:` link,
which opens iMessage on iOS with the text filled in; without one, the Web Share
sheet covers WhatsApp, Signal and the rest, and desktop falls back to the
clipboard. Phone numbers stay in localStorage on your device.

## Screens

- `/` balance across all groups and the group list
- `/activity` every expense and settlement that moved your balance, in your home currency
- `/groups/new` create a group, add people and their cards
- `/groups/[id]` expenses, balances with settle up, people and card fee policy
- `/groups/[id]/add` add or scan an expense
- `/settings` home currency, your card, custom cards

## Next steps

1. **Real accounts and invites.** Swap `lib/store.ts` for Supabase (auth, Postgres, realtime) so
   friends join by link and see the same group. Every write already goes through store actions.
2. **Per-person billing currency** for mixed-country groups (see the TODO in `lib/fees.ts`).
3. **Real bank card presets.** Extend `PRESET_PLANS` with actual cards and their published fees.
4. **Network rate spread.** Visa and Mastercard rates differ slightly from the ECB mid-market rate;
   add a spread field to `CardPlan` if you want to model it.
5. **Offline rates.** Cache the last known rate per currency so adding expenses works with no data abroad.
6. **PWA and push.** Add a manifest and service worker so it installs to the home screen,
   and so Credere can push a reminder to your own phone on a schedule. Today's reminders
   are outbound only: you tap, the phone's messaging app opens.
