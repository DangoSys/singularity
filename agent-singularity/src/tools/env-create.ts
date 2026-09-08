import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { DEFAULT_ROOT } from '@dangosys/dsh-singularity-layout'

const text = (value: string) => [{ type: 'text' as const, text: value }]

export function defineEnvCreateTool(ctx: Context) {
  return defineTool({
    name: 'env_create',
    description: 'Create an environment and promote the current singularity agent to the canvas root. Humans must not call env-builder create directly.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => text(v) },
    execute: async (_args, exec) => {
      if (exec.agent === undefined) throw new Error('env_create: requires an agent initiator')
      const agent = exec.agent
      const env = ctx.envBuilder.store.create()
      await ctx.agentRuntime.promoteRoot(agent)
      await ctx.layout.set(agent.id, DEFAULT_ROOT)
      ctx.envBuilder.store.attachSession(env.id, agent.id)
      ctx.envBuilder.store.select(env.id)
      return JSON.stringify({ env, sessionId: agent.id })
    },
  })
}
