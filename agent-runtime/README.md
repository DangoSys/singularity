# dsh-singularity-agent-runtime

[中文](README.zh.md) | English

Purpose: Own Singularity root / spawn agents on the graph and sync status to the canvas.

Package: `@dangosys/dsh-singularity-agent-runtime`

### Service

1. `ctx.agentRuntime`: `createRoot` / `ensureRoot` / `spawn` / `stopGraph` / `stopAgents` / `prompt`; creation is serialized per graph, and graph stop drains admitted creation before releasing agents.
2. `ctx.sessionVisibility`: hide spawned (non-root) runtime-owned sessions
