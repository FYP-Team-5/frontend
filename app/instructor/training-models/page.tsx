"use client";

import { useEffect, useState } from "react";
import {
  deployTrainingModel,
  listTrainingModels,
  TrainingModel,
} from "@/app/lib/trainingModelApi";
import { trainingModelPreview } from "@/app/lib/trainingModelPreview";
import { formatTestDate } from "@/app/lib/testDates";
import Breadcrumbs from "@/app/components/Breadcrumbs";

const metrics = [
  ["invalid_output_rate", "Invalid output rate"],
  ["exact_match_accuracy", "Exact rubric match"],
  ["per_criterion_accuracy", "Per-criterion accuracy"],
  ["precision", "Precision"],
  ["recall", "Recall"],
  ["f1", "Criterion F1"],
  ["final_score_exact_accuracy", "Exact accuracy"],
  ["final_score_within_one_accuracy", "Within one accuracy"],
  ["final_score_mae", "MAE"],
  ["final_score_rmse", "RMSE"],
  ["final_score_pearson", "Pearson correlation"],
  ["final_score_qwk", "QWK"],
  ["valid_examples", "Valid test examples"],
];
function value(input: unknown) {
  return typeof input === "number"
    ? Number.isInteger(input)
      ? String(input)
      : input.toFixed(4)
    : "—";
}

function evaluationMetrics(
  metrics: Record<string, number | string | null>,
): Record<string, number | string | null> {
  return Object.fromEntries(
    Object.entries(metrics).filter(
      ([key]) =>
        key !== "generation_minutes" && key !== "mean_generation_seconds",
    ),
  );
}

export default function TrainingModelsPage() {
  const [models, setModels] = useState<TrainingModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrainingModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result = await listTrainingModels(controller.signal);
        if (!controller.signal.aborted) {
          setModels(result);
          setError(null);
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load trained models.",
          );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(load, 10000);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh]);
  const showPreview = !loading && models.length === 0;
  const displayedModels = showPreview ? trainingModelPreview : models;
  const deploying = models.some(
    (model) => model.status === "queued" || model.status === "deploying",
  );
  async function deploy() {
    if (!selected || showPreview) return;
    setBusy(true);
    try {
      await deployTrainingModel(selected);
      setSelected(null);
      setRefresh((x) => x + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Deployment could not be confirmed. Refresh to check its status.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/instructor" },
          { label: "Trained models" },
        ]}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-brand-dark">
          Trained models
        </h1>
        <button
          className="rounded border border-brand-dark px-4 py-2 text-sm"
          onClick={() => setRefresh((x) => x + 1)}
        >
          Refresh
        </button>
      </div>
      <p className="mt-2 text-sm text-foreground/70">
        Review nightly candidates against their base model on the same held-out
        questions. Deployment requires your confirmation and successful
        compatibility checks. Existing grading jobs keep their saved model;
        rubric candidates leave few-shot grading on the original model.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="mt-5">
          Loading trained models...
        </p>
      )}
      <div className="mt-6 space-y-5">
        {displayedModels.map((model, index) => (
          <article
            key={model.run_id}
            className="rounded-lg border border-gray-300 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-brand-dark">
                  {showPreview
                    ? "Model evaluation"
                    : index === 0
                      ? "Newest candidate"
                      : "Training candidate"}{" "}
                  · {formatTestDate(model.completed_at)}
                </h2>
                <p className="mt-1 text-sm">
                  {model.is_active
                    ? "Active for new rubric submissions"
                    : model.status}
                </p>
                {showPreview ? (
                  <p className="mt-2 text-sm text-foreground/60">
                    Deployment unavailable until this evaluation is registered
                    by the training service
                  </p>
                ) : (
                  <a
                    className="mt-2 inline-block text-sm text-brand-light underline"
                    href={`https://huggingface.co/${model.hf_repo}/tree/${model.hf_revision}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View pinned Hugging Face version
                  </a>
                )}
                <p className="mt-1 break-all text-xs text-foreground/60">
                  Dataset: {model.dataset_version} · Commit:{" "}
                  {model.hf_revision.slice(0, 12)}
                </p>
              </div>
              <button
                disabled={busy || deploying || model.is_active || showPreview}
                onClick={() => setSelected(model)}
                className="rounded bg-brand-light px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {showPreview
                  ? "Deployment unavailable"
                  : model.is_active
                    ? "Deployed"
                    : model.status === "failed"
                      ? "Retry deployment"
                      : "Deploy this version"}
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">Held-out metric</th>
                    <th>Base model</th>
                    <th>Candidate</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(([key, title]) => (
                    <tr key={key} className="border-b border-gray-100">
                      <td className="py-2">{title}</td>
                      <td>{value(model.baseline_metrics[key])}</td>
                      <td>{value(model.metrics[key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {model.deployment_error && (
              <p className="mt-3 text-sm text-red-700">
                {model.deployment_error}
              </p>
            )}
            {model.checks && (
              <p className="mt-3 text-sm text-green-800">
                Compatibility checks:{" "}
                {Object.entries(model.checks)
                  .filter(([key]) => key !== "pinned_hf_revision")
                  .map(
                    ([key, result]) => `${key.replaceAll("_", " ")}: ${result}`,
                  )
                  .join(" · ")}
              </p>
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer">
                Training configuration and full evaluation
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs">
                {JSON.stringify(
                  {
                    configuration: model.configuration,
                    metrics: evaluationMetrics(model.metrics),
                    baseline_metrics: evaluationMetrics(model.baseline_metrics),
                    dataset_stats: model.dataset_stats,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </article>
        ))}
      </div>
      {selected && !showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deploy-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
        >
          <div className="max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <h2 id="deploy-title" className="text-lg font-semibold">
              Deploy this candidate?
            </h2>
            <p className="mt-3 text-sm">
              The server will download commit{" "}
              {selected.hf_revision.slice(0, 12)}, verify the adapter and test
              its grading responses. New rubric submissions switch only after
              all checks pass. A failed check keeps the current model active.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                disabled={busy}
                className="rounded border px-4 py-2 text-sm"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded bg-brand-light px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => void deploy()}
              >
                {busy ? "Requesting..." : "Confirm deployment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
