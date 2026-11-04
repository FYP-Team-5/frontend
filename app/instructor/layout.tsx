"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSessionUser } from "../lib/useSessionUser";

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useSessionUser();
  const authorized = user?.role === "instructor";

  useEffect(() => {
    if (user !== undefined && !authorized) router.replace("/login");
  }, [user, authorized, router]);

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
