import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

const text = (value: string) => [{ type: 'text' as const, text: value }]

function sessionId(exec: ToolRunContext): string {
  const id = exec.agent?.id
  if (typeof id !== 'string' || id.length === 0) throw new Error('hitl_approve: missing agent id')
  return id
}

export function defineApproveTool(ctx: Context) {
  return defineTool({
    name: 'hitl_approve',
    description: 'Request human approve/reject and wait. Use before irreversible or sensitive actions.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Approval request shown to the human' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => text(v) },
    execute: async (args, exec) => {
      return await ctx.hitl.approve(sessionId(exec), args.prompt)
    },
  })
}
