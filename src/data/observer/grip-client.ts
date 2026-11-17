import type { JsonValue } from "../../domain/json-schema";
import { ObserverHttpError, ObserverProtocolError } from "./observer-errors";
import { createRequestId } from "./request-id";

export type GripDescription = { resource: { uri: string; mcue?: string; metadata?: Record<string, any> }; offers?: Record<string, any>[]; [key: string]: unknown };

export type CatalogCategory = "capability" | "compute" | "execution" | "supporting";
export type CatalogLifecycle = "active" | "retired" | "archived" | "expired";

// One row of the catalog projection. `summary` is the bounded per-type document
// the server publishes; it never carries credentials or instance configuration.
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

// `supporting` is a lookup tier rather than a first class category, so it is
// only reachable through include_supporting instead of catalog_category.
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

export type GripProtocol = "https-json.v1" | "loom-http-json.v1";
export type GripClientOptions = { baseUrl: string; token: string; catalogUrl?: string; catalogToken?: string; authority?: string; workspaceId?: string; allowInsecureHttp?: boolean; protocol?: GripProtocol; fetcher?: typeof fetch; timeoutMs?: number };

export class GripClient {
  private readonly fetcher: typeof fetch;
  constructor(private readonly options: GripClientOptions) {
    // Browser fetch is an instance method and requires the global object as `this`.
    // Bind both the native implementation and injected fetchers so every request
    // follows the same invocation contract.
    this.fetcher = (options.fetcher ?? globalThis.fetch).bind(globalThis);
    // An empty base URL means same-origin requests through the Vite reverse proxy.
    // Only validate an absolute URL when the client is configured to call Observer directly.
    if (options.baseUrl) {
      const protocol = new URL(options.baseUrl).protocol;
      if (protocol !== "https:" && !options.allowInsecureHttp) throw new ObserverProtocolError("Observer URL must use HTTPS unless insecure HTTP is explicitly enabled.");
    }
  }

  private async exchange(method: "DESCRIBE" | "INVOKE", target: string, action?: string, input?: JsonValue): Promise<any> {
    const requestId = createRequestId();
    const deadline = new Date(Date.now() + (this.options.timeoutMs ?? 30000)).toISOString();
    const protocol = this.options.protocol ?? (this.options.baseUrl.startsWith("https:") ? "https-json.v1" : "loom-http-json.v1");
    const payload = {
      version: "grip.v1", request_id: requestId, method,
      auth: { scheme: "bearer", credential: this.options.token }, target,
      accepted_protocols: [protocol], deadline,
      ...(method === "INVOKE" ? { action, input } : {}),
    };
    const response = await this.fetcher(`${this.options.baseUrl.replace(/\/$/, "")}/.well-known/grip`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok) throw new ObserverHttpError(response.status, body?.code ?? "observer_http_error", response.status >= 500);
    if (!body || body.request_id !== requestId || (body.kind !== "reply" && body.kind !== "error")) throw new ObserverProtocolError("Observer returned an invalid GRIP reply.");
    if (body.kind === "error") throw new ObserverHttpError(400, body.error_code ?? "grip_error", false);
    return body.body;
  }

  async describe(target: string): Promise<GripDescription> {
    const body = await this.exchange("DESCRIBE", target);
    if (!body?.resource?.uri) throw new ObserverProtocolError("GRIP description is missing resource.uri.");
    return body as GripDescription;
  }

  async catalogResources(query: CatalogQuery = {}): Promise<CatalogResult> {
    const base = (this.options.catalogUrl ?? "/catalog").replace(/\/$/, "");
    const response = await this.fetcher(`${base}/v1/catalog-resources`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${this.options.catalogToken ?? this.options.token}` },
      body: JSON.stringify(query),
    });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok) throw new ObserverHttpError(response.status, body?.error?.code ?? "catalog_unavailable", response.status >= 500);
    if (!body || !Array.isArray(body.resources) || !(typeof body.next_cursor === "number" || body.next_cursor === null)) {
      throw new ObserverProtocolError("Resource catalog returned an invalid response.");
    }
    if (typeof body.index_version !== "string") throw new ObserverProtocolError("Resource catalog reply is missing index_version.");
    // Identity and type are the only fields every row must carry; a row without
    // them cannot be described or routed, so fail loudly instead of rendering blanks.
    if (body.resources.some((item: CatalogResource) => typeof item?.uri !== "string" || typeof item?.resource_type !== "string")) {
      throw new ObserverProtocolError("Resource catalog item is missing uri or resource_type.");
    }
    return body as CatalogResult;
  }

  async invoke(target: string, action: string, input: JsonValue): Promise<JsonValue> { return this.exchange("INVOKE", target, action, input) as Promise<JsonValue>; }

  async getJsonContent(ref: string): Promise<JsonValue> {
    const root = `grip://${this.options.authority}/workspaces/${this.options.workspaceId}`;
    const body = await this.invoke(ref, `${root}/actions/read/v1`, {});
    if (typeof body === "object" && body !== null && "content" in body) return (body as { content: JsonValue }).content;
    return body;
  }

  async listPackages(): Promise<any[]> {
    const response = await this.fetcher(`${this.options.baseUrl.replace(/\/$/, "")}/api/v1/capability-packages`, { headers: { accept: "application/json", authorization: `Bearer ${this.options.token}` } });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new ObserverHttpError(response.status, body?.detail ?? "package_list_failed", response.status >= 500);
    if (!Array.isArray(body)) throw new ObserverProtocolError("Capability package response is not an array.");
    return body;
  }

  async getRun(runId: string): Promise<JsonValue> {
    const response = await this.fetcher(`${this.options.baseUrl.replace(/\/$/, "")}/api/v1/runs/${encodeURIComponent(runId)}`, { headers: { accept: "application/json", authorization: `Bearer ${this.options.token}` } });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new ObserverHttpError(response.status, body?.detail ?? "run_read_failed", response.status >= 500);
    return body as JsonValue;
  }
}
