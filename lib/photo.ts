"use client";

import { useEffect } from "react";
import { useCredere } from "./store";
import type { Group, GroupPhoto } from "./types";

/**
 * Cover photos for groups, found by name through our own /api/photo route.
 *
 * Same shape as lib/rates.ts: a module-level promise cache so two cards asking
 * for the same term share one request, and the result lands in the store so it
 * survives a reload instead of being re-fetched on every mount.
 */

/** Set once the route tells us there's no key, so we stop asking on every card. */
let unavailable = false;
const inFlight = new Map<string, Promise<GroupPhoto | null>>();

/**
 * The part of a group name worth searching for.
 * "Lisbon, reading week" -> "Lisbon", because the trailing clause is about the
 * trip, not the place. Hyphens are left alone ("Co-op house" is one phrase).
 */
export function photoQuery(name: string): string {
  const head = name.split(/[,–—]/)[0].trim();
  return head.length >= 3 ? head : name.trim();
}

export function fetchPhoto(query: string, skip = 0): Promise<GroupPhoto | null> {
  if (unavailable) return Promise.resolve(null);

  const key = `${query}:${skip}`;
  const hit = inFlight.get(key);
  if (hit) return hit;

  const value = fetch(`/api/photo?q=${encodeURIComponent(query)}&skip=${skip}`)
    .then(async (res) => {
      if (res.status === 503) {
        unavailable = true; // no key configured; fall back to the guilloche everywhere
        return null;
      }
      if (!res.ok) return null;
      const body = (await res.json()) as { photo: GroupPhoto | null };
      return body.photo;
    })
    .catch(() => null);

  // Don't cache a miss: the user may be adding the key right now.
  value.then((photo) => {
    if (!photo) inFlight.delete(key);
  });

  inFlight.set(key, value);
  return value;
}

/**
 * Give every group on screen a cover photo, finding one the first time we see
 * it. Returns the photo to render, or null to fall back to the guilloche.
 *
 * A group whose photo is null was cleared on purpose, so we leave it alone
 * rather than handing it a new one the moment the page reloads.
 */
export function useGroupPhoto(group: Group | undefined): GroupPhoto | null {
  const setGroupPhoto = useCredere((s) => s.setGroupPhoto);
  const stored = group?.photo;
  const cleared = stored === null;
  // A stored photo goes stale if the group gets renamed out from under it.
  const current = group && stored && stored.query === photoQuery(group.name) ? stored : null;

  useEffect(() => {
    if (!group || current || cleared || unavailable) return;
    let alive = true;
    fetchPhoto(photoQuery(group.name)).then((photo) => {
      if (alive && photo) setGroupPhoto(group.id, photo);
    });
    return () => {
      alive = false;
    };
  }, [group?.id, group?.name, current, cleared, setGroupPhoto]);

  return current;
}

/**
 * Unsplash serves one URL at any size. Ask for exactly what the slot needs
 * (times 2 for retina) rather than shipping a 4000px original to a phone.
 */
export function photoSrc(photo: GroupPhoto, width: number): string {
  const sep = photo.url.includes("?") ? "&" : "?";
  return `${photo.url}${sep}w=${width}&q=78&fm=jpg&fit=crop&crop=entropy`;
}
