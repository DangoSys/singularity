import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { LAYOUT_PATH } from '../../constants.ts'
import { send } from '../libs/http.ts'

export function registerLayout(ctx: Context): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: LAYOUT_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      send(res, 200, 'application/json; charset=utf-8', await ctx.layout.snapshot())
    },
  })
}
