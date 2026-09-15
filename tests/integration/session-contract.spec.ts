import { expect, it, vi } from 'vitest'
import { Context } from '../../../../thirdparty/deepseek-harness/vendor/cordis/lib/index.js'
import { RemoteError } from '../../../../thirdparty/deepseek-harness/packages/typert/protocol/lib/index.js'
import { ClientSessions } from '../../../../thirdparty/deepseek-harness/packages/api/session-controller/src/client/sessions/service.ts'
import {
  FakeApiClient,
  ok,
  err,
} from '../../../../thirdparty/deepseek-harness/packages/api/session-controller/tests/fake-api.client.ts'

vi.mock(
  '../../../../thirdparty/deepseek-harness/packages/api/gateway/lib/client.js',
  () => import('../../../../thirdparty/deepseek-harness/packages/api/gateway/src/client/index.ts'),
)

it('exposes history failure on the real DSH session snapshot instead of throwing from open', async () => {
  const api = new FakeApiClient()
  api.onList = async () =>
    ok({ items: [{ sessionId: 'test-root', updatedAt: 1, running: false, blank: false }] } as never)
  api.onHistory = async () => err(new RemoteError('gateway/internal', 'Fixture history unavailable', {}))
  const sessions = new ClientSessions(new Context(), api.sessionRemotes())
  await sessions.refresh()
  sessions.open('test-root' as never)
  const binding = sessions.binding('test-root' as never)!
  await vi.waitFor(() => expect(binding.session.getSnapshot().openState).toBe('error'))
  expect(binding.session.getSnapshot().openError?.message).toBe('Fixture history unavailable')
  expect(binding.eventSource.getSnapshot().entries).toEqual([])
})
