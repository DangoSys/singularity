import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { CanvasNode } from '@dangosys/dsh-singularity-layout'
import { LAYOUT_PATH } from '../../constants.ts'
import { readJson, send } from '../libs/http.ts'

interface LayoutPutBody {
  readonly sessionId: SessionId
  readonly node: CanvasNode
}

export function registerLayout(ctx: Context): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: LAYOUT_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      try {
        if (req.method === 'GET') {
          send(res, 200, 'application/json; charset=utf-8', await ctx.layout.snapshot())
          return
        }
        if (req.method !== 'PUT') {
          send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
          return
        }
        const body = await readJson<LayoutPutBody>(req)
        if (typeof body.sessionId !== 'string' || body.sessionId.length === 0) {
          throw new Error('layout put: sessionId required')
        }
        if (body.node === undefined || typeof body.node !== 'object') {
          throw new Error('layout put: node required')
        }
        await ctx.layout.set(body.sessionId, body.node)
        send(res, 200, 'application/json; charset=utf-8', await ctx.layout.snapshot())
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send(res, message.includes('no graph selected') ? 409 : 400, 'text/plain; charset=utf-8', message)
      }
    },
  })
}
