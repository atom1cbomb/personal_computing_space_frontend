import type { CapabilityAction, CapabilityPackage, Resource, Activation, Run, LifecycleStatus, RunStatus, AcceptanceStatus } from "../../domain/models";
import type { CatalogResource, GripDescription } from "./grip-client";

type CatalogCategory = NonNullable<Resource["catalogCategory"]>;
type CatalogLifecycle = NonNullable<Resource["lifecycle"]>;

const text = (value: unknown, fallback: string) => typeof value === "string" && value ? value : fallback;
const tail = (uri: string) => uri.split("/").pop() ?? uri;
const record = (value: unknown): Record<string, any> => (typeof value === "object" && value !== null ? value as Record<string, any> : {});
// The catalog is typed by the server contract, but a row that predates this
// build may still carry a retired value; drop anything outside the three public
// categories instead of rendering an unknown bucket.
const category = (value: unknown): CatalogCategory | undefined =>
  value === "capability" || value === "compute" || value === "execution" ? value : undefined;
const lifecycleOf = (value: unknown): CatalogLifecycle | undefined =>
  value === "active" || value === "retired" || value === "archived" || value === "expired" ? value : undefined;
const status = (value: unknown): LifecycleStatus => {
  const normalized = String(value ?? "").toLowerCase();
  if (["running", "active", "available", "healthy", "authenticated", "online"].includes(normalized)) return "ready";
  return ["ready", "pending_auth", "degraded", "failed", "stopped", "starting", "stopping"].includes(normalized)
    ? normalized as LifecycleStatus : "degraded";
};

// A catalog row is a projection, not the authoritative record: `summary` holds
// the bounded per-type document, and a live DESCRIPTION supplies whatever the
// projection deliberately leaves out (offers, full attributes).
export function normalizeResource(entry: CatalogResource, description?: GripDescription): Resource {
  const metadata = record(description?.resource.metadata);
  const summary = record(entry.summary);
  const attributes = { ...summary, ...record(metadata.attributes) };
  const relations = record(entry.relations ?? metadata.relations);
  const lifecycle = lifecycleOf(entry.lifecycle ?? metadata.lifecycle);
  const available = entry.available ?? metadata.available !== false;
  const actionRefs = Array.isArray(attributes.available_action_refs) ? attributes.available_action_refs
    : Array.isArray(attributes.declared_action_refs) ? attributes.declared_action_refs
    : Array.isArray(metadata.actions) ? metadata.actions : [];
  return {
    id: entry.uri,
    name: text(attributes.display_name ?? attributes.name ?? (entry.resource_type === "computing/vm" && attributes.vm_id ? `VM · ${attributes.vm_id}` : undefined) ?? entry.resource_name ?? metadata.name, tail(entry.uri)),
    kind: description?.resource.mcue ?? entry.resource_type,
    // Lifecycle vocabulary wins over a raw state string: the projection already
    // resolved whether this row is still selectable.
    status: status(attributes.state ?? attributes.run_status ?? attributes.runtime_status ?? attributes.activation_state
      ?? metadata.state ?? (lifecycle === "retired" ? "stopped" : available ? "ready" : "degraded")),
    attributes,
    packageId: typeof relations.package === "string" ? relations.package : typeof metadata.package === "string" ? metadata.package : undefined,
    managedById: typeof metadata.managed_by === "string" ? metadata.managed_by : undefined,
    activationId: typeof relations.activation === "string" ? relations.activation : typeof metadata.activation === "string" ? metadata.activation : undefined,
    actionIds: actionRefs.map((item: any) => typeof item === "string" ? item : item?.uri ?? item?.action ?? "").filter(Boolean),
    catalogCategory: category(entry.catalog_category) ?? category(metadata.catalog_category),
    lifecycle,
    available,
    relations,
    metadata: { ...metadata, ...summary, owner: entry.owner ?? null, tags: entry.tags ?? [], index_version: entry.index_version ?? 1, updated_at: entry.updated_at ?? null },
  };
}

function normalizeAction(value: any): CapabilityAction {
  const action = value.action ?? value;
  const descriptorId = action.action_descriptor_ref?.resource_id ?? value.action_descriptor_ref?.resource_id;
  const descriptorName = typeof descriptorId === "string" ? descriptorId.split("/descriptors/")[1]?.split("/")[0] : undefined;
  const interaction = action.interaction ?? value.interaction ?? (action.mode === "byte-stream" ? "byte-stream" : "task");
  return { id: text(action.uri ?? action.id ?? descriptorId ?? action.name, "unknown-action"), name: text(action.name ?? descriptorName, "action"), description: action.description, interaction, inputSchema: action.arguments_schema ?? action.input_schema ?? value.inputSchema, outputSchema: action.result_schema ?? action.output_schema ?? value.outputSchema, permissions: Array.isArray(action.permissions) ? action.permissions : [], sideEffects: action.side_effects ?? action.sideEffects ?? "read", available: action.available !== false, unavailableReason: action.unavailable_reason, metadata: { runtimeBinding: action.runtime_binding, descriptor: action.action_descriptor_ref } };
}

export function normalizePackage(payload: any): CapabilityPackage {
  const authority = text(payload.resource_authority, "loom.local");
  const workspace = text(payload.workspace_id, "workspace-default");
  const packageId = text(payload.package_id, "observer-package");
  const version = text(payload.package_version, "published");
  const id = text(payload.resource ?? payload.version_ref ?? payload.package_ref ?? payload.uri,
    `grip://${authority}/workspaces/${workspace}/packages/${packageId}/${version}`);
  const actions = payload.actions ?? payload.action_descriptors?.map((item: any) => ({
    ...(item.descriptor ?? {}),
    action_descriptor_ref: item.resource_ref,
    permissions: payload.action_exports?.find((exp: any) => exp.action_descriptor_ref?.resource_id === item.resource_ref?.resource_id)?.permissions ?? [],
  })) ?? payload.action_exports ?? payload.exports ?? payload.metadata?.actions ?? [];
  return { id, name: text(payload.name ?? payload.package_id ?? payload.metadata?.package_id, id.split("/").pop() ?? id), version, description: payload.description ?? payload.metadata?.description, status: payload.catalog_lifecycle === "retired" || payload.abandoned ? "degraded" : "available", actions: Array.isArray(actions) ? actions.map(normalizeAction) : [], activationIds: Array.isArray(payload.activations) ? payload.activations.map((item: any) => typeof item === "string" ? item : item.resource ?? item.uri ?? item.id).filter(Boolean) : [], metadata: payload };
}

export function normalizeActivation(description: GripDescription, entry?: CatalogResource): Activation {
  const metadata = record(description.resource.metadata);
  const summary = record(entry?.summary);
  const attributes = { ...summary, ...record(metadata.attributes) };
  // `runs_on` and `package` live on the projection relations, not in the offer list.
  const relations = record(entry?.relations ?? metadata.relations);
  const actions = (description.offers ?? []).map((item: any) => normalizeAction(item));
  const auth = attributes.authentication_state ?? metadata.authentication?.status ?? metadata.authentication ?? "not_required";
  const lifecycle = lifecycleOf(entry?.lifecycle ?? metadata.lifecycle);
  return { id: description.resource.uri, name: text(entry?.resource_name ?? attributes.instance_name ?? metadata.instance_name ?? metadata.name, tail(description.resource.uri)), packageId: text(relations.package ?? metadata.package, "unknown-package"), slaveId: text(relations.runs_on ?? metadata.host ?? metadata.target_slave, "unknown-host"), resourceId: relations.operates_on ?? metadata.target, status: status(attributes.activation_state ?? metadata.state ?? metadata.status ?? (lifecycle === "retired" ? "stopped" : entry?.available ? "ready" : undefined)), revision: Number(attributes.activation_revision ?? metadata.revision ?? description.revision ?? 0), available: entry?.available ?? metadata.available !== false, authentication: auth === "authenticated" ? "authenticated" : auth === "auth_required" || auth === "pending_auth" || status(metadata.state) === "pending_auth" ? "pending" : auth === "auth_failed" || auth === "failed" ? "failed" : "not_required", configurationSummary: attributes, actionIds: actions.map((item) => item.id), lifecycle, desiredState: attributes.desired_state, relations, metadata: { ...metadata, ...summary, offers: description.offers ?? [] } };
}

export function normalizeRun(payload: any): Run {
  const state = String(payload.state ?? payload.status ?? "failed");
  const runStatus: RunStatus = ["queued", "running", "completed", "failed", "awaiting_decision", "abandoned"].includes(state) ? state as RunStatus : "failed";
  const acceptance: AcceptanceStatus = state === "awaiting_decision" ? "pending" : state === "completed" ? "not_required" : "not_required";
  return { id: text(payload.run_id ?? payload.id ?? payload.resource, "observer-run"), actionId: text(payload.action_id, "unknown-action"), actionName: text(payload.action_name, "Observer run"), packageId: text(payload.package_id, "unknown-package"), targetId: text(payload.target_id, "unknown-target"), status: runStatus, acceptance, submittedAt: text(payload.submitted_at, new Date().toISOString()), updatedAt: text(payload.updated_at, new Date().toISOString()), input: payload.input, output: payload.output ?? payload.result, evidence: payload.evidence ?? payload.outcome, events: Array.isArray(payload.events) ? payload.events : [], metadata: payload };
}
