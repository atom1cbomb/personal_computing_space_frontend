import { describe, expect, it } from "vitest";
import { readAdapterConfig } from "../data/adapters/adapter-config";

describe("catalog adapter config", () => {
  it("uses the same-origin catalog proxy by default", () => {
    expect(readAdapterConfig().catalogUrl).toBe("/catalog");
  });
  it("reads saved proxy settings", () => {
    const storage = { getItem: () => JSON.stringify({ catalogUrl: "/catalog", proxyToken: "read-only-proxy-token" }) } as unknown as Storage;
    expect(readAdapterConfig(storage)).toEqual({ catalogUrl: "/catalog", proxyToken: "read-only-proxy-token" });
  });
});
