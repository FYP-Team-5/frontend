"use client";

import { use, useEffect, useState } from "react";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import SubmissionReview from "@/app/components/SubmissionReview";
import { useToast } from "@/app/components/ToastProvider";
import {
  AttemptGradeResult,
  Test,
  getAttemptResult,
  getTest,
  gradeAttempt,
  listCourses,
} from "@/app/lib/gradingApi";
import { formatTestDate } from "@/app/lib/testDates";

/**
 * Student attempt page. While the attempt is in progress this page is the
 * take-test experience (one page, one question form); once submitted it
 * delegates to the shared submission review view.
 */
export default function AttemptPage({
  params,
}: {
  params: Promise<{ courseId: string; testId: string; attemptId: string }>;
}) {
  const values = use(params);
  const { courseId, testId, attemptId } = values;
  const toast = useToast();
  const [attemptData, setAttemptData] = useState<AttemptGradeResult | null>(
    null,
  );
  const [test, setTest] = useState<Test | null>(null);
  const [courseName, setCourseName] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getAttemptResult(testId, attemptId), getTest(testId)])
      .then(([result, details]) => {
        if (!active) return;
        setAttemptData(result);
        setTest(details);
        setAnswers(
          Object.fromEntries(
            result.responses.map((item) => [item.question_id, item.answer]),
          ),
        );
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Failed to load attempt.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [testId, attemptId]);

  // Course name for the breadcrumb trail only; failures leave the fallback label.
  useEffect(() => {
    let active = true;
    listCourses()
      .then((courses) => {
        if (active)
          setCourseName(
            courses.find((course) => course.id === courseId)?.course_name ??
              null,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [courseId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!attemptData) return;
    setBusy(true);
    setError(null);
    try {
      await gradeAttempt(testId, attemptData.attempt.id, {
        responses: (test?.questions ?? attemptData.questions).map(
          (question) => ({
            question_id: question.id,
            answer: answers[question.id] ?? "",
          }),
        ),
      });
      toast("Attempt submitted for grading.");
      setSubmitted(true);
    } catch {
      // The request may still have reached the server, so fixed guidance is
      // safer than echoing a raw error; failures are already in the toast.
      toast(
        "Could not confirm submission. Check your attempt history before trying again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p role="status" className="mt-2">
          Loading attempt...
        </p>
      </div>
    );
  }

  const inProgress =
    attemptData !== null &&
    attemptData.attempt.status === "in_progress" &&
    !submitted;
  if (!inProgress) {
    // Submitted, graded, or failed: the review view owns the page (and it
    // also surfaces load errors from above when there is nothing to render).
    return <SubmissionReview key={attemptId} {...values} />;
  }

  const attempt = attemptData.attempt;
  const questions = test?.questions ?? attemptData.questions;
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: "Courses", href: "/student" },
          {
            label: courseName ?? `Course #${courseId}`,
            href: `/student/courses/${encodeURIComponent(courseId)}`,
          },
          {
            label: test?.test_name ?? "Test",
            href: `/student/courses/${encodeURIComponent(courseId)}/tests/${encodeURIComponent(testId)}`,
          },
          { label: `Attempt ${attempt.attempt_number}` },
        ]}
      />
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">
        Attempt {attempt.attempt_number}
      </h1>
      <p className="mt-1 text-sm text-foreground/60">
        {questions.length} questions
        {test &&
          ` · Ends: ${formatTestDate(test.ends_at)}${
            test.starts_at
              ? ` · Starts: ${formatTestDate(test.starts_at)}`
              : ""
          }`}
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="mt-6 space-y-5">
        {questions.map((question, index) => (
          <div
            key={question.id}
            className="rounded-lg border border-gray-300 bg-white p-5"
          >
            <label
              className="block text-sm font-medium"
              htmlFor={question.id}
            >
              {index + 1}. {question.prompt}
            </label>
            <p className="mt-1 text-xs text-foreground/60">
              Max score: {question.max_score}
            </p>
            <textarea
              id={question.id}
              required
              disabled={busy}
              rows={5}
              value={answers[question.id] ?? ""}
              onChange={(event) =>
                setAnswers((previous) => ({
                  ...previous,
                  [question.id]: event.target.value,
                }))
              }
              className="mt-3 w-full rounded border border-gray-300 p-3 text-sm disabled:opacity-60"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors hover:bg-brand-dark"
        >
          {busy ? "Submitting..." : "Submit for grading"}
        </button>
        <p className="text-xs text-foreground/60">
          After submission is accepted, you can leave and return later to see
          your grades.
        </p>
      </form>
    </div>
  );
}
