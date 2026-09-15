import { describe, expect, it } from 'vitest'
import { Context } from '../../../../thirdparty/deepseek-harness/vendor/cordis/lib/index.js'
import type { SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { GraphService } from '../../graph/src/index.ts'

interface StoredSession {
  readonly header: SessionHeader
  events: SessionEvent[]
}

function harness() {
  const sessions = new Map<string, StoredSession>()
  const changes: string[] = []
  const persistence = {
    list: async () => [...sessions.values()].map(item => ({ header: item.header })),
    create: async (header: SessionHeader) => {
      const stored = { header, events: [] }
      sessions.set(header.id, stored)
      return {
        read: async () => ({ events: stored.events }),
        append: async (events: SessionEvent[]) => { stored.events.push(...events) },
        flush: async () => {},
        close: async () => {},
      }
    },
    open: async (id: SessionId) => {
      const stored = sessions.get(id)
      if (stored === undefined) throw new Error('missing session ' + id)
      return {
        read: async () => ({ events: stored.events }),
        append: async (events: SessionEvent[]) => { stored.events.push(...events) },
        flush: async () => {},
        close: async () => {},
      }
    },
  }
  const ctx = new Context()
  ctx.provide('sessionPersistence', persistence as never)
  ctx.on('graph/change', snapshot => changes.push(snapshot.id))
  return { service: new GraphService(ctx), changes }
}

describe('graph scoped persistence', () => {
  it('publishes background changes with their store identity without changing the active graph', async () => {
    const { service, changes } = harness()
    await service.switchStore('graph-a')
    await service.addAgent({ id: 'a-root' as SessionId, name: 'A', status: 'idle' }, true)
    await service.switchStore('graph-b')
    await service.addAgent({ id: 'b-root' as SessionId, name: 'B', status: 'idle' }, true)

    const broadcastsBeforeBackgroundChange = changes.length
    await service.setStatusIn('graph-a', 'a-root' as SessionId, 'running')

    expect(changes).toHaveLength(broadcastsBeforeBackgroundChange + 1)
    expect(changes.at(-1)).toBe('graph-a')
    expect((await service.snapshot()).id).toBe('graph-b')
    expect((await service.snapshot()).agents[0]?.status).toBe('idle')

    await service.switchStore('graph-a')
    expect((await service.snapshot()).agents[0]?.status).toBe('running')
  })
})
