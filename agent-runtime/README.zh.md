# dsh-singularity-agent-runtime

[English](README.md) | 中文

功能：在 graph 上管理 Singularity root / spawn，并把 agent 状态同步到画布。

### Service

1. `ctx.agentRuntime`：`createRoot` / `ensureRoot` / `spawn` / `stopGraph` / `stopAgents` / `prompt`；所有 root 和 worker 使用 `danger-full-access` 权限预设，同图创建串行执行，停止图时先等待已接纳的创建完成，再释放 Agent。
2. `ctx.sessionVisibility`：隐藏非 root 的 runtime 子 session
