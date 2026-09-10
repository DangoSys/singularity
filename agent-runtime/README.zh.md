# dsh-singularity-agent-runtime

[English](README.md) | 中文

功能：在 graph 上管理 Singularity root / spawn，并把 agent 状态同步到画布。

### Service

1. `ctx.agentRuntime`：`createRoot` / `ensureRoot` / `spawn` / `stopAgents` / `prompt`
2. `ctx.sessionVisibility`：隐藏非 root 的 runtime 子 session
