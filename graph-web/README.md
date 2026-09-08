# dsh-singularity-graph-web

[中文](README.zh.md) | English

Purpose: HTTP and SSE surface for Singularity canvas: graph snapshot, events, transcript, and notices.

Package: `@dangosys/dsh-singularity-graph-web`

Dependencies: graph, sessions, webServer

config.yaml: none

### Tools

none

### Web APIs

1. GET `/singularity/graph`: GraphSnapshot JSON.
2. GET `/singularity/layout`: LayoutSnapshot JSON.
3. GET `/singularity/events`: SSE for graph, layout, and `pr-chat/path` / `pr-chat/sent` events.
4. GET `/singularity/transcript?group=`: group transcript events.
5. GET `/singularity/notices`: SSE agent status notices.

### Service state

none
