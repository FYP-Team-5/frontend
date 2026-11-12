import { apiJson } from "./http";

export type GradingOutputContract = "criteria_array_v1" | "grading_json_v1";

export interface FeedbackTrainingModel {
  hf_repo: string;
  hf_branch: string;
  hf_revision: string;
  configuration: Record<string, unknown>;
  dataset_stats: Record<string, unknown>;
}

export type TrainedModelKind = "grading" | "feedback";

// Grading and feedback adapters deploy independently, each with its own state.
export interface ModelDeployment {
  status: "candidate" | "queued" | "deploying" | "deployed" | "failed";
  revision: number;
  is_active: boolean;
  error: string | null;
  checks: Record<string, unknown> | null;
  requested_by: string | null;
}

export interface TrainingModel {
  run_id: string;
  completed_at: string;
  dataset_version: string;
  dataset_checksum: string;
  hf_repo: string;
  hf_branch: string;
  hf_revision: string;
  base_model: string;
  output_contract: GradingOutputContract;
  metrics: Record<string, unknown>;
  baseline_metrics: Record<string, unknown>;
  configuration: Record<string, unknown>;
  dataset_stats: Record<string, unknown>;
  feedback?: FeedbackTrainingModel | null;
  // feedback is null for older grading-only runs.
  deployments: { grading: ModelDeployment; feedback: ModelDeployment | null };
}

export interface TrainingDeploymentResult {
  status: "queued" | "deployed";
}

export interface TrainingStartResult {
  status: "accepted";
  request_id: string;
  execution_arn: string;
}

export interface TrainingRunInProgress {
  run_id: string;
  execution_name: string;
  status: "training" | "failed";
  started_at: string;
  stopped_at: string | null;
}

export const startTraining = (requestId: string) =>
  apiJson<TrainingStartResult>("training-runs/start", {
    method: "POST",
    body: JSON.stringify({ request_id: requestId }),
  });
export const listTrainingModels = (signal?: AbortSignal) =>
  apiJson<TrainingModel[]>("training-runs", { signal });

export const listTrainingRunsInProgress = (signal?: AbortSignal) =>
  apiJson<TrainingRunInProgress[]>("training-runs/in-progress", { signal });

export const deployTrainingModel = (
  runId: string,
  kind: TrainedModelKind,
  deployment: ModelDeployment,
) =>
  apiJson<TrainingDeploymentResult>(`training-runs/${encodeURIComponent(runId)}/deploy`, {
    method: "POST",
    body: JSON.stringify({ model: kind, revision: deployment.revision }),
  });
