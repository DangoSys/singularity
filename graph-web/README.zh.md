# dsh-singularity-graph-web

[English](README.md) | 中文

Singularity 的 HTTP/SSE：graph、layout、graphs 注册、HITL、map 静态资源、事件流。

### 路由

- `GET/POST /singularity/graphs`
- `POST /singularity/graphs/:id/{select,ready,delete}`
- `GET /singularity/graph-envs`，`POST /singularity/repo-check`
- `GET /singularity/graph`，`GET/PUT /singularity/layout`
- `GET /singularity/events`（SSE），`GET/POST /singularity/hitl`
- `GET /singularity/map/`（静态 SPA）
