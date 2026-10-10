import { SessionUser } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    return JSON.stringify(body.detail ?? body);
  } catch {
    return res.statusText;
  }
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(await parseError(res));
  return res.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    user: SessionUser;
  }>;
}

export async function registerStudent(payload: {
  email: string;
  full_name: string;
  password: string;
  student_number: string;
}) {
  const res = await fetch(`${API_URL}/api/v1/auth/register/student`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ApiError(await parseError(res));
  return res.json();
}

export async function registerStaff(
  payload: {
    email: string;
    full_name: string;
    password: string;
    staff_number: string;
  },
  registrationKey: string,
) {
  const res = await fetch(`${API_URL}/api/v1/auth/register/staff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Staff-Registration-Key": registrationKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ApiError(await parseError(res));
  return res.json();
}
