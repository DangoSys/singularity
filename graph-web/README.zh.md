# dsh-singularity-graph-web

[English](README.md) | 中文

功能：为 Singularity 画布提供 graph 快照、SSE 事件、transcript 与 notice HTTP 接口。

包名：`@dangosys/dsh-singularity-graph-web`

依赖：graph, sessions, webServer

依赖的config.yaml配置：无

### 可调用Tools

无

### 注册的 Web API：

1. GET `/singularity/graph`：返回 GraphSnapshot JSON。
2. GET `/singularity/layout`：返回 LayoutSnapshot JSON。
3. GET `/singularity/events`：SSE，推送 graph、layout 与 `pr-chat/path` / `pr-chat/sent` 事件。
4. GET `/singularity/transcript?group=`：返回 group transcript 事件。
5. GET `/singularity/notices`：SSE，推送 agent 状态 notice。

### 维护的 Service 状态

无
