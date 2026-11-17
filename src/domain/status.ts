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
};

export function getStatusLabel(status: LifecycleStatus): string {
  return labels[status];
}

export function getStatusTone(status: LifecycleStatus): StatusTone {
  if (["ready"].includes(status)) return "success";
  if (["pending_auth", "degraded", "starting", "stopping"].includes(status)) return "warning";
  if (["failed"].includes(status)) return "danger";
  return "neutral";
}
