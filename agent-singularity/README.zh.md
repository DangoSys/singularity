# dsh-singularity-agent

[English](README.md) | 中文

功能：Singularity 主 agent 额外能力 — `env_create`，编排 env-builder + agentRuntime + layout。

包名：`@dangosys/dsh-singularity-agent`

依赖：env-builder, agent-runtime, layout, tools

依赖的config.yaml配置：无

### 可调用Tools

1. env_create：建环境、promote 当前 agent 为 graph root、写 layout、挂 session。

仓库安装由 agent 用 bash（clone + 按仓库文档 build）完成，再调用 `env_register_component`。

### 注册的 Web API：

无

### 维护的 Service 状态

1. ctx.singularityAgent：注册上述 tools
