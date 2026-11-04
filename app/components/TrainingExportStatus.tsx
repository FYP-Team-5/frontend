"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "./ToastProvider";
import {
  TrainingExport,
  getTrainingExport,
  retryTrainingExport,
} from "@/app/lib/trainingDatasetApi";

export default function TrainingExportStatus({
  testId,
  courseId,
}: {
  testId: string;
  courseId: string;
}) {
  const [status, setStatus] = useState<TrainingExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const toast = useToast();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function refresh() {
      try {
        const data = await getTrainingExport(testId, controller.signal);
        if (active) {
          setStatus(data);
          setError(null);
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to check training export.",
          );
      }
      if (active) timer = setTimeout(refresh, 5000);
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [testId, reload]);
  const labels = {
    open: "Available after test ends",
    pending: "Queued",
    waiting: "Waiting for grading",
    exporting: "Publishing CSV",
    completed: "Completed",
    needs_attention: "Criterion corrections needed",
    failed: "Failed",
  };
  async function retry() {
    setBusy(true);
    try {
      await retryTrainingExport(testId);
      toast("Training export retry queued.");
      setReload((value) => value + 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to retry export.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 border-t border-gray-200 pt-3 text-xs">
      <p className="font-medium">
        Training export: {status ? labels[status.status] : "Checking..."}
      </p>
      {status && status.status !== "open" && (
        <p className="mt-1 text-foreground/60">
          {status.row_count} eligible row(s) · {status.excluded.length} excluded
        </p>
      )}
      {status?.excluded.length ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-brand-light">
            View excluded rows
          </summary>
          <ul className="mt-2 space-y-2">
            {status.excluded.map((item, index) => (
              <li key={`${item.attempt_id}:${item.question_id}:${index}`}>
                <Link
                  className="text-brand-light underline"
                  href={`/instructor/courses/${encodeURIComponent(courseId)}/tests/${encodeURIComponent(testId)}/submissions/${encodeURIComponent(item.attempt_id)}`}
                >
                  Review submission
                </Link>
                : {item.reason}
                <span className="block break-all text-foreground/50">
                  Attempt {item.attempt_id}
                  {item.question_id ? ` · Question ${item.question_id}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {(error || status?.last_error) && (
        <p role="alert" className="mt-2 text-red-700">
          {error || status?.last_error}
        </p>
      )}
      {status?.status === "failed" && (
        <button
          onClick={retry}
          disabled={busy}
          className="mt-2 inline-flex rounded border border-brand-dark px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-dark hover:text-white disabled:opacity-50"
        >
          {busy ? "Queuing..." : "Retry training export"}
        </button>
      )}
      <Link
        className="mt-2 block text-brand-light underline"
        href="/instructor/training-dataset"
      >
        View dataset versions
      </Link>
    </div>
  );
}
