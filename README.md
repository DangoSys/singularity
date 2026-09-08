# @dangosys/dsh-singularity

Singularity graph runtime workspace for DeepSeek Harness.

| Package | Role |
|---|---|
| `@dangosys/dsh-singularity` | meta-bundle (`dsh.bundle`) |
| `@dangosys/dsh-singularity-core` | runtime + web client |

Install into a profile:

```sh
pnpm dsh plugin --profile web add @dangosys/dsh-singularity@0.1.0
```

Local checkout:

```sh
pnpm dsh plugin --profile web add /absolute/path/to/packages/singularity/bundle
```

## Develop

```sh
pnpm install
pnpm build
```

## Publish

```sh
pnpm install && pnpm build
pnpm --filter @dangosys/dsh-singularity-core publish --access public
pnpm --filter @dangosys/dsh-singularity publish --access public
```
