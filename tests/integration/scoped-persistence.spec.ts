import { describe, expect, it, vi } from 'vitest'
import { Context } from '../../../../thirdparty/deepseek-harness/vendor/cordis/lib/index.js'
import type { SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { GraphService } from '../../graph/src/index.ts'
import { LayoutService } from '../../layout/src/index.ts'
import { DEFAULT_ROOT } from '../../layout/src/types.ts'

function harness(name: 'graph' | 'layout') {
  const ctx = new Context()
  const events = new Map<string, SessionEvent[]>()
  const headers = new Map<string, SessionHeader>()
  const closed = new Set<string>()
  const read = vi.fn(async (_id: string) => ({ events: [] as SessionEvent[] }))
  const flush = vi.fn(async (_id: string) => {})
  const append = vi.fn(async (id: string, records: readonly SessionEvent[]) => {
    events.get(id)!.push(...records)
  })
  const closeHandle = vi.fn(async (id: string) => {
    closed.add(id)
  })
  const create = vi.fn(async (header: SessionHeader) => {
    headers.set(header.id, header)
    events.set(header.id, [])
    return {
      read: () => read(header.id),
      flush: () => flush(header.id),
      append: (records: readonly SessionEvent[]) => {
        if (closed.has(header.id)) throw new Error('append after close')
        return append(header.id, records)
      },
      close: () => closeHandle(header.id),
    }
  })
  ctx.provide('sessionPersistence', {
    list: async () => [...headers.values()].map(header => ({ header })),
    create,
  } as never)
  let dispose!: () => Promise<void>
  const effect = ctx.effect.bind(ctx)
  ctx.effect = ((start, label) => {
    const stop = effect(start, label)
    if (label === `${name}:persistence`) dispose = stop
    return stop
  }) as Context['effect']
  const service = name === 'graph' ? new GraphService(ctx) : new LayoutService(ctx)
  const event =
    name === 'graph'
      ? { kind: 'agent/add', agent: { id: 'agent1', name: 'Agent', status: 'idle' } }
      : { kind: 'node/set', sessionId: 'agent1', node: DEFAULT_ROOT }
  const activeWrite = () =>
    name === 'graph'
      ? (service as GraphService).addAgent({ id: 'agent1' as SessionId, name: 'Agent', status: 'idle' })
      : (service as LayoutService).set('agent1' as SessionId, DEFAULT_ROOT)
  return { service, dispose, event, activeWrite, events, read, flush, append, closeHandle, create, closed }
}

describe.each(['graph', 'layout'] as const)('%s persistence lifecycle', name => {
  it.each(['scoped', 'active'])('waits for a %s write accepted immediately before disposal', async mode => {
    const { service, dispose, event, activeWrite, events, closed } = harness(name)
    await service.switchStore('store-a')
    const write = mode === 'scoped' ? service.commitIn('store-a', [event] as never) : activeWrite()
    const closing = dispose()
    await expect(write).resolves.toBeUndefined()
    await expect(closing).resolves.toBeUndefined()
    expect(events.get('store-a')).toHaveLength(1)
    expect(closed.has('store-a')).toBe(true)
  })

  it('rejects new reads and writes after disposal starts without opening another store', async () => {
    const { service, dispose, event, create, activeWrite } = harness(name)
    await service.switchStore('store-a')
    const count = create.mock.calls.length
    const closing = dispose()
    await expect(service.commitIn('store-a', [event] as never)).rejects.toThrow('service is closing')
    await expect(activeWrite()).rejects.toThrow('service is closing')
    await expect(service.snapshotIn('store-a')).rejects.toThrow('service is closing')
    await expect(service.switchStore('store-new')).rejects.toThrow('service is closing')
    expect(() => service.clearActive()).toThrow('service is closing')
    await closing
    await expect(service.commitIn('store-new', [event] as never)).rejects.toThrow('service is closing')
    expect(create).toHaveBeenCalledTimes(count)
  })

  it('waits for opening and writing a store admitted before disposal', async () => {
    const { service, dispose, event, events, read, closeHandle } = harness(name)
    await service.switchStore('store-a')
    const opening = Promise.withResolvers<void>()
    read.mockImplementation(async id => {
      if (id === 'store-b') await opening.promise
      return { events: [] }
    })
    const write = service.commitIn('store-b', [event] as never)
    const closing = dispose()
    await vi.waitFor(() => expect(read).toHaveBeenCalledWith('store-b'))
    expect(closeHandle).not.toHaveBeenCalledWith('store-b')
    opening.resolve()
    await write
    await closing
    expect(events.get('store-b')).toHaveLength(1)
    expect(closeHandle).toHaveBeenCalledWith('store-b')
  })

  it.each(['read', 'flush'] as const)('releases an acquired handle if its initial %s fails', async stage => {
    const { service, dispose, read, flush, closeHandle } = harness(name)
    await service.switchStore('store-a')
    const error = new Error(`initial ${stage} failed`)
    if (stage === 'read') read.mockRejectedValueOnce(error)
    else flush.mockRejectedValueOnce(error)
    await expect(service.snapshotIn('bad-store')).rejects.toBe(error)
    expect(closeHandle).toHaveBeenCalledWith('bad-store')
    await expect(dispose()).rejects.toBe(error)
    expect(closeHandle.mock.calls.filter(([id]) => id === 'bad-store')).toHaveLength(1)
    expect(closeHandle).toHaveBeenCalledWith('store-a')
  })

  it('drains healthy accepted writes before reporting another store’s open failure on disposal', async () => {
    const { service, dispose, event, read, append, closeHandle } = harness(name)
    await service.switchStore('store-a')
    const error = new Error('bad store')
    read.mockRejectedValueOnce(error)
    await expect(service.snapshotIn('bad-store')).rejects.toBe(error)
    const written = Promise.withResolvers<void>()
    append.mockImplementationOnce(async () => {
      await written.promise
    })
    const write = service.commitIn('store-a', [event] as never)
    let settled = false
    const closing = dispose().finally(() => {
      settled = true
    })
    const rejected = expect(closing).rejects.toBe(error)
    await vi.waitFor(() => expect(append).toHaveBeenCalledWith('store-a', expect.any(Array)))
    expect(settled).toBe(false)
    expect(closeHandle).not.toHaveBeenCalledWith('store-a')
    written.resolve()
    await write
    await rejected
    expect(closeHandle).toHaveBeenCalledWith('store-a')
  })
})
