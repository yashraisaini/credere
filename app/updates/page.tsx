"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BackLink, Money, Page } from "@/components/ui";
import { byDay, eventLine, isUnread, timeAgo } from "@/lib/events";
import { useCredere } from "@/lib/store";
import type { AppEvent } from "@/lib/events";

/**
 * What changed, newest first.
 *
 * Everything here happened on this device, because that is the only place the
 * data lives: there is no server and nobody else in the system yet. The log
 * already records who did each thing, so once there is a backend, other
 * people's changes appear here without this screen changing.
 */
export default function UpdatesPage() {
  const events = useCredere((s) => s.events);
  const markEventsRead = useCredere((s) => s.markEventsRead);
  const unread = events.filter(isUnread).length;

  // Opening the screen is the acknowledgement. Run once on mount so the
  // badge clears, rather than on every store change while reading.
  useEffect(() => {
    markEventsRead();
  }, [markEventsRead]);

  const days = byDay(events);

  return (
    <Page>
      <BackLink href="/">Home</BackLink>

      <header className="mt-5">
        <h1 className="font-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.015em]">
          Updates
        </h1>
        <p className="mt-3 text-mist">
          {events.length === 0
            ? "Nothing has changed yet."
            : `${events.length} ${events.length === 1 ? "change" : "changes"}${unread ? `, ${unread} new` : ""}`}
        </p>
      </header>

      {events.length === 0 ? (
        <p className="mt-10 text-bone">
          Add or remove something and it&apos;ll be recorded here.{" "}
          <Link href="/" className="text-sage">
            Pick a group
          </Link>
          .
        </p>
      ) : (
        <div className="mt-10 space-y-9">
          {days.map(({ label, events: forDay }) => (
            <section key={label}>
              <h2 className="text-sm text-mist">{label}</h2>
              <ul className="mt-2">
                {forDay.map((event) => (
                  <Row key={event.id} event={event} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 text-xs leading-relaxed text-mist">
        Everything here happened on this device. Credere keeps your data locally,
        so there is nobody else to hear from yet.
      </p>
    </Page>
  );
}

function Row({ event }: { event: AppEvent }) {
  const body = (
    <>
      <span
        aria-hidden
        className={`mt-2 size-1.5 shrink-0 rounded-full ${isUnread(event) ? "bg-sage" : "bg-transparent"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] text-bone">{eventLine(event)}</span>
        <span className="mt-1 block text-xs text-mist">
          {event.groupName} &middot; {timeAgo(event.at)}
        </span>
      </span>
      {event.amount && event.amount.currency && (
        <Money
          minor={event.amount.minor}
          currency={event.amount.currency}
          className="shrink-0 text-sm text-mist"
        />
      )}
    </>
  );

  // A deleted group has nowhere to go, so that row isn't a link.
  return (
    <li>
      {event.groupId ? (
        <Link
          href={`/groups/${event.groupId}`}
          className="flex gap-3 border-b border-rule py-3.5 transition-colors hover:border-engrave/50"
        >
          {body}
        </Link>
      ) : (
        <div className="flex gap-3 border-b border-rule py-3.5">{body}</div>
      )}
    </li>
  );
}
