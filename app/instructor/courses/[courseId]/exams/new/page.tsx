"use client";

import Breadcrumbs from "@/app/components/Breadcrumbs";
import { useToast } from "@/app/components/ToastProvider";
import { localDateInput, useLocalTimezone } from "@/app/lib/testDates";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  createTestFromCsv,
  GradingApiError,
  listCourses,
} from "../../../../../lib/gradingApi";

const inputClass =
  "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light";
const labelClass = "block text-sm font-medium text-foreground/80";
const fileInputClass =
  "mt-1 block w-full text-sm text-foreground/70 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90";

export default function NewTestPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const timezone = useLocalTimezone();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [testName, setTestName] = useState("");
  const [courseName, setCourseName] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState(() =>
    localDateInput(new Date().toISOString()),
  );
  const [endsAt, setEndsAt] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [file, setFile] = useState<File | null>(null);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      setError("End date must be after the start date.");
      return;
    }
    setSubmitting(true);
    try {
      await createTestFromCsv(courseId, {
        file,
        testName,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        maxAttempts: Number(maxAttempts),
      });
      toast(`Test "${testName}" created.`);
      // Rubric criteria are uploaded separately from the test's detail page,
      // once the test (and its question ids) exist.
      router.push(`/instructor/courses/${encodeURIComponent(courseId)}`);
    } catch (err) {
      const message = err instanceof GradingApiError
        ? err.message
        : "Failed to create test.";
      setError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/instructor" },
          {
            label: courseName ?? `Course #${courseId}`,
            href: `/instructor/courses/${encodeURIComponent(courseId)}`,
          },
          { label: "New test" },
        ]}
      />
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">New test</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-6">
        <section className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-dark">Details</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className={labelClass}>
                Test name
                <input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g. Assignment 1, Quiz 1"
                  required
                  className={inputClass}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>
                Start date ({timezone})
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>
                End date ({timezone})
                <input
                  type="datetime-local"
                  required
                  value={endsAt}
                  min={startsAt || undefined}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className={inputClass}
                />
              </label>
              <p className="mt-1 text-xs text-foreground/50">
                The test is open for attempts only between the start and end
                dates.
              </p>
            </div>
            <div>
              <label className={labelClass}>
                Max attempts
                <input
                  type="number"
                  min={1}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-dark">Questions</h2>
          <p className="mt-1 text-xs text-foreground/50">
            CSV with a header row, then one row per question:{" "}
            <span className="font-mono">
              id, prompt, max_score, score_increment
            </span>{" "}
            (optionally <span className="font-mono">model_answer</span>). The{" "}
            <span className="font-mono">id</span> is your own question number
            (e.g. <span className="font-mono">1.1</span>,{" "}
            <span className="font-mono">1.2</span>) — you&apos;ll reuse it in
            the rubric CSV to attach criteria to the right question.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className={`${fileInputClass} mt-3`}
          />
        </section>

        <button
          type="submit"
          disabled={submitting || !file || !testName || !startsAt || !endsAt}
          className="self-start rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors hover:bg-brand-dark"
        >
          {submitting ? "Creating..." : "Create test"}
        </button>
      </form>
    </div>
  );
}
