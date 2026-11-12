"use client";

import { newRequestId } from "@/app/lib/requestId";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/app/components/ToastProvider";
import ReloadButton from "@/app/components/ReloadButton";
import {
  DatasetVersion,
  datasetStorageStatus,
  downloadDataset,
  listDatasetVersions,
  retryDatasetVersion,
  uploadDataset,
} from "@/app/lib/trainingDatasetApi";
import { formatTestDate } from "@/app/lib/testDates";
import Breadcrumbs from "@/app/components/Breadcrumbs";

/** Human-readable "course · test" summaries from the version manifest. */
function exportContributions(version: DatasetVersion): string[] {
  const labels = new Set<string>();
  for (const entry of version.source_manifest ?? []) {
    labels.add(`${entry.course_code} · ${entry.test_name}`);
  }
  return [...labels];
}

export default function TrainingDatasetPage() {
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [storage, setStorage] = useState("unknown");
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  // Set when the Reload button is clicked; the next refresh result answers
  // it with a toast instead of the silent 3s poll.
  const manualReload = useRef(false);
  const active = versions.find((version) => version.is_active);

  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let storageTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function refresh() {
      try {
        const data = await listDatasetVersions(controller.signal);
        if (current) {
          setVersions(data);
          setLoadError(null);
          setLoading(false);
          if (manualReload.current) {
            manualReload.current = false;
            toast("Refreshed training dataset");
          }
        }
      } catch (err) {
        if (current) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Unable to load dataset versions.",
          );
          setLoading(false);
          if (manualReload.current) {
            manualReload.current = false;
            toast("Failed to refresh, check back later.", "error");
          }
        }
      }
      if (current) timer = setTimeout(refresh, 3000);
    }
    void refresh();
    async function checkStorage() {
      try {
        const result = await datasetStorageStatus(controller.signal);
        if (current) setStorage(result.status);
      } catch {
        if (current) setStorage("unavailable");
      }
      if (current) storageTimer = setTimeout(checkStorage, 10000);
    }
    void checkStorage();
    return () => {
      current = false;
      clearTimeout(timer);
      clearTimeout(storageTimer);
      controller.abort();
    };
  }, [reload]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !uploadKey) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const version = await uploadDataset(file, uploadKey);
      setMessage(
        `CSV accepted as version ${version.number}. It will be available for download after publication.`,
      );
      toast(`Upload accepted as version ${version.number}. Publication is queued.`);
      setFile(null);
      setUploadKey(null);
      if (fileInput.current) fileInput.current.value = "";
      setReload((value) => value + 1);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Could not confirm upload. Retry with the same file to check its status.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function download(version?: DatasetVersion) {
    setBusy(true);
    setError(null);
    try {
      await downloadDataset(version);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to download CSV.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function retry(version: DatasetVersion) {
    setBusy(true);
    setError(null);
    try {
      await retryDatasetVersion(version.id);
      setMessage("Publication queued again.");
      toast(`Publication of v${version.number} queued again.`);
      setReload((value) => value + 1);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to retry publication.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/instructor" },
          { label: "Training dataset" },
        ]}
      />
      <h1 className="mt-3 text-2xl font-semibold text-brand-dark">
        Training dataset
      </h1>
      <p className="mt-2 text-sm text-foreground/70">
        Upload rubric training CSV files and download versioned snapshots.
        Eligible latest submissions are added after tests end.
      </p>
      <p className="mt-2 text-sm">
        Storage:{" "}
        {storage === "ok"
          ? "Available"
          : storage === "unknown"
            ? "Checking..."
            : "Unavailable — uploads can be queued; quiz grading continues."}
      </p>
      {(error || loadError) && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error || loadError}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-green-800">
          {message}
        </p>
      )}
      <form
        onSubmit={upload}
        className="mt-6 space-y-4 rounded-lg border border-gray-300 bg-white p-6"
      >
        <h2 className="text-lg font-semibold text-brand-dark">Upload CSV</h2>
        <p className="text-sm text-foreground/70">
          Include feedback text for each answer. Older CSV files without feedback
          are also accepted. A new upload replaces the seed examples and retains
          automatically collected test rows. Earlier versions remain available.
        </p>
        <p className="break-words font-mono text-xs text-foreground/60">
          id, question, desired_answer, student_answer, criteria[],
          criteria_score[], criteria_max_score[], student_score, feedback
        </p>
        <label className="block text-sm font-medium">
          Dataset CSV
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            required
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setUploadKey(newRequestId());
            }}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-light file:px-3 file:py-2 file:text-white"
          />
        </label>
        <button
          disabled={busy || !file}
          className="rounded bg-brand-light px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Working..." : "Upload new version"}
        </button>
      </form>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-brand-dark">
          Version history
        </h2>
        <div className="flex gap-4">
          <ReloadButton
            label="Refresh"
            onClick={() => {
              manualReload.current = true;
              setReload((value) => value + 1);
            }}
            disabled={loading}
          />
          <button
            disabled={busy || !active}
            onClick={() => download()}
            className="rounded bg-brand-light px-4 py-2 text-sm text-white disabled:opacity-50 transition-colors hover:bg-brand-dark"
          >
            Download latest CSV
          </button>
        </div>
      </div>
      {loading && (
        <p role="status" className="mt-4">
          Loading versions...
        </p>
      )}
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Version",
                "Source",
                "Created",
                "Status",
                "Rows",
                "Actions",
              ].map((label) => (
                <th key={label} className="px-4 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.id} className="border-t border-gray-200">
                <td className="px-4 py-3 font-medium">
                  v{version.number}
                  {version.is_active && (
                    <span className="ml-2 text-xs text-green-800">Latest</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {version.source === "instructor_upload"
                    ? "Instructor upload"
                    : "Test export"}
                  {version.filename && (
                    <span className="block text-xs text-foreground/60">
                      {version.filename}
                    </span>
                  )}
                  {version.source === "test_export" && (
                    <span className="block text-xs text-foreground/60">
                      {exportContributions(version).join(" · ") ||
                        "Automatically collected test rows"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {formatTestDate(version.created_at)}
                </td>
                <td className="max-w-xs px-4 py-3">
                  {version.status}
                  {version.last_error && (
                    <p className="mt-1 text-xs text-red-700">
                      {version.last_error}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">{version.row_count ?? "—"}</td>
                <td className="px-4 py-3">
                  {version.status === "ready" && (
                    <button
                      disabled={busy}
                      onClick={() => download(version)}
                      className="inline-flex rounded bg-brand-light px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition-colors hover:bg-brand-dark"
                    >
                      Download v{version.number} CSV
                    </button>
                  )}
                  {version.status === "failed" && (
                    <button
                      disabled={busy}
                      onClick={() => retry(version)}
                      className="inline-flex rounded border border-brand-dark px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-dark hover:text-white disabled:opacity-50"
                    >
                      Retry publication
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && versions.length === 0 && (
          <p className="p-5 text-sm text-foreground/60">
            No versions yet. Upload a CSV or end a test with eligible graded
            submissions.
          </p>
        )}
      </div>
    </div>
  );
}
