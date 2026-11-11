"use client";

import { useEffect, useRef, useState } from "react";
import {
  deployTrainingModel,
  listTrainingModels,
  listTrainingRunsInProgress,
  startTraining,
  TrainingModel,
  TrainingRunInProgress,
} from "@/app/lib/trainingModelApi";
import { trainingModelPreview } from "@/app/lib/trainingModelPreview";
import { formatTestDate } from "@/app/lib/testDates";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { useToast } from "@/app/components/ToastProvider";
import { newRequestId } from "@/app/lib/requestId";

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
  metrics: TrainingModel["metrics"],
): TrainingModel["metrics"] {
  return Object.fromEntries(
    Object.entries(metrics).filter(
      ([key]) =>
        key !== "generation_minutes" && key !== "mean_generation_seconds",
    ),
  );
}

export default function TrainingModelsPage() {
  const toast = useToast();
  const [models, setModels] = useState<TrainingModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrainingModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [startingTraining, setStartingTraining] = useState(false);
  const trainingRequest = useRef<string | null>(null);
  const trainingInFlight = useRef(false);
  const loadErrored = useRef(false);
  const [inProgress, setInProgress] = useState<TrainingRunInProgress[]>([]);
  // Set when the Refresh button is clicked; the next load result answers it
  // with a toast instead of the silent 10s poll.
  const manualRefresh = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const [result, runs] = await Promise.all([
          listTrainingModels(controller.signal),
          // Best-effort AWS workflow view; never fail the candidate list for it.
          listTrainingRunsInProgress(controller.signal).catch(() => []),
        ]);
        if (!controller.signal.aborted) {
          setModels(result);
          setInProgress(runs);
          setError(null);
          loadErrored.current = false;
          if (manualRefresh.current) {
            manualRefresh.current = false;
            toast("Refreshed trained models");
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          const message =
            cause instanceof Error
              ? cause.message
              : "Unable to load trained models.";
          setError(message);
          // Poll runs every 10s: toast once per failure streak, or when the
          // failure answers a manual Refresh click.
          if (!loadErrored.current || manualRefresh.current) {
            loadErrored.current = true;
            manualRefresh.current = false;
            toast(message, "error");
          }
        }
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
  const showPreview =
    !loading && models.length === 0 && inProgress.length === 0;
  const displayedModels = showPreview ? trainingModelPreview : models;
  const deploying = models.some(
    (model) => model.status === "queued" || model.status === "deploying",
  );
  async function trainNow() {
    if (trainingInFlight.current) return;
    trainingInFlight.current = true;
    setStartingTraining(true);
    try {
      trainingRequest.current ??= newRequestId();
      await startTraining(trainingRequest.current);
      trainingRequest.current = null;
      toast(
        "Training started. This page now shows the run entry; its candidate appears after training and evaluation finish. If another run holds the GPU lock, this request is skipped.",
      );
      setRefresh((x) => x + 1);
    } catch (cause) {
      toast(
        cause instanceof Error ? cause.message : "Unable to request training.",
        "error",
      );
    } finally {
      trainingInFlight.current = false;
      setStartingTraining(false);
    }
  }
  async function deploy() {
    if (!selected || showPreview) return;
    setBusy(true);
    try {
      await deployTrainingModel(selected);
      setSelected(null);
      toast("Deployment requested. The candidate will deploy once all checks pass.");
      setRefresh((x) => x + 1);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Deployment could not be confirmed. Refresh to check its status.";
      setError(message);
      toast(message, "error");
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
        <div className="flex gap-3">
          <button
            className="rounded bg-brand-light px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={startingTraining}
            onClick={() => void trainNow()}
          >
            {startingTraining ? "Requesting training..." : "Train now"}
          </button>
          <button
            className="rounded border border-brand-dark px-4 py-2 text-sm"
            onClick={() => {
              manualRefresh.current = true;
              setRefresh((x) => x + 1);
            }}
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-foreground/70">
        Start training on the latest ready dataset at any time, including a
        dataset that was trained before. Each run trains grading first, then
        feedback, and publishes both adapters together. Grading metrics compare
        the candidate against its base model. Deployment requires your confirmation and successful
        compatibility checks. Existing grading jobs keep their saved model;
        rubric candidates leave few-shot grading on the original model.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {inProgress.map((run) => (
        <article
          key={run.run_id}
          role="status"
          className={`mt-4 rounded-lg border p-4 ${
            run.status === "training"
              ? "border-amber-300 bg-amber-50"
              : "border-red-300 bg-red-50"
          }`}
        >
          <h2
            className={`text-sm font-semibold ${
              run.status === "training" ? "text-amber-900" : "text-red-800"
            }`}
          >
            {run.status === "training"
              ? "Training run in progress"
              : "Training run failed"}{" "}
            · started {formatTestDate(run.started_at)}
          </h2>
          <p
            className={`mt-1 text-sm ${
              run.status === "training" ? "text-amber-900" : "text-red-700"
            }`}
          >
            {run.status === "training"
              ? "Grading training and evaluation run first, followed by feedback training. Both models share this run and dataset. The candidate appears once both adapters are published."
              : `The workflow ended without registering a candidate${
                  run.stopped_at ? ` (stopped ${formatTestDate(run.stopped_at)})` : ""
                }. Check the training workflow logs, then press Train now to retry.`}
          </p>
          <p className="mt-1 break-all text-xs text-foreground/60">
            {run.execution_name.startsWith("manual-")
              ? "Requested via Train now"
              : "Nightly schedule"}{" "}
            · Run: {run.run_id}
          </p>
        </article>
      ))}
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
                    View grading model on Hugging Face
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
                      : model.feedback ? "Deploy both models" : "Deploy this version"}
              </button>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-brand-dark">
              Grading model
            </h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">
                      {model.configuration.held_out_evaluation === false
                        ? "Training-data metric"
                        : "Held-out metric"}
                    </th>
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
            <section className="mt-4 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-brand-dark">Feedback model</h3>
              {model.feedback ? (
                <>
                  <p className="mt-1 text-sm text-foreground/70">
                    Trained after grading on the same dataset. No evaluation metrics.
                  </p>
                  {!showPreview && (
                    <a
                      className="mt-2 inline-block text-sm text-brand-light underline"
                      href={`https://huggingface.co/${model.feedback.hf_repo}/tree/${model.feedback.hf_revision}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View feedback model on Hugging Face
                    </a>
                  )}
                  <p className="mt-1 break-all text-xs text-foreground/60">
                    Branch: {model.feedback.hf_branch} · Commit: {model.feedback.hf_revision.slice(0, 12)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-foreground/60">
                  No feedback adapter was trained for this older run.
                </p>
              )}
            </section>
            {model.deployment_error && (
              <p className="mt-3 text-sm text-red-700">
                {model.deployment_error}
              </p>
            )}
            {model.checks && (
              <p className="mt-3 text-sm text-green-800">
                Compatibility checks:{" "}
                {Object.entries(model.checks)
                  .filter(([key]) => !key.startsWith("pinned_"))
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
                    ...(model.feedback ? { feedback: model.feedback } : {}),
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
              {selected.hf_revision.slice(0, 12)}{selected.feedback ? ` and feedback commit ${selected.feedback.hf_revision.slice(0, 12)}` : ""}, verify the adapters and test
              their responses. New rubric submissions switch only after
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
