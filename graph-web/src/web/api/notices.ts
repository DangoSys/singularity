import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { NOTICES_PATH } from '../../constants.ts'
import type { GraphBroadcast } from '../libs/broadcast.ts'
import { send } from '../libs/http.ts'

export function registerNotices(ctx: Context, broadcast: GraphBroadcast): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: NOTICES_PATH,
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
      broadcast.notices.add(res)
      req.on('close', () => broadcast.notices.delete(res))
    },
  })
}
