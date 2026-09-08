# dsh-singularity-agent

[中文](README.zh.md) | English

Purpose: Singularity root agent extras — `env_create` tool for environment orchestration.

Package: `@dangosys/dsh-singularity-agent`

Dependencies: env-builder, agent-runtime, layout, tools

config.yaml: none

### Tools

1. env_create: create environment, promote current agent to graph root, layout at DEFAULT_ROOT, attach session.

Repository installs are done by the agent with bash (clone + build per repo docs), then `env_register_component`.

### Web APIs

none

### Service state

1. ctx.singularityAgent: tool registration host
