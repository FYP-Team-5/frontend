"use client";

import { useSyncExternalStore } from "react";

export function formatTestDate(value: string | null): string {
  if (!value) return "No deadline set";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: undefined,
  }).format(new Date(value));
}

export function localDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const subscribeTimezone = () => () => {};
const serverTimezone = () => "UTC";

export function useLocalTimezone(): string {
  return useSyncExternalStore(subscribeTimezone, localTimezone, serverTimezone);
}

export type TestDisplayStatus = "open" | "upcoming" | "closed";

/**
 * A test is open only inside its [starts_at, ends_at) window. `is_closed`
 * from the API covers the whole non-open set, so a future `starts_at` is
 * surfaced as "upcoming" for display.
 */
export function testDisplayStatus(test: {
  is_closed: boolean;
  starts_at: string | null;
}): TestDisplayStatus {
  if (test.starts_at && Date.now() < Date.parse(test.starts_at)) {
    return "upcoming";
  }
  return test.is_closed ? "closed" : "open";
}
