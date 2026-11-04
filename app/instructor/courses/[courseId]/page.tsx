"use client";

import Link from "next/link";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import TestStatusBadge from "@/app/components/TestStatusBadge";
import { testDisplayStatus } from "@/app/lib/testDates";
import { use, useEffect, useState } from "react";
import {
  Course,
  GradingApiError,
  Test,
  listCourses,
  listTests,
} from "../../../lib/gradingApi";

/**
 * Instructor course page: a slim list of test cards (TODO.md R6).
 * All per-test detail — grading readiness, rubric uploads and controls —
 * lives on the test detail page the whole card links to, mirroring the
 * student "List all Tests" pattern.
 */
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

  useEffect(() => {
    let active = true;
    Promise.allSettled([listCourses(), listTests(courseId)]).then(
      ([coursesResult, testsResult]) => {
        if (!active) return;
        if (coursesResult.status === "fulfilled") {
          setCourseName(
            coursesResult.value.find((course) => course.id === courseId)
              ?.course_name ?? null,
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
          setError(
            err instanceof GradingApiError
              ? err.message
              : "Failed to load course data.",
          );
        }
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [courseId]);

  // Keep the Open/Closed badges current while the page is open.
  useEffect(() => {
    const timer = window.setInterval(() => {
      listTests(courseId).then(setTests).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [courseId]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/instructor" },
          { label: courseName ?? `Course #${courseId}` },
        ]}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">
            {courseName ?? `Course #${courseId}`}
          </h1>
          <p className="text-xs text-foreground/50">Course #{courseId}</p>
        </div>
        <Link
          href={`/instructor/courses/${encodeURIComponent(courseId)}/exams/new`}
          className="rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors hover:bg-brand-dark"
        >
          + New test
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-foreground/60">Loading...</p>}

      <h2 className="mt-8 text-lg font-semibold text-brand-dark">Tests</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {tests.map((test) => (
          <Link
            key={test.id}
            href={`/instructor/courses/${encodeURIComponent(courseId)}/tests/${encodeURIComponent(test.id)}`}
            className="cursor-pointer overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition hover:border-brand-light hover:shadow-md"
          >
            <div className="h-2 bg-brand-dark" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {test.test_name}
                </p>
                <TestStatusBadge status={testDisplayStatus(test)} />
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-foreground/50">
                {test.questions.length} question(s) · max {test.max_attempts}{" "}
                attempt(s)
              </p>
            </div>
          </Link>
        ))}
        {tests.length === 0 && !loading && (
          <p className="text-sm text-foreground/50">
            No tests yet. Click &quot;New test&quot; to create one.
          </p>
        )}
      </div>
    </div>
  );
}
