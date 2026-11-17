import { describe, expect, it } from "vitest";
import { normalizePackage, normalizeResource } from "../../data/observer/observer-normalizer";

describe("Observer normalizers", () => {
  it("keeps unknown package actions and reads the catalog summary", () => {
    const pkg = normalizePackage({ resource: "grip://loom.local/workspaces/workspace-default/packages/custom/v1", name: "Custom", version: "v1", actions: [{ action: { uri: "grip://loom.local/actions/export/v1", name: "export-history", interaction: "request-reply", side_effects: "none", permissions: [] } }] });
    const resource = normalizeResource({
      uri: "grip://loom.local/workspaces/workspace-default/resources/custom",
      resource_type: "custom/resource",
      catalog_category: "compute",
      lifecycle: "active",
      available: true,
      summary: { region: "local", state: "ready" },
    });
    expect(pkg.actions[0].name).toBe("export-history");
    expect(resource.kind).toBe("custom/resource");
    expect(resource.attributes.region).toBe("local");
    expect(resource.catalogCategory).toBe("compute");
    expect(resource.lifecycle).toBe("active");
    expect(resource.available).toBe(true);
  });

  it("prefers the projection display name over the URI tail", () => {
    const resource = normalizeResource({
      uri: "grip://loom.local/workspaces/workspace-default/resources/computing/vm/x",
      resource_type: "computing/vm",
      resource_name: "loom-workspace",
      catalog_category: "compute",
      summary: { state: "running" },
    });
    expect(resource.name).toBe("loom-workspace");
    expect(resource.status).toBe("ready");
  });

  it("uses the live VM display name ahead of the catalog URI tail", () => {
    const resource = normalizeResource({ uri: "grip://loom.local/resources/computing/vm/id-123", resource_type: "computing/vm", resource_name: "id-123", catalog_category: "compute", summary: { state: "running" } }, {
      resource: { uri: "grip://loom.local/resources/computing/vm/id-123", mcue: "computing/vm", metadata: { attributes: { display_name: "loom-workspace" } } },
    });
    expect(resource.name).toBe("loom-workspace");
  });

  it("merges a live description over the bounded summary", () => {
    const resource = normalizeResource({
      uri: "grip://loom.local/workspaces/workspace-default/resources/computing/vm/x",
      resource_type: "computing/vm",
      catalog_category: "compute",
      lifecycle: "active",
      available: false,
      relations: { runs_on: "grip://loom.local/slaves/slave-a" },
      summary: { state: "pending_auth" },
    }, {
      resource: { uri: "grip://loom.local/workspaces/workspace-default/resources/computing/vm/x", mcue: "computing/vm", metadata: { attributes: { display_name: "Research VM", region: "Shanghai" }, offers: [] } },
    });
    expect(resource.name).toBe("Research VM");
    expect(resource.attributes.region).toBe("Shanghai");
    expect(resource.available).toBe(false);
    expect(resource.status).toBe("pending_auth");
    expect(resource.metadata?.owner).toBeNull();
  });

  it("drops a category outside the three public ones", () => {
    const resource = normalizeResource({
      uri: "grip://loom.local/workspaces/workspace-default/actions/exports/x",
      resource_type: "supporting/action",
      catalog_category: "supporting",
      summary: {},
    });
    expect(resource.catalogCategory).toBeUndefined();
    expect(resource.kind).toBe("supporting/action");
  });
});
