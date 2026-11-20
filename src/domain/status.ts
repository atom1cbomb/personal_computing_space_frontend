import type { LifecycleStatus } from "./models";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

const labels: Record<LifecycleStatus, string> = {
  ready: "Ready",
  pending_auth: "Pending authentication",
  degraded: "Degraded",
  failed: "Failed",
  stopped: "Stopped",
  starting: "Starting",
  stopping: "Stopping",
  not_applicable: "Not applicable",
};

export function getStatusLabel(status: LifecycleStatus): string {
  return labels[status];
}

export function getStatusTone(status: LifecycleStatus): StatusTone {
  if (status === "ready") return "success";
  if (["pending_auth", "degraded", "starting", "stopping"].includes(status)) return "warning";
  if (status === "failed") return "danger";
  // stopped / not_applicable carry no failure signal: neutral, not warning/danger.
  return "neutral";
}
