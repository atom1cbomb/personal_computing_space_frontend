import { describe, expect, it } from "vitest";
import { normalizeAction, normalizeActivation, normalizePackage, normalizeResource } from "../data/catalog/normalizer";

describe("catalog normalizers", () => {
  it("derives status from lifecycle and available, not from a second raw state", () => {
    const resource = normalizeResource({ uri: "grip://loom.local/resources/vm/x", resource_type: "computing/vm", catalog_category: "compute", lifecycle: "retired", available: false, relations: { runs_on: "grip://loom.local/slaves/a" }, summary: { region: "Shanghai", state: "stopped" } });
    expect(resource).toMatchObject({ kind: "computing/vm", lifecycle: "retired", available: false, status: "stopped", relations: { runs_on: "grip://loom.local/slaves/a" } });
    expect(resource.attributes.region).toBe("Shanghai");

    // available === null means "no verdict", never degraded — even with a state.
    const run = normalizeResource({ uri: "grip://loom.local/runs/1", resource_type: "execution/run", lifecycle: "active", available: null, summary: { state: "completed" } });
    expect(run.available).toBeNull();
    expect(run.status).toBe("not_applicable");
    expect(run.attributes.state).toBe("completed");
  });

  it("turns a VM's running state into ready instead of not_applicable", () => {
    const vm = normalizeResource({ uri: "grip://loom.local/resources/computing/vm/1", resource_type: "computing/vm", catalog_category: "compute", lifecycle: "active", available: null, summary: { state: "running", display_name: "Workspace VM" } });
    expect(vm.available).toBeNull();
    expect(vm.status).toBe("ready");
  });

  it("does not render old/removed projection fields as its name", () => {
    const resource = normalizeResource({ uri: "grip://loom.local/workspaces/w/computing/vms/vm-42", resource_type: "computing/vm", catalog_category: "compute", lifecycle: "active", available: true, summary: { display_name: "Research VM" } });
    expect(resource.name).toBe("Research VM");
    const fallback = normalizeResource({ uri: "grip://loom.local/workspaces/w/computing/vms/vm-42", resource_type: "computing/vm", summary: {} });
    expect(fallback.name).toBe("vm-42");
  });

  it("shows a retired package as stopped, never degraded", () => {
    const current = normalizePackage({ resource: "grip://loom.local/packages/demo/v2", package_id: "demo", package_version: "v2", catalog_lifecycle: "active" });
    const retired = normalizePackage({ resource: "grip://loom.local/packages/demo/v1", package_id: "demo", package_version: "v1", catalog_lifecycle: "retired" });
    expect(current.status).toBe("ready");
    expect(retired.status).toBe("stopped");
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

  it("maps activation Loom state through available for one authoritative status", () => {
    const activation = normalizeActivation({ uri: "grip://loom.local/activations/a", resource_type: "capability/activation", catalog_category: "capability", lifecycle: "active", available: false, relations: { package: "grip://loom.local/packages/p", runs_on: "grip://loom.local/slaves/a" }, summary: { name: "p:alpha", state: "failed", available_action_refs: [] } });
    expect(activation).toMatchObject({ name: "p:alpha", status: "failed", available: false, packageId: "grip://loom.local/packages/p", slaveId: "grip://loom.local/slaves/a", actionIds: [] });
    expect(activation.authentication).toBeUndefined();
    // available=true always wins as ready (state is not a competing status).
    const ready = normalizeActivation({ uri: "grip://loom.local/activations/b", resource_type: "capability/activation", summary: { state: "provisioning" }, available: true });
    expect(ready.status).toBe("ready");
    // With no verdict, a mapped Loom state (provisioning) shows as starting.
    const provisioning = normalizeActivation({ uri: "grip://loom.local/activations/b2", resource_type: "capability/activation", summary: { state: "provisioning" }, available: null });
    expect(provisioning.status).toBe("starting");
    // available=false with a "ready" raw state must never display Ready.
    const unusable = normalizeActivation({ uri: "grip://loom.local/activations/c", resource_type: "capability/activation", available: false, summary: { state: "ready" } });
    expect(unusable.status).toBe("degraded");
  });
});
