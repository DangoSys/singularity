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
| `@dangosys/dsh-singularity-graph` | mid-layer agent topology store |
| `@dangosys/dsh-singularity-graph-web` | `/singular/*` HTTP + SSE |
| `@dangosys/dsh-singularity-agent-runtime` | root / spawn / group / relay |
| `@dangosys/dsh-singularity-canvas-view` | conversation.view canvas shell |
| `@dangosys/dsh-singularity-canvas-node` | node renderer |
| `@dangosys/dsh-singularity-canvas-edge` | edge renderer |
| `@dangosys/dsh-singularity-canvas-sticky` | sticky notes |
| `@dangosys/dsh-singularity-canvas-report` | report overlay |
| `@dangosys/dsh-singularity-canvas-chat` | chat surface |
| `@dangosys/dsh-singularity-canvas-human` | human-in-the-loop UI |
| `@dangosys/dsh-singularity-canvas-bubble` | notice bubbles |

## Develop (as ruyi submodule)

`devDependencies` link `@deepseek-ai/*` into `ruyi/thirdparty/deepseek-harness`. From this directory:

```sh
pnpm install
pnpm build
```
