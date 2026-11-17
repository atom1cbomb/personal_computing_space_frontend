# Personal Computing Space Console Design

## Goal

Build an independent frontend console that makes a Personal Computing Space legible and manageable: users can browse heterogeneous resources, capability packages, activations, Slaves, and Runs; inspect developer-defined actions; and simulate safe management and action execution before a real Observer API is connected.

## Product boundary

The frontend is fully separate from the backend repository. It must not import backend code, read backend databases, or depend on private provider endpoints. The only future integration boundary is a public HTTP/JSON contract implemented by `ObserverAdapter`.

The first release uses `FixtureAdapter` and local state. It must present realistic states, including ready, pending authentication, degraded, failed, stopped, and running. Management actions are simulated and visibly update state; they do not perform real external side effects.

## Core concepts

- **Resource:** a concrete computing or service object, such as a VM, Kubernetes cluster, document service, model, or Grafana instance.
- **Capability package:** an immutable package that declares one or more developer-defined actions and their contracts.
- **Activation:** a named running instance of a package on a Slave, with readiness and authentication state.
- **Slave:** an execution node that can host activations.
- **Run:** a durable execution record with status, events, result, and verification/acceptance state.
- **Action:** a package or resource operation. Actions are open-ended and must not be represented as a fixed frontend menu.

## Action extensibility

Every action is represented by metadata plus JSON Schema input/output contracts. The generic action surface supports all actions whose interaction is `task` or `request-reply`:

- render a readable action description;
- show permissions, side effects, interaction mode, and availability;
- generate a form from JSON Schema for common JSON types;
- validate required fields and primitive formats;
- simulate invocation and show direct results or a Run timeline.

`byte-stream` actions are visible and explain that a specialized stream surface is required. The first release does not implement a terminal or arbitrary stream client.

Known resource/package types may register optional renderers for richer views (GPU charts, papers, documents, SSH, Kubernetes), but every unknown action and package falls back to the generic surface.

## Information architecture

1. **Overview:** readiness summary, resource counts, active Runs, attention items, and a visual resource topology.
2. **Resources:** filterable list and detail pages for concrete resources, including relationships and available actions.
3. **Capability packages:** package catalog with versions, action counts, action contract inspection, and activations.
4. **Activations:** lifecycle table and detail view for readiness, authentication, host Slave, configuration summary, and management actions.
5. **Runs:** status list, timeline, inputs/outputs, evidence, and simulated acceptance decisions.

The visual language should feel like a personal operations workspace: information-dense enough for infrastructure, but organized around the user's resources and work rather than an enterprise admin hierarchy.

## Architecture

```text
React UI
  -> domain-facing data interface
  -> FixtureAdapter (release 1) / ObserverAdapter (future)
  -> local fixtures / public Observer HTTP API
```

The UI consumes only domain models and adapter methods. Adapter implementations translate transport data into those models and normalize errors, loading state, pagination, and action results.

## Initial technical decisions

- TypeScript, React, and Vite.
- A small explicit domain model; unknown backend fields may be retained as `metadata` but are not required by UI components.
- JSON Schema is the contract for generic action forms.
- Local fixture data is deterministic and includes representative heterogeneous packages and lifecycle states.
- CSS should establish a coherent design system before adding optional component libraries.
- Tests cover model normalization, schema form generation, adapter behavior, and key UI states.

## Risks and limits

- Observer's exact public endpoint shapes may evolve; `ObserverAdapter` must remain isolated and versioned.
- JSON Schema supports more constructs than the first form renderer; unsupported constructs must fall back to a JSON editor with an explicit explanation.
- A topology graph can become noisy; the first release limits the default graph to high-value relationships and provides list/detail fallbacks.
- Generic execution is a simulation until authentication, action bindings, idempotency, revision checks, and Run polling are connected to Observer.
