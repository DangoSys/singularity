# dsh-singularity-agent-runtime

[English](README.md) | 中文

功能：在 graph 之上管理 Singularity root / spawn / group / relay，并同步 agent 状态到画布。

包名：`@dangosys/dsh-singularity-agent-runtime`

依赖：agentDefaultModel, agents, graph, layout, sessions, sessionPersistence

依赖的config.yaml配置：无

### 可调用Tools

无

### 注册的 Web API：

无

### 维护的 Service 状态

1. ctx.agentRuntime：createRoot / promoteRoot / spawn / destroySession / createGroup / addMember / handoff / relay / prompt

2. ctx.sessionVisibility：隐藏非 root 的 runtime 自建 session
