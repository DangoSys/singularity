# dsh-singularity-graph-web

[中文](README.zh.md) | English

HTTP and SSE for Singularity: graph, layout, graphs registry, HITL, map static, events.

### Routes

- `GET/POST /singularity/graphs`
- `POST /singularity/graphs/:id/{select,ready,delete}`
- `GET /singularity/graph-envs`, `POST /singularity/repo-check`
- `GET /singularity/graph`, `GET/PUT /singularity/layout`
- `GET /singularity/events` (SSE), `GET/POST /singularity/hitl`
- `GET /singularity/map/` (static SPA)
