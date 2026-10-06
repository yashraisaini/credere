import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { fromMajor } from "@/lib/money";
import type { ScannedReceipt } from "@/lib/types";

/**
 * POST /api/receipt
 * body: { image: base64 (no data: prefix), mediaType, hintCurrency?: "EUR" }
 * -> ScannedReceipt (all amounts in minor units)
 *
 * Claude reads the receipt and returns the figures through structured outputs,
 * so what comes back is schema-valid JSON rather than prose we have to guess
 * at. PDFs go up as documents; everything else arrives as a JPEG the browser
 * already decoded and re-encoded for us.
 */

export const runtime = "nodejs";
// Reading a dense receipt with thinking on can take a while. Give it room.
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const PDF_TYPE = "application/pdf";
type ImageType = (typeof IMAGE_TYPES)[number];

/**
 * Every field is required and nullable rather than optional: structured outputs
 * wants a closed schema, and "the receipt did not say" is information we want
 * stated plainly instead of inferred from a missing key.
 */
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["merchant", "date", "currency", "items", "subtotal", "tax", "tip", "total"],
  properties: {
    merchant: { type: ["string", "null"], description: "Business name as printed." },
    date: {
      type: ["string", "null"],
      description: "Purchase date as YYYY-MM-DD, or null if the receipt does not print one.",
    },
    currency: {
      type: ["string", "null"],
      description:
        "ISO 4217 code. Infer from symbols, language, tax labels (IVA, VAT, TPS/TVQ, GST) and the address when no code is printed.",
    },
    items: {
      type: "array",
      description: "Every purchased line. A discount is its own line with a negative total.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "line_total"],
        properties: {
          name: {
            type: "string",
            description: "Short readable name, translated to English if not English.",
          },
          quantity: { type: "number" },
          line_total: { type: "number", description: "Total for the line in major units, e.g. 12.50." },
        },
      },
    },
    subtotal: { type: ["number", "null"] },
    tax: {
      type: ["number", "null"],
      description:
        "Tax added on top of item prices. Null when prices already include it, as with most European VAT.",
    },
    tip: { type: ["number", "null"], description: "Tip or service charge, if any." },
    total: {
      type: "number",
      description:
        "The final amount actually paid, in major units: the figure labelled TOTAL, AMOUNT DUE, BALANCE or the equivalent, after tax, tip and discounts.",
    },
  },
} as const;

const INSTRUCTIONS = [
  "Read this receipt and report what is on it.",
  "The total is the most important figure: find the line labelled TOTAL, AMOUNT DUE, BALANCE, or the equivalent in the receipt's language, and report the amount actually charged after tax, tip and any discount.",
  "If a card payment line or a change-due line disagrees with the printed total, trust the printed total.",
  "For items, use line totals (quantity times unit price), not unit prices.",
  "Do not list subtotals, taxes, tips, payment method or change as items.",
].join(" ");

interface Extracted {
  merchant: string | null;
  date: string | null;
  currency: string | null;
  items: { name: string; quantity: number; line_total: number }[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Receipt scanning needs ANTHROPIC_API_KEY in .env.local." },
      { status: 503 },
    );
  }

  let body: { image?: string; mediaType?: string; hintCurrency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send the receipt as JSON." }, { status: 400 });
  }

  const mediaType = body.mediaType ?? "image/jpeg";
  const isPdf = mediaType === PDF_TYPE;
  if (!body.image || (!isPdf && !IMAGE_TYPES.includes(mediaType as ImageType))) {
    return NextResponse.json(
      { error: "Attach a photo of the receipt, or a PDF of it." },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      // A photographed receipt should never trip a safety classifier, but if
      // one ever does, the request is re-run rather than simply failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: RECEIPT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            isPdf
              ? {
                  type: "document",
                  source: { type: "base64", media_type: PDF_TYPE, data: body.image },
                }
              : {
                  type: "image",
                  source: { type: "base64", media_type: mediaType as ImageType, data: body.image },
                },
            {
              type: "text",
              text: body.hintCurrency
                ? `${INSTRUCTIONS} If the currency is not clear from the receipt, it is probably ${body.hintCurrency}.`
                : INSTRUCTIONS,
            },
          ],
        },
      ],
    });

    // A safety decline returns 200 with no usable content, so check first.
    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Claude declined to read that image. Try a photo of just the receipt." },
        { status: 422 },
      );
    }

    const text = message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json(
        { error: "Couldn't read that receipt. Try a flatter, brighter photo." },
        { status: 422 },
      );
    }

    let extracted: Extracted;
    try {
      extracted = JSON.parse(text.text) as Extracted;
    } catch {
      return NextResponse.json(
        { error: "Couldn't read that receipt. Try a flatter, brighter photo." },
        { status: 422 },
      );
    }

    const receipt = toReceipt(extracted, body.hintCurrency);
    if (receipt.total <= 0) {
      return NextResponse.json(
        {
          error:
            "Couldn't find a total on that receipt. Make sure the bottom of it is in the photo.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json(receipt);
  } catch (err) {
    // Most specific first, so a bad key doesn't read as a transient outage.
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY was rejected." }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited. Try again in a moment." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Receipt scanning failed: ${err.message}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Receipt scanning failed." }, { status: 502 });
  }
}

/** Major units to minor, once we know which currency we are counting in. */
function toReceipt(input: Extracted, hintCurrency?: string): ScannedReceipt {
  const currency = /^[A-Z]{3}$/.test(input.currency ?? "")
    ? input.currency!
    : (hintCurrency ?? null);

  const minor = (n: number | null | undefined) =>
    typeof n === "number" && Number.isFinite(n) ? fromMajor(n, currency ?? "USD") : null;

  return {
    merchant: input.merchant?.trim() || null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "") ? input.date! : null,
    currency,
    items: (input.items ?? [])
      .filter((i) => i && typeof i.line_total === "number")
      .map((i) => ({
        name: String(i.name).slice(0, 80),
        quantity: Number(i.quantity) || 1,
        amount: minor(i.line_total) ?? 0,
      })),
    subtotal: minor(input.subtotal),
    tax: minor(input.tax),
    tip: minor(input.tip),
    total: minor(input.total) ?? 0,
  };
}
