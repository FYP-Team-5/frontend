"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession } from "../lib/session";
import { useSessionUser } from "../lib/useSessionUser";

export default function Header() {
  const router = useRouter();
  const user = useSessionUser();

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <header className="border-b border-gray-300 bg-white text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center">
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
        <nav className="flex w-full min-w-0 flex-wrap items-center gap-3 text-sm sm:w-auto">
          {user === undefined ? null : user ? (
            <>
              {user.role === "instructor" ? (
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
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9Z" />
                  </svg>
                </span>
                <span className="break-words text-foreground/80">
                  {user.full_name}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="rounded bg-brand-light px-3 py-1.5 font-medium text-white hover:opacity-90 transition-colors hover:bg-brand-dark"
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
                className="rounded bg-brand-light px-3 py-1.5 font-medium text-white hover:opacity-90 transition-colors hover:bg-brand-dark"
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
