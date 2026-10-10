"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUser, onSessionChange, SessionUser } from "./lib/session";

export default function Home() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    setUser(getUser());
    return onSessionChange(() => setUser(getUser()));
  }, []);

  if (user === undefined) {
    return null;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-lg border border-black/10 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-brand-dark">
            Welcome to FYP Assessment
          </h1>
          <p className="mt-2 text-foreground/70">
            Sign in to view your courses, or register a new account to get started.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/login"
              className="rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded border border-brand-dark px-4 py-2 text-sm font-medium text-brand-dark hover:bg-brand-dark/5"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-lg border border-black/10 bg-white p-10 shadow-sm">
        <h1 className="text-2xl font-semibold text-brand-dark">
          Welcome back, {user.full_name}
        </h1>
        <p className="mt-2 text-foreground/70">
          {user.role === "instructor"
            ? "Head to your instructor dashboard to manage courses, rubrics, and exams."
            : "Browse available courses and their exams."}
        </p>
        <Link
          href={user.role === "instructor" ? "/instructor" : "/student"}
          className="mt-6 inline-block rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {user.role === "instructor" ? "Go to instructor dashboard" : "Browse courses"}
        </Link>
      </div>
    </div>
  );
}
