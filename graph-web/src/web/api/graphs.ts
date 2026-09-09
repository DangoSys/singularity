import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { CreateGraphRequest } from '@dangosys/dsh-singularity-graphs'
import { GRAPHS_PATH } from '../../constants.ts'
import { readJson, send } from '../libs/http.ts'

function fail(res: ServerResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  send(res, 400, 'text/plain; charset=utf-8', message)
}

export function registerGraphs(ctx: Context): () => void {
  const stopList = ctx.webServer.register({
    kind: 'exact',
    path: GRAPHS_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      try {
        if (req.method === 'GET') {
          send(res, 200, 'application/json; charset=utf-8', await ctx.graphs.snapshot())
          return
        }
        if (req.method === 'POST') {
          const body = await readJson<CreateGraphRequest>(req)
          const graph = await ctx.graphs.create(body)
          send(res, 200, 'application/json; charset=utf-8', graph)
          return
        }
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
      } catch (error) {
        fail(res, error)
      }
    },
  })

  const stopActions = ctx.webServer.register({
    kind: 'prefix',
    path: GRAPHS_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.local')
        const parts = url.pathname.slice(GRAPHS_PATH.length + 1).split('/').filter(Boolean)
        if (parts.length !== 2) throw new Error(`graphs: unknown path ${url.pathname}`)
        const [id, action] = parts
        if (id.length === 0) throw new Error('graphs: missing graph id')

        if (action === 'select') {
          if (req.method !== 'POST') {
            send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
            return
          }
          const graph = await ctx.graphs.select(id)
          send(res, 200, 'application/json; charset=utf-8', graph)
          return
        }

        if (action === 'ready') {
          if (req.method !== 'POST') {
            send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
            return
          }
          const graph = await ctx.graphs.markReady(id)
          send(res, 200, 'application/json; charset=utf-8', graph)
          return
        }

        if (action === 'delete') {
          if (req.method !== 'POST') {
            send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
            return
          }
          await ctx.graphs.remove(id)
          send(res, 200, 'application/json; charset=utf-8', { ok: true })
          return
        }

        throw new Error(`graphs: unknown action ${action}`)
      } catch (error) {
        fail(res, error)
      }
    },
  })

  return () => {
    stopList()
    stopActions()
  }
}
