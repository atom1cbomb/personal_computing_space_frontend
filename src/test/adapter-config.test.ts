import { describe, expect, it } from "vitest";
import { readAdapterConfig } from "../data/adapters/adapter-config";

describe("adapter config", () => {
  it("defaults to observer mode", () => expect(readAdapterConfig().mode).toBe("observer"));
  it("reads saved observer settings", () => {
    const storage = { getItem: () => JSON.stringify({ mode: "observer", observerUrl: "https://observer.test", token: "runtime-token" }) } as unknown as Storage;
    const config = readAdapterConfig(storage);
    expect(config).toMatchObject({ mode: "observer", observerUrl: "https://observer.test", token: "runtime-token" });
  });
  it("accepts the local runtime token when configured", () => {
    expect(typeof readAdapterConfig().token).toBe("string");
  });
  it("uses same-origin proxy mode when enabled", () => {
    const storage = { getItem: () => JSON.stringify({ mode: "observer", observerUrl: "" }) } as unknown as Storage;
    expect(readAdapterConfig(storage).observerUrl).toBe("");
  });
  it("preserves proxy readiness with an empty observer URL", () => {
    const storage = { getItem: () => JSON.stringify({ mode: "observer", observerUrl: "", token: "runtime-token", useProxy: true }) } as unknown as Storage;
    expect(readAdapterConfig(storage)).toMatchObject({ observerUrl: "", token: "runtime-token", useProxy: true });
  });
});
