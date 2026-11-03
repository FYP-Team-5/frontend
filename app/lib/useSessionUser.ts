"use client";

import { useMemo, useSyncExternalStore } from "react";
import { onSessionChange, SessionUser } from "./session";

const readUser = () => localStorage.getItem("auth_user");
const serverUser = () => undefined;

export function useSessionUser(): SessionUser | null | undefined {
  const raw = useSyncExternalStore(onSessionChange, readUser, serverUser);
  return useMemo(() => {
    if (raw === undefined) return undefined;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }, [raw]);
}
