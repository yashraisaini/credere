# Credere: notes for Claude Code

Splitwise-style app for travel: live FX, receipt scanning, card fees. Next.js App Router,
TypeScript, Tailwind v4, Zustand (localStorage for now), Anthropic SDK.

## Rules

- Money is always integer minor units. Use helpers in `lib/money.ts`; never do float math on amounts in components.
- Use `allocate()` from `lib/split.ts` whenever a total is divided, so cents always reconcile.
- All state changes go through actions in `lib/store.ts`. Components don't mutate data directly.
- Expenses lock `fx.rate`, `fee`, and `shares` at save time. Don't recompute history from live rates.
- The Anthropic key is server-only. Vision calls happen in `app/api/receipt/route.ts`, never the client.
- Run `npm run typecheck` after changes.

## Design

- Tokens live in `app/globals.css` under `@theme`: ink (true black page), vault (raised surfaces),
  bottle (primary green), engrave (lines, focus), sage (owed to you), rose (you owe), bone (text), mist (secondary).
- Bodoni Moda for display text and big numbers, Hanken Grotesk for UI. Use the `num` utility for amounts.
- The guilloche banknote on the home screen is the one decorative element. Keep everything else quiet:
  hairline rows on black, no card grids, no all-caps labels, sentence case copy.
- Phone first. Main actions sit in `ActionBar` at the bottom.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
