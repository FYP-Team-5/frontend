"use client";

import Link from "next/link";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import TestStatusBadge from "@/app/components/TestStatusBadge";
import { testDisplayStatus } from "@/app/lib/testDates";
import { use, useEffect, useState } from "react";
import {
  GradingApiError,
  Test,
  listCourses,
  listTests,
} from "../../../lib/gradingApi";

export default function StudentCoursePage({
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
    Promise.allSettled([listCourses(), listTests(courseId)]).then(
      ([coursesResult, testsResult]) => {
        if (coursesResult.status === "fulfilled") {
          setCourseName(
            coursesResult.value.find((course) => course.id === courseId)
              ?.course_name ?? null,
          );
        }
        if (testsResult.status === "fulfilled") {
          setTests(testsResult.value);
        } else {
          setError(
            testsResult.reason instanceof GradingApiError
              ? testsResult.reason.message
              : "Failed to load tests.",
          );
        }
        setLoading(false);
      },
    );
  }, [courseId]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: "Courses", href: "/student" },
          { label: courseName ?? `Course #${courseId}` },
        ]}
      />
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">
        {courseName ?? `Course #${courseId}`}
      </h1>
      <p className="text-xs text-foreground/50">Course #{courseId}</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-foreground/60">Loading...</p>}

      <h2 className="mt-8 text-lg font-semibold text-brand-dark">Tests</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {tests.map((test) => (
          <Link
            key={test.id}
            href={`/student/courses/${encodeURIComponent(courseId)}/tests/${encodeURIComponent(test.id)}`}
            className="cursor-pointer overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition hover:border-brand-light hover:shadow-md"
          >
            <div className="h-2 bg-brand-dark" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{test.test_name}</p>
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
          <p className="text-sm text-foreground/50">No tests available yet.</p>
        )}
      </div>
    </div>
  );
}
