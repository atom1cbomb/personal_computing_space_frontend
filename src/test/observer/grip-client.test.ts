import { describe, expect, it, vi } from "vitest";
import { GripClient } from "../../data/observer/grip-client";

const emptyCatalog = { resources: [], next_cursor: null, index_version: "catalog-v2", reason: "no_match" };
const reply = (requestId: string, envelope: unknown) => JSON.stringify({ kind: "reply", request_id: requestId, body: envelope });

describe("GripClient", () => {
  it("sends a public GRIP request and returns the reply body", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      return new Response(JSON.stringify(emptyCatalog), { status: 200 });
    });
    const client = new GripClient({ baseUrl: "https://observer.test", token: "secret", fetcher });
    await expect(client.catalogResources()).resolves.toMatchObject({ resources: [], index_version: "catalog-v2" });
    expect(fetcher.mock.calls[0][0]).toBe("/catalog/v1/catalog-resources");
    expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
  });

  it("omits invoke-only fields from DESCRIBE requests", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body));
      return new Response(reply(payload.request_id, {
        resource: { uri: payload.target, mcue: "computing/slave", metadata: {} }, offers: [],
      }), { status: 200 });
    });
    const client = new GripClient({ baseUrl: "", token: "secret", fetcher });
    await client.describe("grip://loom.local/workspaces/workspace-default/resources/slave-a");
    const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(payload).not.toHaveProperty("action");
    expect(payload).not.toHaveProperty("input");
  });

  it("preserves the native fetch invocation context for same-origin requests", async () => {
    const nativeLikeFetch = function (this: typeof globalThis, _url: string | URL, _init?: RequestInit) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    };
    vi.stubGlobal("fetch", nativeLikeFetch);
    try {
      const client = new GripClient({ baseUrl: "", token: "secret" });
      await expect(client.listPackages()).resolves.toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the local HTTP GRIP protocol through a same-origin proxy", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      return new Response(JSON.stringify(emptyCatalog), { status: 200 });
    });
    const client = new GripClient({ baseUrl: "", token: "secret", fetcher });
    await expect(client.catalogResources()).resolves.toMatchObject({ next_cursor: null });
    expect(fetcher.mock.calls[0][0]).toBe("/catalog/v1/catalog-resources");
  });

  it("queries the categorized catalog with lifecycle filters and validates pagination", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      return new Response(JSON.stringify({
        resources: [{ uri: "grip://loom.local/active", resource_type: "capability/activation", catalog_category: "capability" }],
        next_cursor: null, index_version: "catalog-v2", reason: "match",
      }), { status: 200 });
    });
    const client = new GripClient({ baseUrl: "", token: "secret", fetcher });
    await expect(client.catalogResources({ resource_type: "capability/activation", lifecycle: "active", include_supporting: false })).resolves.toMatchObject({ index_version: "catalog-v2", next_cursor: null });
    const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(fetcher.mock.calls[0][0]).toBe("/catalog/v1/catalog-resources");
    expect(payload).toMatchObject({ resource_type: "capability/activation", lifecycle: "active", include_supporting: false });
    expect(payload).not.toHaveProperty("resource_class");
  });

  it("rejects a catalog row without a resource type", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      return new Response(JSON.stringify({
        resources: [{ uri: "grip://loom.local/legacy" }], next_cursor: null, index_version: "catalog-v2", reason: "match",
      }), { status: 200 });
    });
    const client = new GripClient({ baseUrl: "", token: "secret", fetcher });
    await expect(client.catalogResources()).rejects.toThrow(/uri or resource_type/);
  });
});
