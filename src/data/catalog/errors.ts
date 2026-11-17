export class CatalogHttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly retryable: boolean, message = code) {
    super(message);
    this.name = "CatalogHttpError";
  }
}

export class CatalogProtocolError extends Error {
  constructor(message: string) { super(message); this.name = "CatalogProtocolError"; }
}
