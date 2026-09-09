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
import type {} from '@dangosys/dsh-singularity-graph'
import type {} from '@dangosys/dsh-singularity-layout'
import type {} from '@dangosys/dsh-singularity-agent-runtime'
import { DEFAULT_ROOT } from '@dangosys/dsh-singularity-layout'
import type { CreateGraphRequest, GraphArchive, GraphRecord, GraphsEvent, GraphsSnapshot } from './types.ts'
import { GraphsState } from './service/state.ts'

export * from './types.ts'
export { GraphsState } from './service/state.ts'

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap { 'graphs/event': GraphsEvent }
}

type StoredEvent = SessionEvent<'graphs/event'>

declare module '@deepseek-ai/cordis' {
  interface Context { graphs: GraphsService }
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

  constructor(ctx: Context) {
    super(ctx, 'graphs')
    this.ready = this.open(ctx)
    ctx.effect(() => () => this.ready.then(() => this.handle?.close()), 'graphs:persistence')
    ctx.effect(async () => {
      await this.ready
      const selected = this.state.selected()
      if (selected !== undefined) await this.activate(selected)
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

  async list(): Promise<readonly GraphRecord[]> {
    await this.ready
    return this.state.snapshot().graphs
  }

  async select(id: string): Promise<GraphRecord> {
    await this.commit([{ kind: 'graph/select', id }])
    const graph = this.state.get(id)
    await this.activate(graph)
    return graph
  }

  async create(request: CreateGraphRequest): Promise<GraphRecord> {
    await this.ready
    let createdEnvId: string | undefined
    try {
      const envId = await this.resolveEnv(request)
      if (request.createEnv === true) createdEnvId = envId
      const id = nextGraphId(this.state.snapshot().graphs.map(g => g.id))
      const name = request.name?.trim() || id
      if (name.length === 0) throw new Error('graphs: name is empty')
      const rootSessionId = SessionId(randomUUID())
      const graphStoreId = `sg-g-${id}`
      const layoutStoreId = `sg-l-${id}`

      await this.ctx.graph.switchStore(graphStoreId)
      await this.ctx.layout.switchStore(layoutStoreId)
      const handle = await this.ctx.agentRuntime.createRoot({ sessionId: rootSessionId })
      await this.ctx.layout.set(handle.agent.id, DEFAULT_ROOT)
      this.ctx.envBuilder.store.attachSession(envId, handle.agent.id)
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
      this.ctx.emit('graphs/selected', graph)
      return graph
    } catch (error) {
      if (createdEnvId !== undefined) this.ctx.envBuilder.store.delete(createdEnvId)
      throw error
    }
  }

  async markReady(id?: string): Promise<GraphRecord> {
    await this.ready
    const graph = id === undefined ? await this.current() : this.state.get(id)
    await this.commit([{ kind: 'graph/ready', id: graph.id }])
    return this.state.get(graph.id)
  }

  async remove(id: string): Promise<void> {
    await this.ready
    const graph = this.state.get(id)
    await this.ctx.graph.switchStore(graph.graphStoreId)
    await this.ctx.layout.switchStore(graph.layoutStoreId)
    const snapshot = await this.ctx.graph.snapshot()
    const agentIds = snapshot.agents.map(agent => agent.id)
    await this.ctx.agentRuntime.stopAgents(agentIds)

    const archive: GraphArchive = {
      graph,
      agentIds,
      archivedAt: Date.now(),
    }
    this.ctx.envBuilder.store.clean(graph.envId)

    await this.commit([{ kind: 'graph/remove', id, archive }])

    const selected = this.state.selected()
    if (selected !== undefined) await this.activate(selected)
  }

  private async resolveEnv(request: CreateGraphRequest): Promise<string> {
    const modes = [request.createEnv === true, request.envId !== undefined]
    if (modes.filter(Boolean).length !== 1) {
      throw new Error('graphs: provide exactly one of createEnv, envId')
    }
    const bound = this.state.boundEnvIds()
    if (request.createEnv === true) {
      if (request.repos !== undefined && !Array.isArray(request.repos)) {
        throw new Error('graphs: repos must be an array')
      }
      const env = this.ctx.envBuilder.store.create()
      for (const ref of request.repos ?? []) {
        if (typeof ref !== 'string' || ref.trim().length === 0) throw new Error('graphs: empty repo ref')
        this.ctx.envBuilder.store.planComponent(env.id, ref)
      }
      return env.id
    }
    if (request.repos !== undefined) throw new Error('graphs: repos only allowed with createEnv')
    const envId = request.envId!
    if (bound.has(envId)) throw new Error(`graphs: environment "${envId}" already bound`)
    const env = this.ctx.envBuilder.store.get(envId)
    if (env.sessionIds.length > 0) {
      throw new Error(`graphs: environment "${envId}" still has sessions; delete the bound graph first`)
    }
    return envId
  }

  private async activate(graph: GraphRecord): Promise<void> {
    await this.ctx.graph.switchStore(graph.graphStoreId)
    await this.ctx.layout.switchStore(graph.layoutStoreId)
    await this.ctx.agentRuntime.ensureRoot(graph.rootSessionId)
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
        type: 'graphs/event', seq: SessionSeq(this.nextSeq + index), time: Date.now(), data: event, ignorable: true,
      }))
      await this.handle!.append(records)
      this.state = next
      this.nextSeq += records.length
      this.ctx.emit('graphs/change', this.state.snapshot())
    })
    this.writes = run
    return run
  }

  private async open(ctx: Context): Promise<void> {
    const listed = (await ctx.sessionPersistence.list()).filter(item => item.header.id === this.storeId)
    if (listed.length > 1) throw new Error(`graphs: duplicate store session "${this.storeId}"`)
    this.handle = listed.length === 0
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
