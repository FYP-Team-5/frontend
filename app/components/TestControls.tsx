"use client";

import TrainingExportStatus from "./TrainingExportStatus";
import { useEffect, useState } from "react";
import { useToast } from "./ToastProvider";
import { Test, endTest, setTestDeadline } from "@/app/lib/gradingApi";
import { localDateInput, useLocalTimezone } from "@/app/lib/testDates";

export default function TestControls({
  test,
  courseId,
  onUpdated,
}: {
  test: Test;
  courseId: string;
  onUpdated: (test: Test) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!test.ends_at || test.ended_at) return;
    const deadline = Date.parse(test.ends_at);
    if (now >= deadline) return;
    const delay = Math.min(Math.max(0, deadline - Date.now()), 2_147_483_647);
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [test.ends_at, test.ended_at, now]);
  const timezone = useLocalTimezone();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Ended" means permanently over (ended early or past the deadline).
  // An upcoming test is not open yet, but stays administratively editable.
  const ended =
    test.ended_at !== null ||
    (test.ends_at !== null && now >= Date.parse(test.ends_at));
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
      toast(`"${test.test_name}" ended. Training export will collect results.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to end test.";
      setError(message);
      toast(message, "error");
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
      toast(`End date updated for "${test.test_name}".`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to update deadline.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }
  // Status display (badge, question count, end date) lives on the instructor
  // test detail page so it matches the student view (TODO.md R7); this
  // component only hosts the administrative actions.
  return (
    <div className="mt-3 space-y-3">
      {!ended && (
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
              className="rounded border border-brand-dark px-3 py-1.5 text-xs text-brand-dark transition-colors hover:bg-brand-dark hover:text-white disabled:opacity-50"
            >
              Save end date
            </button>
          </form>
          <button
            onClick={closeTest}
            disabled={busy}
            className="rounded border border-red-700 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-700 hover:text-white disabled:opacity-50"
          >
            {busy ? "Updating..." : "End test"}
          </button>
        </>
      )}
      {ended && <TrainingExportStatus testId={test.id} courseId={courseId} />}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
