import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '../../../../thirdparty/deepseek-harness/vendor/cordis/lib/index.js'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { EnvStore } from '../../../env-builder/src/service/store.ts'
import { GraphsService } from '../../graphs/src/index.ts'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'graphs-lifecycle-'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

function harness() {
  const ctx = new Context()
  const store = new EnvStore(root)
  const events: SessionEvent[] = []
  const agents: { id: SessionId }[] = []
  const append = vi.fn(async (records: readonly SessionEvent[]) => {
    events.push(...records)
  })
  const handle = {
    read: async () => ({ events }),
    append,
    flush: async () => {},
    close: async () => {},
  }
  const runtime = {
    createRoot: vi.fn(async ({ sessionId }: { sessionId: SessionId; cwd: string }) => {
      const agent = { id: sessionId }
      agents.push(agent)
      return { agent }
    }),
    ensureRoot: vi.fn(async (sessionId: SessionId) => ({ agent: { id: sessionId } })),
    prompt: vi.fn(async (_agent: { id: SessionId }, _prompt: { type: string; text: string }[]) => {}),
    stopAgents: vi.fn(async (_ids: readonly SessionId[]) => {}),
    stopGraph: vi.fn(async (): Promise<void> => {
      await runtime.stopAgents(agents.map(agent => agent.id))
    }),
    spawn: vi.fn(async (_parent: { id: SessionId }, options: { sessionId: SessionId; name: string }) => {
      const agent = { id: options.sessionId }
      agents.push(agent)
      return { agent }
    }),
  }
  const graph = {
    switchStore: vi.fn(async (_id: string) => {}),
    snapshot: async () => ({ agents: [...agents] }),
    snapshotIn: async (_id: string) => ({ agents: [...agents] }),
    clearActive: vi.fn(),
  }
  const layout = {
    switchStore: vi.fn(async (_id: string) => {}),
    snapshot: async () => ({ nodes: {} }),
    clearActive: vi.fn(),
  }
  const detach = vi.spyOn(store, 'detachSession')
  const deleteEnv = vi.spyOn(store, 'delete')
  ctx.provide('sessionPersistence', { list: async () => [], create: async () => handle } as never)
  ctx.provide('envBuilder', { store } as never)
  ctx.provide('graph', graph as never)
  ctx.provide('layout', layout as never)
  ctx.provide('agentRuntime', runtime as never)
  const service = new GraphsService(ctx)
  return { ctx, service, store, events, agents, append, runtime, graph, layout, detach, deleteEnv }
}

describe('graphs creation lifecycle', () => {
  it('rejects a graph environment without repositories', async () => {
    const { service, store, runtime } = harness()
    await expect(service.create({ createEnv: true })).rejects.toThrow(
      'new environment requires at least one repository',
    )
    expect(store.list()).toEqual([])

    const env = store.create()
    await expect(service.create({ envId: env.id })).rejects.toThrow(`environment "${env.id}" has no repositories`)
    expect(runtime.createRoot).not.toHaveBeenCalled()
  })

  it('uses the environment cwd and sends setup only after registry persistence completes', async () => {
    const { service, store, append, events, runtime } = harness()
    const persisted = Promise.withResolvers<void>()
    append.mockImplementationOnce(async records => {
      await persisted.promise
      events.push(...records)
    })
    const creating = service.create({ createEnv: true, repos: ['acme/widget'] })
    await vi.waitFor(() => expect(append).toHaveBeenCalledOnce())
    expect(runtime.prompt).not.toHaveBeenCalled()
    expect(await service.list()).toEqual([])
    persisted.resolve()
    const graph = await creating

    expect(runtime.createRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: store.get(graph.envId).path,
        sessionId: graph.rootSessionId,
        scope: { graphStoreId: graph.graphStoreId, layoutStoreId: graph.layoutStoreId },
      }),
    )
    expect(events[0]).toMatchObject({ type: 'graphs/event', data: { kind: 'graph/add', graph } })
    expect(store.get(graph.envId).sessionIds).toEqual([graph.rootSessionId])
    expect(runtime.prompt).toHaveBeenCalledOnce()
    expect(runtime.prompt.mock.calls[0][0]).toMatchObject({ id: graph.rootSessionId })
    expect(runtime.prompt.mock.calls[0][1][0].text).toContain('graph_mark_ready')
    expect(runtime.prompt.mock.calls[0][1][0].text).toContain('acme/widget')
  })

  it('stops and detaches a created root before deleting its environment when persistence fails', async () => {
    const { service, store, append, runtime, detach, deleteEnv } = harness()
    append.mockRejectedValueOnce(new Error('registry unavailable'))
    await expect(service.create({ createEnv: true, repos: ['acme/widget'] })).rejects.toThrow('registry unavailable')

    const sessionId = runtime.createRoot.mock.calls[0][0].sessionId
    expect(runtime.stopAgents).toHaveBeenCalledExactlyOnceWith([sessionId])
    expect(detach).toHaveBeenCalledExactlyOnceWith('project1', sessionId)
    expect(deleteEnv).toHaveBeenCalledExactlyOnceWith('project1')
    expect(runtime.stopAgents.mock.invocationCallOrder[0]).toBeLessThan(detach.mock.invocationCallOrder[0])
    expect(detach.mock.invocationCallOrder[0]).toBeLessThan(deleteEnv.mock.invocationCallOrder[0])
    expect(store.list()).toEqual([])
    expect(await service.list()).toEqual([])
    expect(runtime.prompt).not.toHaveBeenCalled()
  })

  it('removes a newly created environment when planning a repository fails', async () => {
    const { service, store, runtime, deleteEnv } = harness()
    await expect(service.create({ createEnv: true, repos: ['acme/widget', 'invalid'] })).rejects.toThrow()
    expect(deleteEnv).toHaveBeenCalledExactlyOnceWith('project1')
    expect(store.list()).toEqual([])
    expect(await service.list()).toEqual([])
    expect(runtime.createRoot).not.toHaveBeenCalled()
  })

  it('keeps the committed graph, environment and root binding if setup submission fails', async () => {
    const { service, store, runtime, detach, deleteEnv } = harness()
    runtime.prompt.mockRejectedValueOnce(new Error('setup submission failed'))
    await expect(service.create({ createEnv: true, repos: ['acme/widget'] })).rejects.toThrow('setup submission failed')

    const graphs = await service.list()
    expect(graphs).toHaveLength(1)
    expect(store.get(graphs[0].envId).sessionIds).toEqual([graphs[0].rootSessionId])
    expect(runtime.stopAgents).not.toHaveBeenCalled()
    expect(detach).not.toHaveBeenCalled()
    expect(deleteEnv).not.toHaveBeenCalled()
  })
})

describe('graphs removal lifecycle', () => {
  it('waits for all previous workers to stop before launching cleanup, then archives after cleaning', async () => {
    const { ctx, service, store, agents, runtime, graph, layout } = harness()
    const created = await service.create({ createEnv: true, repos: ['acme/widget'] })
    const workerId = 'old-worker' as SessionId
    agents.push({ id: workerId })
    store.attachSession(created.envId, workerId)
    runtime.ensureRoot.mockClear()
    const stopped = Promise.withResolvers<void>()
    runtime.stopAgents.mockImplementationOnce(async () => {
      await stopped.promise
    })
    let cleanupId: SessionId
    runtime.spawn.mockImplementationOnce(async (_parent, options) => {
      cleanupId = options.sessionId
      agents.push({ id: cleanupId })
      store.attachSession(created.envId, cleanupId)
      store.markClean(created.envId)
      ctx.emit('envBuilder/cleaned', created.envId)
      return { agent: { id: cleanupId } }
    })

    const removing = service.remove(created.id)
    await vi.waitFor(() => expect(runtime.stopAgents).toHaveBeenCalledOnce())
    expect(runtime.stopAgents.mock.calls[0][0]).toEqual([created.rootSessionId, workerId])
    expect(runtime.stopGraph).toHaveBeenCalledExactlyOnceWith({
      graphStoreId: created.graphStoreId,
      layoutStoreId: created.layoutStoreId,
    })
    expect(runtime.ensureRoot).not.toHaveBeenCalled()
    expect(runtime.spawn).not.toHaveBeenCalled()
    stopped.resolve()
    await removing

    expect(runtime.spawn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: created.rootSessionId }),
      expect.objectContaining({ name: 'env-clean' }),
    )
    expect(runtime.stopAgents).toHaveBeenCalledTimes(2)
    expect(runtime.stopAgents.mock.calls[1][0]).toEqual([created.rootSessionId, workerId, cleanupId!])
    expect(await service.snapshot()).toMatchObject({
      graphs: [],
      archives: [{ graph: created, agentIds: [created.rootSessionId, workerId, cleanupId!] }],
    })
    expect(store.get(created.envId).sessionIds).toEqual([])
    expect(ctx.events._hooks['envBuilder/cleaned']).toHaveLength(0)
    expect(graph.clearActive).toHaveBeenCalledOnce()
    expect(layout.clearActive).toHaveBeenCalledOnce()
  })

  it('disposes the cleanup timer and listener without archiving if cleanup spawn fails', async () => {
    const { ctx, service, store, runtime, graph, layout } = harness()
    const created = await service.create({ createEnv: true, repos: ['acme/widget'] })
    vi.useFakeTimers()
    const timerCount = vi.getTimerCount()
    runtime.spawn.mockRejectedValueOnce(new Error('cleanup spawn failed'))
    await expect(service.remove(created.id)).rejects.toThrow('cleanup spawn failed')

    expect(vi.getTimerCount()).toBe(timerCount)
    expect(ctx.events._hooks['envBuilder/cleaned']).toHaveLength(0)
    expect(runtime.stopAgents).toHaveBeenCalledTimes(2)
    expect(await service.snapshot()).toMatchObject({ graphs: [created], archives: [] })
    expect(store.get(created.envId).sessionIds).toEqual([created.rootSessionId])
    expect(graph.clearActive).not.toHaveBeenCalled()
    expect(layout.clearActive).not.toHaveBeenCalled()
  })
})
