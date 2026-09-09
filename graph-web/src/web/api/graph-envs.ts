import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { GRAPH_ENVS_PATH, REPO_CHECK_PATH } from '../../constants.ts'
import { readJson, send } from '../libs/http.ts'

export function registerGraphEnvs(ctx: Context): () => void {
  const stopList = ctx.webServer.register({
    kind: 'exact',
    path: GRAPH_ENVS_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      const bound = new Set((await ctx.graphs.list()).map(g => g.envId))
      const envs = ctx.envBuilder.store.list().map(env => ({
        id: env.id,
        path: env.path,
        componentCount: env.components.length,
        sessionCount: env.sessionIds.length,
        available: !bound.has(env.id) && env.sessionIds.length === 0,
        bound: bound.has(env.id),
      }))
      send(res, 200, 'application/json; charset=utf-8', { envs })
    },
  })

  const stopCheck = ctx.webServer.register({
    kind: 'exact',
    path: REPO_CHECK_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      const body = await readJson<{ repo?: string }>(req)
      if (typeof body.repo !== 'string' || body.repo.trim().length === 0) {
        throw new Error('repo-check: missing repo')
      }
      const parsed = await ctx.envBuilder.assertRepo(body.repo)
      send(res, 200, 'application/json; charset=utf-8', {
        owner: parsed.owner,
        repo: parsed.repo,
        ref: parsed.dir,
      })
    },
  })

  return () => {
    stopList()
    stopCheck()
  }
}
