import type { Activation } from "../../domain/models";

export const fixtureActivations: Activation[] = [
  { id: "activation-kubernetes", name: "beijing-cluster", packageId: "package-kubernetes", slaveId: "slave-a", resourceId: "resource-gpu-cluster", status: "ready", revision: 12, available: true, authentication: "authenticated", configurationSummary: { namespacePolicy: "research + shared" }, actionIds: ["kubernetes.resources", "kubernetes.submit-job", "kubernetes.open-stream"] },
  { id: "activation-grafana", name: "gpu-observatory", packageId: "package-grafana", slaveId: "slave-a", resourceId: "resource-grafana", status: "ready", revision: 8, available: true, authentication: "authenticated", configurationSummary: { dashboard: "gpu-arena", dataSource: "prometheus" }, actionIds: ["grafana.gpu-hours", "grafana.metrics"] },
  { id: "activation-autopaper", name: "paper-index", packageId: "package-autopaper", slaveId: "slave-b", resourceId: "resource-paper-index", status: "degraded", revision: 4, available: false, authentication: "failed", configurationSummary: { identityProvider: "connect.cs.ac.cn" }, actionIds: ["autopaper.search"] },
  { id: "activation-vm", name: "research-vm-ssh", packageId: "package-vm-ssh", slaveId: "slave-b", resourceId: "resource-research-vm", status: "pending_auth", revision: 2, available: false, authentication: "pending", configurationSummary: { host: "vm-research.internal", user: "worker", port: 22 }, actionIds: ["vm.exec"] },
  { id: "activation-old", name: "archived-notebook", packageId: "package-custom-research", slaveId: "slave-b", status: "stopped", revision: 1, available: false, authentication: "not_required", configurationSummary: { retention: "local" }, actionIds: ["custom.export-history"] },
];
