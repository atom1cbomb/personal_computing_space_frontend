import type { AcceptanceStatus, LifecycleStatus, RunStatus } from "./models";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

const labels: Record<LifecycleStatus | RunStatus | AcceptanceStatus, string> = {
  ready: "Ready",
  pending_auth: "Pending authentication",
  degraded: "Degraded",
  failed: "Failed",
  stopped: "Stopped",
  starting: "Starting",
  stopping: "Stopping",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  awaiting_decision: "Awaiting decision",
  abandoned: "Abandoned",
  not_required: "Not required",
  pending: "Pending",
  accepted: "Accepted",
};

export function getStatusLabel(status: LifecycleStatus | RunStatus | AcceptanceStatus): string {
  return labels[status];
}

export function getStatusTone(status: LifecycleStatus | RunStatus | AcceptanceStatus): StatusTone {
  if (["ready", "completed", "accepted"].includes(status)) return "success";
  if (["pending_auth", "degraded", "starting", "stopping", "queued", "pending", "awaiting_decision"].includes(status)) return "warning";
  if (["failed", "abandoned"].includes(status)) return "danger";
  if (["running"].includes(status)) return "info";
  return "neutral";
}
