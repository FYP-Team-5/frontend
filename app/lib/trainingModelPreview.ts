import type { TrainingModel } from "./trainingModelApi";

// Page-only examples. These records are never registered with the backend.
const baseline: TrainingModel["metrics"] = {
  exact_match_accuracy: 0.7404,
  f1: 0.881,
  final_score_mae: 0.3085,
  invalid_output_rate: 0,
  valid_examples: 389,
};
const configuration = {
  MODEL_ID: "Qwen/Qwen3.5-9B",
  LORA_R: 48,
  LORA_ALPHA: 96,
  LEARNING_RATE: 0.00005,
  NUM_EPOCHS: 3,
  MAX_SEQ_LENGTH: 4096,
};
const example: TrainingModel = {
  run_id: "preview-improved",
  completed_at: "2026-11-06T17:00:00Z",
  dataset_version: "Sample dataset v3",
  dataset_checksum: "Example checksum",
  hf_repo: "SmuFypTeam5/GradingQlora",
  hf_branch: "Sample candidate branch",
  hf_revision: "Example revision",
  base_model: "Qwen/Qwen3.5-9B",
  output_contract: "criteria_array_v1",
  metrics: {
    exact_match_accuracy: 0.8445,
    f1: 0.932,
    final_score_mae: 0.18,
    invalid_output_rate: 0,
    valid_examples: 389,
  },
  baseline_metrics: baseline,
  configuration,
  dataset_stats: { source_rows: 3778, training_rows: 3778 },
  status: "candidate",
  revision: 0,
  is_active: false,
  deployment_error: null,
  checks: null,
};

export const trainingModelPreview: TrainingModel[] = [
  example,
  {
    ...example,
    run_id: "preview-earlier",
    completed_at: "2026-11-05T17:00:00Z",
    dataset_version: "Sample dataset v2",
    metrics: {
      exact_match_accuracy: 0.7815,
      f1: 0.901,
      final_score_mae: 0.255,
      invalid_output_rate: 0.0103,
      valid_examples: 385,
    },
  },
  {
    ...example,
    run_id: "preview-check-failed",
    completed_at: "2026-11-04T17:00:00Z",
    dataset_version: "Sample dataset v1",
    status: "failed",
    metrics: {
      exact_match_accuracy: 0.7147,
      f1: 0.851,
      final_score_mae: 0.36,
      invalid_output_rate: 0.0488,
      valid_examples: 370,
    },
    deployment_error:
      "Example: grading compatibility checks failed; the active model was retained.",
  },
];
