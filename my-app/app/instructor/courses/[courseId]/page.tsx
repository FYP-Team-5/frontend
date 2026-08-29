"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { archiveRubric, listRubrics, Rubric, RagApiError, uploadRubric } from "../../../lib/ragApi";
import { attachRubric, Exam, GradingApiError, listExams } from "../../../lib/gradingApi";

export default function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);

  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attachFiles, setAttachFiles] = useState<Record<string, File | null>>({});
  const [attachingExamId, setAttachingExamId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [rubricList, examList] = await Promise.all([
        listRubrics(courseId),
        listExams(courseId),
      ]);
      setRubrics(rubricList);
      setExams(examList);
    } catch (err) {
      setError(
        err instanceof RagApiError || err instanceof GradingApiError
          ? err.message
          : "Failed to load course data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function handleDelete(rubricId: string) {
    setError(null);
    try {
      await archiveRubric(rubricId);
      await refresh();
    } catch (err) {
      setError(err instanceof RagApiError ? err.message : "Failed to delete rubric.");
    }
  }

  async function handleAttach(exam: Exam) {
    const file = attachFiles[exam.id];
    if (!file) return;
    setError(null);
    setAttachingExamId(exam.id);
    try {
      const rubric = await uploadRubric({
        file,
        courseId,
        examId: exam.id,
        title: exam.title,
      });
      await attachRubric(exam.id, rubric.id);
      setAttachFiles((prev) => ({ ...prev, [exam.id]: null }));
      await refresh();
    } catch (err) {
      setError(
        err instanceof RagApiError || err instanceof GradingApiError
          ? err.message
          : "Failed to attach rubric.",
      );
    } finally {
      setAttachingExamId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/instructor" className="text-sm text-brand-light hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">Course: {courseId}</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-foreground/60">Loading...</p>}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-dark">Rubrics</h2>
          <ul className="mt-3 divide-y divide-black/5">
            {rubrics.map((rubric) => (
              <li
                key={rubric.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{rubric.title}</p>
                  <p className="text-xs text-foreground/50">
                    v{rubric.version} · {rubric.processing_status}
                  </p>
                </div>
                {!rubric.archived ? (
                  <button
                    onClick={() => handleDelete(rubric.id)}
                    className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-foreground/40">archived</span>
                )}
              </li>
            ))}
            {rubrics.length === 0 && (
              <li className="py-3 text-sm text-foreground/50">No rubrics yet.</li>
            )}
          </ul>
          <p className="mt-4 text-xs text-foreground/50">
            Rubrics are uploaded per exam — create an exam to add one, or attach one
            below for an exam that doesn&apos;t have one yet.
          </p>
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-dark">Exams</h2>
          <ul className="mt-3 divide-y divide-black/5">
            {exams.map((exam) => (
              <li key={exam.id} className="py-3 text-sm">
                <p className="font-medium text-foreground">{exam.title}</p>
                <p className="text-xs text-foreground/50">
                  {exam.questions.length} question(s) ·{" "}
                  {exam.rubric_id ? "rubric attached" : "no rubric yet"}
                </p>
                {!exam.rubric_id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="file"
                      onChange={(e) =>
                        setAttachFiles((prev) => ({
                          ...prev,
                          [exam.id]: e.target.files?.[0] ?? null,
                        }))
                      }
                      className="text-xs text-foreground/70 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:file:opacity-90"
                    />
                    <button
                      onClick={() => handleAttach(exam)}
                      disabled={
                        !attachFiles[exam.id] || attachingExamId === exam.id
                      }
                      className="shrink-0 rounded border border-brand-dark px-2 py-1 text-xs font-medium text-brand-dark hover:bg-brand-dark/5 disabled:opacity-50"
                    >
                      Attach
                    </button>
                  </div>
                )}
              </li>
            ))}
            {exams.length === 0 && (
              <li className="py-3 text-sm text-foreground/50">No exams yet.</li>
            )}
          </ul>
          <Link
            href={`/instructor/courses/${encodeURIComponent(courseId)}/exams/new`}
            className="mt-4 inline-block rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            New exam
          </Link>
        </section>
      </div>
    </div>
  );
}
