import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'

export function defineSpawnTool(ctx: Context) {
  return defineTool({
    name: 'graph_spawn',
    description: 'Delegate one task to a new Singularity worker node and wait for its final response.',
    parameters: {
      name: { type: 'string', required: true, description: 'Short worker name shown on the graph' },
      task: { type: 'string', required: true, description: 'Complete task for the worker' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute: async (args, exec) => {
      const handle = await ctx.agentRuntime.spawn(exec.agent!, {
        sessionId: SessionId(randomUUID()),
        name: args.name,
        prompt: [{ type: 'text', text: args.task }],
        signal: exec.signal,
      })
      const cancel = () => handle.agent.cancel({ kind: 'parent' })
      exec.signal.addEventListener('abort', cancel, { once: true })
      try {
        await handle.agent.whenIdle()
        exec.signal.throwIfAborted()
      } finally {
        exec.signal.removeEventListener('abort', cancel)
      }
      const event = [...handle.agent.session.snapshotEvents()].reverse().find(item => item.type === 'assistant/message')
      if (event === undefined || event.type !== 'assistant/message') {
        throw new Error(`graph_spawn: worker ${handle.agent.id} produced no response`)
      }
      const result = event.data.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
      if (result.length === 0) throw new Error(`graph_spawn: worker ${handle.agent.id} produced no text response`)
      return `Worker ${handle.agent.id} completed:\n${result}`
    },
  })
}
