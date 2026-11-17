import type { CapabilityAction, CapabilityPackage } from "../../domain/models";
import type { JsonSchema } from "../../domain/json-schema";

const objectSchema = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  required,
});

const action = (value: CapabilityAction): CapabilityAction => value;

export const fixturePackages: CapabilityPackage[] = [
  {
    id: "package-kubernetes", name: "Kubernetes Gateway", version: "kubernetes-http/v8",
    description: "Inspect cluster resources, submit jobs, and stream service access through a declared binding.", status: "available", activationIds: ["activation-kubernetes"],
    actions: [
      action({ id: "kubernetes.resources", name: "list-resources", description: "List resources in an allowed namespace.", interaction: "request-reply", inputSchema: objectSchema({ namespace: { type: "string", default: "research" } }), outputSchema: { type: "object" }, permissions: ["kubernetes.read"], sideEffects: "read", available: true }),
      action({ id: "kubernetes.submit-job", name: "submit-job", description: "Submit a durable batch job to the cluster.", interaction: "task", inputSchema: objectSchema({ name: { type: "string" }, image: { type: "string" }, command: { type: "array", items: { type: "string" } } }, ["name"]), outputSchema: { type: "object" }, permissions: ["kubernetes.jobs.write"], sideEffects: "write", available: true }),
      action({ id: "kubernetes.open-stream", name: "open-service-stream", description: "Open a byte stream to a declared service target.", interaction: "byte-stream", inputSchema: objectSchema({ service: { type: "string" } }, ["service"]), permissions: ["kubernetes.service.stream"], sideEffects: "read", available: false, unavailableReason: "Requires a specialized stream surface." }),
    ],
  },
  {
    id: "package-grafana", name: "Grafana Observatory", version: "grafana-http/v5",
    description: "Read dashboards, Prometheus metrics, GPU utilization, and allocation accounting.", status: "available", activationIds: ["activation-grafana"],
    actions: [
      action({ id: "grafana.gpu-hours", name: "gpu-arena-gpu-hours", description: "Rank namespace GPU-hour allocations for a time window.", interaction: "request-reply", inputSchema: objectSchema({ start: { type: "string", format: "date" }, end: { type: "string", format: "date" } }, ["start", "end"]), outputSchema: { type: "object" }, permissions: ["grafana.read"], sideEffects: "read", available: true }),
      action({ id: "grafana.metrics", name: "metrics-query-range", description: "Query a verified Prometheus target over time.", interaction: "request-reply", inputSchema: objectSchema({ query: { type: "string" }, step: { type: "integer", minimum: 30, default: 120 } }, ["query"]), outputSchema: { type: "object" }, permissions: ["grafana.read"], sideEffects: "read", available: true }),
    ],
  },
  {
    id: "package-autopaper", name: "AutoPaper Research", version: "autopaper-http/v2",
    description: "Search the paper index and inspect venues, years, and paper details.", status: "available", activationIds: ["activation-autopaper"],
    actions: [action({ id: "autopaper.search", name: "search-papers", description: "Search indexed papers by title, author, or venue.", interaction: "request-reply", inputSchema: objectSchema({ query: { type: "string" }, year: { type: "integer" }, limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } }, ["query"]), outputSchema: { type: "array" }, permissions: ["papers.read"], sideEffects: "read", available: true })],
  },
  {
    id: "package-vm-ssh", name: "VM SSH", version: "vm-ssh-http/v5",
    description: "Execute bounded shell commands on an SSH-accessible VM.", status: "degraded", activationIds: ["activation-vm"],
    actions: [action({ id: "vm.exec", name: "exec", description: "Run a shell command with bounded output and timeout.", interaction: "task", inputSchema: objectSchema({ command: { type: "string" }, timeout_seconds: { type: "integer", minimum: 1, maximum: 3600, default: 300 } }, ["command"]), outputSchema: { type: "object" }, permissions: ["vm.exec"], sideEffects: "write", available: false, unavailableReason: "Activation is waiting for authentication." })],
  },
  {
    id: "package-custom-research", name: "Research Archive Tools", version: "custom/v1",
    description: "An example user-published package proving that unknown action sets remain inspectable.", status: "published", activationIds: [],
    actions: [action({ id: "custom.export-history", name: "export-history", description: "Export a research history in a selected format.", interaction: "request-reply", inputSchema: objectSchema({ format: { type: "string", enum: ["json", "csv", "markdown"], default: "json" } }, ["format"]), outputSchema: { type: "object" }, permissions: ["archive.read"], sideEffects: "none", available: true })],
  },
];
