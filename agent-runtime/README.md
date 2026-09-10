# dsh-singularity-agent-runtime

[中文](README.zh.md) | English

Purpose: Own Singularity root / spawn agents on the graph and sync status to the canvas.

Package: `@dangosys/dsh-singularity-agent-runtime`

### Service

1. `ctx.agentRuntime`: `createRoot` / `ensureRoot` / `spawn` / `stopAgents` / `prompt`
2. `ctx.sessionVisibility`: hide spawned (non-root) runtime-owned sessions
