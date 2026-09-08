# dsh-singularity-agent-runtime

[中文](README.zh.md) | English

Purpose: Manage Singularity root / spawn / group / relay on top of the graph, and sync agent status to the canvas.

Package: `@dangosys/dsh-singularity-agent-runtime`

Dependencies: agentDefaultModel, agents, graph, layout, sessions, sessionPersistence

config.yaml: none

### Tools

none

### Web APIs

none

### Service state

1. ctx.agentRuntime: createRoot / promoteRoot / spawn / destroySession / createGroup / addMember / handoff / relay / prompt

2. ctx.sessionVisibility: hide spawned (non-root) runtime-owned sessions
