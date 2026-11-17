import type { JsonSchema, JsonValue } from "./json-schema";

export type LifecycleStatus = "ready" | "pending_auth" | "degraded" | "failed" | "stopped" | "starting" | "stopping";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "awaiting_decision" | "abandoned";
export type AcceptanceStatus = "not_required" | "pending" | "accepted" | "abandoned";
export type ActionInteraction = "task" | "request-reply" | "byte-stream";
export type ActionSideEffects = "none" | "read" | "write" | "destructive";

export type CapabilityAction = {
  id: string;
  name: string;
  description?: string;
  interaction: ActionInteraction;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  permissions: string[];
  sideEffects: ActionSideEffects;
  available: boolean;
  unavailableReason?: string;
  metadata?: Record<string, JsonValue>;
};

export type CapabilityPackage = {
  id: string;
  name: string;
  version: string;
  description?: string;
  status: "published" | "available" | "degraded";
  actions: CapabilityAction[];
  activationIds: string[];
  metadata?: Record<string, JsonValue>;
};

export type Resource = {
  id: string;
  name: string;
  kind: string;
  status: LifecycleStatus;
  attributes: Record<string, JsonValue>;
  packageId?: string;
  managedById?: string;
  activationId?: string;
  actionIds: string[];
  metadata?: Record<string, JsonValue>;
  catalogCategory?: "capability" | "compute" | "execution";
  lifecycle?: "active" | "retired" | "archived" | "expired";
  available?: boolean;
  relations?: Record<string, string | null>;
};

export type Activation = {
  id: string;
  name: string;
  packageId: string;
  slaveId: string;
  resourceId?: string;
  status: LifecycleStatus;
  revision: number;
  available: boolean;
  authentication: "not_required" | "pending" | "authenticated" | "failed";
  configurationSummary: Record<string, JsonValue>;
  actionIds: string[];
  metadata?: Record<string, JsonValue>;
  lifecycle?: "active" | "retired" | "archived" | "expired";
  desiredState?: string;
  relations?: Record<string, string | null>;
};

export type RunEvent = {
  id: string;
  timestamp: string;
  type: "submitted" | "started" | "progress" | "completed" | "failed" | "awaiting_decision" | "accepted" | "abandoned";
  message: string;
};

export type Run = {
  id: string;
  actionId: string;
  actionName: string;
  packageId: string;
  targetId: string;
  status: RunStatus;
  acceptance: AcceptanceStatus;
  submittedAt: string;
  updatedAt: string;
  input?: JsonValue;
  output?: JsonValue;
  evidence?: JsonValue;
  events: RunEvent[];
  metadata?: Record<string, JsonValue>;
};

export type ActionInvocationRequest = {
  actionId: string;
  packageId: string;
  targetId: string;
  input: JsonValue;
};

export type ActionInvocationResult = {
  interaction: ActionInteraction;
  output?: JsonValue;
  run?: Run;
  message?: string;
};

export type ActivationManagementRequest = {
  activationId: string;
  operation: "start" | "stop" | "retry" | "authenticate";
};
