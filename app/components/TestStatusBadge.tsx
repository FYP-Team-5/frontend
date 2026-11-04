"use client";

import type { TestDisplayStatus } from "@/app/lib/testDates";

/**
 * Single source of truth for the test availability indicator.
 * Used by the student and instructor test lists and detail pages (TODO.md R3/R7)
 * so both views always render identical status markup. A test is open only
 * inside its start/end window; before it starts it shows as "Upcoming".
 */
const TONES: Record<TestDisplayStatus, { pill: string; dot: string; label: string }> = {
  open: {
    pill: "border-green-300 bg-green-50 text-green-800",
    dot: "bg-green-600",
    label: "Open",
  },
  upcoming: {
    pill: "border-sky-300 bg-sky-50 text-sky-800",
    dot: "bg-sky-600",
    label: "Upcoming",
  },
  closed: {
    pill: "border-red-300 bg-red-50 text-red-800",
    dot: "bg-red-600",
    label: "Closed",
  },
};

export default function TestStatusBadge({
  status,
  size = "sm",
}: {
  status: TestDisplayStatus;
  size?: "sm" | "md";
}) {
  const { pill, dot, label } = TONES[status];
  const sizeClass = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${pill} ${sizeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
