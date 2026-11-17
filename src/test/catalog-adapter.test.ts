import { describe, expect, it, vi } from "vitest";
import { CatalogAdapter } from "../data/adapters/catalog-adapter";
import type { CatalogClient } from "../data/catalog/client";

describe("catalog adapter", () => {
  it("uses catalog categories and preserves retired activation history", async () => {
    const catalogResources = vi.fn(async (query: Record<string, unknown>) => {
      const row = query.catalog_category === "compute"
        ? { uri: "grip://loom.local/slaves/a", resource_type: "computing/slave", catalog_category: "compute", lifecycle: "active", available: true, summary: { runtime_status: "ready" } }
        : query.catalog_category === "execution"
          ? { uri: "grip://loom.local/runs/a", resource_type: "execution/run", catalog_category: "execution", lifecycle: "retired", available: false, summary: { run_status: "completed" } }
          : { uri: "grip://loom.local/activations/a", resource_type: "capability/activation", catalog_category: "capability", lifecycle: "retired", available: false, relations: { package: "grip://loom.local/packages/a", runs_on: "grip://loom.local/slaves/a" }, summary: { desired_state: "stopped" } };
      return { resources: [row], next_cursor: null, index_version: "catalog-v2", reason: "match" };
    });
    const adapter = new CatalogAdapter({ catalogResources } as unknown as CatalogClient);

    const resources = await adapter.listResources();
    const activations = await adapter.listActivations();
    expect(catalogResources).toHaveBeenCalledWith(expect.objectContaining({ catalog_category: "compute" }));
    expect(catalogResources).toHaveBeenCalledWith(expect.objectContaining({ catalog_category: "execution" }));
    expect(resources.map((item) => item.kind)).toEqual(["computing/slave", "execution/run"]);
    expect(activations[0]).toMatchObject({ status: "stopped", lifecycle: "retired", available: false });
  });

  it("builds package actions from catalog references without Observer requests", async () => {
    const actionUri = "grip://loom.local/workspaces/workspace-default/actions/exports/demo/v1/info/sha256/abc";
    const catalogResources = vi.fn(async (query: Record<string, unknown>) => ({
      resources: query.resource_type === "supporting/action"
        ? [{ uri: actionUri, resource_type: "supporting/action", summary: {} }]
        : [{ uri: "grip://loom.local/workspaces/workspace-default/packages/demo/v1", resource_type: "capability/package", catalog_category: "capability", summary: { package_id: "demo", package_version: "v1", declared_action_refs: [actionUri] } }],
      next_cursor: null, index_version: "catalog-v2", reason: "match",
    }));
    const adapter = new CatalogAdapter({ catalogResources } as unknown as CatalogClient);
    const packages = await adapter.listPackages();
    expect(packages[0]).toMatchObject({ name: "demo", version: "v1", actions: [{ id: actionUri, name: "info" }] });
    expect(catalogResources).toHaveBeenCalledWith(expect.objectContaining({ resource_type: "supporting/action", include_supporting: true }));
  });
});
