"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { RagApiError, uploadRubric, waitForRubricProcessing } from "../../../lib/ragApi";
import { attachRubric, Exam, GradingApiError, listCourses, listExams } from "../../../lib/gradingApi";

export default function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);

  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attachFiles, setAttachFiles] = useState<Record<string, File | null>>({});
  const [attachingExamId, setAttachingExamId] = useState<string | null>(null);
  const [attachStage, setAttachStage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    // Fetched independently (not Promise.all) so that one source failing —
    // e.g. the rag service being unreachable — doesn't also block the course
    // title or exam list from updating with data that loaded successfully.
    const [coursesResult, examsResult] = await Promise.allSettled([
      listCourses(),
      listExams(courseId),
    ]);

    if (coursesResult.status === "fulfilled") {
      setCourseTitle(
        coursesResult.value.find((course) => course.id === courseId)?.title ?? null,
      );
    }
    if (examsResult.status === "fulfilled") {
      setExams(examsResult.value);
    }

    const failure = [coursesResult, examsResult].find(
      (result) => result.status === "rejected",
    );
    if (failure && failure.status === "rejected") {
      const err = failure.reason;
      setError(
        err instanceof RagApiError || err instanceof GradingApiError
          ? err.message
          : "Failed to load some course data.",
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function handleAttach(exam: Exam) {
    const file = attachFiles[exam.id];
    if (!file) return;
    setError(null);
    setAttachingExamId(exam.id);
    try {
      setAttachStage("Uploading...");
      const rubric = await uploadRubric({
        file,
        courseId,
        examId: exam.id,
        title: exam.title,
      });
      // Chunking/embedding runs in the background on the rag service, so the
      // rubric isn't attachable the instant upload returns — wait for it.
      setAttachStage("Processing document...");
      const processed = await waitForRubricProcessing(rubric.id);
      setAttachStage("Attaching...");
      await attachRubric(exam.id, processed.id);
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
      setAttachStage(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/instructor" className="text-sm text-brand-light hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">
        {courseTitle ?? `Course #${courseId}`}
      </h1>
      <p className="text-xs text-foreground/50">Course #{courseId}</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-foreground/60">Loading...</p>}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-dark">Exams</h2>
        <Link
          href={`/instructor/courses/${encodeURIComponent(courseId)}/exams/new`}
          className="rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + New exam
        </Link>
      </div>

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

              {exam.rubric_id ? (
                <p className="mt-3 text-xs font-medium text-green-700">
                  ✓ Rubric attached
                </p>
              ) : (
                <div className="mt-3">
                  <p className="text-xs font-medium text-amber-700">No rubric yet</p>
                  {attachingExamId === exam.id && attachStage && (
                    <p className="mt-1 text-xs text-foreground/60">{attachStage}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="file"
                      onChange={(e) =>
                        setAttachFiles((prev) => ({
                          ...prev,
                          [exam.id]: e.target.files?.[0] ?? null,
                        }))
                      }
                      disabled={attachingExamId === exam.id}
                      className="min-w-0 flex-1 text-xs text-foreground/70 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-2 file:py-1 file:text-xs file:font-medium file:text-white hover:file:opacity-90 disabled:opacity-50"
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
                </div>
              )}
            </div>
          </div>
        ))}

        {exams.length === 0 && !loading && (
          <p className="text-sm text-foreground/50">
            No exams yet. Click &quot;New exam&quot; to create one.
          </p>
        )}
      </div>
    </div>
  );
}
