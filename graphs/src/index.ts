/**
 * Multi-graph registry: each graph binds one environment and a root session.
 * @module dsh-singularity-graphs
 */

import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionHandle } from '@deepseek-ai/dsh-session-persistence'
import type {} from '@dangosys/dsh-env-builder'
import { cleanPromptText } from '@dangosys/dsh-env-builder'
import type {} from '@dangosys/dsh-singularity-graph'
import type {} from '@dangosys/dsh-singularity-layout'
import type {} from '@dangosys/dsh-singularity-agent-runtime'
import type { CreateGraphRequest, GraphArchive, GraphRecord, GraphsEvent, GraphsSnapshot } from './types.ts'
import { GraphsState } from './service/state.ts'
import { setupPromptText } from './prompts/setup.prompts.ts'

export * from './types.ts'
export { GraphsState } from './service/state.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'graphs/event': GraphsEvent
  }
}

type StoredEvent = SessionEvent<'graphs/event'>

declare module '@deepseek-ai/cordis' {
  interface Context {
    graphs: GraphsService
  }
  interface Events {
    'graphs/change'(snapshot: GraphsSnapshot): void
    'graphs/selected'(graph: GraphRecord): void
  }
}

function nextGraphId(existing: readonly string[]): string {
  let n = 1
  while (existing.includes(`graph${n}`)) n += 1
  return `graph${n}`
}

export class GraphsService extends Service {
  static inject = ['sessionPersistence', 'graph', 'layout', 'agentRuntime', 'envBuilder']
  private readonly ready: Promise<void>
  private readonly storeId = SessionId('graphs-registry')
  private handle: SessionHandle | undefined
  private state = new GraphsState()
  private nextSeq = 0
  private writes = Promise.resolve()
  private transitions = Promise.resolve()

  constructor(ctx: Context) {
    super(ctx, 'graphs')
    this.ready = this.open(ctx)
    ctx.on('agentRuntime/spawned', async ({ parentId, sessionId }) => {
      const graph = await this.graphForSession(parentId)
      ctx.envBuilder.store.attachSession(graph.envId, sessionId)
    })
    ctx.effect(
      () => async () => {
        await this.ready
        await this.transitions
        await this.writes
        await this.handle?.close()
      },
      'graphs:persistence',
    )
    ctx.effect(async () => {
      await this.ready
      const selected = this.state.selected()
      if (selected !== undefined) await this.transition(() => this.activate(selected))
      return () => {}
    }, 'graphs: boot selected')
  }

  async snapshot(): Promise<GraphsSnapshot> {
    await this.ready
    return this.state.snapshot()
  }

  async current(): Promise<GraphRecord> {
    await this.ready
    const selected = this.state.selected()
    if (selected === undefined) throw new Error('graphs: no graph selected')
    return selected
  }

  async get(id: string): Promise<GraphRecord> {
    await this.ready
    return this.state.get(id)
  }

  async view(id: string) {
    const meta = await this.get(id)
    const graph = await this.ctx.graph.snapshotIn(meta.graphStoreId)
    const layout = await this.ctx.layout.snapshotIn(meta.layoutStoreId)
    return { meta, graph, layout }
  }

  async list(): Promise<readonly GraphRecord[]> {
    await this.ready
    return this.state.snapshot().graphs
  }

  async select(id: string): Promise<GraphRecord> {
    return this.transition(async () => {
      const graph = await this.get(id)
      await this.activate(graph)
      await this.commit([{ kind: 'graph/select', id }])
      return graph
    })
  }

  async create(request: CreateGraphRequest): Promise<GraphRecord> {
    return this.transition(async () => {
      await this.ready
      let createdEnvId: string | undefined
      let attached: { envId: string; sessionId: SessionId } | undefined
      let rootAgentId: SessionId | undefined
      let committed = false
      try {
        if ((request.createEnv === true) === (request.envId !== undefined)) {
          throw new Error('graphs: provide exactly one of createEnv, envId')
        }
        let envId: string
        if (request.createEnv === true) {
          if (request.repos === undefined || request.repos.length === 0) {
            throw new Error('graphs: new environment requires at least one repository')
          }
          const env = this.ctx.envBuilder.store.create()
          envId = createdEnvId = env.id
          for (const ref of request.repos) this.ctx.envBuilder.store.planComponent(envId, ref)
        } else {
          if (request.repos !== undefined) throw new Error('graphs: repos only allowed with createEnv')
          envId = request.envId!
          if (this.state.boundEnvIds().has(envId)) throw new Error(`graphs: environment "${envId}" already bound`)
          const env = this.ctx.envBuilder.store.get(envId)
          if (env.components.length === 0) throw new Error(`graphs: environment "${envId}" has no repositories`)
          if (env.sessionIds.length > 0) {
            throw new Error(`graphs: environment "${envId}" still has sessions`)
          }
        }
        const registry = this.state.snapshot()
        const id = nextGraphId([
          ...registry.graphs.map(graph => graph.id),
          ...registry.archives.map(archive => archive.graph.id),
        ])
        const name = request.name === undefined ? id : request.name.trim()
        if (name.length === 0) throw new Error('graphs: name is empty')
        const rootSessionId = SessionId(randomUUID())
        const graphStoreId = `sg-g-${rootSessionId}`
        const layoutStoreId = `sg-l-${rootSessionId}`

        const handle = await this.ctx.agentRuntime.createRoot({
          sessionId: rootSessionId,
          cwd: this.ctx.envBuilder.store.get(envId).path,
          scope: { graphStoreId, layoutStoreId },
        })
        rootAgentId = handle.agent.id
        this.ctx.envBuilder.store.attachSession(envId, handle.agent.id)
        attached = { envId, sessionId: handle.agent.id }
        this.ctx.envBuilder.store.select(envId)

        const graph: GraphRecord = {
          id,
          name,
          envId,
          rootSessionId: handle.agent.id,
          graphStoreId,
          layoutStoreId,
          createdAt: Date.now(),
          ready: false,
        }
        await this.commit([{ kind: 'graph/add', graph }])
        committed = true
        await this.activate(graph)
        const env = this.ctx.envBuilder.store.get(envId)
        await this.ctx.agentRuntime.prompt(handle.agent, [
          {
            type: 'text',
            text: setupPromptText(id, env),
          },
        ])
        return graph
      } catch (error) {
        if (committed) throw error
        if (attached !== undefined) {
          await this.ctx.agentRuntime.stopAgents([attached.sessionId])
          this.ctx.envBuilder.store.detachSession(attached.envId, attached.sessionId)
        } else if (rootAgentId !== undefined) {
          await this.ctx.agentRuntime.stopAgents([rootAgentId])
        }
        if (createdEnvId !== undefined) this.ctx.envBuilder.store.delete(createdEnvId)
        throw error
      }
    })
  }

  async markReady(id: string): Promise<GraphRecord> {
    await this.ready
    await this.commit([{ kind: 'graph/ready', id }])
    return this.state.get(id)
  }

  async graphForSession(sessionId: SessionId): Promise<GraphRecord> {
    await this.ready
    for (const graph of this.state.snapshot().graphs) {
      const snapshot = await this.ctx.graph.snapshotIn(graph.graphStoreId)
      if (snapshot.agents.some(agent => agent.id === sessionId)) return graph
    }
    throw new Error(`graphs: session "${sessionId}" is not in a graph`)
  }

  async remove(id: string): Promise<void> {
    return this.transition(async () => {
      const graph = await this.get(id)
      const scope = { graphStoreId: graph.graphStoreId, layoutStoreId: graph.layoutStoreId }
      await this.ctx.agentRuntime.stopGraph(scope)
      const root = await this.ctx.agentRuntime.ensureRoot(graph.rootSessionId, {
        graphStoreId: graph.graphStoreId,
        layoutStoreId: graph.layoutStoreId,
      })
      let stop!: () => void
      let timer!: ReturnType<typeof setTimeout>
      const cleaned = new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`graphs: env clean timed out for "${graph.envId}"`)), 10 * 60 * 1000)
        stop = this.ctx.on('envBuilder/cleaned', (envId: string) => {
          if (envId === graph.envId) resolve()
        })
      })
      try {
        await Promise.all([
          this.ctx.agentRuntime.spawn(root.agent, {
            sessionId: SessionId(randomUUID()),
            name: 'env-clean',
            prompt: [{ type: 'text', text: cleanPromptText(graph.envId) }],
          }),
          cleaned,
        ])
      } finally {
        clearTimeout(timer)
        stop()
        await this.ctx.agentRuntime.stopGraph(scope)
      }
      const snapshot = await this.ctx.graph.snapshotIn(graph.graphStoreId)
      const archive: GraphArchive = { graph, agentIds: snapshot.agents.map(agent => agent.id), archivedAt: Date.now() }
      await this.commit([{ kind: 'graph/remove', id, archive }])
      const selected = this.state.selected()
      if (selected !== undefined) await this.activate(selected)
      else {
        this.ctx.graph.clearActive()
        this.ctx.layout.clearActive()
      }
    })
  }

  private async activate(graph: GraphRecord): Promise<void> {
    await this.ctx.agentRuntime.ensureRoot(graph.rootSessionId, {
      graphStoreId: graph.graphStoreId,
      layoutStoreId: graph.layoutStoreId,
    })
    await this.ctx.graph.switchStore(graph.graphStoreId)
    await this.ctx.layout.switchStore(graph.layoutStoreId)
    this.ctx.envBuilder.store.select(graph.envId)
    this.ctx.emit('graphs/selected', graph)
    this.ctx.emit('graph/change', await this.ctx.graph.snapshot())
    this.ctx.emit('layout/change', await this.ctx.layout.snapshot())
  }

  private async commit(events: readonly GraphsEvent[]): Promise<void> {
    if (events.length === 0) throw new Error('graphs: cannot commit an empty event batch')
    const run = this.writes.then(async () => {
      await this.ready
      const next = this.state.clone()
      for (const event of events) next.apply(event)
      const records = events.map((event, index): StoredEvent => ({
        type: 'graphs/event',
        seq: SessionSeq(this.nextSeq + index),
        time: Date.now(),
        data: event,
        ignorable: true,
      }))
      await this.handle!.append(records)
      this.state = next
      this.nextSeq += records.length
      this.ctx.emit('graphs/change', this.state.snapshot())
    })
    this.writes = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private transition<T>(work: () => Promise<T>): Promise<T> {
    const run = this.transitions.then(work)
    this.transitions = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async open(ctx: Context): Promise<void> {
    const listed = (await ctx.sessionPersistence.list()).filter(item => item.header.id === this.storeId)
    if (listed.length > 1) throw new Error(`graphs: duplicate store session "${this.storeId}"`)
    this.handle =
      listed.length === 0
        ? await ctx.sessionPersistence.create(this.header())
        : await ctx.sessionPersistence.open(this.storeId, 'write')
    const { events } = await this.handle.read()
    for (const event of events) {
      if (event.type !== 'graphs/event' || event.ignorable !== true) {
        throw new Error(`graphs: invalid persisted event at seq ${event.seq}`)
      }
      const stored = event as StoredEvent
      const next = this.state.clone()
      next.apply(stored.data)
      this.state = next
      this.nextSeq = event.seq + 1
    }
    await this.handle.flush()
  }

  private header(): SessionHeader {
    return { version: SESSION_FORMAT_VERSION, id: this.storeId, createdAt: Date.now(), isSeeded: false }
  }
}

export default GraphsService
