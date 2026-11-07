import { apiJson } from "./http";

export interface TrainingModel {
  run_id: string;
  completed_at: string;
  dataset_version: string;
  dataset_checksum: string;
  hf_repo: string;
  hf_branch: string;
  hf_revision: string;
  base_model: string;
  output_contract: string;
  metrics: Record<string, number | string | null>;
  baseline_metrics: Record<string, number | string | null>;
  configuration: Record<string, unknown>;
  dataset_stats: Record<string, number>;
  status: "candidate" | "queued" | "deploying" | "deployed" | "failed";
  revision: number;
  is_active: boolean;
  deployment_error: string | null;
  checks: Record<string, unknown> | null;
}

export const listTrainingModels = (signal?: AbortSignal) =>
  apiJson<TrainingModel[]>("training-runs", { signal });

export const deployTrainingModel = (model: TrainingModel) =>
  apiJson(`training-runs/${encodeURIComponent(model.run_id)}/deploy`, {
    method: "POST",
    body: JSON.stringify({ revision: model.revision }),
  });
