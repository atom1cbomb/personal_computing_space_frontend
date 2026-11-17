# Personal Computing Space Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent React console that visualizes and locally simulates management of Personal Computing Space resources, capability packages, activations, Slaves, Runs, and developer-defined actions.

**Architecture:** The UI depends on a domain-facing `DataAdapter` interface. `FixtureAdapter` implements it first with deterministic local data and simulated state transitions; `ObserverAdapter` is reserved for a later public API integration and is not needed for the first release. Generic action rendering is driven by JSON Schema, with optional type-specific renderers layered on top.

**Tech Stack:** TypeScript, React, Vite, Vitest, React Testing Library, CSS modules or scoped stylesheet primitives, and a small client-side router if needed. Keep dependencies minimal until a concrete visualization requires one.

**Spec:** `docs/superpowers/specs/2026-10-29-personal-computing-space-console-design.md`

## Global Constraints

- The frontend is fully independent from the backend repository and imports no backend code.
- Release 1 uses `FixtureAdapter`; no real provider action or Observer mutation is performed.
- Actions are open-ended arrays; never hardcode the package action catalog into page structure.
- `task` and `request-reply` actions receive generic simulated execution; `byte-stream` is visible but clearly marked as requiring a specialized surface.
- Unknown packages, actions, schema fields, and lifecycle states must remain inspectable through generic fallback UI.
- Every user-facing status must distinguish readiness, authentication, execution, and acceptance.

## Project file structure

- `package.json`, `vite.config.ts`, `tsconfig*.json`: project tooling and scripts.
- `src/domain/`: domain models, JSON Schema types, status helpers, and adapter interfaces.
- `src/data/fixtures/`: deterministic packages, resources, Slaves, activations, and Runs.
- `src/data/adapters/fixture-adapter.ts`: local implementation of the adapter contract.
- `src/data/adapters/observer-adapter.ts`: typed placeholder and transport boundary for later API work; no network calls in release 1.
- `src/features/overview/`: summary cards and topology view.
- `src/features/resources/`: resource list, filters, detail, relationships, and actions.
- `src/features/packages/`: package catalog, action catalog, and action contract detail.
- `src/features/activations/`: lifecycle list/detail and simulated management actions.
- `src/features/runs/`: Run list, timeline, result, and simulated acceptance.
- `src/components/`: reusable status badges, data tables, schema form, JSON viewer, empty/loading/error states.
- `src/app/`: shell, navigation, routing, adapter provider, and global styles.
- `src/test/`: adapter, domain, schema-form, and smoke tests.

---

### Task 1: Scaffold the independent frontend workspace

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/app/app.css`
- Create: `src/test/setup.ts`

**Interfaces:**
- Produces a runnable Vite app with `dev`, `build`, `test`, and `test:watch` scripts.

- [ ] **Step 1: Create the package metadata and Vite entrypoint.**
- [ ] **Step 2: Add a minimal app shell with a visible project title and loading-safe root.**
- [ ] **Step 3: Add Vitest configuration and a browser-like test setup.**
- [ ] **Step 4: Run `npm install`, `npm test -- --run`, and `npm run build`.**

### Task 2: Define domain models and adapter contracts

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/domain/json-schema.ts`
- Create: `src/domain/status.ts`
- Create: `src/data/adapters/data-adapter.ts`
- Create: `src/data/adapters/observer-adapter.ts`
- Test: `src/test/domain-models.test.ts`

**Interfaces:**
- `DataAdapter.listResources(): Promise<Resource[]>`
- `DataAdapter.getResource(id: string): Promise<Resource | undefined>`
- `DataAdapter.listPackages(): Promise<CapabilityPackage[]>`
- `DataAdapter.getPackage(id: string): Promise<CapabilityPackage | undefined>`
- `DataAdapter.listActivations(): Promise<Activation[]>`
- `DataAdapter.listRuns(): Promise<Run[]>`
- `DataAdapter.invokeAction(request: ActionInvocationRequest): Promise<ActionInvocationResult>`
- `DataAdapter.manageActivation(request: ActivationManagementRequest): Promise<Activation>`
- `ObserverAdapter` implements the interface but throws a clear “Observer integration not configured” error for network methods in release 1.

- [ ] **Step 1: Write tests for open-ended action arrays, lifecycle status labels, and relationship fields.**
- [ ] **Step 2: Run the focused test and verify it fails because the models do not exist.**
- [ ] **Step 3: Implement models with `JsonSchema`, `CapabilityAction`, `Resource`, `CapabilityPackage`, `Activation`, `Slave`, and `Run`.**
- [ ] **Step 4: Implement adapter signatures and status helpers.**
- [ ] **Step 5: Run the focused test and typecheck.**

### Task 3: Build deterministic fixtures and FixtureAdapter

**Files:**
- Create: `src/data/fixtures/packages.ts`
- Create: `src/data/fixtures/resources.ts`
- Create: `src/data/fixtures/activations.ts`
- Create: `src/data/fixtures/runs.ts`
- Create: `src/data/fixtures/index.ts`
- Create: `src/data/adapters/fixture-adapter.ts`
- Test: `src/test/fixture-adapter.test.ts`

**Interfaces:**
- `createFixtureAdapter(): DataAdapter`
- Fixtures include at least one Kubernetes package, Grafana package, AutoPaper package, VM SSH package, and one unknown custom package.
- Fixtures include ready, pending_auth, degraded, failed, stopped activations and running/completed/awaiting_decision/failed Runs.

- [ ] **Step 1: Write adapter tests for list methods, unknown package actions, simulated request-reply results, task Run creation, and activation state transitions.**
- [ ] **Step 2: Run focused tests and verify they fail.**
- [ ] **Step 3: Add fixtures with realistic action descriptors and JSON Schemas.**
- [ ] **Step 4: Implement in-memory adapter methods with deterministic IDs and short simulated delays.**
- [ ] **Step 5: Run adapter tests, then build.**

### Task 4: Establish the application shell and navigation

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/navigation.ts`
- Create: `src/app/adapter-context.tsx`
- Modify: `src/app/app.css`
- Test: `src/test/app-shell.test.tsx`

**Interfaces:**
- `AdapterProvider` exposes the selected `DataAdapter` to feature components.
- Navigation routes: `/`, `/resources`, `/packages`, `/activations`, `/runs`.

- [ ] **Step 1: Write smoke tests for navigation labels and adapter provider rendering.**
- [ ] **Step 2: Implement the shell, sidebar/topbar, route selection, and responsive narrow layout.**
- [ ] **Step 3: Add design tokens, typography, spacing, status colors, and focus styles.**
- [ ] **Step 4: Run smoke tests and build.**

### Task 5: Implement generic JSON Schema action rendering

**Files:**
- Create: `src/components/SchemaForm.tsx`
- Create: `src/components/JsonViewer.tsx`
- Create: `src/components/ActionPanel.tsx`
- Create: `src/components/StatusBadge.tsx`
- Create: `src/domain/schema-form.ts`
- Test: `src/test/schema-form.test.tsx`

**Interfaces:**
- `SchemaForm({ schema, value, onChange, onSubmit, disabled }): JSX.Element`
- `ActionPanel({ action, onInvoke }): JSX.Element`
- Common JSON Schema types render native controls; unsupported constructs render an editable JSON fallback with a message.

- [ ] **Step 1: Write tests for string, number, boolean, enum, array, required validation, and unsupported-schema fallback.**
- [ ] **Step 2: Run focused tests and verify they fail.**
- [ ] **Step 3: Implement schema traversal and controlled form state.**
- [ ] **Step 4: Implement action metadata, side-effect confirmation, disabled/unavailable states, simulated result, and Run link.**
- [ ] **Step 5: Run focused tests and build.**

### Task 6: Implement package catalog and action contract inspection

**Files:**
- Create: `src/features/packages/PackageListPage.tsx`
- Create: `src/features/packages/PackageDetailPage.tsx`
- Create: `src/features/packages/ActionCatalog.tsx`
- Create: `src/features/packages/ActionContractPanel.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/test/packages-page.test.tsx`

**Interfaces:**
- Package pages render arbitrary action arrays and fall back to generic action panels.

- [ ] **Step 1: Write tests showing a custom fixture action appears without package-specific code.**
- [ ] **Step 2: Implement package list filters and package detail summary.**
- [ ] **Step 3: Add action contract tabs for overview, input schema, output schema, permissions, and side effects.**
- [ ] **Step 4: Wire generic invocation to the adapter and show result/Run status.**
- [ ] **Step 5: Run package tests and build.**

### Task 7: Implement resources and relationship visualization

**Files:**
- Create: `src/features/resources/ResourceListPage.tsx`
- Create: `src/features/resources/ResourceDetailPage.tsx`
- Create: `src/features/resources/ResourceTopology.tsx`
- Create: `src/components/RelationshipList.tsx`
- Test: `src/test/resources-page.test.tsx`

**Interfaces:**
- Resource detail shows public attributes, managed-by/package relationships, status, and available actions.
- Topology is a dependency-light relationship view with list fallback; it must not require a graph library for release 1.

- [ ] **Step 1: Write tests for resource filtering, relationship links, and unknown resource kind fallback.**
- [ ] **Step 2: Implement list/detail views with status filtering and search.**
- [ ] **Step 3: Implement topology using accessible nodes and relationship lines/cards.**
- [ ] **Step 4: Add resource action panels and relationship navigation.**
- [ ] **Step 5: Run tests and build.**

### Task 8: Implement activation lifecycle management

**Files:**
- Create: `src/features/activations/ActivationListPage.tsx`
- Create: `src/features/activations/ActivationDetailPage.tsx`
- Create: `src/features/activations/ActivationActions.tsx`
- Test: `src/test/activations-page.test.tsx`

**Interfaces:**
- Management actions: start, stop, retry, authenticate (simulated); the adapter owns state transitions.

- [ ] **Step 1: Write tests for lifecycle badges, unavailable actions, and simulated stop/start transition.**
- [ ] **Step 2: Implement lifecycle table and detail timeline.**
- [ ] **Step 3: Add confirmation for destructive stop and clear pending/auth/degraded explanations.**
- [ ] **Step 4: Run tests and build.**

### Task 9: Implement Runs and acceptance evidence

**Files:**
- Create: `src/features/runs/RunListPage.tsx`
- Create: `src/features/runs/RunDetailPage.tsx`
- Create: `src/features/runs/RunTimeline.tsx`
- Create: `src/features/runs/AcceptancePanel.tsx`
- Test: `src/test/runs-page.test.tsx`

**Interfaces:**
- Run detail shows action/package/resource references, status, events, output, evidence, and acceptance decision.

- [ ] **Step 1: Write tests for running, completed, failed, and awaiting_decision states.**
- [ ] **Step 2: Implement list filters and timeline.**
- [ ] **Step 3: Add result/evidence JSON viewer and simulated accept/abandon controls.**
- [ ] **Step 4: Run tests and build.**

### Task 10: Implement overview dashboard and finish integration

**Files:**
- Create: `src/features/overview/OverviewPage.tsx`
- Create: `src/features/overview/MetricCard.tsx`
- Create: `src/features/overview/AttentionQueue.tsx`
- Modify: `src/app/App.tsx`
- Modify: `README.md`
- Test: `src/test/overview-page.test.tsx`

**Interfaces:**
- Overview aggregates adapter data without duplicating fixture-specific assumptions.

- [ ] **Step 1: Write tests for counts, readiness summary, active Runs, and attention items.**
- [ ] **Step 2: Implement overview cards and topology preview.**
- [ ] **Step 3: Add links from attention items to the relevant resource, activation, package, or Run.**
- [ ] **Step 4: Document local development, fixture mode, adapter boundary, and future Observer integration.**
- [ ] **Step 5: Run full test suite, typecheck, and production build.**

## Verification checklist

- `npm test -- --run` passes with no failures.
- `npm run build` exits successfully.
- The UI renders an unknown custom package and its actions without package-specific components.
- A Schema-driven action form validates required fields and shows a simulated result.
- Activation management visibly transitions state and preserves lifecycle semantics.
- Run detail distinguishes execution status from acceptance status.
- No frontend source imports backend Python modules or private provider endpoints.
