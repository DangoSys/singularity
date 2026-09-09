import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'

const text = (value: string) => [{ type: 'text' as const, text: value }]

export function defineEnvCreateTool(ctx: Context) {
  return defineTool({
    name: 'env_create',
    description: 'Deprecated. Create a Singularity graph from the Singularity UI (New graph).',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => text(v) },
    execute: async () => {
      void ctx
      throw new Error('env_create is retired: open Singularity → New graph to create a graph bound to a clean environment')
    },
  })
}
