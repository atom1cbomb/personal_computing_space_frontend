import { describe, expect, it } from "vitest";
import { normalizeAction, normalizeActivation, normalizePackage, normalizeResource } from "../data/catalog/normalizer";

describe("catalog normalizers", () => {
  it("uses bounded summaries and preserves resource lifecycle", () => {
    const resource = normalizeResource({ uri: "grip://loom.local/resources/vm/x", resource_type: "computing/vm", resource_name: "Research VM", catalog_category: "compute", lifecycle: "retired", available: false, relations: { runs_on: "grip://loom.local/slaves/a" }, summary: { region: "Shanghai", state: "stopped" } });
    expect(resource).toMatchObject({ name: "Research VM", kind: "computing/vm", lifecycle: "retired", available: false, relations: { runs_on: "grip://loom.local/slaves/a" } });
    expect(resource.attributes.region).toBe("Shanghai");
    const run = normalizeResource({ uri: "grip://loom.local/runs/1", resource_type: "execution/run", lifecycle: "active", available: null, summary: { state: "completed" } });
    expect(run.available).toBeNull();
    expect(run.attributes.state).toBe("completed");
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

  it("uses Loom state even when the activation is unavailable", () => {
    const activation = normalizeActivation({ uri: "grip://loom.local/activations/a", resource_type: "capability/activation", catalog_category: "capability", lifecycle: "active", available: false, relations: { package: "grip://loom.local/packages/p", runs_on: "grip://loom.local/slaves/a" }, summary: { instance_name: "alpha", state: "failed", revision: 3, available_action_refs: [] } });
    expect(activation).toMatchObject({ name: "alpha", status: "failed", revision: 3, packageId: "grip://loom.local/packages/p", slaveId: "grip://loom.local/slaves/a", actionIds: [] });
    expect(activation.authentication).toBeUndefined();
    const provisioning = normalizeActivation({ uri: "grip://loom.local/activations/b", resource_type: "capability/activation", summary: { state: "provisioning" } });
    expect(provisioning.status).toBe("provisioning");
  });
});
