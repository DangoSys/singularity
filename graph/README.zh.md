# dsh-singularity-graph

[English](README.md) | 中文

功能：持久化 Agent 拓扑（agents / groups / edges），并向画布与 runtime 暴露 graph 服务。

包名：`@dangosys/dsh-singularity-graph`

依赖：sessionPersistence

依赖的config.yaml配置：可选 `storeId`（默认 graph-state）

### 可调用Tools

无

### 注册的 Web API：

无

### 维护的 Service 状态

1. ctx.graph：snapshot / addAgent / setStatus / setNode / addGroup / addMember / addEdge / commit

2. 事件 `graph/change`：提交后广播 GraphSnapshot
