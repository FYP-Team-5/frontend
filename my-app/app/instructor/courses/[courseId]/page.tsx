"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  GradingApiError,
  Test,
  listCourses,
  listTests,
  uploadCriteriaCsv,
} from "../../../lib/gradingApi";

function rubricStatus(test: Test): { done: number; total: number } {
  const total = test.questions.length;
  const done = test.questions.filter((q) => q.rubric !== null).length;
  return { done, total };
}

export default function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);

  const [courseName, setCourseName] = useState<string | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [criteriaFiles, setCriteriaFiles] = useState<Record<string, File | null>>({});
  const [uploadingTestId, setUploadingTestId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    // Fetched independently (not Promise.all) so that one source failing
    // doesn't also block the other from updating with data that loaded.
    const [coursesResult, testsResult] = await Promise.allSettled([
      listCourses(),
      listTests(courseId),
    ]);

    if (coursesResult.status === "fulfilled") {
      setCourseName(
        coursesResult.value.find((course) => course.id === courseId)?.course_name ?? null,
      );
    }
    if (testsResult.status === "fulfilled") {
      setTests(testsResult.value);
    }

    const failure = [coursesResult, testsResult].find(
      (result) => result.status === "rejected",
    );
    if (failure && failure.status === "rejected") {
      const err = failure.reason;
      setError(err instanceof GradingApiError ? err.message : "Failed to load course data.");
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function handleUploadCriteria(test: Test) {
    const file = criteriaFiles[test.id];
    if (!file) return;
    setError(null);
    setUploadingTestId(test.id);
    try {
      await uploadCriteriaCsv(test.id, file);
      setCriteriaFiles((prev) => ({ ...prev, [test.id]: null }));
      await refresh();
    } catch (err) {
      setError(
        err instanceof GradingApiError ? err.message : "Failed to upload rubric criteria.",
      );
    } finally {
      setUploadingTestId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/instructor" className="text-sm text-brand-light hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">
        {courseName ?? `Course #${courseId}`}
      </h1>
      <p className="text-xs text-foreground/50">Course #{courseId}</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-foreground/60">Loading...</p>}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-dark">Tests</h2>
        <Link
          href={`/instructor/courses/${encodeURIComponent(courseId)}/exams/new`}
          className="rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + New test
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {tests.map((test) => {
          const { done, total } = rubricStatus(test);
          const complete = total > 0 && done === total;
          return (
            <div
              key={test.id}
              className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm"
            >
              <div className="h-2 bg-brand-dark" />
              <div className="p-4">
                <p className="font-semibold text-foreground">{test.test_name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-foreground/50">
                  {total} question(s) · max {test.max_attempts} attempt(s)
                </p>

                {complete ? (
                  <p className="mt-3 text-xs font-medium text-green-700">
                    ✓ Rubrics attached ({done}/{total})
                  </p>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-amber-700">
                      Rubrics missing ({done}/{total} questions)
                    </p>
                    <p className="mt-1 text-xs text-foreground/50">
                      CSV: <span className="font-mono">id, criteria, criteria_max_score</span>
                      {" "}(optional <span className="font-mono">model_answer</span>)
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) =>
                          setCriteriaFiles((prev) => ({
                            ...prev,
                            [test.id]: e.target.files?.[0] ?? null,
                          }))
                        }
                        disabled={uploadingTestId === test.id}
                        className="min-w-0 flex-1 text-xs text-foreground/70 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:file:opacity-90 disabled:opacity-50"
                      />
                      <button
                        onClick={() => handleUploadCriteria(test)}
                        disabled={!criteriaFiles[test.id] || uploadingTestId === test.id}
                        className="shrink-0 rounded border border-brand-dark px-2 py-1 text-xs font-medium text-brand-dark hover:bg-brand-dark/5 disabled:opacity-50"
                      >
                        {uploadingTestId === test.id ? "Uploading..." : "Upload"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {tests.length === 0 && !loading && (
          <p className="text-sm text-foreground/50">
            No tests yet. Click &quot;New test&quot; to create one.
          </p>
        )}
      </div>
    </div>
  );
}
