import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { EVENTS_PATH } from '../../constants.ts'
import type { GraphBroadcast } from '../libs/broadcast.ts'
import { send } from '../libs/http.ts'

export function registerEvents(ctx: Context, broadcast: GraphBroadcast): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: EVENTS_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      const id = new URL(req.url!, 'http://dsh.local').searchParams.get('graphId')
      if (id === null) throw new Error('events: graphId required')
      const graph = await ctx.graphs.get(id)
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      res.on('close', () => broadcast.clients.delete(res))
      broadcast.subscribe(res, graph)
      res.write(`event: hitl\ndata: ${JSON.stringify({ pending: ctx.hitl.list() })}\n\n`)
    },
  })
}
