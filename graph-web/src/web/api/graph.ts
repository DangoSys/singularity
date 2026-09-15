import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { GRAPH_PATH } from '../../constants.ts'
import { send } from '../libs/http.ts'

export function registerGraph(ctx: Context): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: GRAPH_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      try {
        const id = new URL(req.url!, 'http://dsh.local').searchParams.get('graphId')
        if (id === null) throw new Error('graph: graphId required')
        send(res, 200, 'application/json; charset=utf-8', await ctx.graphs.view(id))
      } catch (error) {
        send(res, 409, 'text/plain; charset=utf-8', error instanceof Error ? error.message : String(error))
      }
    },
  })
}
