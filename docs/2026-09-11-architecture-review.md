# Singularity architecture review

Reviewed on 2026-09-11 against the current working tree, including the uncommitted fixes from this conversation. This is a code-level review and proposed contract, not a claim of browser end-to-end verification.

## Confirmed intent

- Switching graphs must leave other graphs' agents running in the background.
- Retain the repository's Cordis service/plugin organization.
- Reuse useful ThoughtDAG interactions and algorithms where their semantics match Singularity.

## Current system

`graphs` binds a registry record to an environment, a root session, a topology store and a layout store. `agent-runtime` creates/resumes agents and records topology. `graph` and `layout` persist separate event streams and retain an active-store pointer for unscoped callers. `graph-web` exposes snapshots, mutations and SSE. `canvas-view` owns the host overlay, graph list and session bridge; the iframe `map` owns React Flow, node selection, chat presentation and HITL answers.

There are currently multiple independent selections: registry selected graph, topology active store, layout active store, selected environment, host selected session and iframe selected session. A graph selection performs side effects across all of them without a single commit boundary.

## Findings

| Priority | Trigger and consequence | Source |
| --- | --- | --- |
| P1 | Host sends reload followed immediately by a new root selection. `setSelectedLocal` accepts that session while the iframe still has the previous graph. `FocusPanel` throws when that agent is absent; no render error boundary contains it. Boot generation does not guard these messages. | `canvas-view/src/frontend/client.js:155`, `map/src/store.ts:234`, `map/src/components/FocusPanel.tsx` |
| P1 | Background graph A calls `graph_mark_ready` while B is selected: the tool has no caller-to-graph resolution and marks B ready. | `agent-singularity/src/tools/mark-ready.ts` |
| P1 | A delayed layout PUT from A can write into active B. Request carries a session ID but no graph ID, and the route does not check graph membership. | `graph-web/src/web/api/layout.ts` |
| P1 | `select` commits registry selection before activation succeeds. `create` and `remove` do not join the same transition queue. Errors and concurrency can leave selection and active stores inconsistent. | `graphs/src/index.ts` |
| P1 | `create` can commit a graph successfully and then fail activation. Its catch block still stops its root and deletes/detaches its environment, leaving a committed record referencing compensated resources. Concurrent creates can allocate the same ID before either commits. Failed attempts can also leave stores whose IDs are absent from the registry/archive. | `graphs/src/index.ts:91` |
| P1 | Graph/layout/registry write queues assign a rejected operation to the queue tail. A validation failure prevents all subsequent operations from running. Graph duplicate status explicitly throws, making the failure reachable from status events. | `graph/src/index.ts`, `layout/src/index.ts`, `graphs/src/index.ts`, `graph/src/service/state.ts` |
| P1 | `ensureRoot` returns an `AgentHandle` whose dispose only calls cancel for a borrowed agent. Real handles stop, drain and unregister. It also treats every persisted node as owned. This blurs membership, observation and teardown authority. Concurrent resumes are not coalesced per session. | `agent-runtime/src/index.ts:41` |
| P1 | Delete starts a cleanup agent before stopping the graph's workers. The cleanup prompt requests git reset/clean and removal of scratch data while workers may still write. If spawn fails, the cleanup waiter and timer are not disposed. | `graphs/src/index.ts:153`, `../env-builder/src/prompts/3-clean.prompts.ts` |
| P2 | New graph is `ready:false`; free chat is disabled. `createRoot` sends no initial task. No consumer of `graphs/selected` starts setup in the searched workspace. The automatic setup path is incomplete unless supplied by an external preset. | `graphs/src/index.ts`, `agent-runtime/src/index.ts`, `map/src/components/FocusPanel.tsx` |
| P2 | Every root and spawned child receives DEFAULT_ROOT (80,80). Children overlap. Controlled React Flow nodes/edges have no onNodesChange/onEdgesChange handlers, while drag and box-selection affordances are enabled. | `agent-runtime/src/index.ts`, `map/src/App.tsx` |
| P2 | Graph/layout snapshots arrive independently with no shared graph identity/revision envelope. `complete()` only checks node coverage, and `rebuild()` empties all nodes if one layout is missing. It also reopens root selection after the user clears it. `boot` posts the pre-rebuild selected ID back to the host. | `map/src/store.ts` |
| P2 | `bindChat` awaits refresh without a generation guard; an older bind can install subscribers and send selection after a newer one. Host UI/listeners have no plugin-disposal cleanup. Prompt submission clears drafts before acknowledgement; failures are not reliably rendered. | `canvas-view/src/frontend/client.js`, `map/src/components/FocusPanel.tsx` |
| P2 | HITL waiters are memory-only and have no abort/disposal path. HTTP answer validation relies on TypeScript casts; approve decisions are not runtime-validated in the service. | `agent-singularity/src/hitl.ts`, `graph-web/src/web/api/hitl.ts` |

## Validation limits

The existing 17 tests cover state reducers, route registration/basic responses, workspace shape and one scoped topology update. They do not cover the host/iframe bridge, real agent-handle lifecycle, rapid graph switching, setup, deletion failure, persistence recovery or browser rendering.

`pnpm -C packages/singularity/map exec tsc --noEmit` fails with 10 diagnostics: AgentData does not satisfy React Flow's Record constraint, edge data can be undefined, Position enum values are provided as string literals, and an import is unused. Vite's current build script does not run type checking.

Earlier API 200 checks did not establish that the UI stayed mounted. The claim that blank canvas was definitively caused by panel occlusion was not backed by a successful browser observation and should be treated as a hypothesis. The earlier placeholder-key service restart also means model authentication must be checked before any live setup validation; an HTTP health check is insufficient. Do not restart the user's service to perform this review.

## Proposed target contract

1. **Identity:** graph ID is immutable and independent of display name. Bind graph/environment/session ownership durably. Distinguish a session's membership in a graph from ownership of its live AgentHandle.
2. **Runtime:** explicit graph-scoped commands; no background operation resolves its target through UI selection. One in-flight resume per session. Owned handles and borrowed references have different types and lifecycle operations.
3. **Selection:** opening graph B is a client subscription change. It does not stop A, start setup again, or implicitly redirect environment operations. A server default selection may be retained as a preference, not as routing authority.
4. **Protocol:** use graph-addressed endpoints for snapshot, events, layout and commands. A snapshot carries graph metadata, topology, layout and revision together. Events carry graphId/revision; reconnect resynchronizes gaps. Publish node creation with initial geometry as a complete projection.
5. **Bridge:** one explicit openGraph handshake with graphId and requestId. Only after that graph is installed may a matching session selection/transcript apply. Session commands return acknowledgement/error; subscriptions are disposed on replacement and plugin unload.
6. **State machine:** separate graph provisioning/setup/ready/failed/archived state from agent idle/running/waiting status. Setup start must be explicit and retryable. User selection must not drive execution.
7. **Persistence:** serialize mutations within each graph; keep queues usable after rejected validation, and mark storage faults explicitly. Drain writes before closing handles. Record provisioning progress and compensate only before the durable success boundary.
8. **Presentation:** transient graph mismatch produces a bounded loading state, not an exception or loss of the whole canvas. Keep selected sessions valid, wait for measured nodes before fitting, preserve per-graph viewports, and reserve space for panels.

Keep the current package split initially. `graphs` owns lifecycle coordination; `graph` owns topology; `layout` owns geometry; `agent-runtime` owns live execution; `graph-web` adapts the domain protocol; `canvas-view` owns the host bridge; `map` owns presentation. Do not add another parallel service layer before these responsibilities are explicit.

## Decisions requested

- New graph: automatic environment setup, immediate free chat, or a required initial goal?
- Edges: runtime provenance/coordination, executable context wiring, or two explicitly distinct edge families? Current ancestor highlighting does not mean context is actually passed that way.
- Delete: archive/stop with environment retained, or destructive environment cleanup as part of deletion?
- Is environment binding permanently one-to-one? Can an existing conversation be attached to a graph? Is one session allowed in multiple graphs?
- After process restart, restore visibility only, resume idle agents, or automatically continue interrupted work? How should pending human decisions recover?

## Implementation and acceptance order

1. Fix ownership and explicit routing; regression: A runs/spawns/marks-ready while viewing B, all effects stay in A. Reject wrong-graph layout mutations.
2. Replace fragmented switching with a coherent graph snapshot/subscription and bridge handshake; regression: repeatedly switch A/B/C, deliver old replies last, preserve the last selection and mounted FocusPanel. Test two independent clients.
3. Implement the agreed setup/archive state machine and failure recovery; inject errors before and after registry commit. Verify no record points to a deleted environment and no workers write during cleanup.
4. Repair controlled canvas interactions, selection and error handling; real browser test for repeated switches, dragging, node click, chat acknowledgement and HITL submission.
5. Migrate contaminated legacy stores by creating new stores and repointing records after validation, retaining old streams for rollback. Do not delete historical events blindly.
6. Gate delivery on TypeScript plus scenario tests. Rebuild generated lib/dist only after source checks, and explicitly distinguish built code from code loaded in the running server.
