"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Course,
  createCourse,
  GradingApiError,
  listCourses,
} from "../lib/gradingApi";

const inputClass =
  "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light";
const labelClass = "block text-sm font-medium text-foreground/80";

export default function InstructorDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);

  async function refresh() {
    try {
      setCourses(await listCourses());
      setError(null);
    } catch (err) {
      setError(
        err instanceof GradingApiError
          ? err.message
          : "Failed to load courses.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    listCourses()
      .then((data) => {
        if (active) setCourses(data);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Failed to load courses.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createCourse({ course_code: courseCode, course_name: courseName });
      setCourseCode("");
      setCourseName("");
      setShowCourseForm(false);
      await refresh();
    } catch (err) {
      setError(
        err instanceof GradingApiError
          ? err.message
          : "Failed to create course.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">
            Instructor Dashboard
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Manage courses, tests, and rubric-based grading.
          </p>
        </div>
        <Link
          href="/instructor/training-dataset"
          className="rounded border border-brand-dark px-4 py-2 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-dark hover:text-white"
        >
          Training dataset
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && (
        <p className="mt-4 text-sm text-foreground/60">Loading courses...</p>
      )}

      <h2 className="mt-8 text-lg font-semibold text-brand-dark">Courses</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/instructor/courses/${encodeURIComponent(course.id)}`}
            className="cursor-pointer overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition hover:border-brand-light hover:shadow-md"
          >
            <div className="h-2 bg-brand-dark" />
            <div className="p-4">
              <p className="font-semibold text-foreground">
                {course.course_name}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-foreground/50">
                {course.course_code}
              </p>
            </div>
          </Link>
        ))}
        {courses.length === 0 && !loading && (
          <p className="text-sm text-foreground/50">
            No courses yet. Create your first one below.
          </p>
        )}
      </div>

      {!showCourseForm && (
        <button
          type="button"
          onClick={() => setShowCourseForm(true)}
          className="mt-6 rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors hover:bg-brand-dark"
        >
          + New course
        </button>
      )}

      {showCourseForm && (
        <div className="mt-6 rounded-lg border border-gray-300 bg-white p-6 shadow-sm sm:max-w-md">
          <h2 className="text-lg font-semibold text-brand-dark">New course</h2>
          <p className="mt-1 text-xs text-foreground/50">
            Create a course, then add tests to it from the course page.
          </p>
          <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4">
            <div>
              <label className={labelClass}>
                Course code
                <input
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="e.g. CS101"
                  required
                  className={inputClass}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>
                Course name
                <input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Introduction to Computer Science"
                  required
                  className={inputClass}
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="self-start rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors hover:bg-brand-dark disabled:opacity-50 transition-colors hover:bg-brand-dark transition-colors hover:bg-brand-dark"
              >
                Create course
              </button>
              <button
                type="button"
                onClick={() => setShowCourseForm(false)}
                disabled={submitting}
                className="self-start rounded border border-brand-dark px-4 py-2 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-dark hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
