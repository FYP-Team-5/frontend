"use client";

import Link from "next/link";
import TrainingExportStatus from "./TrainingExportStatus";
import { useState } from "react";
import { Test, endTest, setTestDeadline } from "@/app/lib/gradingApi";
import {
  formatTestDate,
  localDateInput,
  useLocalTimezone,
} from "@/app/lib/testDates";

export default function TestControls({
  test,
  courseId,
  onUpdated,
}: {
  test: Test;
  courseId: string;
  onUpdated: (test: Test) => void;
}) {
  const timezone = useLocalTimezone();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = test.is_closed;
  async function closeTest() {
    if (
      !window.confirm(
        `End "${test.test_name}" now? Students will no longer be able to start or submit attempts. Accepted submissions will continue grading.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      onUpdated(await endTest(test.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to end test.");
    } finally {
      setBusy(false);
    }
  }
  async function saveDeadline(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("ends_at"));
    setBusy(true);
    setError(null);
    try {
      onUpdated(await setTestDeadline(test.id, new Date(value).toISOString()));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update deadline.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
      <p className="text-sm font-semibold">{closed ? "Closed" : "Open"}</p>
      <p className="text-xs text-foreground/60">
        Ends: {formatTestDate(test.ends_at)} ({timezone})
      </p>
      <Link
        className="block text-sm font-medium text-brand-light underline"
        href={`/instructor/courses/${encodeURIComponent(courseId)}/tests/${encodeURIComponent(test.id)}/submissions`}
      >
        View submissions
      </Link>
      {!closed && (
        <>
          <form onSubmit={saveDeadline} className="space-y-2">
            <label className="block text-xs font-medium">
              End date ({timezone})
              <input
                key={test.ends_at}
                aria-label={`End date for ${test.test_name}`}
                name="ends_at"
                type="datetime-local"
                required
                defaultValue={localDateInput(test.ends_at)}
                disabled={busy}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-xs"
              />
            </label>
            <button
              disabled={busy}
              className="rounded border border-brand-dark px-3 py-1.5 text-xs text-brand-dark disabled:opacity-50"
            >
              Save end date
            </button>
          </form>
          <button
            onClick={closeTest}
            disabled={busy}
            className="rounded border border-red-700 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
          >
            {busy ? "Updating..." : "End test"}
          </button>
        </>
      )}
      {closed && <TrainingExportStatus testId={test.id} courseId={courseId} />}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
