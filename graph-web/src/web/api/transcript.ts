import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { TRANSCRIPT_PATH } from '../../constants.ts'
import { send } from '../libs/http.ts'

export function registerTranscript(ctx: Context): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: TRANSCRIPT_PATH,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      try {
        const groupId = new URL(req.url!, 'http://local').searchParams.get('group')
        if (groupId === null || groupId.length === 0) throw new Error('web: transcript requires group')
        const snapshot = await ctx.graph.snapshot()
        const group = snapshot.groups.find(item => item.id === groupId)
        if (group === undefined) throw new Error(`web: group "${groupId}" is not in graph`)
        const session = ctx.sessions.get(group.transcriptId)
        if (session === undefined) throw new Error(`web: transcript "${group.transcriptId}" is not live`)
        send(res, 200, 'application/json; charset=utf-8', {
          groupId,
          transcriptId: group.transcriptId,
          events: session.snapshotEvents(),
        })
      } catch (error) {
        send(res, 400, 'text/plain; charset=utf-8', error instanceof Error ? error.message : String(error))
      }
    },
  })
}
