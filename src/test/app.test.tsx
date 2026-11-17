import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App, packageLabel } from "../app/App";

describe("application foundation", () => {
  it("renders the console title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /your resource space/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Workspace resource map" }).querySelector(".map-center")?.textContent).toContain("PERSONALCOMPUTING SPACE");
    expect(screen.queryByText("Workspace snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText("Catalog model")).not.toBeInTheDocument();
  });

  it("opens a specific compute type from the workspace map", () => {
    render(<App />);
    const vmLink = screen.getByRole("link", { name: /Open VMs,/i });
    expect(vmLink).toHaveAttribute("href", "#/resources/vm");
    fireEvent.click(vmLink);
    expect(screen.getByRole("heading", { name: "VMs" })).toBeInTheDocument();
    window.location.hash = "";
  });

  it("opens a copied resource link directly", () => {
    window.location.hash = "#/resources/plan";
    render(<App />);
    expect(screen.getByRole("heading", { name: "Plans" })).toBeInTheDocument();
    window.location.hash = "";
  });

  it("shows the related package name and version for activations", () => {
    const uri = "grip://loom.local/workspaces/workspace-default/packages/kubernetes-http/v8";
    expect(packageLabel(uri, [{ id: uri, name: "Kubernetes Gateway", version: "v8", status: "available", actions: [], activationIds: [] }])).toBe("Kubernetes Gateway · v8");
    expect(packageLabel(uri, [])).toBe("kubernetes-http · v8");
  });
});
