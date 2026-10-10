// The grading/catalog routes now live on the same `backend` service as auth
// (grading + user microservices were collapsed into it), just gated by a
// separate X-API-Key instead of the JWT bearer token used by /auth and /users.
// Attempt endpoints additionally require that bearer token — the backend
// derives whose attempt it is from the token, not from a caller-supplied id.
import { getToken } from "./session";

const GRADING_API_URL = process.env.NEXT_PUBLIC_API_URL;
const GRADING_API_KEY = process.env.NEXT_PUBLIC_GRADING_API_KEY;

export class GradingApiError extends Error {}

function jsonHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(GRADING_API_KEY ? { "X-API-Key": GRADING_API_KEY } : {}),
    ...extra,
  };
}

// No Content-Type here — the browser must set the multipart boundary itself.
function formHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    ...(GRADING_API_KEY ? { "X-API-Key": GRADING_API_KEY } : {}),
    ...extra,
  };
}

// Attempt routes require the student's own bearer token in addition to the
// service-level API key, so the backend can derive the attempt's owner from
// the token instead of trusting a caller-supplied id.
function attemptHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getToken();
  return jsonHeaders({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  });
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    return JSON.stringify(body.detail ?? body);
  } catch {
    return res.statusText;
  }
}

export interface Course {
  id: string;
  course_code: string;
  course_name: string;
  created_at: string;
}

export interface Criterion {
  id: string;
  rubric_id: string;
  description: string;
  score: number;
}

export interface Rubric {
  id: string;
  criteria: Criterion[];
}

export interface Example {
  id: string;
  question_id: string;
  band: "excellent" | "average" | "poor";
  example_answer: string;
  score: number;
}

export type GradingMethod = "rubric" | "fewshot";

export interface Question {
  id: string;
  test_id: string;
  external_id: string | null;
  prompt: string;
  max_score: number;
  score_increment: number;
  model_answer: string | null;
  rubric: Rubric | null;
  examples: Example[];
  grading_method: GradingMethod | null;
  position: number;
}

export interface Test {
  id: string;
  course_id: string;
  test_name: string;
  max_attempts: number;
  questions: Question[];
  created_at: string;
}

export interface Attempt {
  id: string;
  test_id: string;
  user_id: string;
  attempt_number: number;
  status: "in_progress" | "grading" | "graded" | "failed";
  started_at: string;
  graded_at: string | null;
  error: string | null;
}

export interface CriteriaMet {
  id: string;
  criteria_id: string;
  is_met: boolean;
}

export interface QuestionResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: string;
  score: number;
  feedback: string | null;
  criteria_met: CriteriaMet[];
}

export interface AttemptGradeResult {
  attempt: Attempt;
  responses: QuestionResponse[];
  total_score: number;
  max_score: number;
  percentage: number;
  completed_questions: number;
  total_questions: number;
}

export async function listCourses(): Promise<Course[]> {
  const res = await fetch(`${GRADING_API_URL}/api/v1/courses`, {
    headers: jsonHeaders(),
  });
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function createCourse(params: {
  course_code: string;
  course_name: string;
}): Promise<Course> {
  const res = await fetch(`${GRADING_API_URL}/api/v1/courses`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function listTests(courseId: string): Promise<Test[]> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/courses/${encodeURIComponent(courseId)}/tests`,
    { headers: jsonHeaders() },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function getTest(testId: string): Promise<Test> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/tests/${encodeURIComponent(testId)}`,
    { headers: jsonHeaders() },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

// Bulk-creates a test and its questions from an instructor-authored CSV
// (columns: id, prompt, max_score, score_increment, optional model_answer).
// The `id` column becomes each question's external_id, used later to join
// against the criteria CSV.
export async function createTestFromCsv(
  courseId: string,
  params: { file: File; testName: string; maxAttempts: number },
): Promise<Test> {
  const form = new FormData();
  form.set("file", params.file);
  form.set("test_name", params.testName);
  form.set("max_attempts", String(params.maxAttempts));

  const res = await fetch(
    `${GRADING_API_URL}/api/v1/courses/${encodeURIComponent(courseId)}/tests/csv`,
    { method: "POST", headers: formHeaders(), body: form },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

// Bulk-attaches rubric criteria (and optional model answers) from a CSV
// (columns: id, criteria, criteria_max_score, optional model_answer). Each
// row's `id` must match a question's external_id from the questions CSV.
export async function uploadCriteriaCsv(
  testId: string,
  file: File,
): Promise<Test> {
  const form = new FormData();
  form.set("file", file);

  const res = await fetch(
    `${GRADING_API_URL}/api/v1/tests/${encodeURIComponent(testId)}/criteria/csv`,
    { method: "POST", headers: formHeaders(), body: form },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

// Bulk-attaches few-shot exemplars from a CSV (columns: id, good_answer,
// good_score, average_answer, average_score, bad_answer, bad_score). Each
// row's `id` must match a question's external_id from the questions CSV.
// Optional — a question only needs a rubric OR examples to be gradable.
export async function uploadExamplesCsv(
  testId: string,
  file: File,
): Promise<Test> {
  const form = new FormData();
  form.set("file", file);

  const res = await fetch(
    `${GRADING_API_URL}/api/v1/tests/${encodeURIComponent(testId)}/examples/csv`,
    { method: "POST", headers: formHeaders(), body: form },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

// Explicitly picks which method grades a question. Only required once a
// question has both a rubric and examples attached (otherwise whichever
// one exists is used automatically) — students can't start an attempt
// until this is resolved for every such question.
export async function setGradingMethod(
  testId: string,
  questionId: string,
  method: GradingMethod,
): Promise<Question> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/tests/${encodeURIComponent(testId)}/questions/${encodeURIComponent(questionId)}/grading-method`,
    {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ method }),
    },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function createAttempt(testId: string): Promise<Attempt> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/tests/${encodeURIComponent(testId)}/attempts`,
    {
      method: "POST",
      headers: attemptHeaders(),
    },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function listAttempts(testId: string): Promise<Attempt[]> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/tests/${encodeURIComponent(testId)}/attempts`,
    { headers: attemptHeaders() },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

// Saves the submitted answers and starts grading them in the background —
// returns as soon as responses are stored (attempt.status becomes
// "grading"), before any LLM grading has actually happened. Poll
// getAttemptResult (see waitForAttemptGrading) for the outcome instead of
// expecting a result here, since each answer costs its own LLM round-trip.
export async function gradeAttempt(
  testId: string,
  attemptId: string,
  params: { responses: Array<{ question_id: string; answer: string }>; finalize?: boolean },
): Promise<Attempt> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/tests/${encodeURIComponent(testId)}/attempts/${encodeURIComponent(attemptId)}/grade`,
    {
      method: "POST",
      headers: attemptHeaders(),
      body: JSON.stringify({
        responses: params.responses,
        finalize: params.finalize ?? true,
      }),
    },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function getAttemptResult(
  testId: string,
  attemptId: string,
): Promise<AttemptGradeResult> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/tests/${encodeURIComponent(testId)}/attempts/${encodeURIComponent(attemptId)}`,
    { headers: attemptHeaders() },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

// Polls getAttemptResult until the background grading task finishes
// (status "graded" or "failed"), same pattern as ragApi's
// waitForRubricProcessing.
export async function waitForAttemptGrading(
  testId: string,
  attemptId: string,
  { intervalMs = 1500, timeoutMs = 120_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<AttemptGradeResult> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await getAttemptResult(testId, attemptId);
    if (result.attempt.status === "graded" || result.attempt.status === "failed") {
      return result;
    }
    if (Date.now() > deadline) {
      throw new GradingApiError(
        "Grading is taking longer than expected — check back shortly.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
