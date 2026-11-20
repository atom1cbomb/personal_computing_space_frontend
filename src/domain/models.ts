import type { JsonSchema, JsonValue } from "./json-schema";

// not_applicable: the resource has no availability verdict (e.g. plan/run/vm).
// It is deliberately distinct from "degraded" so "unknown/not applicable" is
// never rendered as a failure.
export type LifecycleStatus = "ready" | "pending_auth" | "degraded" | "failed" | "stopped" | "starting" | "stopping" | "not_applicable";
export type ActionInteraction = "task" | "request-reply" | "byte-stream";
export type ActionSideEffects = "none" | "read" | "write" | "destructive";

export type CapabilityAction = {
  id: string;
  name: string;
  description?: string;
  interaction?: ActionInteraction;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  permissions: string[];
  sideEffects?: ActionSideEffects;
  available?: boolean;
  unavailableReason?: string;
  metadata?: Record<string, JsonValue>;
};

export type CapabilityPackage = {
  id: string;
  name: string;
  version: string;
  description?: string;
  // "ready" = current published version; "stopped" = superseded/historical.
  // Retired is not a failure, so it must never be shown as "degraded".
  status: LifecycleStatus;
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
  available?: boolean | null;
  relations?: Record<string, string | null>;
};

export type Activation = {
  id: string;
  name: string;
  packageId: string;
  slaveId: string;
  resourceId?: string;
  status: LifecycleStatus;
  available: boolean | null;
  authentication?: string;
  configurationSummary: Record<string, JsonValue>;
  actionIds: string[];
  metadata?: Record<string, JsonValue>;
  lifecycle?: "active" | "retired" | "archived" | "expired";
  desiredState?: string;
  relations?: Record<string, string | null>;
};
