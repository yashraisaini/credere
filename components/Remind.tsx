"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui";
import { resultMessage, sendReminder } from "@/lib/remind";

/**
 * Hands a composed reminder to Messages, the share sheet, or the clipboard
 * (whichever the device supports) and says what happened.
 */
export function RemindButton({
  text,
  phone,
  label = "Remind",
  variant = "quiet",
  block,
}: {
  text: string;
  phone?: string;
  label?: string;
  variant?: "primary" | "quiet";
  block?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);

  return (
    <span className={block ? "block" : "inline-flex flex-col items-end"}>
      <Button
        variant={variant}
        block={block}
        className={block ? undefined : "h-9 px-4 text-sm"}
        onClick={async () => {
          const result = await sendReminder(text, phone);
          setNote(resultMessage(result));
          if (result === "copied") setTimeout(() => setNote(null), 2600);
        }}
      >
        <MessageCircle size={16} strokeWidth={1.5} aria-hidden />
        {label}
      </Button>
      {note && (
        <span role="status" className="mt-1.5 block text-xs text-mist">
          {note}
        </span>
      )}
    </span>
  );
}
