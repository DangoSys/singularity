# dsh-singularity-agent

[English](README.md) | 中文

功能：Singularity 图内 worker 派发、就绪标记与可取消的人工交互工具。

包名：`@dangosys/dsh-singularity-agent`

依赖：graphs, tools

依赖的config.yaml配置：无

### 可调用Tools

1. graph_spawn：通过 Singularity runtime 创建 worker 节点并等待其回复。
2. graph_mark_ready：将调用 agent 所属的图标记为就绪。
3. hitl_ask：等待人工文本回答，随工具执行取消。
4. hitl_approve：等待明确的 approve/reject 决定，随工具执行取消。

通过 New graph 创建图。仓库安装由 agent 用 bash（clone + 按仓库文档 build）完成，再调用 `env_register_component`。

### 注册的 Web API：

无

### 维护的 Service 状态

1. ctx.singularityAgent：注册上述 tools；root agent 只保留派发、就绪和 HITL 工具
2. ctx.hitl：待处理的人工请求，回答、取消或服务卸载后移除
