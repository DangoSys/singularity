# dsh-singularity-layout

[English](README.md) | 中文

功能：持久化 sessionId → CanvasNode 几何，暴露 `ctx.layout`。

包名：`@dangosys/dsh-singularity-layout`

依赖：session, session-persistence

依赖的config.yaml配置：无

### 可调用Tools

无

### 注册的 Web API：

无（由 graph-web 暴露）

### 维护的 Service 状态

1. ctx.layout：snapshot / get / set / remove 画布几何
