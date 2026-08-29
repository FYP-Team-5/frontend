"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { uploadRubric, RagApiError } from "../../../../../lib/ragApi";
import { attachRubric, createExam, Exam, GradingApiError } from "../../../../../lib/gradingApi";

interface QuestionRow {
  id: string;
  prompt: string;
  max_score: string;
}

const inputClass =
  "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light";
const labelClass = "block text-sm font-medium text-foreground/80";

export default function NewExamPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdExam, setCreatedExam] = useState<Exam | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"exam" | "quiz">("exam");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [questions, setQuestions] = useState<QuestionRow[]>([
    { id: "", prompt: "", max_score: "" },
  ]);

  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [rubricTitle, setRubricTitle] = useState("");
  const [attaching, setAttaching] = useState(false);

  function addQuestion() {
    setQuestions([...questions, { id: "", prompt: "", max_score: "" }]);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function updateQuestion(index: number, field: keyof QuestionRow, value: string) {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const exam = await createExam(courseId, {
        title,
        type,
        max_attempts: Number(maxAttempts),
        questions: questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          max_score: Number(q.max_score),
        })),
      });
      setCreatedExam(exam);
    } catch (err) {
      setError(err instanceof GradingApiError ? err.message : "Failed to create exam.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAttachRubric(e: React.FormEvent) {
    e.preventDefault();
    if (!createdExam || !rubricFile) return;
    setError(null);
    setAttaching(true);
    try {
      const rubric = await uploadRubric({
        file: rubricFile,
        courseId,
        examId: createdExam.id,
        title: rubricTitle || createdExam.title,
      });
      await attachRubric(createdExam.id, rubric.id);
      router.push(`/instructor/courses/${encodeURIComponent(courseId)}`);
    } catch (err) {
      setError(
        err instanceof RagApiError || err instanceof GradingApiError
          ? err.message
          : "Failed to attach rubric.",
      );
    } finally {
      setAttaching(false);
    }
  }

  if (createdExam) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-brand-dark">
          Exam created: {createdExam.title}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          Now attach a grading rubric, or skip this and add one later.
        </p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <form
          onSubmit={handleAttachRubric}
          className="mt-6 rounded-lg border border-gray-300 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-brand-dark">Rubric</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className={labelClass}>
                File
                <input
                  type="file"
                  onChange={(e) => setRubricFile(e.target.files?.[0] ?? null)}
                  required
                  className="mt-1 block w-full text-sm text-foreground/70 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90"
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>
                Rubric title (optional)
                <input
                  value={rubricTitle}
                  onChange={(e) => setRubricTitle(e.target.value)}
                  placeholder={createdExam.title}
                  className={inputClass}
                />
              </label>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <button
              type="submit"
              disabled={attaching || !rubricFile}
              className="rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Upload and attach
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/instructor/courses/${encodeURIComponent(courseId)}`)
              }
              className="text-sm text-foreground/60 hover:underline"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/instructor/courses/${encodeURIComponent(courseId)}`}
        className="text-sm text-brand-light hover:underline"
      >
        &larr; Back to course
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-brand-dark">New exam</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreateExam} className="mt-6 flex flex-col gap-6">
        <section className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-dark">Details</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className={labelClass}>
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Assignment 1, Quiz 1"
                  required
                  className={inputClass}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>
                Type
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "exam" | "quiz")}
                  className={inputClass}
                >
                  <option value="exam">Exam</option>
                  <option value="quiz">Quiz</option>
                </select>
              </label>
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
          <h2 className="text-lg font-semibold text-brand-dark">
            Questions (open-ended)
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {questions.map((q, i) => (
              <div
                key={i}
                className="rounded border border-black/10 bg-brand-soft/40 p-4"
              >
                <div className="flex flex-col gap-3">
                  <label className={labelClass}>
                    Question ID
                    <input
                      value={q.id}
                      onChange={(e) => updateQuestion(i, "id", e.target.value)}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Prompt
                    <textarea
                      value={q.prompt}
                      onChange={(e) => updateQuestion(i, "prompt", e.target.value)}
                      required
                      rows={3}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Max score
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={q.max_score}
                      onChange={(e) => updateQuestion(i, "max_score", e.target.value)}
                      required
                      className={inputClass}
                    />
                  </label>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(i)}
                      className="self-start text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove question
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addQuestion}
            className="mt-4 rounded border border-brand-dark px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-dark/5"
          >
            Add question
          </button>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Create exam
        </button>
      </form>
    </div>
  );
}
