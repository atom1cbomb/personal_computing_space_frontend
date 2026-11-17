import { describe, expect, it, vi } from "vitest";
import { CatalogClient } from "../data/catalog/client";

const emptyCatalog = { resources: [], next_cursor: null, index_version: "catalog-v2", reason: "no_match" };

describe("CatalogClient", () => {
  it("queries the read-only catalog endpoint through the same-origin proxy", async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => new Response(JSON.stringify(emptyCatalog), { status: 200 }));
    const client = new CatalogClient({ proxyToken: "proxy-token", fetcher });
    await expect(client.catalogResources({ catalog_category: "compute" })).resolves.toMatchObject(emptyCatalog);
    expect(fetcher.mock.calls[0][0]).toBe("/catalog/v1/catalog-resources");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer proxy-token" }) });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ catalog_category: "compute" });
  });

  it("preserves native fetch context", async () => {
    const nativeLikeFetch = function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(new Response(JSON.stringify(emptyCatalog), { status: 200 }));
    };
    vi.stubGlobal("fetch", nativeLikeFetch);
    try { await expect(new CatalogClient({ proxyToken: "proxy-token" }).catalogResources()).resolves.toMatchObject(emptyCatalog); }
    finally { vi.unstubAllGlobals(); }
  });

  it("rejects catalog rows without a resource type", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ resources: [{ uri: "grip://loom.local/legacy" }], next_cursor: null, index_version: "catalog-v2", reason: "match" }), { status: 200 }));
    await expect(new CatalogClient({ proxyToken: "proxy-token", fetcher }).catalogResources()).rejects.toThrow(/uri or resource_type/);
  });
});
