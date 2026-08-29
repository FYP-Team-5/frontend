"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Course, createCourse, GradingApiError, listCourses } from "../lib/gradingApi";

const inputClass =
  "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light";
const labelClass = "block text-sm font-medium text-foreground/80";

export default function InstructorDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setCourses(await listCourses());
    } catch (err) {
      setError(err instanceof GradingApiError ? err.message : "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createCourse({ id, title });
      setId("");
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof GradingApiError ? err.message : "Failed to create course.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-dark">Instructor Dashboard</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-foreground/60">Loading courses...</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/instructor/courses/${encodeURIComponent(course.id)}`}
            className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="h-16 border-b border-gray-300 bg-white" />
            <div className="p-4">
              <p className="font-semibold text-foreground">{course.title}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-foreground/50">
                {course.id}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-black/10 bg-white p-6 shadow-sm sm:max-w-md">
        <h2 className="text-lg font-semibold text-brand-dark">New course</h2>
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4">
          <div>
            <label className={labelClass}>
              Course ID
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          </div>
          <div>
            <label className={labelClass}>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Create course
          </button>
        </form>
      </div>
    </div>
  );
}
