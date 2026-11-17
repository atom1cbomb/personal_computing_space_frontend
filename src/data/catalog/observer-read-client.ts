export type ObserverDescription = {
  uri: string;
  mcue?: string;
  attributes: Record<string, unknown>;
  details: Record<string, unknown>;
};

export class ObserverReadClient {
  private readonly fetcher: typeof fetch;
  constructor(private readonly proxyToken: string, fetcher?: typeof fetch) {
    this.fetcher = (fetcher ?? globalThis.fetch).bind(globalThis);
  }

  async describe(uri: string): Promise<ObserverDescription> {
    const response = await this.fetcher(`/observer/describe?uri=${encodeURIComponent(uri)}`, {
      method: "GET", headers: { accept: "application/json", authorization: `Bearer ${this.proxyToken}` },
    });
    if (!response.ok) throw new Error(`observer_describe_${response.status}`);
    const body = await response.json() as ObserverDescription;
    if (body.uri !== uri || !body.details || !body.attributes) throw new Error("invalid_observer_description");
    return body;
  }
}
