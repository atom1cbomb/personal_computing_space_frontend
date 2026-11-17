import { describe, expect, it } from "vitest";
import { normalizeAction, normalizeActivation, normalizePackage, normalizeResource } from "../data/catalog/normalizer";

describe("catalog normalizers", () => {
  it("uses bounded summaries and preserves resource lifecycle", () => {
    const resource = normalizeResource({ uri: "grip://loom.local/resources/vm/x", resource_type: "computing/vm", resource_name: "Research VM", catalog_category: "compute", lifecycle: "retired", available: false, relations: { runs_on: "grip://loom.local/slaves/a" }, summary: { region: "Shanghai", state: "stopped" } });
    expect(resource).toMatchObject({ name: "Research VM", kind: "computing/vm", lifecycle: "retired", available: false, relations: { runs_on: "grip://loom.local/slaves/a" } });
    expect(resource.attributes.region).toBe("Shanghai");
  });

  it("derives package action names from catalog references", () => {
    const uri = "grip://loom.local/workspaces/workspace-default/actions/exports/ark-http/v3/chat-completions/sha256/abc";
    const action = normalizeAction({ uri });
    const pkg = normalizePackage({ resource: "grip://loom.local/workspaces/workspace-default/packages/ark-http/v3", package_id: "ark-http", package_version: "v3", actions: [action], activations: [] });
    expect(action.name).toBe("chat-completions");
    expect(action.sideEffects).toBeUndefined();
    expect(action.interaction).toBeUndefined();
    expect(action.available).toBeUndefined();
    expect(pkg.actions[0].id).toBe(uri);
  });

  it("shows activation relations and declared availability from the catalog", () => {
    const activation = normalizeActivation({ uri: "grip://loom.local/activations/a", resource_type: "capability/activation", catalog_category: "capability", lifecycle: "active", available: true, relations: { package: "grip://loom.local/packages/p", runs_on: "grip://loom.local/slaves/a" }, summary: { instance_name: "alpha", available_action_refs: ["grip://loom.local/actions/x"] } });
    expect(activation).toMatchObject({ name: "alpha", status: "ready", packageId: "grip://loom.local/packages/p", slaveId: "grip://loom.local/slaves/a", actionIds: ["grip://loom.local/actions/x"] });
    expect(activation.authentication).toBe("unknown");
  });
});
