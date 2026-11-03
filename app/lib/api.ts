import { SessionUser } from "./session";
import { apiFetch } from "./http";
export { ApiError } from "./http";

export async function login(email: string, password: string) {
  const res = await apiFetch("auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
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
  const res = await apiFetch("auth/register/student", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  const res = await apiFetch("auth/register/staff", {
    method: "POST",
    headers: {
      "X-Staff-Registration-Key": registrationKey,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}
