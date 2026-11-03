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
