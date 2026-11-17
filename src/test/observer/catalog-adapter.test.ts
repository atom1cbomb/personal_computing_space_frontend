import { describe, expect, it, vi } from "vitest";
import { ObserverAdapter } from "../../data/adapters/observer-adapter";
import type { GripClient } from "../../data/observer/grip-client";

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
    const describe = vi.fn(async (uri: string) => ({ resource: { uri, mcue: "computing/slave", metadata: {} }, offers: [] }));
    const adapter = new ObserverAdapter({ catalogResources, describe } as unknown as GripClient);

    const resources = await adapter.listResources();
    const activations = await adapter.listActivations();
    expect(catalogResources).toHaveBeenCalledWith(expect.objectContaining({ catalog_category: "compute" }));
    expect(catalogResources).toHaveBeenCalledWith(expect.objectContaining({ catalog_category: "execution" }));
    expect(resources.map((item) => item.kind)).toEqual(["computing/slave", "execution/run"]);
    expect(activations[0]).toMatchObject({ status: "stopped", lifecycle: "retired", available: false });
    expect(describe).toHaveBeenCalledTimes(1);
  });
});
