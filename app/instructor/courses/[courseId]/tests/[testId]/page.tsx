"use client";

import Link from "next/link";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import TestControls from "@/app/components/TestControls";
import TestStatusBadge from "@/app/components/TestStatusBadge";
import { useToast } from "@/app/components/ToastProvider";
import { use, useEffect, useState } from "react";
import {
  GradingApiError,
  Test,
  getTest,
  listCourses,
  uploadCriteriaCsv,
} from "@/app/lib/gradingApi";
import {
  formatTestDate,
  testDisplayStatus,
  useLocalTimezone,
  type TestDisplayStatus,
} from "@/app/lib/testDates";

/**
 * Instructor test detail page (TODO.md R6): the destination of an instructor
 * course page's test card. Hosts the controls that used to live on the card —
 * deadline management, rubric CSV upload and grading readiness — plus the
 * entry point to submissions. Readiness is rubric-only (TODO.md R8).
 */
function testReadiness(test: Test) {
  const missingRubric = test.questions.filter((q) => q.rubric === null);
  return {
    ready: missingRubric.length === 0,
    missingRubric,
    rubricCount: test.questions.length - missingRubric.length,
    total: test.questions.length,
  };
}

export default function InstructorTestPage({
  params,
}: {
  params: Promise<{ courseId: string; testId: string }>;
}) {
  const { courseId, testId } = use(params);
  const timezone = useLocalTimezone();

  const [test, setTest] = useState<Test | null>(null);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [criteriaFile, setCriteriaFile] = useState<File | null>(null);
  const [uploadingCriteria, setUploadingCriteria] = useState(false);
  const toast = useToast();
  const [courseName, setCourseName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTest(testId)
      .then((details) => {
        if (!active) return;
        setTest(details);
        setClosed(details.is_closed);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Failed to load test.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [testId]);

  // Course name for the breadcrumb trail only; failures leave the fallback label.
  useEffect(() => {
    let active = true;
    listCourses()
      .then((courses) => {
        if (active)
          setCourseName(
            courses.find((course) => course.id === courseId)?.course_name ?? null,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [courseId]);

  // Keep availability in sync, like the student detail page: poll while the
  // test is open or upcoming, and flip states the moment a window boundary
  // passes. A truly finished test stops polling.
  useEffect(() => {
    if (!test) return;
    const now = Date.now();
    const upcoming =
      test.starts_at !== null && now < Date.parse(test.starts_at);
    if (closed && !upcoming) return;
    let checking = false;
    const controller = new AbortController();
    const check = async () => {
      const currentTime = Date.now();
      if (
        (test.ends_at && currentTime >= Date.parse(test.ends_at)) ||
        (test.starts_at && currentTime < Date.parse(test.starts_at))
      )
        setClosed(true);
      if (checking) return;
      checking = true;
      try {
        const fresh = await getTest(testId, controller.signal);
        setTest(fresh);
        setClosed(fresh.is_closed);
      } catch {
        /* Polling errors are transient; the server still guards submissions. */
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(check, 5000);
    const boundaries = [test.starts_at, test.ends_at]
      .map((value) => (value ? Date.parse(value) : undefined))
      .filter((value): value is number => value !== undefined && value > now)
      .sort((left, right) => left - right);
    const boundaryTimer =
      boundaries.length > 0
        ? window.setTimeout(check, Math.min(boundaries[0] - now, 2_147_483_647))
        : undefined;
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.clearTimeout(boundaryTimer);
    };
  }, [test, closed, testId]);

  async function handleUploadCriteria() {
    if (!test || !criteriaFile) return;
    setError(null);
    setUploadingCriteria(true);
    try {
      setTest(await uploadCriteriaCsv(test.id, criteriaFile));
      setCriteriaFile(null);
      toast("Rubric criteria uploaded.");
    } catch (err) {
      const message =
        err instanceof GradingApiError
          ? err.message
          : "Failed to upload rubric criteria.";
      setError(message);
      toast(message, "error");
    } finally {
      setUploadingCriteria(false);
    }
  }

  const readiness = test ? testReadiness(test) : null;
  const status: TestDisplayStatus = test
    ? testDisplayStatus({ is_closed: closed, starts_at: test.starts_at })
    : "closed";
  const backHref = `/instructor/courses/${encodeURIComponent(courseId)}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/instructor" },
          { label: courseName ?? `Course #${courseId}`, href: backHref },
          { label: test?.test_name ?? "Test" },
        ]}
      />
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">
        {test?.test_name ?? "Test"}
      </h1>
      {loading && (
        <p className="mt-4" role="status">
          Loading...
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {test && readiness && (
        <>
          {/* Shared status display — identical markup to the student detail
              page (TODO.md R7). */}
          <div className="mt-2 flex items-center gap-2">
            <TestStatusBadge status={status} size="md" />
            <p className="text-sm">
              {test.questions.length} questions · max {test.max_attempts}{" "}
              attempts
            </p>
          </div>
          {test.starts_at && (
            <p className="mt-1 text-sm text-foreground/60">
              Starts: {formatTestDate(test.starts_at)} ({timezone})
            </p>
          )}
          <p className="mt-1 text-sm text-foreground/60">
            Ends: {formatTestDate(test.ends_at)} ({timezone})
          </p>
          {status === "upcoming" && (
            <p className="mt-4 rounded border border-sky-300 bg-sky-50 p-3 text-sm">
              This test opens on {formatTestDate(test.starts_at)} ({timezone}).
              Students gain access to attempts once it opens.
            </p>
          )}
          {closed && status !== "upcoming" && (
            <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
              This test is closed. Submitted attempts and grading results
              remain available.
            </p>
          )}

          <div className="mt-6">
            <Link
              href={`${backHref}/tests/${encodeURIComponent(test.id)}/submissions`}
              className="inline-block rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              View submissions
            </Link>
          </div>

          <section className="mt-6 rounded-lg border border-gray-300 bg-white p-5">
            <h2 className="font-semibold text-brand-dark">
              Grading readiness
            </h2>
            <p className="mt-1 text-[11px] text-foreground/40">
              Rubric: {readiness.rubricCount}/{readiness.total}
            </p>
            {readiness.ready ? (
              <p className="mt-2 text-xs font-medium text-green-700">
                ✓ Ready to grade ({readiness.total}/{readiness.total})
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-xs font-medium text-amber-700">
                  {readiness.missingRubric.length} question(s) still need a
                  rubric.
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {readiness.missingRubric.map((question) => (
                    <li
                      key={question.id}
                      className="flex items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1"
                    >
                      <span className="truncate text-xs text-foreground/70">
                        {question.prompt}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-gray-300 bg-white p-5">
            <h2 className="font-semibold text-brand-dark">Rubric criteria</h2>
            <p className="mt-1 text-xs text-foreground/50">
              CSV: <span className="font-mono">id, criteria, criteria_max_score</span>{" "}
              (optional <span className="font-mono">model_answer</span>)
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setCriteriaFile(e.target.files?.[0] ?? null)}
                disabled={uploadingCriteria}
                className="min-w-0 flex-1 text-xs text-foreground/70 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:file:opacity-90 disabled:opacity-50"
              />
              <button
                onClick={handleUploadCriteria}
                disabled={!criteriaFile || uploadingCriteria}
                className="shrink-0 rounded border border-brand-dark px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-dark hover:text-white disabled:opacity-50"
              >
                {uploadingCriteria ? "Uploading..." : "Upload"}
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-gray-300 bg-white p-5">
            <h2 className="font-semibold text-brand-dark">
              Availability and deadline
            </h2>
            <TestControls
              test={test}
              courseId={courseId}
              onUpdated={(updated) => {
                setTest(updated);
                setClosed(updated.is_closed);
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
