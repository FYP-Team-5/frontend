"use client";

import { use } from "react";
import SubmissionReview from "@/app/components/SubmissionReview";

export default function AttemptPage({
  params,
}: {
  params: Promise<{ courseId: string; testId: string; attemptId: string }>;
}) {
  const values = use(params);
  return <SubmissionReview key={values.attemptId} {...values} />;
}
