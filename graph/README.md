# dsh-singularity-graph

[中文](README.zh.md) | English

Purpose: Persist the agent topology (agents / groups / edges) and expose the graph service to canvas and runtime.

Package: `@dangosys/dsh-singularity-graph`

Dependencies: sessionPersistence

config.yaml: optional `storeId` (default graph-state)

### Tools

none

### Web APIs

none

### Service state

1. ctx.graph: snapshot / addAgent / setStatus / addGroup / addMember / addEdge / commit

2. event `graph/change`: emit GraphSnapshot after commit
