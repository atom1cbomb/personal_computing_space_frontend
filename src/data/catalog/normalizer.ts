import type { CapabilityAction, CapabilityPackage, Resource, Activation, LifecycleStatus } from "../../domain/models";
import type { CatalogResource } from "./client";
import type { ObserverDescription } from "./observer-read-client";

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
export function normalizeResource(entry: CatalogResource, description?: ObserverDescription): Resource {
  const summary = record(entry.summary);
  const attributes = { ...summary, ...record(description?.attributes), ...record(description?.details) };
  const relations = { ...record(entry.relations) };
  for (const key of ["plan", "run", "driver"] as const) {
    if (typeof attributes[key] === "string") relations[key] = attributes[key];
  }
  const lifecycle = lifecycleOf(entry.lifecycle);
  const available = entry.available ?? false;
  const actionRefs = Array.isArray(attributes.available_action_refs) ? attributes.available_action_refs
    : Array.isArray(attributes.declared_action_refs) ? attributes.declared_action_refs
    : [];
  return {
    id: entry.uri,
    name: text(attributes.display_name ?? attributes.name ?? (entry.resource_type === "computing/vm" && attributes.vm_id ? `VM · ${attributes.vm_id}` : undefined) ?? entry.resource_name, tail(entry.uri)),
    kind: entry.resource_type,
    // Lifecycle vocabulary wins over a raw state string: the projection already
    // resolved whether this row is still selectable.
    status: status(attributes.state ?? attributes.run_status ?? attributes.runtime_status ?? attributes.activation_state
      ?? (lifecycle === "retired" ? "stopped" : available ? "ready" : "degraded")),
    attributes,
    packageId: typeof relations.package === "string" ? relations.package : undefined,
    activationId: typeof relations.activation === "string" ? relations.activation : undefined,
    actionIds: actionRefs.map((item: any) => typeof item === "string" ? item : item?.uri ?? item?.action ?? "").filter(Boolean),
    catalogCategory: category(entry.catalog_category),
    lifecycle,
    available,
    relations,
    metadata: { ...summary, owner: entry.owner ?? null, tags: entry.tags ?? [], index_version: entry.index_version ?? 1, updated_at: entry.updated_at ?? null },
  };
}

export function normalizeAction(value: any): CapabilityAction {
  const action = value.action ?? value;
  const descriptorId = action.action_descriptor_ref?.resource_id ?? value.action_descriptor_ref?.resource_id;
  const descriptorName = typeof descriptorId === "string" ? descriptorId.split("/descriptors/")[1]?.split("/")[0] : undefined;
  const interaction = action.interaction ?? value.interaction ?? (action.mode === "byte-stream" ? "byte-stream" : undefined);
  const uri = text(action.uri ?? action.id ?? descriptorId, "unknown-action");
  const exportName = uri.match(/\/actions\/exports\/[^/]+\/[^/]+\/([^/]+)/)?.[1];
  return { id: uri, name: text(action.name ?? descriptorName ?? exportName, tail(uri)), description: action.description, interaction, inputSchema: action.arguments_schema ?? action.input_schema ?? value.inputSchema, outputSchema: action.result_schema ?? action.output_schema ?? value.outputSchema, permissions: Array.isArray(action.permissions) ? action.permissions : [], sideEffects: action.side_effects ?? action.sideEffects ?? action.effect_class, available: typeof action.available === "boolean" ? action.available : undefined, unavailableReason: action.unavailable_reason, metadata: {} };
}

export function normalizePackage(payload: any): CapabilityPackage {
  const authority = text(payload.resource_authority, "loom.local");
  const workspace = text(payload.workspace_id, "workspace-default");
  const packageId = text(payload.package_id, "catalog-package");
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

export function normalizeActivation(entry: CatalogResource): Activation {
  const summary = record(entry.summary);
  const attributes = { ...summary };
  // `runs_on` and `package` live on the projection relations, not in the offer list.
  const relations = record(entry.relations);
  const actionRefs = Array.isArray(attributes.available_action_refs) ? attributes.available_action_refs : [];
  const auth = attributes.authentication_state;
  const lifecycle = lifecycleOf(entry.lifecycle);
  return { id: entry.uri, name: text(entry.resource_name ?? attributes.instance_name, tail(entry.uri)), packageId: text(relations.package, "unknown-package"), slaveId: text(relations.runs_on, "unknown-host"), status: status(attributes.activation_state ?? (lifecycle === "retired" ? "stopped" : entry.available ? "ready" : undefined)), revision: Number(attributes.activation_revision ?? 0), available: entry.available ?? false, authentication: auth === "authenticated" ? "authenticated" : auth === "auth_required" || auth === "pending_auth" ? "pending" : auth === "auth_failed" || auth === "failed" ? "failed" : auth === "not_required" ? "not_required" : "unknown", configurationSummary: attributes, actionIds: actionRefs.map(String), lifecycle, desiredState: attributes.desired_state, relations, metadata: summary };
}
