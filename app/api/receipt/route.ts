import { NextRequest, NextResponse } from "next/server";
import { fromMajor } from "@/lib/money";
import type { ScannedReceipt } from "@/lib/types";

/**
 * POST /api/receipt
 * body: { image: base64 (no data: prefix), mediaType, hintCurrency?: "EUR" }
 * -> ScannedReceipt (all amounts in minor units)
 *
 * Reads the receipt with Gemini, which has a free tier. The response comes
 * back through `response_format` with a JSON schema, so it is schema-valid
 * JSON rather than prose we have to guess at.
 *
 * Called over plain REST rather than through a Google SDK: it is one request,
 * the shape is documented, and it keeps the dependency list as it was.
 */

export const runtime = "nodejs";
// A dense receipt takes a moment to read. Give it room.
export const maxDuration = 60;

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

/** What Gemini accepts inline. The browser sends JPEG, or HEIC straight off an iPhone. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
const PDF_TYPE = "application/pdf";

/**
 * Every field is required and nullable rather than optional, so "the receipt
 * did not print a date" comes back stated plainly instead of being inferred
 * from a missing key.
 */
const RECEIPT_SCHEMA = {
  type: "object",
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
        required: ["name", "quantity", "line_total"],
        properties: {
          name: {
            type: "string",
            description: "Short readable name, translated to English if not English.",
          },
          quantity: { type: "number" },
          line_total: {
            type: "number",
            description: "Total for the line in major units, e.g. 12.50.",
          },
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
};

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
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Receipt scanning needs GEMINI_API_KEY in .env.local." },
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
  if (!body.image || (!isPdf && !IMAGE_TYPES.includes(mediaType as (typeof IMAGE_TYPES)[number]))) {
    return NextResponse.json(
      { error: "Attach a photo of the receipt, or a PDF of it." },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        input: [
          // A PDF goes up as a document; a photo as an image.
          {
            type: isPdf ? "document" : "image",
            data: body.image,
            mime_type: mediaType,
          },
          {
            type: "text",
            text: body.hintCurrency
              ? `${INSTRUCTIONS} If the currency is not clear from the receipt, it is probably ${body.hintCurrency}.`
              : INSTRUCTIONS,
          },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: RECEIPT_SCHEMA,
        },
      }),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Gemini." }, { status: 502 });
  }

  if (!res.ok) return NextResponse.json({ error: describe(res.status) }, { status: statusFor(res.status) });

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return NextResponse.json({ error: "Gemini returned something unreadable." }, { status: 502 });
  }

  const text = outputText(payload);
  if (!text) {
    return NextResponse.json(
      { error: "Couldn't read that receipt. Try a flatter, brighter photo." },
      { status: 422 },
    );
  }

  let extracted: Extracted;
  try {
    extracted = JSON.parse(text) as Extracted;
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that receipt. Try a flatter, brighter photo." },
      { status: 422 },
    );
  }

  const receipt = toReceipt(extracted, body.hintCurrency);
  if (receipt.total <= 0) {
    return NextResponse.json(
      { error: "Couldn't find a total on that receipt. Make sure the bottom of it is in the photo." },
      { status: 422 },
    );
  }

  return NextResponse.json(receipt);
}

/**
 * Pull the generated text out of the response.
 *
 * The docs show two shapes for this - `steps[].content[].text` and a flatter
 * `output_text` - so read whichever is actually present rather than betting on
 * one and failing opaquely if it is the other.
 */
function outputText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const root = payload as Record<string, unknown>;

  const steps = root.steps;
  if (Array.isArray(steps)) {
    const parts: string[] = [];
    for (const step of steps) {
      const content = (step as Record<string, unknown>)?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        const b = block as Record<string, unknown>;
        if (b?.type === "text" && typeof b.text === "string") parts.push(b.text);
      }
    }
    if (parts.length) return parts.join("");
  }

  const interaction = root.interaction as Record<string, unknown> | undefined;
  for (const candidate of [interaction?.output_text, root.output_text]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}

function describe(status: number): string {
  if (status === 401 || status === 403) return "GEMINI_API_KEY was rejected.";
  // The free tier is generous but finite, and this is the error you'll meet.
  if (status === 429) return "Gemini's free tier limit was hit. Try again in a minute.";
  if (status === 400) return "Gemini rejected the receipt. Try a different photo.";
  return "Receipt scanning failed.";
}

function statusFor(status: number): number {
  if (status === 429) return 429;
  return 502;
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
