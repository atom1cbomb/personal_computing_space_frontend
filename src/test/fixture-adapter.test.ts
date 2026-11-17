import { describe, expect, it } from "vitest";
import { createFixtureAdapter } from "../data/adapters/fixture-adapter";

describe("FixtureAdapter", () => {
  it("exposes heterogeneous packages and custom actions", async () => {
    const adapter = createFixtureAdapter();
    const packages = await adapter.listPackages();
    expect(packages.length).toBeGreaterThanOrEqual(5);
    expect(packages.find((item) => item.id === "package-custom-research")?.actions[0].name).toBe("export-history");
  });

  it("simulates direct and task action results", async () => {
    const adapter = createFixtureAdapter();
    const direct = await adapter.invokeAction({
      packageId: "package-grafana",
      actionId: "grafana.gpu-hours",
      targetId: "resource-gpu-cluster",
      input: { start: "2026-10-01", end: "2026-10-07" },
    });
    expect(direct.interaction).toBe("request-reply");
    expect(direct.output).toBeTruthy();

    const task = await adapter.invokeAction({
      packageId: "package-kubernetes",
      actionId: "kubernetes.submit-job",
      targetId: "resource-gpu-cluster",
      input: { name: "embedding-batch" },
    });
    expect(task.run?.status).toBe("running");
    expect((await adapter.listRuns()).some((run) => run.id === task.run?.id)).toBe(true);
  });

  it("simulates activation lifecycle operations", async () => {
    const adapter = createFixtureAdapter();
    const stopped = await adapter.manageActivation({ activationId: "activation-vm", operation: "start" });
    expect(stopped.status).toBe("starting");
    const authenticated = await adapter.manageActivation({ activationId: "activation-vm", operation: "authenticate" });
    expect(authenticated.authentication).toBe("authenticated");
  });
});
