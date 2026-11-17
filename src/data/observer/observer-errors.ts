export class ObserverHttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly retryable: boolean, message = code) {
    super(message);
    this.name = "ObserverHttpError";
  }
}

export class ObserverProtocolError extends Error {
  constructor(message: string) { super(message); this.name = "ObserverProtocolError"; }
}
