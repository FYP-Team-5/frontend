import { apiFetch } from "./http";

export interface DatasetSourceEntry {
  source_key: string;
  test_id: string;
  attempt_id: string;
  question_id: string;
  submission_version: number;
  grade_revision: number;
  label_source: string;
  test_name: string;
  course_code: string;
  course_name: string;
}

export interface DatasetVersion {
  id: string;
  number: number;
  schema_version: number;
  parent_version_id: string | null;
  source: "instructor_upload" | "test_export";
  creator_id: string | null;
  created_at: string;
  ready_at: string | null;
  filename: string | null;
  status: "pending" | "running" | "ready" | "failed" | "unchanged";
  checksum: string | null;
  row_count: number | null;
  byte_size: number | null;
  last_error: string | null;
  retry_of: string | null;
  is_active: boolean;
  source_manifest: DatasetSourceEntry[] | null;
}

export interface TrainingExport {
  test_id: string;
  status:
    | "open"
    | "pending"
    | "waiting"
    | "exporting"
    | "completed"
    | "needs_attention"
    | "failed";
  row_count: number;
  excluded: Array<{
    attempt_id: string;
    question_id: string | null;
    reason: string;
  }>;
  version_id: string | null;
  last_error: string | null;
}

export async function listDatasetVersions(
  signal?: AbortSignal,
): Promise<DatasetVersion[]> {
  return (await apiFetch("training-dataset/versions", { signal })).json();
}
export async function datasetStorageStatus(
  signal?: AbortSignal,
): Promise<{ status: string }> {
  return (await apiFetch("training-dataset/status", { signal })).json();
}
export async function uploadDataset(
  file: File,
  uploadKey: string,
): Promise<DatasetVersion> {
  const body = new FormData();
  body.set("file", file);
  return (
    await apiFetch("training-dataset/versions", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": uploadKey },
    })
  ).json();
}
export async function retryDatasetVersion(id: string): Promise<DatasetVersion> {
  return (
    await apiFetch(
      `training-dataset/versions/${encodeURIComponent(id)}/retry`,
      {
        method: "POST",
      },
    )
  ).json();
}
export async function downloadDataset(version?: DatasetVersion) {
  const path = version
    ? `training-dataset/versions/${encodeURIComponent(version.id)}/download`
    : "training-dataset/download";
  const response = await apiFetch(path);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const filename = response.headers
    .get("Content-Disposition")
    ?.match(/filename="([^"]+)"/)?.[1];
  anchor.download =
    filename ??
    (version
      ? `training-dataset-v${String(version.number).padStart(6, "0")}.csv`
      : "training-dataset-latest.csv");
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function getTrainingExport(
  testId: string,
  signal?: AbortSignal,
): Promise<TrainingExport> {
  return (
    await apiFetch(`tests/${encodeURIComponent(testId)}/training-export`, {
      signal,
    })
  ).json();
}
export async function retryTrainingExport(
  testId: string,
): Promise<TrainingExport> {
  return (
    await apiFetch(
      `tests/${encodeURIComponent(testId)}/training-export/retry`,
      {
        method: "POST",
      },
    )
  ).json();
}
