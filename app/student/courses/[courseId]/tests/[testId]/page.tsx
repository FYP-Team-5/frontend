"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  AttemptGradeResult,
  Attempt,
  GradingApiError,
  Test,
  createAttempt,
  gradeAttempt,
  getTest,
  waitForAttemptGrading,
} from "../../../../../lib/gradingApi";
import { getUser } from "../../../../../lib/session";

const textareaClass =
  "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light";

export default function TakeTestPage({
  params,
}: {
  params: Promise<{ courseId: string; testId: string }>;
}) {
  const { courseId, testId } = use(params);
  const user = getUser();

  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptGradeResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "submitting" | "grading">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getTest(testId)
      .then(setTest)
      .catch((err) =>
        setError(err instanceof GradingApiError ? err.message : "Failed to load test."),
      )
      .finally(() => setLoading(false));
  }, [testId]);

  async function handleStart() {
    if (!user) return;
    setError(null);
    setStarting(true);
    try {
      const newAttempt = await createAttempt(testId);
      setAttempt(newAttempt);
    } catch (err) {
      setError(
        err instanceof GradingApiError ? err.message : "Failed to start attempt.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !attempt || !test) return;
    setError(null);
    setSubmitPhase("submitting");
    try {
      const submitted = await gradeAttempt(testId, attempt.id, {
        responses: test.questions.map((q) => ({
          question_id: q.id,
          answer: answers[q.id] ?? "",
        })),
        finalize: true,
      });
      setAttempt(submitted);
      setSubmitPhase("grading");
      const graded = await waitForAttemptGrading(testId, attempt.id);
      setAttempt(graded.attempt);
      if (graded.attempt.status === "failed") {
        // Leave the form up (with answers intact) so the student can just
        // resubmit — the backend allows re-grading a failed attempt.
        setError(graded.attempt.error || "Grading failed — try submitting again.");
      } else {
        setResult(graded);
      }
    } catch (err) {
      setError(err instanceof GradingApiError ? err.message : "Failed to submit attempt.");
    } finally {
      setSubmitPhase("idle");
    }
  }

  const backHref = `/student/courses/${encodeURIComponent(courseId)}`;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-foreground/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href={backHref} className="text-sm text-brand-light hover:underline">
        &larr; Back to course
      </Link>

      {test && (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-brand-dark">{test.test_name}</h1>
          <p className="text-xs text-foreground/50">
            {test.questions.length} question(s) · max {test.max_attempts} attempt(s)
          </p>
        </>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {result ? (
        <section className="mt-6 rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-dark">Result</h2>
          <p className="mt-1 text-sm text-foreground/70">
            {result.total_score} / {result.max_score} ({result.percentage.toFixed(1)}%)
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {result.responses.map((response) => {
              const question = test?.questions.find((q) => q.id === response.question_id);
              return (
                <div key={response.id} className="rounded border border-black/10 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {question?.prompt ?? response.question_id}
                  </p>
                  <p className="mt-1 text-xs text-foreground/50">
                    Score: {response.score} / {question?.max_score ?? "?"}
                  </p>
                  {response.feedback && (
                    <p className="mt-2 text-sm text-foreground/70">{response.feedback}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : !attempt ? (
        <button
          onClick={handleStart}
          disabled={starting || !test}
          className="mt-6 rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {starting ? "Starting..." : "Start attempt"}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
          {test?.questions.map((question, index) => (
            <div
              key={question.id}
              className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {question.prompt}
              </p>
              <p className="mt-1 text-xs text-foreground/50">Max score: {question.max_score}</p>
              <textarea
                value={answers[question.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                }
                rows={4}
                required
                className={`${textareaClass} mt-3`}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={submitPhase !== "idle"}
            className="self-start rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitPhase === "submitting"
              ? "Submitting..."
              : submitPhase === "grading"
                ? "Grading..."
                : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
