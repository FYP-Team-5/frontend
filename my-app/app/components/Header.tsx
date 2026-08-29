"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getUser, onSessionChange, SessionUser } from "../lib/session";
import D2LIcon from "./D2LIcon";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    setUser(getUser());
    return onSessionChange(() => setUser(getUser()));
  }, []);

  function handleLogout() {
    clearSession();
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="border-b border-gray-300 bg-white text-foreground">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/smu-logo.png"
            alt="SMU"
            width={220}
            height={80}
            priority
            className="h-10 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user === undefined ? null : user ? (
            <>
              {user.role === "staff" ? (
                <Link
                  href="/instructor"
                  className="rounded px-3 py-1.5 text-foreground/80 hover:bg-black/5"
                >
                  Instructor dashboard
                </Link>
              ) : (
                <Link
                  href="/student"
                  className="rounded px-3 py-1.5 text-foreground/80 hover:bg-black/5"
                >
                  My courses
                </Link>
              )}
              <button
                type="button"
                aria-label="Email"
                className="rounded p-1 hover:bg-black/5"
              >
                <D2LIcon icon="tier3:email" color="#141B54" />
              </button>
              <button
                type="button"
                aria-label="Notifications"
                className="rounded p-1 hover:bg-black/5"
              >
                <D2LIcon icon="tier3:notification-bell" color="#141B54" />
              </button>
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-dark text-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9Z" />
                  </svg>
                </span>
                <span className="text-foreground/80">{user.full_name}</span>
              </span>
              <button
                onClick={handleLogout}
                className="rounded bg-brand-light px-3 py-1.5 font-medium text-white hover:opacity-90"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded px-3 py-1.5 text-foreground/80 hover:bg-black/5"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded bg-brand-light px-3 py-1.5 font-medium text-white hover:opacity-90"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
