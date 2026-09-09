# @dangosys/dsh-singularity

Singularity graph runtime workspace for DeepSeek Harness.

Install into a profile:

```sh
pnpm dsh plugin --profile web add @dangosys/dsh-singularity@0.1.0
```

Local checkout:

```sh
pnpm dsh plugin --profile web add /absolute/path/to/packages/singularity/bundle
```

## Packages

| Package | Role |
|---|---|
| `@dangosys/dsh-singularity` | meta-bundle (`dsh.bundle`) |
| `@dangosys/dsh-singularity-graph` | per-graph agent topology store |
| `@dangosys/dsh-singularity-graphs` | graph registry + env binding |
| `@dangosys/dsh-singularity-layout` | per-graph session geometry |
| `@dangosys/dsh-singularity-agent-runtime` | root / spawn / group / relay |
| `@dangosys/dsh-singularity-agent` | root tools: mark_ready / HITL |
| `@dangosys/dsh-singularity-graph-web` | `/singularity/*` HTTP + SSE + map static |
| `@dangosys/dsh-singularity-map` | xyflow map SPA + FocusPanel |
| `@dangosys/dsh-singularity-canvas-view` | 对话 \| Singularity shell |

## Develop (as ruyi submodule)

`devDependencies` link `@deepseek-ai/*` into `ruyi/thirdparty/deepseek-harness`. From this directory:

```sh
pnpm install
pnpm build
```
