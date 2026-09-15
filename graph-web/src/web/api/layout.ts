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
        const id = new URL(req.url!, 'http://dsh.local').searchParams.get('graphId')
        if (id === null) throw new Error('layout: graphId required')
        const graph = await ctx.graphs.get(id)
        if (req.method === 'GET') {
          send(res, 200, 'application/json; charset=utf-8', await ctx.layout.snapshotIn(graph.layoutStoreId))
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
        const topology = await ctx.graph.snapshotIn(graph.graphStoreId)
        if (!topology.agents.some(agent => agent.id === body.sessionId)) throw new Error('layout: session belongs to another graph')
        await ctx.layout.setIn(graph.layoutStoreId, body.sessionId, body.node)
        send(res, 200, 'application/json; charset=utf-8', await ctx.layout.snapshotIn(graph.layoutStoreId))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send(res, message.includes('no graph selected') ? 409 : 400, 'text/plain; charset=utf-8', message)
      }
    },
  })
}
