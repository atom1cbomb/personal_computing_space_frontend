import type { DataAdapter } from "./data-adapter";
import { fixtureActivations, fixturePackages, fixtureResources, fixtureRuns } from "../fixtures";
import type {
  ActionInvocationRequest,
  ActionInvocationResult,
  Activation,
  ActivationManagementRequest,
  CapabilityPackage,
  Resource,
  Run,
} from "../../domain/models";

const clone = <T>(value: T): T => structuredClone(value);

export function createFixtureAdapter(): DataAdapter {
  let resources = clone(fixtureResources);
  let packages = clone(fixturePackages);
  let activations = clone(fixtureActivations);
  let runs = clone(fixtureRuns);

  return {
    async listResources() { return clone(resources); },
    async getResource(id: string) { return clone(resources.find((item) => item.id === id)); },
    async listPackages() { return clone(packages); },
    async getPackage(id: string) { return clone(packages.find((item) => item.id === id)); },
    async listActivations() { return clone(activations); },
    async listRuns() { return clone(runs); },
    async invokeAction(request: ActionInvocationRequest): Promise<ActionInvocationResult> {
      const pkg = packages.find((item) => item.id === request.packageId);
      const selected = pkg?.actions.find((item) => item.id === request.actionId);
      if (!pkg || !selected) throw new Error("The requested fixture action does not exist.");
      if (!selected.available) throw new Error(selected.unavailableReason ?? "This action is unavailable.");
      if (selected.interaction === "request-reply") {
        return { interaction: selected.interaction, output: { simulated: true, action: selected.name, input: clone(request.input), generatedAt: "2026-10-29T04:10:00.000Z" }, message: "Fixture result generated locally." };
      }
      if (selected.interaction === "byte-stream") throw new Error("This fixture action requires a specialized stream surface.");
      const run: Run = { id: `run-simulated-${runs.length + 1}`, actionId: selected.id, actionName: selected.name, packageId: pkg.id, targetId: request.targetId, status: "running", acceptance: "not_required", submittedAt: "2026-10-29T04:10:00.000Z", updatedAt: "2026-10-29T04:10:00.000Z", input: clone(request.input), events: [{ id: `event-${runs.length + 1}`, timestamp: "2026-10-29T04:10:00.000Z", type: "submitted", message: "Fixture action submitted" }, { id: `event-${runs.length + 2}`, timestamp: "2026-10-29T04:10:00.000Z", type: "started", message: "Fixture runner started" }] };
      runs = [run, ...runs];
      return { interaction: selected.interaction, run, message: "Fixture Run created locally." };
    },
    async manageActivation(request: ActivationManagementRequest): Promise<Activation> {
      const current = activations.find((item) => item.id === request.activationId);
      if (!current) throw new Error("The requested fixture activation does not exist.");
      const next = clone(current);
      next.revision += 1;
      if (request.operation === "start") { next.status = "starting"; next.available = false; }
      if (request.operation === "stop") { next.status = "stopped"; next.available = false; }
      if (request.operation === "retry") { next.status = "pending_auth"; next.authentication = "pending"; next.available = false; }
      if (request.operation === "authenticate") { next.status = "ready"; next.authentication = "authenticated"; next.available = true; }
      activations = activations.map((item) => item.id === next.id ? next : item);
      resources = resources.map((item) => item.activationId === next.id ? { ...item, status: next.status } : item);
      packages = packages.map((item) => item.id === next.packageId && !item.activationIds.includes(next.id) ? { ...item, activationIds: [...item.activationIds, next.id] } : item);
      return clone(next);
    },
  };
}
