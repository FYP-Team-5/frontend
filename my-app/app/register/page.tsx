"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerStudent, registerStaff, ApiError } from "../lib/api";

const inputClass =
  "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light";
const labelClass = "block text-sm font-medium text-foreground/80";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "staff">("student");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [institutionalNumber, setInstitutionalNumber] = useState("");
  const [password, setPassword] = useState("");
  const [registrationKey, setRegistrationKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (role === "student") {
        await registerStudent({
          email,
          full_name: fullName,
          password,
          student_number: institutionalNumber,
        });
      } else {
        await registerStaff(
          {
            email,
            full_name: fullName,
            password,
            staff_number: institutionalNumber,
          },
          registrationKey,
        );
      }
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-lg border border-black/10 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-brand-dark">Register</h1>

        <div className="mt-6 flex overflow-hidden rounded border border-black/15 text-sm">
          <button
            type="button"
            onClick={() => setRole("student")}
            className={`flex-1 px-3 py-2 font-medium ${
              role === "student"
                ? "bg-brand-dark text-white"
                : "bg-white text-foreground/70 hover:bg-black/5"
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setRole("staff")}
            className={`flex-1 px-3 py-2 font-medium ${
              role === "staff"
                ? "bg-brand-dark text-white"
                : "bg-white text-foreground/70 hover:bg-black/5"
            }`}
          >
            Staff (instructor)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className={labelClass}>
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          </div>
          <div>
            <label className={labelClass}>
              {role === "student" ? "Student number" : "Staff number"}
              <input
                type="text"
                value={institutionalNumber}
                onChange={(e) => setInstitutionalNumber(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          </div>
          <div>
            <label className={labelClass}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          </div>
          <div>
            <label className={labelClass}>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
                className={inputClass}
              />
            </label>
          </div>
          {role === "staff" && (
            <div>
              <label className={labelClass}>
                Staff registration key
                <input
                  type="password"
                  value={registrationKey}
                  onChange={(e) => setRegistrationKey(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Register
          </button>
        </form>
      </div>
    </div>
  );
}
