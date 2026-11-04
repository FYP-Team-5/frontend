"use client";

import Link from "next/link";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import TestStatusBadge from "@/app/components/TestStatusBadge";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  Attempt,
  GradingApiError,
  Test,
  createAttempt,
  getAttemptResult,
  getTest,
  gradeAttempt,
  listAttempts,
  listCourses,
} from "@/app/lib/gradingApi";
import {
  formatTestDate,
  testDisplayStatus,
  useLocalTimezone,
  type TestDisplayStatus,
} from "@/app/lib/testDates";

export default function TakeTestPage({
  params,
}: {
  params: Promise<{ courseId: string; testId: string }>;
}) {
  const { courseId, testId } = use(params);
  const router = useRouter();
  const timezone = useLocalTimezone();
  const [test, setTest] = useState<Test | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string | null>(null);
  const backHref = `/student/courses/${encodeURIComponent(courseId)}`;
  const resultHref = (id: string) =>
    `${backHref}/tests/${encodeURIComponent(testId)}/attempts/${encodeURIComponent(id)}`;

  useEffect(() => {
    let active = true;
    Promise.all([getTest(testId), listAttempts(testId)])
      .then(async ([details, history]) => {
        if (!active) return;
        setTest(details);
        setClosed(details.is_closed);
        setAttempts(history);
        const unfinished = history.findLast(
          (item) => item.status === "in_progress",
        );
        if (unfinished) {
          const saved = await getAttemptResult(testId, unfinished.id);
          if (!active) return;
          setAttempt(unfinished);
          setAnswers(
            Object.fromEntries(
              saved.responses.map((item) => [item.question_id, item.answer]),
            ),
          );
        }
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Failed to load test.");
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

  const testLoaded = test !== null;
  const startsAt = test?.starts_at;
  const endsAt = test?.ends_at;
  const serverClosed = test?.is_closed;
  const status: TestDisplayStatus = test
    ? testDisplayStatus({ is_closed: closed, starts_at: test.starts_at })
    : "closed";
  useEffect(() => {
    if (!testLoaded) return;
    const now = Date.now();
    const upcoming = Boolean(startsAt) && now < Date.parse(startsAt!);
    // Once the test is truly over (ended early or deadline passed) there is
    // nothing left to observe; an upcoming test must keep polling so it flips
    // to open when its start time arrives.
    if (serverClosed && !upcoming) return;
    let active = true;
    let checking = false;
    const controller = new AbortController();
    // Observe changing availability, while keeping the clock independent of fetched object identity.
    const check = async () => {
      const currentTime = Date.now();
      if (
        (endsAt && currentTime >= Date.parse(endsAt)) ||
        (startsAt && currentTime < Date.parse(startsAt))
      )
        setClosed(true);
      if (checking) return;
      checking = true;
      try {
        const fresh = await getTest(testId, controller.signal);
        if (active) {
          setClosed(fresh.is_closed);
          setTest(fresh);
        }
      } catch {
        /* Server-side closure still guards submissions while offline. */
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(check, 5000);
    // Re-check immediately at the next scheduled window boundary.
    const boundaries = [startsAt, endsAt]
      .map((value) => (value ? Date.parse(value) : undefined))
      .filter((value): value is number => value !== undefined && value > now)
      .sort((left, right) => left - right);
    const boundaryTimer =
      boundaries.length > 0
        ? window.setTimeout(
            check,
            Math.min(boundaries[0] - now, 2_147_483_647),
          )
        : undefined;
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.clearTimeout(boundaryTimer);
    };
  }, [testLoaded, serverClosed, startsAt, endsAt, testId]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const created = await createAttempt(testId);
      setAttempt(created);
      setAttempts((previous) =>
        previous.some((item) => item.id === created.id)
          ? previous
          : [...previous, created],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start attempt.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!test || !attempt) return;
    setBusy(true);
    setError(null);
    try {
      await gradeAttempt(testId, attempt.id, {
        responses: test.questions.map((question) => ({
          question_id: question.id,
          answer: answers[question.id] ?? "",
        })),
      });
      router.push(resultHref(attempt.id));
    } catch (err) {
      setError(
        err instanceof GradingApiError
          ? err.message
          : "Could not confirm submission. Check your attempt history before trying again.",
      );
      const history = await listAttempts(testId).catch(() => null);
      if (history) {
        setAttempts(history);
        const accepted = history.find(
          (item) => item.id === attempt.id && item.status !== "in_progress",
        );
        if (accepted) router.push(resultHref(accepted.id));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: "Courses", href: "/student" },
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
      {test && (
        <>
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
              Attempts become available once it opens.
            </p>
          )}
          {closed && status !== "upcoming" && (
            <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
              This test is closed. Your submitted attempts and results remain
              available.
            </p>
          )}
          <section className="mt-6 rounded-lg border border-gray-300 bg-white p-5">
            <h2 className="font-semibold text-brand-dark">Your attempts</h2>
            {attempts.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/60">
                No attempts yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {[...attempts].reverse().map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-brand-soft/60 px-5 py-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-brand-dark">
                          Attempt {item.attempt_number}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium capitalize text-brand-dark ring-1 ring-gray-200">
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-foreground/60">
                        {item.submitted_at
                          ? `Submitted ${formatTestDate(item.submitted_at)}`
                          : "Not submitted"}
                      </p>
                    </div>
                    {item.submitted_at && (
                      <Link
                        className="rounded bg-brand-light px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                        href={resultHref(item.id)}
                      >
                        {item.status === "graded"
                          ? "View submission"
                          : "View submission status"}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {!closed && !attempt && (
            <button
              onClick={start}
              disabled={busy || attempts.length >= test.max_attempts}
              className="mt-6 rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors hover:bg-brand-dark"
            >
              {busy
                ? "Starting..."
                : attempts.length >= test.max_attempts
                  ? "Attempt limit reached"
                  : "Start attempt"}
            </button>
          )}
          {!closed && attempt && (
            <form onSubmit={submit} className="mt-6 space-y-5">
              <h2 className="text-lg font-semibold">
                Attempt {attempt.attempt_number}
              </h2>
              {test.questions.map((question, index) => (
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
                disabled={busy}
                className="rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors hover:bg-brand-dark"
              >
                {busy ? "Submitting..." : "Submit for grading"}
              </button>
              <p className="text-xs text-foreground/60">
                After submission is accepted, you can leave and return later to
                see your grades.
              </p>
            </form>
          )}
        </>
      )}
    </div>
  );
}
