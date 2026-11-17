import type { DataAdapter } from "./data-adapter";
import { GripClient, type CatalogQuery, type CatalogResource } from "../observer/grip-client";
import { normalizeActivation, normalizePackage, normalizeResource, normalizeRun } from "../observer/observer-normalizer";
import { createRequestId } from "../observer/request-id";
import type {
  ActionInvocationRequest,
  ActionInvocationResult,
  Activation,
  ActivationManagementRequest,
  CapabilityPackage,
  Resource,
  Run,
} from "../../domain/models";

export class ObserverAdapter implements DataAdapter {
  constructor(private readonly client: GripClient) {}

  async listResources(): Promise<Resource[]> {
    const [compute, execution] = await Promise.all([
      this.listCatalogEntries({ catalog_category: "compute" }),
      this.listCatalogEntries({ catalog_category: "execution" }),
    ]);
    const filtered = [...compute, ...execution];
    const described = await Promise.all(filtered.map(async (entry) => {
      if (entry.catalog_category === "execution" || entry.lifecycle !== "active") return normalizeResource(entry);
      try {
        return normalizeResource(entry, await this.client.describe(entry.uri));
      } catch (error) {
        // Catalog projections can briefly outlive a backing resource (for
        // example, a retired driver row). Keep the usable entries visible
        // instead of failing the entire workspace snapshot.
        if (error instanceof Error && error.message.includes("not_found")) return normalizeResource(entry);
        throw error;
      }
    }));
    return described.filter((item): item is Resource => item !== undefined);
  }
  async getResource(id: string): Promise<Resource | undefined> {
    const entry = (await this.client.catalogResources({ resource_uri: id, limit: 1 })).resources[0];
    if (!entry) return undefined;
    if (entry.lifecycle !== "active") return normalizeResource(entry);
    try { return normalizeResource(entry, await this.client.describe(id)); }
    catch (error) {
      if (error instanceof Error && error.message.includes("not_found")) return normalizeResource(entry);
      throw error;
    }
  }
  async listPackages(): Promise<CapabilityPackage[]> {
    const entries = await this.listCatalogEntries({ resource_type: "capability/package" });
    const details = await this.client.listPackages().catch(() => []);
    const byUri = new Map(details.map((item) => [item.resource ?? item.version_ref ?? item.package_ref ?? item.uri, item]));
    return entries.map((entry) => normalizePackage({
      ...(byUri.get(entry.uri) ?? {}), resource: entry.uri,
      name: byUri.get(entry.uri)?.package_id ?? entry.summary?.package_id ?? entry.resource_name,
      ...(entry.summary ?? {}), activations: (entry.summary?.activation_refs as string[] | undefined) ?? [],
      catalog_lifecycle: entry.lifecycle,
    }));
  }
  async getPackage(id: string): Promise<CapabilityPackage | undefined> { return (await this.listPackages()).find((item) => item.id === id); }
  async listActivations(): Promise<Activation[]> {
    const entries = await this.listCatalogEntries({ resource_type: "capability/activation", include_supporting: false });
    return Promise.all(entries.map(async (entry) => {
      const projected = { resource: { uri: entry.uri, mcue: entry.resource_type, metadata: { ...entry.summary, state: entry.summary?.activation_state, relations: entry.relations } }, offers: [] };
      if (entry.lifecycle !== "active") return normalizeActivation(projected, entry);
      try {
        return normalizeActivation(await this.client.describe(entry.uri), entry);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not_found")) {
          return normalizeActivation(projected, entry);
        }
        throw error;
      }
    }));
  }
  private async listCatalogEntries(query: CatalogQuery = {}): Promise<CatalogResource[]> {
    const entries: CatalogResource[] = [];
    let cursor = query.cursor ?? 0;
    do {
      const page = await this.client.catalogResources({ ...query, cursor, limit: query.limit ?? 200 });
      entries.push(...page.resources);
      if (page.next_cursor === null) break;
      cursor = page.next_cursor;
    } while (entries.length < 10000);
    return entries;
  }
  async listRuns(): Promise<Run[]> { throw new Error("Observer does not expose a public run catalog endpoint; request a specific Run reference instead."); }
  async invokeAction(request: ActionInvocationRequest): Promise<ActionInvocationResult> {
    const description = await this.client.describe(request.targetId);
    const offer = (description.offers ?? []).find((item: any) => item.action?.uri === request.actionId || item.action?.name === request.actionId);
    if (!offer) throw new Error("The requested action is not offered by the current Observer description.");
    if (offer.action?.mode === "byte-stream") throw new Error("byte_stream_ui_not_supported");
    const input = offer.action?.interaction === "task" || !offer.action?.interaction ? { arguments: request.input, expected_revision: String(description.revision ?? ""), idempotency_key: createRequestId() } : request.input;
    const body = await this.client.invoke(request.targetId, offer.action.uri, input);
    const output = body as any;
    return output?.run ? { interaction: "task", run: normalizeRun(output) } : { interaction: offer.action?.interaction ?? "request-reply", output };
  }
  async manageActivation(request: ActivationManagementRequest): Promise<Activation> {
    const description = await this.client.describe(request.activationId);
    const actionName = request.operation === "authenticate" ? "auth-start" : request.operation;
    const offer = (description.offers ?? []).find((item: any) => item.action?.name === actionName || item.action?.uri?.includes(`/actions/${actionName}/`));
    if (!offer) throw new Error(`activation_action_unavailable:${actionName}`);
    await this.client.invoke(request.activationId, offer.action.uri, { expected_revision: String(description.revision ?? ""), idempotency_key: createRequestId() });
    return normalizeActivation(await this.client.describe(request.activationId));
  }
}

export class UnavailableObserverAdapter implements DataAdapter {
  constructor(private readonly reason: string) {}
  private fail(): never { throw new Error(this.reason); }
  listResources(): Promise<Resource[]> { return this.fail(); }
  getResource(_id: string): Promise<Resource | undefined> { return this.fail(); }
  listPackages(): Promise<CapabilityPackage[]> { return this.fail(); }
  getPackage(_id: string): Promise<CapabilityPackage | undefined> { return this.fail(); }
  listActivations(): Promise<Activation[]> { return this.fail(); }
  listRuns(): Promise<Run[]> { return this.fail(); }
  invokeAction(_request: ActionInvocationRequest): Promise<ActionInvocationResult> { return this.fail(); }
  manageActivation(_request: ActivationManagementRequest): Promise<Activation> { return this.fail(); }
}
