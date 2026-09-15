# dsh-singularity-agent

[中文](README.zh.md) | English

Purpose: Singularity graph worker delegation, readiness and cancellable human-in-the-loop tools.

Package: `@dangosys/dsh-singularity-agent`

Dependencies: graphs, tools

config.yaml: none

### Tools

1. graph_spawn: create a worker node through Singularity runtime and wait for its response.
2. graph_mark_ready: mark the calling agent's graph ready.
3. hitl_ask: wait for a human text answer; cancel with the tool execution.
4. hitl_approve: wait for an explicit approve/reject decision; cancel with the tool execution.

Graphs are created from New graph. Repository installs are done by the agent with bash (clone + build per repo docs), then `env_register_component`.

### Web APIs

none

### Service state

1. ctx.singularityAgent: tool registration host; root agents only receive delegation/readiness/HITL tools
2. ctx.hitl: pending human requests, removed on answer, cancellation or service disposal
