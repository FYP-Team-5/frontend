"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  GradingApiError,
  GradingMethod,
  Question,
  Test,
  listCourses,
  listTests,
  setGradingMethod,
  uploadCriteriaCsv,
  uploadExamplesCsv,
} from "../../../lib/gradingApi";

type QuestionStatus =
  | { kind: "resolved"; method: GradingMethod }
  | { kind: "ambiguous" }
  | { kind: "unassigned" };

function questionStatus(question: Question): QuestionStatus {
  const hasRubric = question.rubric !== null;
  const hasExamples = question.examples.length > 0;
  if (question.grading_method) return { kind: "resolved", method: question.grading_method };
  if (hasRubric && hasExamples) return { kind: "ambiguous" };
  if (hasRubric) return { kind: "resolved", method: "rubric" };
  if (hasExamples) return { kind: "resolved", method: "fewshot" };
  return { kind: "unassigned" };
}

function testReadiness(test: Test) {
  const ambiguous = test.questions.filter((q) => questionStatus(q).kind === "ambiguous");
  const unassigned = test.questions.filter((q) => questionStatus(q).kind === "unassigned");
  return {
    ready: ambiguous.length === 0 && unassigned.length === 0,
    ambiguous,
    unassigned,
    rubricCount: test.questions.filter((q) => q.rubric !== null).length,
    exampleCount: test.questions.filter((q) => q.examples.length > 0).length,
    total: test.questions.length,
  };
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
  const [exampleFiles, setExampleFiles] = useState<Record<string, File | null>>({});
  const [uploadingCriteriaTestId, setUploadingCriteriaTestId] = useState<string | null>(null);
  const [uploadingExamplesTestId, setUploadingExamplesTestId] = useState<string | null>(null);

  const [methodPopup, setMethodPopup] = useState<{ testId: string; question: Question } | null>(
    null,
  );
  const [settingMethod, setSettingMethod] = useState(false);
  const [bulkSettingTestId, setBulkSettingTestId] = useState<string | null>(null);

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
    setUploadingCriteriaTestId(test.id);
    try {
      await uploadCriteriaCsv(test.id, file);
      setCriteriaFiles((prev) => ({ ...prev, [test.id]: null }));
      await refresh();
    } catch (err) {
      setError(
        err instanceof GradingApiError ? err.message : "Failed to upload rubric criteria.",
      );
    } finally {
      setUploadingCriteriaTestId(null);
    }
  }

  async function handleUploadExamples(test: Test) {
    const file = exampleFiles[test.id];
    if (!file) return;
    setError(null);
    setUploadingExamplesTestId(test.id);
    try {
      await uploadExamplesCsv(test.id, file);
      setExampleFiles((prev) => ({ ...prev, [test.id]: null }));
      await refresh();
    } catch (err) {
      setError(
        err instanceof GradingApiError ? err.message : "Failed to upload few-shot examples.",
      );
    } finally {
      setUploadingExamplesTestId(null);
    }
  }

  async function handleChooseMethod(method: GradingMethod) {
    if (!methodPopup) return;
    setError(null);
    setSettingMethod(true);
    try {
      await setGradingMethod(methodPopup.testId, methodPopup.question.id, method);
      setMethodPopup(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof GradingApiError ? err.message : "Failed to set grading method.",
      );
    } finally {
      setSettingMethod(false);
    }
  }

  // Only touches questions that actually need a choice (both rubric and
  // examples attached) — a question with just one of the two is left alone,
  // since forcing the other method onto it would fail server-side.
  async function handleSetAllMethods(test: Test, method: GradingMethod) {
    const ambiguous = testReadiness(test).ambiguous;
    if (ambiguous.length === 0) return;
    setError(null);
    setBulkSettingTestId(test.id);
    try {
      await Promise.all(
        ambiguous.map((question) => setGradingMethod(test.id, question.id, method)),
      );
      await refresh();
    } catch (err) {
      setError(
        err instanceof GradingApiError
          ? err.message
          : "Failed to set grading method for all questions.",
      );
    } finally {
      setBulkSettingTestId(null);
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
          const readiness = testReadiness(test);
          return (
            <div
              key={test.id}
              className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm"
            >
              <div className="h-2 bg-brand-dark" />
              <div className="p-4">
                <p className="font-semibold text-foreground">{test.test_name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-foreground/50">
                  {readiness.total} question(s) · max {test.max_attempts} attempt(s)
                </p>

                {readiness.ready ? (
                  <p className="mt-3 text-xs font-medium text-green-700">
                    ✓ Ready to grade ({readiness.total}/{readiness.total})
                  </p>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-amber-700">
                      {readiness.ambiguous.length + readiness.unassigned.length} question(s)
                      need attention
                    </p>

                    {readiness.ambiguous.length > 0 && (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-foreground/50">
                            Apply to all {readiness.ambiguous.length}:
                          </span>
                          <button
                            onClick={() => handleSetAllMethods(test, "rubric")}
                            disabled={bulkSettingTestId === test.id}
                            className="rounded border border-brand-dark px-2 py-0.5 text-xs font-medium text-brand-dark hover:bg-brand-dark/5 disabled:opacity-50"
                          >
                            All rubric
                          </button>
                          <button
                            onClick={() => handleSetAllMethods(test, "fewshot")}
                            disabled={bulkSettingTestId === test.id}
                            className="rounded border border-brand-dark px-2 py-0.5 text-xs font-medium text-brand-dark hover:bg-brand-dark/5 disabled:opacity-50"
                          >
                            All few-shot
                          </button>
                        </div>
                        <ul className="mt-2 flex flex-col gap-1">
                        {readiness.ambiguous.map((question) => (
                          <li
                            key={question.id}
                            className="flex items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1"
                          >
                            <span className="truncate text-xs text-foreground/70">
                              {question.prompt}
                            </span>
                            <button
                              onClick={() => setMethodPopup({ testId: test.id, question })}
                              className="shrink-0 rounded border border-amber-700 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                            >
                              Choose method
                            </button>
                          </li>
                        ))}
                        </ul>
                      </>
                    )}

                    {readiness.unassigned.length > 0 && (
                      <p className="mt-1 text-xs text-foreground/50">
                        {readiness.unassigned.length} question(s) still need a rubric or
                        few-shot examples.
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-2 text-[11px] text-foreground/40">
                  Rubric: {readiness.rubricCount}/{readiness.total} · Examples:{" "}
                  {readiness.exampleCount}/{readiness.total}
                </p>

                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-foreground/70">Rubric criteria</p>
                  <p className="mt-1 text-xs text-foreground/50">
                    CSV: <span className="font-mono">id, criteria, criteria_max_score</span>{" "}
                    (optional <span className="font-mono">model_answer</span>)
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
                      disabled={uploadingCriteriaTestId === test.id}
                      className="min-w-0 flex-1 text-xs text-foreground/70 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:file:opacity-90 disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleUploadCriteria(test)}
                      disabled={!criteriaFiles[test.id] || uploadingCriteriaTestId === test.id}
                      className="shrink-0 rounded border border-brand-dark px-2 py-1 text-xs font-medium text-brand-dark hover:bg-brand-dark/5 disabled:opacity-50"
                    >
                      {uploadingCriteriaTestId === test.id ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-foreground/70">
                    Few-shot examples <span className="text-foreground/40">(optional)</span>
                  </p>
                  <p className="mt-1 text-xs text-foreground/50">
                    CSV:{" "}
                    <span className="font-mono">
                      id, good_answer, good_score, average_answer, average_score, bad_answer,
                      bad_score
                    </span>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) =>
                        setExampleFiles((prev) => ({
                          ...prev,
                          [test.id]: e.target.files?.[0] ?? null,
                        }))
                      }
                      disabled={uploadingExamplesTestId === test.id}
                      className="min-w-0 flex-1 text-xs text-foreground/70 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:file:opacity-90 disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleUploadExamples(test)}
                      disabled={!exampleFiles[test.id] || uploadingExamplesTestId === test.id}
                      className="shrink-0 rounded border border-brand-dark px-2 py-1 text-xs font-medium text-brand-dark hover:bg-brand-dark/5 disabled:opacity-50"
                    >
                      {uploadingExamplesTestId === test.id ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>
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

      {methodPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-brand-dark">Choose a grading method</h3>
            <p className="mt-2 text-xs text-foreground/60">
              This question has both a rubric and few-shot examples attached. Pick which one
              should grade student answers — this can&apos;t be left unresolved once both
              exist.
            </p>
            <p className="mt-3 rounded bg-gray-50 p-2 text-xs text-foreground/70">
              {methodPopup.question.prompt}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => handleChooseMethod("rubric")}
                disabled={settingMethod}
                className="rounded bg-brand-light px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Grade with rubric
              </button>
              <button
                onClick={() => handleChooseMethod("fewshot")}
                disabled={settingMethod}
                className="rounded border border-brand-dark px-3 py-2 text-sm font-medium text-brand-dark hover:bg-brand-dark/5 disabled:opacity-50"
              >
                Grade with few-shot examples
              </button>
              <button
                onClick={() => setMethodPopup(null)}
                disabled={settingMethod}
                className="mt-1 text-xs text-foreground/50 hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
