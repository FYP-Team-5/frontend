import { apiJson } from "./http";
export { ApiError as GradingApiError } from "./http";

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
  ends_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
  is_closed: boolean;
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
  submitted_at: string | null;
  submission_version: number;
  revision: number;
  graded_at: string | null;
  error: string | null;
}

export interface CriteriaMet {
  id: string;
  criteria_id: string;
  is_met: boolean;
}

export interface CriterionScore {
  criteria_id: string;
  score: number;
}

export interface QuestionResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: string;
  score: number | null;
  original_score: number | null;
  original_feedback: string | null;
  overridden: boolean;
  edited_by: string | null;
  edited_at: string | null;
  feedback: string | null;
  criteria_met: CriteriaMet[];
  criterion_scores: CriterionScore[] | null;
}

export interface AttemptGradeResult {
  attempt: Attempt;
  responses: QuestionResponse[];
  total_score: number;
  max_score: number;
  percentage: number;
  completed_questions: number;
  total_questions: number;
  questions: Question[];
  can_edit: boolean;
}

export interface StudentSubmissionSummary {
  user_id: string;
  full_name: string;
  student_number: string;
  latest_submission: Attempt | null;
  latest_graded_submission: Attempt | null;
  total_score: number | null;
  max_score: number;
}

const testPath = (testId: string) => `tests/${encodeURIComponent(testId)}`;
const attemptPath = (testId: string, attemptId: string) =>
  `${testPath(testId)}/attempts/${encodeURIComponent(attemptId)}`;

export function listCourses(): Promise<Course[]> {
  return apiJson("courses");
}
export function createCourse(params: {
  course_code: string;
  course_name: string;
}): Promise<Course> {
  return apiJson("courses", { method: "POST", body: JSON.stringify(params) });
}
export function listTests(
  courseId: string,
  signal?: AbortSignal,
): Promise<Test[]> {
  return apiJson(`courses/${encodeURIComponent(courseId)}/tests`, { signal });
}
export function getTest(testId: string, signal?: AbortSignal): Promise<Test> {
  return apiJson(testPath(testId), { signal });
}
export function createTestFromCsv(
  courseId: string,
  params: { file: File; testName: string; maxAttempts: number; endsAt: string },
): Promise<Test> {
  const body = new FormData();
  body.set("file", params.file);
  body.set("test_name", params.testName);
  body.set("max_attempts", String(params.maxAttempts));
  body.set("ends_at", params.endsAt);
  return apiJson(`courses/${encodeURIComponent(courseId)}/tests/csv`, {
    method: "POST",
    body,
  });
}
function uploadTestCsv(
  testId: string,
  kind: "criteria" | "examples",
  file: File,
): Promise<Test> {
  const body = new FormData();
  body.set("file", file);
  return apiJson(`${testPath(testId)}/${kind}/csv`, { method: "POST", body });
}
export function uploadCriteriaCsv(testId: string, file: File): Promise<Test> {
  return uploadTestCsv(testId, "criteria", file);
}
export function uploadExamplesCsv(testId: string, file: File): Promise<Test> {
  return uploadTestCsv(testId, "examples", file);
}
export function setGradingMethod(
  testId: string,
  questionId: string,
  method: GradingMethod,
): Promise<Question> {
  return apiJson(
    `${testPath(testId)}/questions/${encodeURIComponent(questionId)}/grading-method`,
    { method: "PUT", body: JSON.stringify({ method }) },
  );
}
export function createAttempt(testId: string): Promise<Attempt> {
  return apiJson(`${testPath(testId)}/attempts`, { method: "POST" });
}
export function listAttempts(testId: string): Promise<Attempt[]> {
  return apiJson(`${testPath(testId)}/attempts`);
}
export function gradeAttempt(
  testId: string,
  attemptId: string,
  params: {
    responses: Array<{ question_id: string; answer: string }>;
    finalize?: boolean;
  },
): Promise<Attempt> {
  return apiJson(`${attemptPath(testId, attemptId)}/grade`, {
    method: "POST",
    body: JSON.stringify({ ...params, finalize: params.finalize ?? true }),
  });
}
export function getAttemptResult(
  testId: string,
  attemptId: string,
  signal?: AbortSignal,
): Promise<AttemptGradeResult> {
  return apiJson(attemptPath(testId, attemptId), { signal });
}
export function listSubmissions(
  testId: string,
  signal?: AbortSignal,
): Promise<StudentSubmissionSummary[]> {
  return apiJson(`${testPath(testId)}/submissions`, { signal });
}
export function getSubmission(
  testId: string,
  attemptId: string,
  signal?: AbortSignal,
): Promise<AttemptGradeResult> {
  return apiJson(
    `${testPath(testId)}/submissions/${encodeURIComponent(attemptId)}`,
    { signal },
  );
}
export function editSubmission(
  testId: string,
  attemptId: string,
  revision: number,
  responses: Array<{
    response_id: string;
    score: number;
    feedback: string;
    criterion_scores?: CriterionScore[];
  }>,
): Promise<AttemptGradeResult> {
  return apiJson(
    `${testPath(testId)}/submissions/${encodeURIComponent(attemptId)}/grades`,
    { method: "PATCH", body: JSON.stringify({ revision, responses }) },
  );
}
export function retryGrading(
  testId: string,
  attemptId: string,
): Promise<Attempt> {
  return apiJson(`${attemptPath(testId, attemptId)}/retry-grading`, {
    method: "POST",
  });
}
export function endTest(testId: string): Promise<Test> {
  return apiJson(`${testPath(testId)}/end`, { method: "POST" });
}
export function setTestDeadline(testId: string, endsAt: string): Promise<Test> {
  return apiJson(`${testPath(testId)}/deadline`, {
    method: "PATCH",
    body: JSON.stringify({ ends_at: endsAt }),
  });
}
