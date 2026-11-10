import { apiJson } from "./http";

export type GradingOutputContract = "criteria_array_v1" | "grading_json_v1";

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
  status: "candidate" | "queued" | "deploying" | "deployed" | "failed";
  revision: number;
  is_active: boolean;
  deployment_error: string | null;
  checks: Record<string, unknown> | null;
  requested_by: string | null;
}

export interface TrainingDeploymentResult {
  status: "queued" | "deployed";
}
export const listTrainingModels = (signal?: AbortSignal) =>
  apiJson<TrainingModel[]>("training-runs", { signal });

export const deployTrainingModel = (model: TrainingModel) =>
  apiJson<TrainingDeploymentResult>(`training-runs/${encodeURIComponent(model.run_id)}/deploy`, {
    method: "POST",
    body: JSON.stringify({ revision: model.revision }),
  });
