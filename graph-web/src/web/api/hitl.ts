import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { HITL_PATH } from '../../constants.ts'
import { readJson, send } from '../libs/http.ts'

type HitlAnswer =
  | { readonly kind: 'ask'; readonly text: string }
  | { readonly kind: 'approve'; readonly decision: 'approve' | 'reject' }

export function registerHitl(ctx: Context): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: HITL_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET') {
        send(res, 200, 'application/json; charset=utf-8', { pending: ctx.hitl.list() })
        return
      }
      if (req.method === 'POST') {
        const body = await readJson<{ id: string; answer: HitlAnswer }>(req)
        if (typeof body.id !== 'string' || body.id.length === 0) throw new Error('hitl: missing id')
        if (body.answer === undefined) throw new Error('hitl: missing answer')
        ctx.hitl.answer(body.id, body.answer)
        send(res, 200, 'application/json; charset=utf-8', { ok: true, pending: ctx.hitl.list() })
        return
      }
      send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
    },
  })
}
