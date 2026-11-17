# Console Resource Display Remediation Plan

## Goal

Make the independent console show the same business resources that Loom exposes, with correct names, lifecycle states, package identities, and a repeatable deployment on the workspace VM.

## Findings

- `list-resources` returns the complete GRIP directory, including internal MCUE, schema, action, content, plan, and run entries.
- The UI treated every directory entry as a business resource.
- VM resources expose `state: running` and `metadata.attributes.display_name`; the adapter only recognized `ready` and `metadata.name`.
- The capability package REST payload uses `package_id`, `package_version`, and `action_exports`; it does not always include a prebuilt `resource` URI.
- AppleDouble files (`._*`) were copied into the source tree and were being collected by Vitest.
- The project used `latest` frontend dependencies, which installed releases requiring a newer Node version than the workspace VM provides.

## Implementation

1. Filter internal GRIP directory kinds before describing resources.
2. Normalize running/active/available states to `ready`; prefer public `display_name`.
3. Construct stable package URIs and derive action labels from descriptor references.
4. Remove AppleDouble artifacts and pin the toolchain to Node 18 compatible releases.
5. Point the workspace VM proxy at the Observer public address and bind Vite to the VM interface.
6. Run unit tests, production build, a real Observer read smoke test, then deploy and verify HTTP.

## Acceptance

- Resource view excludes GRIP implementation records.
- `loom-workspace` appears once as a ready `computing/vm` resource.
- Package and activation counts come from Observer without fixture fallback.
- Tests and build pass on the workspace VM.
- The deployed console proxy reaches Observer.
