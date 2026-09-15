import { expect, it, vi } from 'vitest'
import { GraphBroadcast } from '../../graph-web/src/web/libs/broadcast.ts'
import type { GraphRecord } from '../../graphs/src/types.ts'
import type { ServerResponse } from 'node:http'

it('keeps two graph subscriptions isolated and sends fresh full views on reconnect', async () => {
  const view = vi.fn(async (id: string) => ({ meta: { id }, graph: { id: `g-${id}` }, layout: { id: `l-${id}` } }))
  const broadcast = new GraphBroadcast({ graphs: { view } } as never)
  const a = { write: vi.fn(), destroy: vi.fn(), end: vi.fn(), destroyed: false } as unknown as ServerResponse
  const b = { write: vi.fn(), destroy: vi.fn(), end: vi.fn(), destroyed: false } as unknown as ServerResponse
  const meta = (id: string) => ({ id, graphStoreId: `g-${id}`, layoutStoreId: `l-${id}` }) as GraphRecord
  broadcast.subscribe(a, meta('a'))
  broadcast.subscribe(b, meta('b'))
  await Promise.all([...broadcast.clients.values()].map(client => client.writes))
  vi.mocked(a.write).mockClear()
  vi.mocked(b.write).mockClear()
  broadcast.publish({ id: 'g-a' } as never)
  broadcast.publishLayout({ id: 'l-a' } as never)
  await Promise.all([...broadcast.clients.values()].map(client => client.writes))
  expect(a.write).toHaveBeenCalledTimes(2)
  expect(b.write).not.toHaveBeenCalled()
  expect(vi.mocked(a.write).mock.calls[0][0]).toContain('event: snapshot')
  broadcast.clients.delete(a)
  broadcast.subscribe(a, meta('a'))
  await broadcast.clients.get(a)!.writes
  expect(view).toHaveBeenLastCalledWith('a')
  expect(a.destroy).not.toHaveBeenCalled()
  broadcast.close()
  expect(a.end).toHaveBeenCalledOnce()
  expect(b.end).toHaveBeenCalledOnce()
})
