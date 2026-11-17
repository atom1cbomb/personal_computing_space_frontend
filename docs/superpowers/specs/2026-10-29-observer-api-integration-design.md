# Observer API Integration Design

## Objective

Connect the independent console to the Observer public data plane while preserving the fixture-driven product experience and the open-ended capability/action model.

## Public boundary

The frontend talks only to Observer. GRIP discovery and invocation use `POST /.well-known/grip`; package and Run data use documented `/api/v1` read endpoints. Provider endpoints, Slave private endpoints, Driver endpoints, and Python SDK internals remain outside the browser.

## Runtime modes

The app has explicit `fixture` and `observer` modes. Fixture mode is the default for local development. Observer mode requires an Observer URL, workspace ID, GRIP authority, and a runtime token. The UI displays the current mode and connection state. Errors never silently fall back from Observer to fixtures.

## Security and deployment

Tokens are supplied at runtime and sent only to Observer. Development uses a Vite proxy to avoid browser CORS issues. Production should serve the frontend through the same origin as Observer or configure a narrowly scoped HTTPS reverse proxy/CORS policy. No token is stored in source or build artifacts.

## Data flow

```text
React UI
  -> DataAdapter
  -> ObserverAdapter
  -> GripClient / public REST reads
  -> Observer
```

The adapter resolves descriptions and offers, then normalizes them to the existing frontend domain model. Action URIs, revisions, bindings, schemas, and package references are always taken from Observer responses.

## Scope of first real integration

- Read resources, packages, activations, and individual Runs where public endpoints support them.
- Resolve action metadata and JSON Schemas for generic display.
- Invoke declared `task` and `request-reply` actions with the exact advertised contract.
- Manage activations only through advertised lifecycle offers.
- Reject generic byte-stream invocation with a visible unsupported-interaction state.
- Keep bounded polling for returned Run references.

If a deployed Observer does not expose a catalog endpoint, the adapter reports that limitation explicitly rather than synthesizing data.
