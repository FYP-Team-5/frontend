"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSessionUser } from "./lib/useSessionUser";

/**
 * The landing page no longer renders a "Welcome back" screen (TODO.md R1).
 * It redirects logged-in users straight to their Courses view and
 * unauthenticated visitors to the login page. `replace` keeps `/` out of
 * the history stack so Back does not bounce through it.
 */
export default function Home() {
  const router = useRouter();
  const user = useSessionUser();

  useEffect(() => {
    if (user === undefined) return; // Session still resolving; render nothing.
    if (!user) {
      router.replace("/login");
    } else {
      router.replace(user.role === "instructor" ? "/instructor" : "/student");
    }
  }, [user, router]);

  return null;
}
