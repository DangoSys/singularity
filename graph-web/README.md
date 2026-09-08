# dsh-singularity-graph-web

[中文](README.zh.md) | English

Purpose: HTTP and SSE surface for Singularity canvas: graph snapshot, events, transcript, and notices.

Package: `@dangosys/dsh-singularity-graph-web`

Dependencies: graph, sessions, webServer

config.yaml: none

### Tools

none

### Web APIs

1. GET `/singular/graph`: GraphSnapshot JSON.

2. GET `/singular/events`: SSE for graph and `pr-chat/path` / `pr-chat/sent` events.

3. GET `/singular/transcript?group=`: group transcript events.

4. GET `/singular/notices`: SSE agent status notices.

### Service state

none
