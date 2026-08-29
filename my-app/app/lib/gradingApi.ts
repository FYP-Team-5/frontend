// The grading/catalog routes now live on the same `backend` service as auth
// (grading + user microservices were collapsed into it), just gated by a
// separate X-API-Key instead of the JWT bearer token used by /auth and /users.
const GRADING_API_URL = process.env.NEXT_PUBLIC_API_URL;
const GRADING_API_KEY = process.env.NEXT_PUBLIC_GRADING_API_KEY;

export class GradingApiError extends Error {}

function headers(extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(GRADING_API_KEY ? { "X-API-Key": GRADING_API_KEY } : {}),
    ...extra,
  };
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
  title: string;
  created_at: string;
}

export interface Question {
  id: string;
  prompt: string;
  max_score: number;
  criteria: string[];
  rubric_chunk_indexes: number[];
  position: number;
}

export interface Exam {
  id: string;
  course_id: string;
  title: string;
  type: "exam" | "quiz";
  max_attempts: number;
  rubric_id: string | null;
  questions: Question[];
  created_at: string;
}

export async function listCourses(): Promise<Course[]> {
  const res = await fetch(`${GRADING_API_URL}/api/v1/courses`, {
    headers: headers(),
  });
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function createCourse(params: { title: string }): Promise<Course> {
  const res = await fetch(`${GRADING_API_URL}/api/v1/courses`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function listExams(courseId: string): Promise<Exam[]> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/courses/${encodeURIComponent(courseId)}/exams`,
    { headers: headers() },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function createExam(
  courseId: string,
  params: {
    title: string;
    type: "exam" | "quiz";
    max_attempts: number;
    questions: Array<{
      id: string;
      prompt: string;
      max_score: number;
      criteria?: string[];
    }>;
  },
): Promise<Exam> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/courses/${encodeURIComponent(courseId)}/exams`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(params),
    },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}

export async function attachRubric(
  examId: string,
  rubricId: string,
): Promise<Exam> {
  const res = await fetch(
    `${GRADING_API_URL}/api/v1/exams/${encodeURIComponent(examId)}/rubric`,
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ rubric_id: rubricId }),
    },
  );
  if (!res.ok) throw new GradingApiError(await parseError(res));
  return res.json();
}
