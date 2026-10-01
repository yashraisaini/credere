import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { fromMajor } from "@/lib/money";
import type { ScannedReceipt } from "@/lib/types";

/**
 * POST /api/receipt
 * body: { image: base64 (no data: prefix), mediaType: "image/jpeg", hintCurrency?: "EUR" }
 * -> ScannedReceipt (all amounts in minor units)
 *
 * Uses Claude vision with a forced tool call so the response is always
 * structured JSON we can trust the shape of.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const receiptTool: Anthropic.Tool = {
  name: "record_receipt",
  description: "Record the contents of a photographed receipt.",
  input_schema: {
    type: "object",
    properties: {
      merchant: { type: "string", description: "Business name as printed." },
      date: { type: "string", description: "Purchase date as YYYY-MM-DD, if printed." },
      currency: {
        type: "string",
        description:
          "ISO 4217 code. Infer from symbols, language, tax labels (IVA, VAT, TPS/TVQ) and the address when no code is printed.",
      },
      items: {
        type: "array",
        description: "Every purchased line. Discounts are separate lines with negative totals.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short readable name, translated to English if not English." },
            quantity: { type: "number" },
            line_total: { type: "number", description: "Total for the line in major units, e.g. 12.50." },
          },
          required: ["name", "quantity", "line_total"],
        },
      },
      subtotal: { type: "number" },
      tax: {
        type: "number",
        description: "Tax added on top of item prices. Omit if prices already include tax, as with most European VAT.",
      },
      tip: { type: "number", description: "Tip or service charge, if any." },
      total: { type: "number", description: "Final amount paid, in major units." },
    },
    required: ["items", "total"],
  },
};

interface ToolInput {
  merchant?: string;
  date?: string;
  currency?: string;
  items: { name: string; quantity: number; line_total: number }[];
  subtotal?: number;
  tax?: number;
  tip?: number;
  total: number;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Receipt scanning needs ANTHROPIC_API_KEY in .env.local." },
      { status: 500 },
    );
  }

  let body: { image?: string; mediaType?: string; hintCurrency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send the photo as JSON." }, { status: 400 });
  }

  const mediaType = (body.mediaType ?? "image/jpeg") as MediaType;
  if (!body.image || !MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: "Attach a JPEG, PNG or WebP photo of the receipt." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      tools: [receiptTool],
      tool_choice: { type: "tool", name: receiptTool.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: body.image } },
            {
              type: "text",
              text: [
                "Read this receipt and record it with the tool.",
                "Use line totals (quantity times unit price), not unit prices.",
                "Leave out lines that are subtotals, taxes, tips, payment method or change.",
                body.hintCurrency
                  ? `If the currency is not clear from the receipt, it is probably ${body.hintCurrency}.`
                  : "",
              ]
                .filter(Boolean)
                .join(" "),
            },
          ],
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Couldn't read that receipt. Try a flatter, brighter photo." }, { status: 422 });
    }

    const input = toolUse.input as ToolInput;
    const currency = /^[A-Z]{3}$/.test(input.currency ?? "")
      ? input.currency!
      : (body.hintCurrency ?? null);
    const minor = (n: number | undefined) =>
      typeof n === "number" && Number.isFinite(n) ? fromMajor(n, currency ?? "USD") : null;

    const receipt: ScannedReceipt = {
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

    if (receipt.total <= 0) {
      return NextResponse.json({ error: "Couldn't find a total on that receipt." }, { status: 422 });
    }

    return NextResponse.json(receipt);
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? err.message : "Receipt scanning failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
