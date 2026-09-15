import { Context } from '@deepseek-ai/cordis'
import { ClientSessions } from '../../../../thirdparty/deepseek-harness/packages/api/session-controller/src/client/sessions/service.ts'
import {
  FakeApiClient,
  ok,
} from '../../../../thirdparty/deepseek-harness/packages/api/session-controller/tests/fake-api.client.ts'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type {
  SessionPromptRequest,
  SessionHistoryRecord,
} from '../../../../thirdparty/deepseek-harness/packages/api/session-controller/src/types.ts'
import shell from '../../canvas-view/src/frontend/client.js?raw'

const ctx = new Context()
const api = new FakeApiClient()
const records = new Map<string, SessionHistoryRecord[]>()
api.onList = async () => ok(await (await fetch('/__fixture/sessions')).json())
api.onHistory = async ({ sessionId }) => ok({ records: records.get(sessionId) ?? [], hasMore: false })
api.onPrompt = async value => {
  const request = value as SessionPromptRequest
  const content = request.content.map(part => {
    if (part.type !== 'text') throw new Error('fixture accepts text submissions only')
    return { type: 'text' as const, text: part.text }
  })
  const text = content.map(part => part.text).join('')
  if (text === 'reject')
    return { ok: false, error: new RemoteError('gateway/internal', 'Fixture rejected submission', {}) }
  const rows = records.get(request.sessionId) ?? []
  const event = {
    type: 'user/message',
    seq: rows.length,
    time: Date.now(),
    surfaceOp: 'append' as const,
    data: { id: crypto.randomUUID(), role: 'user', content, source: { kind: 'user', rpcId: request.requestId } },
  }
  rows.push({ type: 'event', event })
  records.set(request.sessionId, rows)
  await api.pushFollow(request.sessionId, { type: 'event', event })
  return ok({ accepted: true })
}
const sessions = new ClientSessions(ctx, api.sessionRemotes())
let plugin: { apply: (ctx: Context) => void }
Object.assign(window, {
  __ModuleLoader__: {
    load: ({ factory }: { factory: () => typeof plugin }) => {
      plugin = factory()
    },
  },
  fixture: {
    api,
    sessions,
    ctx,
    failHistory: () => {
      api.onHistory = async () => ({
        ok: false,
        error: new RemoteError('gateway/internal', 'Fixture history unavailable', {}),
      })
    },
  },
})
Function(shell)()
plugin!.apply(ctx)
