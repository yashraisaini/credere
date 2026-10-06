# Credere: notes for Claude Code

Splitwise-style app for travel: live FX, receipt scanning, card fees. Next.js App Router,
TypeScript, Tailwind v4, Zustand (localStorage for now).

## Rules

- Money is always integer minor units. Use helpers in `lib/money.ts`; never do float math on amounts in components.
- Use `allocate()` from `lib/split.ts` whenever a total is divided, so cents always reconcile.
- All state changes go through actions in `lib/store.ts`. Components don't mutate data directly.
- Expenses lock `fx.rate`, `fee`, and `shares` at save time. Don't recompute history from live rates.
- The Gemini key is server-only. Receipt vision happens in `app/api/receipt/route.ts`, never the
  client. It is called over plain REST, on the free tier, so expect 429s under heavy use.
- The Unsplash key is server-only too. Group cover photos are searched in `app/api/photo/route.ts`.
  Store the URL, never a copy of the image: their terms want photos hotlinked, and base64 in
  localStorage would blow the quota. Always render `PhotoCredit` where a photo is shown, since
  crediting the photographer with a link back is a condition of their API.
- Run `npm run typecheck` after changes.

## Design

- Tokens live in `app/globals.css` under `@theme`: ink (true black page), vault (raised surfaces),
  bottle (primary green), engrave (lines, focus), sage (owed to you), rose (you owe), bone (text), mist (secondary).
- Bodoni Moda for display text and big numbers, Hanken Grotesk for UI. Use the `num` utility for amounts.
- Groups carry an Unsplash cover photo, shown as a photo card on the home screen and a full-bleed
  header on the group page. A group with no photo falls back to the guilloche, so both states are
  designed, not one broken. Everything else stays quiet: hairline rows on black, no all-caps
  labels, sentence case copy.
- Text over a photo always sits on a scrim (`bg-linear-to-t from-ink`), never straight on the image.
- Phone first. Main actions sit in `ActionBar` at the bottom.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
