"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AttemptGradeResult,
  GradingApiError,
  editSubmission,
  getAttemptResult,
  getSubmission,
  retryGrading,
} from "@/app/lib/gradingApi";
import { formatTestDate } from "@/app/lib/testDates";

type Drafts = Record<
  string,
  { score: string; feedback: string; criteria: Record<string, string> }
>;
const draftsFor = (result: AttemptGradeResult): Drafts =>
  Object.fromEntries(
    result.responses.map((item) => {
      const question = result.questions.find((q) => q.id === item.question_id);
      const awarded = new Map(
        item.criterion_scores?.map((criterion) => [
          criterion.criteria_id,
          criterion.score,
        ]),
      );
      const labels = new Map(
        item.criteria_met.map((criterion) => [
          criterion.criteria_id,
          criterion.is_met,
        ]),
      );
      const criteria = Object.fromEntries(
        (question?.rubric?.criteria ?? []).map((criterion) => [
          criterion.id,
          awarded.has(criterion.id)
            ? String(awarded.get(criterion.id))
            : labels.has(criterion.id)
              ? String(labels.get(criterion.id) ? criterion.score : 0)
              : "",
        ]),
      );
      return [
        item.id,
        {
          score: String(item.score ?? ""),
          feedback: item.feedback ?? "",
          criteria,
        },
      ];
    }),
  );

export default function SubmissionReview({
  courseId,
  testId,
  attemptId,
  instructor = false,
}: {
  courseId: string;
  testId: string;
  attemptId: string;
  instructor?: boolean;
}) {
  const [result, setResult] = useState<AttemptGradeResult | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState(false);
  const backHref = instructor
    ? `/instructor/courses/${encodeURIComponent(courseId)}/tests/${encodeURIComponent(testId)}/submissions`
    : `/student/courses/${encodeURIComponent(courseId)}/tests/${encodeURIComponent(testId)}`;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const controller = new AbortController();
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await (instructor ? getSubmission : getAttemptResult)(
          testId,
          attemptId,
          controller.signal,
        );
        if (!active) return;
        setResult(data);
        setDrafts(draftsFor(data));
        setError(null);
        setConflict(false);
        if (data.attempt.status === "grading") timer = setTimeout(load, 1500);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to check submission status.",
        );
        // Connection errors do not change the persisted submission status.
        if (!(err instanceof GradingApiError) || err.status >= 500)
          timer = setTimeout(load, 5000);
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const focus = () => {
      if (!instructor) {
        clearTimeout(timer);
        void load();
      }
    };
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
      window.removeEventListener("focus", focus);
    };
  }, [testId, attemptId, instructor, reload]);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await retryGrading(testId, attemptId);
      setMessage("Grading queued again using your saved answers.");
      setReload((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry grading.");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!result) return;
    const original = draftsFor(result);
    const changed = result.responses.filter(
      (item) =>
        Number(drafts[item.id]?.score) !== item.score ||
        drafts[item.id]?.feedback !== (item.feedback ?? "") ||
        JSON.stringify(drafts[item.id]?.criteria) !==
          JSON.stringify(original[item.id]?.criteria),
    );
    if (!changed.length) {
      setMessage("No changes to save.");
      return;
    }
    for (const item of changed) {
      if (
        JSON.stringify(drafts[item.id].criteria) !==
          JSON.stringify(original[item.id].criteria) &&
        Object.values(drafts[item.id].criteria).some(
          (value) => !value.trim() || !Number.isFinite(Number(value)),
        )
      ) {
        setError(
          "Enter a score for every rubric criterion before saving criterion corrections.",
        );
        return;
      }
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await editSubmission(
        testId,
        attemptId,
        result.attempt.revision,
        changed.map((item) => ({
          response_id: item.id,
          score: Number(drafts[item.id].score),
          feedback: drafts[item.id].feedback,
          ...(JSON.stringify(drafts[item.id].criteria) !==
          JSON.stringify(original[item.id].criteria)
            ? {
                criterion_scores: Object.entries(drafts[item.id].criteria).map(
                  ([criteria_id, score]) => ({
                    criteria_id,
                    score: Number(score),
                  }),
                ),
              }
            : {}),
        })),
      );
      setResult(updated);
      setDrafts(draftsFor(updated));
      setMessage("Scores and feedback saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save grades.");
      if (
        err instanceof GradingApiError &&
        err.status === 409 &&
        /changed|latest graded/.test(err.message)
      )
        setConflict(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        className="text-sm text-brand-light hover:underline"
        href={backHref}
      >
        &larr;{" "}
        {instructor
          ? "Back to submissions"
          : "Back to test and attempt history"}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-brand-dark">
        {instructor ? "Submission review" : "Your submission"}
      </h1>
      {loading && (
        <p role="status" className="mt-4">
          Loading submission...
        </p>
      )}
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
      <button
        onClick={() => {
          if (
            instructor &&
            result &&
            JSON.stringify(drafts) !== JSON.stringify(draftsFor(result)) &&
            !window.confirm("Discard unsaved edits and reload grades?")
          )
            return;
          setReload((value) => value + 1);
        }}
        disabled={busy}
        className="mt-3 text-sm text-brand-light underline disabled:opacity-50"
      >
        Reload status and grades
      </button>
      {result && (
        <>
          <section
            className="mt-5 rounded-lg border border-gray-300 bg-white p-5"
            aria-live="polite"
          >
            <p className="font-semibold">
              Attempt {result.attempt.attempt_number} ·{" "}
              {result.attempt.status.replaceAll("_", " ")}
            </p>
            <p className="mt-1 text-xs text-foreground/60">
              Submitted:{" "}
              {result.attempt.submitted_at
                ? formatTestDate(result.attempt.submitted_at)
                : "Not submitted"}
            </p>
            {instructor && (
              <p className="mt-1 text-xs text-foreground/60">
                Student ID: {result.attempt.user_id}
              </p>
            )}
            {result.attempt.status === "grading" && (
              <>
                <p className="mt-3 text-sm">
                  Submitted—grading in progress. You can leave this page and
                  return later.
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  {result.completed_questions} / {result.total_questions}{" "}
                  questions graded.
                </p>
              </>
            )}
            {result.attempt.status === "graded" && (
              <p className="mt-3 text-lg font-semibold text-brand-dark">
                {result.total_score} / {result.max_score} (
                {result.percentage.toFixed(1)}%)
              </p>
            )}
            {result.attempt.status === "failed" && (
              <>
                <p className="mt-3 text-sm text-red-700">
                  Grading could not be completed. Your submitted answers and
                  completed grades are saved.
                </p>
                {result.attempt.error && (
                  <p className="mt-2 text-xs text-foreground/60">
                    {result.attempt.error}
                  </p>
                )}
                {!instructor && (
                  <button
                    onClick={retry}
                    disabled={busy}
                    className="mt-3 rounded bg-brand-light px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {busy ? "Queuing..." : "Retry grading saved answers"}
                  </button>
                )}
              </>
            )}
            {instructor && !result.can_edit && (
              <p className="mt-3 text-sm text-foreground/60">
                Only the student&apos;s latest graded submission can be edited.
                A newer submission may still be grading.
              </p>
            )}
          </section>
          <form onSubmit={save} className="mt-5 space-y-4">
            {result.questions.map((question, index) => {
              const response = result.responses.find(
                (item) => item.question_id === question.id,
              );
              return (
                <section
                  key={question.id}
                  className="rounded-lg border border-gray-300 bg-white p-5"
                >
                  <h2 className="text-sm font-semibold">
                    {index + 1}. {question.prompt}
                  </h2>
                  <p className="mt-3 text-xs font-medium text-foreground/60">
                    Submitted answer
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {response?.answer ?? "No answer submitted."}
                  </p>
                  {response && (
                    <>
                      <p className="mt-3 text-sm">
                        Score: {response.score ?? "Pending"} /{" "}
                        {question.max_score}
                      </p>
                      {response.overridden && (
                        <p className="mt-1 text-xs text-brand-light">
                          Updated by instructor
                          {response.edited_at
                            ? ` · ${formatTestDate(response.edited_at)}`
                            : ""}
                        </p>
                      )}
                      {instructor && response.overridden && (
                        <p className="mt-2 text-xs text-foreground/60">
                          Original automated score: {response.original_score}
                          <br />
                          Original feedback: {response.original_feedback}
                        </p>
                      )}
                      {instructor && result.can_edit ? (
                        <div className="mt-4 space-y-3">
                          {question.rubric && (
                            <fieldset className="space-y-3 rounded border border-gray-200 p-3">
                              <legend className="px-1 text-sm font-medium">
                                Rubric criterion scores
                              </legend>
                              <p className="text-xs text-foreground/60">
                                For CSV training export, criterion scores must
                                match the total. Changing all criterion scores
                                updates the total automatically.
                              </p>
                              {question.rubric.criteria.map(
                                (criterion, criterionIndex) => (
                                  <label
                                    key={criterion.id}
                                    className="block text-sm"
                                  >
                                    {criterion.description} (max{" "}
                                    {criterion.score})
                                    <input
                                      aria-label={`Criterion ${criterionIndex + 1} score for question ${index + 1}`}
                                      type="number"
                                      min={0}
                                      max={criterion.score}
                                      step="any"
                                      disabled={busy || conflict}
                                      value={
                                        drafts[response.id]?.criteria[
                                          criterion.id
                                        ] ?? ""
                                      }
                                      onChange={(event) =>
                                        setDrafts((previous) => {
                                          const criteria = {
                                            ...previous[response.id].criteria,
                                            [criterion.id]: event.target.value,
                                          };
                                          const complete = Object.values(
                                            criteria,
                                          ).every(
                                            (value) =>
                                              value.trim() &&
                                              Number.isFinite(Number(value)),
                                          );
                                          return {
                                            ...previous,
                                            [response.id]: {
                                              ...previous[response.id],
                                              criteria,
                                              ...(complete
                                                ? {
                                                    score: String(
                                                      Object.values(
                                                        criteria,
                                                      ).reduce(
                                                        (total, value) =>
                                                          total + Number(value),
                                                        0,
                                                      ),
                                                    ),
                                                  }
                                                : {}),
                                            },
                                          };
                                        })
                                      }
                                      className="mt-1 block w-32 rounded border border-gray-300 p-2"
                                    />
                                  </label>
                                ),
                              )}
                            </fieldset>
                          )}
                          <label className="block text-sm">
                            Score (increments of {question.score_increment})
                            <input
                              aria-label={`Score for question ${index + 1}`}
                              type="number"
                              required
                              min={0}
                              max={question.max_score}
                              step={question.score_increment}
                              disabled={busy || conflict}
                              value={drafts[response.id]?.score ?? ""}
                              onChange={(event) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [response.id]: {
                                    ...previous[response.id],
                                    score: event.target.value,
                                  },
                                }))
                              }
                              className="mt-1 block w-32 rounded border border-gray-300 p-2"
                            />
                          </label>
                          <label className="block text-sm">
                            Feedback
                            <textarea
                              aria-label={`Feedback for question ${index + 1}`}
                              maxLength={10000}
                              rows={4}
                              disabled={busy || conflict}
                              value={drafts[response.id]?.feedback ?? ""}
                              onChange={(event) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [response.id]: {
                                    ...previous[response.id],
                                    feedback: event.target.value,
                                  },
                                }))
                              }
                              className="mt-1 w-full rounded border border-gray-300 p-2"
                            />
                          </label>
                        </div>
                      ) : (
                        response.feedback && (
                          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">
                            {response.feedback}
                          </p>
                        )
                      )}
                    </>
                  )}
                </section>
              );
            })}
            {instructor && result.can_edit && (
              <button
                disabled={busy || conflict}
                className="rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save scores and feedback"}
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
}
