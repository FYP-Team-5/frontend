import { getToken } from "./session";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002"
).replace(/\/+$/, "");
const API_KEY = process.env.NEXT_PUBLIC_GRADING_API_KEY;

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.detail === "string"
      ? body.detail
      : JSON.stringify(body.detail ?? body);
  } catch {
    return response.statusText || "Request failed.";
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (API_KEY) headers.set("X-API-Key", API_KEY);
  // Leave multipart boundaries to the browser when the body is FormData.
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_URL}/api/v1/${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (!response.ok)
    throw new ApiError(await errorMessage(response), response.status);
  return response;
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return (await apiFetch(path, options)).json();
}
