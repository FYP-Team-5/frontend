"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Course, GradingApiError, listCourses } from "../lib/gradingApi";

export default function StudentDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCourses()
      .then(setCourses)
      .catch((err) =>
        setError(err instanceof GradingApiError ? err.message : "Failed to load courses."),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-dark">Courses</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-foreground/60">Loading courses...</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/student/courses/${encodeURIComponent(course.id)}`}
            className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="h-16 border-b border-gray-300 bg-white" />
            <div className="p-4">
              <p className="font-semibold text-foreground">{course.title}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-foreground/50">
                Course #{course.id}
              </p>
            </div>
          </Link>
        ))}
        {courses.length === 0 && !loading && (
          <p className="text-sm text-foreground/50">No courses available yet.</p>
        )}
      </div>
    </div>
  );
}
