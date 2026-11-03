"use client";

import Link from "next/link";
import { newRequestId } from "@/app/lib/requestId";
import { useEffect, useRef, useState } from "react";
import {
  DatasetVersion,
  datasetStorageStatus,
  downloadDataset,
  listDatasetVersions,
  retryDatasetVersion,
  uploadDataset,
} from "@/app/lib/trainingDatasetApi";
import { formatTestDate } from "@/app/lib/testDates";

export default function TrainingDatasetPage() {
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [storage, setStorage] = useState("unknown");
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = versions.find((version) => version.is_active);

  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function refresh() {
      try {
        const data = await listDatasetVersions(controller.signal);
        if (current) {
          setVersions(data);
          setLoading(false);
        }
      } catch (err) {
        if (current) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dataset versions.",
          );
          setLoading(false);
        }
      }
      if (current) timer = setTimeout(refresh, 3000);
    }
    void refresh();
    datasetStorageStatus(controller.signal)
      .then((result) => {
        if (current) setStorage(result.status);
      })
      .catch(() => {
        if (current) setStorage("unavailable");
      });
    return () => {
      current = false;
      clearTimeout(timer);
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
      setFile(null);
      setUploadKey(null);
      if (fileInput.current) fileInput.current.value = "";
      setReload((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not confirm upload. Retry with the same file to check its status.",
      );
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
      setError(err instanceof Error ? err.message : "Unable to download CSV.");
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
      setReload((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to retry publication.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/instructor"
        className="text-sm text-brand-light hover:underline"
      >
        &larr; Back to dashboard
      </Link>
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
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
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
          Use the columns from training_data_moh_eng_rubrics.csv. A new upload
          replaces the seed examples and retains automatically collected test
          rows. Earlier versions remain available.
        </p>
        <p className="break-words font-mono text-xs text-foreground/60">
          id, question, desired_answer, student_answer, criteria[],
          criteria_score[], criteria_max_score[], student_score
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
          <button
            onClick={() => setReload((value) => value + 1)}
            className="text-sm text-brand-light underline"
          >
            Refresh
          </button>
          <button
            disabled={busy || !active}
            onClick={() => download()}
            className="rounded bg-brand-light px-4 py-2 text-sm text-white disabled:opacity-50"
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
                      className="text-brand-light underline disabled:opacity-50"
                    >
                      Download v{version.number} CSV
                    </button>
                  )}
                  {version.status === "failed" && (
                    <button
                      disabled={busy}
                      onClick={() => retry(version)}
                      className="text-brand-light underline disabled:opacity-50"
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
