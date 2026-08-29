"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { login, ApiError } from "../lib/api";
import { setSession } from "../lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      setSession(result.access_token, result.user);
      router.push(result.user.role === "staff" ? "/instructor" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-lg border border-black/10 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-brand-dark">Login</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground/80">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded bg-brand-light px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}
