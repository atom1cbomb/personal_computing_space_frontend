import { CatalogClient, type CatalogQuery, type CatalogResource } from "../catalog/client";
import { normalizeAction, normalizeActivation, normalizePackage, normalizeResource } from "../catalog/normalizer";
import type {
  Activation,
  CapabilityPackage,
  Resource,
} from "../../domain/models";

export class CatalogAdapter {
  constructor(private readonly client: CatalogClient) {}

  async listResources(): Promise<Resource[]> {
    const [compute, execution] = await Promise.all([
      this.listCatalogEntries({ catalog_category: "compute" }),
      this.listCatalogEntries({ catalog_category: "execution" }),
    ]);
    return [...compute, ...execution].map((entry) => normalizeResource(entry));
  }
  async getResource(id: string): Promise<Resource | undefined> {
    const entry = (await this.client.catalogResources({ resource_uri: id, limit: 1 })).resources[0];
    return entry ? normalizeResource(entry) : undefined;
  }
  async listPackages(): Promise<CapabilityPackage[]> {
    const entries = await this.listCatalogEntries({ resource_type: "capability/package" });
    const actionEntries = await this.listCatalogEntries({ resource_type: "supporting/action", include_supporting: true });
    const actionByUri = new Map(actionEntries.map((entry) => [entry.uri, normalizeAction({ uri: entry.uri, ...(entry.summary ?? {}) })]));
    return entries.map((entry) => {
      const refs = Array.isArray(entry.summary?.declared_action_refs) ? entry.summary.declared_action_refs : [];
      const catalogActions = refs.map((ref) => actionByUri.get(String(ref)) ?? normalizeAction({ uri: String(ref) }));
      return normalizePackage({
        resource: entry.uri,
        name: entry.summary?.package_id ?? entry.resource_name,
        ...(entry.summary ?? {}),
        actions: catalogActions,
        activations: (entry.summary?.activation_refs as string[] | undefined) ?? [],
        catalog_lifecycle: entry.lifecycle,
      });
    });
  }
  async getPackage(id: string): Promise<CapabilityPackage | undefined> { return (await this.listPackages()).find((item) => item.id === id); }
  async listActivations(): Promise<Activation[]> {
    const entries = await this.listCatalogEntries({ resource_type: "capability/activation", include_supporting: false });
    return entries.map((entry) => normalizeActivation(entry));
  }
  private async listCatalogEntries(query: CatalogQuery = {}): Promise<CatalogResource[]> {
    const entries: CatalogResource[] = [];
    let cursor = query.cursor ?? 0;
    do {
      const page = await this.client.catalogResources({ ...query, cursor, limit: query.limit ?? 200 });
      entries.push(...page.resources);
      if (page.next_cursor === null) break;
      cursor = page.next_cursor;
      if (entries.length >= 10000) throw new Error("Resource catalog query exceeded the console page limit.");
    } while (true);
    return entries;
  }
}

export class UnavailableCatalogAdapter {
  constructor(private readonly reason: string) {}
  private fail(): never { throw new Error(this.reason); }
  listResources(): Promise<Resource[]> { return this.fail(); }
  getResource(_id: string): Promise<Resource | undefined> { return this.fail(); }
  listPackages(): Promise<CapabilityPackage[]> { return this.fail(); }
  getPackage(_id: string): Promise<CapabilityPackage | undefined> { return this.fail(); }
  listActivations(): Promise<Activation[]> { return this.fail(); }
}
