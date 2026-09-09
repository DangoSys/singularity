import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'

const text = (value: string) => [{ type: 'text' as const, text: value }]

export function defineMarkReadyTool(ctx: Context) {
  return defineTool({
    name: 'graph_mark_ready',
    description: 'Mark the current Singularity graph ready after environment setup is complete. Required before free-form human chat.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => text(v) },
    execute: async () => {
      const graph = await ctx.graphs.markReady()
      return `graph ${graph.id} ready`
    },
  })
}
