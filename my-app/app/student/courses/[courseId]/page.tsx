"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Exam, GradingApiError, listCourses, listExams } from "../../../lib/gradingApi";

export default function StudentCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);

  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.allSettled([listCourses(), listExams(courseId)]).then(
      ([coursesResult, examsResult]) => {
        if (coursesResult.status === "fulfilled") {
          setCourseTitle(
            coursesResult.value.find((course) => course.id === courseId)?.title ?? null,
          );
        }
        if (examsResult.status === "fulfilled") {
          setExams(examsResult.value);
        } else {
          setError(
            examsResult.reason instanceof GradingApiError
              ? examsResult.reason.message
              : "Failed to load exams.",
          );
        }
        setLoading(false);
      },
    );
  }, [courseId]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/student" className="text-sm text-brand-light hover:underline">
        &larr; Back to courses
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">
        {courseTitle ?? `Course #${courseId}`}
      </h1>
      <p className="text-xs text-foreground/50">Course #{courseId}</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-foreground/60">Loading...</p>}

      <h2 className="mt-8 text-lg font-semibold text-brand-dark">Exams</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm"
          >
            <div className="h-2 bg-brand-dark" />
            <div className="p-4">
              <p className="font-semibold text-foreground">{exam.title}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-foreground/50">
                {exam.type} · {exam.questions.length} question(s) · max{" "}
                {exam.max_attempts} attempt(s)
              </p>
            </div>
          </div>
        ))}
        {exams.length === 0 && !loading && (
          <p className="text-sm text-foreground/50">No exams available yet.</p>
        )}
      </div>
    </div>
  );
}
