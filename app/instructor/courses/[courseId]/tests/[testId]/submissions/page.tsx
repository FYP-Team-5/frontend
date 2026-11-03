"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  StudentSubmissionSummary,
  Test,
  getTest,
  listSubmissions,
} from "@/app/lib/gradingApi";
import { formatTestDate } from "@/app/lib/testDates";

export default function SubmissionsPage({
  params,
}: {
  params: Promise<{ courseId: string; testId: string }>;
}) {
  const { courseId, testId } = use(params);
  const [test, setTest] = useState<Test | null>(null);
  const [rows, setRows] = useState<StudentSubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const base = `/instructor/courses/${encodeURIComponent(courseId)}/tests/${encodeURIComponent(testId)}/submissions`;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const [details, submissions] = await Promise.all([
          getTest(testId),
          listSubmissions(testId, controller.signal),
        ]);
        if (!active) return;
        setTest(details);
        setRows(submissions);
        setError(null);
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : "Unable to load submissions.",
          );
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(load, 5000);
        }
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [testId, reload]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href={`/instructor/courses/${encodeURIComponent(courseId)}`}
        className="text-sm text-brand-light hover:underline"
      >
        &larr; Back to course
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-brand-dark">
        {test?.test_name ?? "Test"} submissions
      </h1>
      <p className="mt-2 text-sm text-foreground/60">
        Latest submitted attempt for each registered student. Unsubmitted
        attempts are excluded.
      </p>
      <button
        className="mt-3 text-sm text-brand-light underline"
        onClick={() => setReload((value) => value + 1)}
      >
        Refresh submissions
      </button>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="mt-4">
          Loading...
        </p>
      )}
      <div className="mt-5 overflow-x-auto rounded-lg border border-gray-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Student",
                "Submitted",
                "Attempt",
                "Status",
                "Score",
                "Review",
              ].map((label) => (
                <th key={label} className="px-4 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id} className="border-t border-gray-200">
                <td className="px-4 py-3 font-medium">
                  {row.full_name}
                  <br />
                  <span className="text-xs font-normal text-foreground/60">
                    {row.student_number}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.latest_submission?.submitted_at
                    ? formatTestDate(row.latest_submission.submitted_at)
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {row.latest_submission?.attempt_number ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {row.latest_submission?.status.replaceAll("_", " ") ??
                    "No submission"}
                </td>
                <td className="px-4 py-3">
                  {row.total_score === null
                    ? "—"
                    : `${row.total_score} / ${row.max_score}`}
                </td>
                <td className="space-y-2 px-4 py-3">
                  {row.latest_submission && (
                    <Link
                      className="block text-brand-light underline"
                      href={`${base}/${encodeURIComponent(row.latest_submission.id)}`}
                    >
                      View latest submission
                    </Link>
                  )}
                  {row.latest_graded_submission &&
                    row.latest_graded_submission.id !==
                      row.latest_submission?.id && (
                      <Link
                        className="block text-brand-light underline"
                        href={`${base}/${encodeURIComponent(row.latest_graded_submission.id)}`}
                      >
                        Edit latest graded attempt (
                        {row.latest_graded_submission.attempt_number})
                      </Link>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <p className="p-4 text-sm text-foreground/60">
            No registered students.
          </p>
        )}
      </div>
    </div>
  );
}
