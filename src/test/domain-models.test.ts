import { describe, expect, it } from "vitest";
import type { CapabilityAction, Resource } from "../domain/models";
import { getStatusTone, getStatusLabel } from "../domain/status";

describe("domain models", () => {
  it("keeps developer-defined actions as an open array", () => {
    const action: CapabilityAction = {
      id: "custom.export",
      name: "export-history",
      description: "Export a custom history format",
      interaction: "request-reply",
      inputSchema: { type: "object", properties: { format: { type: "string" } } },
      outputSchema: { type: "object" },
      permissions: ["history.read"],
      sideEffects: "none",
      available: true,
    };
    const resource: Resource = {
      id: "resource-custom",
      name: "Custom service",
      kind: "service",
      status: "ready",
      attributes: { owner: "workspace" },
      packageId: "package-custom",
      managedById: "slave-a",
      actionIds: [action.id],
    };

    expect(resource.actionIds).toContain("custom.export");
    expect(action.name).toBe("export-history");
  });

  it("gives lifecycle statuses readable labels and tones", () => {
    expect(getStatusLabel("pending_auth")).toBe("Pending authentication");
    expect(getStatusTone("degraded")).toBe("warning");
    expect(getStatusTone("failed")).toBe("danger");
  });
});
