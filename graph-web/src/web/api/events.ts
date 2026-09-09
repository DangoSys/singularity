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
      try {
        res.write(`event: graph\ndata: ${JSON.stringify(await ctx.graph.snapshot())}\n\n`)
        res.write(`event: layout\ndata: ${JSON.stringify(await ctx.layout.snapshot())}\n\n`)
      } catch (error) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`)
      }
      try {
        res.write(`event: graphs\ndata: ${JSON.stringify(await ctx.graphs.snapshot())}\n\n`)
      } catch (error) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`)
      }
      try {
        res.write(`event: hitl\ndata: ${JSON.stringify({ pending: ctx.hitl.list() })}\n\n`)
      } catch (error) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`)
      }
    },
  })
}
