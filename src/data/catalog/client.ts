import { CatalogHttpError, CatalogProtocolError } from "./errors";

export type CatalogCategory = "capability" | "compute" | "execution" | "supporting";
export type CatalogLifecycle = "active" | "retired" | "archived" | "expired";

export type CatalogResource = {
  uri: string;
  resource_type: string;
  resource_name?: string | null;
  catalog_category?: CatalogCategory;
  lifecycle?: CatalogLifecycle;
  available?: boolean;
  owner?: string | null;
  tags?: string[];
  relations?: Record<string, string | null>;
  index_version?: number;
  updated_at?: string | null;
  summary?: Record<string, unknown>;
};

export type CatalogQuery = {
  resource_uri?: string;
  catalog_category?: Exclude<CatalogCategory, "supporting">;
  resource_type?: string;
  tag?: string;
  owner?: string;
  lifecycle?: CatalogLifecycle;
  available?: boolean;
  include_validation?: boolean;
  include_supporting?: boolean;
  limit?: number;
  sort?: "uri" | "resource_type";
  cursor?: number;
};

export type CatalogResult = { resources: CatalogResource[]; next_cursor: number | null; index_version: string; reason: "match" | "no_match" };
export type CatalogClientOptions = { catalogUrl?: string; proxyToken: string; fetcher?: typeof fetch };

export class CatalogClient {
  private readonly fetcher: typeof fetch;
  constructor(private readonly options: CatalogClientOptions) {
    this.fetcher = (options.fetcher ?? globalThis.fetch).bind(globalThis);
  }

  async catalogResources(query: CatalogQuery = {}): Promise<CatalogResult> {
    const base = (this.options.catalogUrl ?? "/catalog").replace(/\/$/, "");
    const response = await this.fetcher(`${base}/v1/catalog-resources`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${this.options.proxyToken}` },
      body: JSON.stringify(query),
    });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok) throw new CatalogHttpError(response.status, body?.error?.code ?? "catalog_unavailable", response.status >= 500);
    if (!body || !Array.isArray(body.resources) || !(typeof body.next_cursor === "number" || body.next_cursor === null)) {
      throw new CatalogProtocolError("Resource catalog returned an invalid response.");
    }
    if (typeof body.index_version !== "string") throw new CatalogProtocolError("Resource catalog reply is missing index_version.");
    if (body.resources.some((item: CatalogResource) => typeof item?.uri !== "string" || typeof item?.resource_type !== "string")) {
      throw new CatalogProtocolError("Resource catalog item is missing uri or resource_type.");
    }
    return body as CatalogResult;
  }
}
