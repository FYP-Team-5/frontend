const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL;
const RAG_API_KEY = process.env.NEXT_PUBLIC_RAG_API_KEY;

export class RagApiError extends Error {}

function headers(extra?: Record<string, string>): HeadersInit {
  return {
    ...(RAG_API_KEY ? { "X-API-Key": RAG_API_KEY } : {}),
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

export interface Rubric {
  id: string;
  title: string;
  version: string;
  course_id: string | null;
  exam_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  chunk_count: number;
  processed: boolean;
  processing_status: "processing" | "completed" | "failed";
  processing_error: string | null;
  archived: boolean;
  uploaded_at: string;
}

export async function listRubrics(courseId: string): Promise<Rubric[]> {
  const res = await fetch(
    `${RAG_API_URL}/api/v1/rubrics?course_id=${encodeURIComponent(courseId)}&limit=100`,
    { headers: headers() },
  );
  if (!res.ok) throw new RagApiError(await parseError(res));
  const body = await res.json();
  return body.items;
}

export async function uploadRubric(params: {
  file: File;
  courseId: string;
  examId: string;
  title?: string;
  version?: string;
}): Promise<Rubric> {
  const form = new FormData();
  form.set("file", params.file);
  form.set("course_id", params.courseId);
  form.set("exam_id", params.examId);
  if (params.title) form.set("title", params.title);
  if (params.version) form.set("version", params.version);

  const res = await fetch(`${RAG_API_URL}/api/v1/rubrics`, {
    method: "POST",
    headers: headers(),
    body: form,
  });
  if (!res.ok) throw new RagApiError(await parseError(res));
  return res.json();
}

export async function archiveRubric(rubricId: string): Promise<void> {
  const res = await fetch(
    `${RAG_API_URL}/api/v1/rubrics/${encodeURIComponent(rubricId)}`,
    { method: "DELETE", headers: headers() },
  );
  if (!res.ok) throw new RagApiError(await parseError(res));
}
