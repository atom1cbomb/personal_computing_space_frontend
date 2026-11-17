import type { Resource } from "../../domain/models";

const root = "grip://loom.local/workspaces/workspace-default";

// Offline fixtures mirror the catalog projection categories. Business
// "managed resources" no longer exist as a catalog category, so this list holds
// compute rows plus the execution rows the Plans and Runs views read.
export const fixtureResources: Resource[] = [
  {
    id: `${root}/slaves/lab-node-a/instance-1`, name: "lab-node-a", kind: "computing/slave", catalogCategory: "compute",
    lifecycle: "active", available: true, status: "ready", relations: {},
    attributes: { runtime_status: "online", supported_protocols: ["https-json.v1"], runtime_capabilities: ["container", "shell"], region: "Beijing" },
    actionIds: [],
  },
  {
    id: `${root}/slaves/home-node-b/instance-1`, name: "home-node-b", kind: "computing/slave", catalogCategory: "compute",
    lifecycle: "active", available: true, status: "degraded", relations: {},
    attributes: { runtime_status: "degraded", supported_protocols: ["https-json.v1"], runtime_capabilities: ["container"], region: "Shanghai" },
    actionIds: [],
  },
  {
    id: `${root}/resources/computing/vm/research-vm`, name: "Research VM", kind: "computing/vm", catalogCategory: "compute",
    lifecycle: "active", available: false, status: "pending_auth",
    relations: { runs_on: `${root}/slaves/home-node-b/instance-1` },
    attributes: { state: "pending_auth", region: "Shanghai", display_name: "Research VM" },
    packageId: "package-vm-ssh", managedById: "slave-b", activationId: "activation-vm", actionIds: ["vm.exec"],
  },
  {
    id: `${root}/plans/run-embedding/v3`, name: "run-embedding · closure v3", kind: "execution/plan", catalogCategory: "execution",
    lifecycle: "active", available: true, status: "ready", relations: { run: `${root}/runs/run-embedding` },
    attributes: { plan_status: "frozen", action_name: "submit-job" },
    actionIds: [],
  },
  {
    id: `${root}/runs/run-embedding`, name: "run-embedding", kind: "execution/run", catalogCategory: "execution",
    lifecycle: "active", available: true, status: "ready", relations: { plan: `${root}/plans/run-embedding/v3` },
    attributes: { run_status: "running" },
    actionIds: [],
  },
  {
    id: `${root}/runs/run-gpu-hours`, name: "run-gpu-hours", kind: "execution/run", catalogCategory: "execution",
    lifecycle: "retired", available: false, status: "stopped", relations: {},
    attributes: { run_status: "completed" },
    actionIds: [],
  },
];
