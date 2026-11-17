# Observer API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the independent Personal Computing Space console to the Observer public data plane while preserving the existing domain-facing UI and fixture mode.

**Architecture:** Add a typed HTTP transport and a GRIP client inside the frontend data layer. `ObserverAdapter` will discover resources and packages through public Observer endpoints, resolve descriptions and action metadata, and normalize transport payloads into the existing domain models. The app will select Observer or fixture mode through explicit runtime configuration and will surface authentication, CORS, protocol, and normalization failures without silently substituting fixture data.

**Tech Stack:** TypeScript, React, Vite, Vitest, native `fetch`, and the existing domain models. No backend code or Python SDK is imported into the browser.

**Spec:** `docs/superpowers/specs/2026-10-29-personal-computing-space-console-design.md`

## Global Constraints

- The frontend remains fully independent from the backend repository.
- Only public Observer endpoints are used: `/.well-known/grip`, `/api/v1/capability-packages`, `/api/v1/runs/{run_id}`, `/api/v1/runtime`, and documented public action APIs.
- GRIP targets, action URIs, bindings, revisions, and package digests are read from Observer responses; the frontend must not invent them.
- Tokens are never bundled into source or sent to provider services; the browser sends the configured Observer bearer token only to Observer HTTP endpoints.
- Fixture mode remains available for offline development and is never silently used after a configured Observer request fails.
- `task`, `request-reply`, and `byte-stream` semantics remain distinct; the first real integration supports JSON request/reply and task submission, while byte streams report an explicit unsupported UI state.
- Writes require the exact action offer, current revision, and idempotency key supplied by the Observer description; generic UI must not guess management payloads.

## File structure

- Modify: `src/domain/models.ts` for transport-safe metadata and resource references.
- Create: `src/data/observer/grip-client.ts` for GRIP request construction, response validation, and errors.
- Create: `src/data/observer/observer-normalizer.ts` for public Observer payload to domain model conversion.
- Modify: `src/data/adapters/observer-adapter.ts` to implement real discovery and invocation.
- Create: `src/data/adapters/adapter-config.ts` for runtime mode, URL, workspace, authority, and token handling.
- Modify: `src/app/App.tsx` to select the adapter and expose connection state.
- Modify: `src/app/app.css` for connection/error/configuration surfaces.
- Create: `.env.example`, `vite.config.ts` proxy configuration, and update `README.md`.
- Create tests under `src/test/observer/` using mocked `fetch` and fixture transport payloads.

### Task 1: Define runtime configuration and adapter selection

**Files:**
- Create: `src/data/adapters/adapter-config.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`
- Create: `.env.example`
- Test: `src/test/adapter-config.test.ts`

**Interfaces:**
- `AdapterConfig = { mode: "fixture" | "observer"; observerUrl?: string; workspaceId: string; gripAuthority: string; token?: string; allowInsecureHttp: boolean }`
- `readAdapterConfig(storage?: Storage): AdapterConfig`
- The app creates `FixtureAdapter` for fixture mode and `ObserverAdapter` for observer mode.

- [ ] Write tests for defaults, environment values, local storage overrides, and missing Observer URL.
- [ ] Run the focused tests and verify the new module is missing.
- [ ] Implement config parsing with no secret hardcoded in source.
- [ ] Add a small connection mode indicator and error boundary in the shell.
- [ ] Run focused tests and build.

### Task 2: Implement the browser GRIP client

**Files:**
- Create: `src/data/observer/grip-client.ts`
- Create: `src/data/observer/observer-errors.ts`
- Test: `src/test/observer/grip-client.test.ts`

**Interfaces:**
- `GripClient.describe(target: string): Promise<GripDescription>`
- `GripClient.listResources(mcue?: string): Promise<GripResourceSummary[]>`
- `GripClient.invoke(target: string, action: string, input: JsonValue): Promise<JsonValue>`
- `GripClient.getJsonContent(ref: string): Promise<JsonValue>`
- `ObserverHttpError` preserves HTTP status, public error code, and retryability without exposing credentials.

- [ ] Write mocked-fetch tests for GRIP request shape, bearer auth, list-resources response, describe response, error envelope, and deadline handling.
- [ ] Run focused tests and verify failure.
- [ ] Implement native-fetch transport with `/.well-known/grip`, request IDs, ISO deadlines, and exact target/action values.
- [ ] Validate minimum response structure and return structured errors for malformed replies.
- [ ] Run focused tests and typecheck.

### Task 3: Normalize Observer descriptions into domain models

**Files:**
- Create: `src/data/observer/observer-normalizer.ts`
- Modify: `src/domain/models.ts`
- Test: `src/test/observer/observer-normalizer.test.ts`

**Interfaces:**
- `normalizeResource(summary: GripResourceSummary, description?: GripDescription): Resource`
- `normalizePackage(payload: unknown): CapabilityPackage`
- `normalizeActivation(description: GripDescription): Activation`
- `normalizeRun(payload: unknown): Run`
- Normalization preserves original GRIP URI, MCUE, revision, action URI, schema refs, binding metadata, and unknown metadata under `metadata`.

- [ ] Write tests for package actions, activation states, unknown MCUE types, pending authentication, and malformed optional fields.
- [ ] Run focused tests and verify failure.
- [ ] Implement conservative normalization with explicit fallback labels and no inferred provider semantics.
- [ ] Run focused tests and build.

### Task 4: Implement real ObserverAdapter discovery and reads

**Files:**
- Modify: `src/data/adapters/observer-adapter.ts`
- Create: `src/data/observer/observer-types.ts`
- Test: `src/test/observer/observer-adapter.test.ts`

**Interfaces:**
- `ObserverAdapter` receives `{ client: GripClient }`.
- `listResources()` queries the root `list-resources` action, then describes only entries needed by the UI.
- `listPackages()` reads `/api/v1/capability-packages` and resolves action descriptors/schema refs through the public content/action reads.
- `listActivations()` discovers `capability/activation` entries and describes them.
- `listRuns()` reads configured run IDs from the public run listing or returns a clear `unsupported` error if the deployed Observer exposes only per-run reads; it must not fabricate runs.

- [ ] Write tests for successful discovery, partial description failures, empty catalogs, and explicit unsupported run listing.
- [ ] Run focused tests and verify failure.
- [ ] Implement read methods with bounded parallelism and per-item error metadata.
- [ ] Run focused tests and build.

### Task 5: Implement safe real action invocation and lifecycle operations

**Files:**
- Modify: `src/data/adapters/observer-adapter.ts`
- Modify: `src/data/observer/grip-client.ts`
- Test: `src/test/observer/observer-actions.test.ts`

**Interfaces:**
- `invokeAction()` selects the action offer from the latest description, sends the declared interaction payload, and returns either direct output or a Run reference.
- `manageActivation()` supports only operations whose action offers are present; it sends `expected_revision` and a generated idempotency key for task actions.
- Byte-stream actions return `unsupported_interaction` without making a network request.

- [ ] Write tests proving no request is sent for unavailable/stream actions and that revision/idempotency are included for task calls.
- [ ] Run focused tests and verify failure.
- [ ] Implement offer selection and action result normalization.
- [ ] Implement Run polling only when the returned contract explicitly provides a Run reference.
- [ ] Run focused tests and build.

### Task 6: Add connection UX, proxy, documentation, and integration verification

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`
- Modify: `README.md`
- Create: `.env.example`
- Test: `src/test/app-connection.test.tsx`

- [ ] Add development proxy configuration for `VITE_OBSERVER_URL` and document production same-origin/reverse-proxy requirements.
- [ ] Show connecting, connected, auth required, CORS/network error, malformed response, and fixture mode states.
- [ ] Add a user-triggered “switch to fixture mode” only when explicitly requested; do not silently fallback.
- [ ] Run the full test suite and production build.
- [ ] Run a manual smoke test against a reachable Observer using a token supplied at runtime, without committing it.

## Verification checklist

- `npm test -- --run` passes.
- `npm run build` passes.
- A mocked GRIP exchange sends the correct target, action, request ID, deadline, and bearer token.
- Unknown packages/actions still render through the existing generic UI after normalization.
- Observer failures are visible and do not silently show stale fixtures.
- No token appears in source, build output, logs, Run input, or provider requests.
- Byte-stream actions are not invoked by the generic JSON UI.
