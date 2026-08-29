"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { readCsvFile } from "../../../../../lib/csv";
import { createExam, GradingApiError } from "../../../../../lib/gradingApi";

interface ParsedQuestion {
  id: string;
  prompt: string;
  max_score: number;
  criteria: string[];
}

const inputClass =
  "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light";
const labelClass = "block text-sm font-medium text-foreground/80";
const fileInputClass =
  "mt-1 block w-full text-sm text-foreground/70 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-brand-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90";

function nonEmptyRows(rows: string[][]): string[][] {
  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

export default function NewExamPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"exam" | "quiz">("exam");
  const [maxAttempts, setMaxAttempts] = useState("1");

  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [questionsCsvError, setQuestionsCsvError] = useState<string | null>(null);
  const [criteriaCsvError, setCriteriaCsvError] = useState<string | null>(null);

  async function handleQuestionsCsv(file: File | null) {
    if (!file) {
      setQuestions([]);
      setQuestionsCsvError(null);
      return;
    }
    try {
      const rows = nonEmptyRows(await readCsvFile(file));
      const dataRows = rows.slice(1); // first row is the header
      const seen = new Set<string>();
      const parsed = dataRows.map((cells, index) => {
        const rowNumber = index + 2;
        if (cells.length < 3) {
          throw new Error(
            `Row ${rowNumber}: expected 3 columns (question_id, question, total_marks) but found ${cells.length}. ` +
              "If your question text contains commas, only quote that field — don't wrap the whole line in quotes.",
          );
        }
        const [rawId, rawPrompt, rawMarks] = cells;
        const id = (rawId ?? "").trim();
        const prompt = (rawPrompt ?? "").trim();
        if (!id) throw new Error(`Row ${rowNumber}: missing question ID.`);
        if (seen.has(id)) throw new Error(`Row ${rowNumber}: duplicate question ID "${id}".`);
        seen.add(id);
        if (!prompt) throw new Error(`Row ${rowNumber}: missing question text.`);
        const maxScore = Number(rawMarks);
        if (!rawMarks?.trim() || Number.isNaN(maxScore) || maxScore <= 0) {
          throw new Error(`Row ${rowNumber}: invalid total marks "${rawMarks ?? ""}".`);
        }
        return { id, prompt, max_score: maxScore, criteria: [] as string[] };
      });
      if (parsed.length === 0) {
        throw new Error("No question rows found (expected a header row plus at least one question).");
      }
      setQuestions(parsed);
      setQuestionsCsvError(null);
      setCriteriaCsvError(null);
    } catch (err) {
      setQuestions([]);
      setQuestionsCsvError(
        err instanceof Error ? err.message : "Failed to parse questions CSV.",
      );
    }
  }

  async function handleCriteriaCsv(file: File | null) {
    if (!file) {
      setQuestions((prev) => prev.map((q) => ({ ...q, criteria: [] })));
      setCriteriaCsvError(null);
      return;
    }
    try {
      const rows = nonEmptyRows(await readCsvFile(file));
      const dataRows = rows.slice(1); // first row is the header
      const criteriaById = new Map<string, string[]>();
      dataRows.forEach((cells, index) => {
        const rowNumber = index + 2;
        if (cells.length < 2) {
          throw new Error(
            `Row ${rowNumber}: expected 2 columns (question_id, criterion) but found ${cells.length}. ` +
              "If your criterion text contains commas, only quote that field — don't wrap the whole line in quotes.",
          );
        }
        const [rawId, rawCriterion] = cells;
        const id = (rawId ?? "").trim();
        const criterion = (rawCriterion ?? "").trim();
        if (!id) throw new Error(`Row ${rowNumber}: missing question ID.`);
        if (!criterion) throw new Error(`Row ${rowNumber}: missing criterion text.`);
        const list = criteriaById.get(id) ?? [];
        list.push(criterion);
        criteriaById.set(id, list);
      });
      const knownIds = new Set(questions.map((q) => q.id));
      for (const id of criteriaById.keys()) {
        if (!knownIds.has(id)) {
          throw new Error(
            `Rubric CSV references question ID "${id}", which isn't in the uploaded questions CSV.`,
          );
        }
      }
      setQuestions((prev) =>
        prev.map((q) => ({ ...q, criteria: criteriaById.get(q.id) ?? [] })),
      );
      setCriteriaCsvError(null);
    } catch (err) {
      setCriteriaCsvError(
        err instanceof Error ? err.message : "Failed to parse rubric CSV.",
      );
    }
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createExam(courseId, {
        title,
        type,
        max_attempts: Number(maxAttempts),
        questions: questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          max_score: q.max_score,
          criteria: q.criteria,
        })),
      });
      // Rubric attachment happens from the course page's exam card — the
      // single place to do it, whether right after creation or later.
      router.push(`/instructor/courses/${encodeURIComponent(courseId)}`);
    } catch (err) {
      setError(err instanceof GradingApiError ? err.message : "Failed to create exam.");
    } finally {
      setSubmitting(false);
    }
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
          <h2 className="text-lg font-semibold text-brand-dark">Questions</h2>
          <p className="mt-1 text-xs text-foreground/50">
            CSV with a header row, then one row per question:{" "}
            <span className="font-mono">question_id, question, total_marks</span>
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleQuestionsCsv(e.target.files?.[0] ?? null)}
            required
            className={`${fileInputClass} mt-3`}
          />
          {questionsCsvError && (
            <p className="mt-2 text-sm text-red-600">{questionsCsvError}</p>
          )}

          {questions.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded border border-black/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-soft/40 text-xs uppercase text-foreground/50">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Question</th>
                    <th className="px-3 py-2">Marks</th>
                    <th className="px-3 py-2">Criteria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td className="px-3 py-2 font-mono text-xs">{q.id}</td>
                      <td className="px-3 py-2">{q.prompt}</td>
                      <td className="px-3 py-2">{q.max_score}</td>
                      <td className="px-3 py-2 text-foreground/70">
                        {q.criteria.length > 0 ? (
                          <ul className="list-inside list-disc">
                            {q.criteria.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-foreground/40">none</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-dark">
            Rubric criteria (optional)
          </h2>
          <p className="mt-1 text-xs text-foreground/50">
            CSV with a header row, then one row per criterion:{" "}
            <span className="font-mono">question_id, criterion</span>. A question can
            have multiple rows; each criterion is graded true/false. Not every
            question needs one.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleCriteriaCsv(e.target.files?.[0] ?? null)}
            disabled={questions.length === 0}
            className={`${fileInputClass} mt-3 disabled:cursor-not-allowed disabled:opacity-50`}
          />
          {questions.length === 0 && (
            <p className="mt-2 text-xs text-foreground/40">
              Upload the questions CSV first.
            </p>
          )}
          {criteriaCsvError && (
            <p className="mt-2 text-sm text-red-600">{criteriaCsvError}</p>
          )}
        </section>

        <button
          type="submit"
          disabled={submitting || questions.length === 0 || !!questionsCsvError}
          className="self-start rounded bg-brand-light px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Create exam
        </button>
      </form>
    </div>
  );
}
