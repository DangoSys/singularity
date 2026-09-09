import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

const text = (value: string) => [{ type: 'text' as const, text: value }]

function sessionId(exec: ToolRunContext): string {
  const id = exec.agent?.id
  if (typeof id !== 'string' || id.length === 0) throw new Error('hitl_ask: missing agent id')
  return id
}

export function defineAskTool(ctx: Context) {
  return defineTool({
    name: 'hitl_ask',
    description: 'Ask the human a text question and wait for the answer. Use for environment setup or decisions that need human input.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Question shown to the human' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => text(v) },
    execute: async (args, exec) => {
      return await ctx.hitl.ask(sessionId(exec), args.prompt)
    },
  })
}
