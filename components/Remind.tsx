"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { ActionSheet, type SheetAction } from "./ActionSheet";
import { Button } from "./ui";
import { resultMessage, sendReminder } from "@/lib/remind";

/**
 * Offers the ways this person can actually be reached, then hands the composed
 * reminder to Messages, Mail, the share sheet or the clipboard.
 *
 * Nothing is sent from here. Each route opens the device's own app with the
 * message already written, and the person taps send - a web page has no way to
 * send a text or an email on someone's behalf.
 */
export function RemindButton({
  text,
  phone,
  email,
  subject,
  who,
  label = "Remind",
  variant = "quiet",
  block,
}: {
  text: string;
  phone?: string;
  email?: string;
  subject?: string;
  /** Whose reminder this is, for the sheet's heading. */
  who?: string;
  label?: string;
  variant?: "primary" | "quiet";
  block?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  async function send(opts: Parameters<typeof sendReminder>[1]) {
    const result = await sendReminder(text, opts);
    setNote(resultMessage(result));
    if (result === "copied") setTimeout(() => setNote(null), 2600);
  }

  const hasPhone = Boolean(phone?.trim());
  const hasEmail = Boolean(email?.trim());

  const actions: SheetAction[] = [];
  if (hasPhone) {
    actions.push({
      label: "Send as a text",
      hint: phone,
      onSelect: () => send({ channel: "sms", phone }),
    });
  }
  if (hasEmail) {
    actions.push({
      label: "Send as an email",
      hint: email,
      onSelect: () => send({ channel: "email", email, subject }),
    });
  }
  actions.push({
    label: actions.length ? "Copy or share instead" : "Copy or share",
    hint: actions.length ? undefined : "Add a phone or email to send it directly",
    onSelect: () => send({ channel: "share" }),
  });

  return (
    <span className={block ? "block" : "inline-flex flex-col items-end"}>
      <Button
        variant={variant}
        block={block}
        className={block ? undefined : "h-9 px-4 text-sm"}
        onClick={() => {
          // One route available and nothing to choose between: just take it.
          if (actions.length === 1) {
            void actions[0].onSelect();
            return;
          }
          setPicking(true);
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

      <ActionSheet
        open={picking}
        onClose={() => setPicking(false)}
        title={who ? `Remind ${who}` : "Send the reminder"}
        subtitle="Opens the app with the message written. You still tap send."
        actions={actions}
      />
    </span>
  );
}
