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
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      broadcast.clients.add(res)
      req.on('close', () => broadcast.clients.delete(res))
      res.write(`event: graph\ndata: ${JSON.stringify(await ctx.graph.snapshot())}\n\n`)
    },
  })
}
