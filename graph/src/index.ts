/**
 * Persist agent topology and expose ctx.graph (switchable store per Singularity graph).
 * @module dsh-singularity-graph
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { SESSION_FORMAT_VERSION, SessionId as makeSessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionHandle } from '@deepseek-ai/dsh-session-persistence'
import type { GraphConfig, GraphEdge, GraphEvent, GraphSnapshot, GroupNode, AgentNode, AgentStatus } from './types.ts'
import { GraphState } from './service/state.ts'

export * from './types.ts'
export { GraphState } from './service/state.ts'

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap { 'graph/event': GraphEvent }
}

type StoredEvent = SessionEvent<'graph/event'>

declare module '@deepseek-ai/cordis' {
  interface Context { graph: GraphService }
  interface Events { 'graph/change'(snapshot: GraphSnapshot): void }
}

export class GraphService extends Service {
  static inject = ['sessionPersistence']
  private ready: Promise<void>
  private storeId: SessionId
  private handle: SessionHandle | undefined
  private state: GraphState
  private nextSeq = 0
  private writes = Promise.resolve()
  private active = false

  constructor(ctx: Context, config: GraphConfig = {}) {
    super(ctx, 'graph')
    const rawId = config.storeId ?? 'graph-idle'
    if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`graph: invalid store id "${rawId}"`)
    this.storeId = makeSessionId(rawId)
    this.state = new GraphState(rawId)
    this.ready = this.open(ctx, this.storeId)
    ctx.effect(() => () => this.ready.then(() => this.handle?.close()), 'graph:persistence')
  }

  async switchStore(rawId: string): Promise<GraphSnapshot> {
    if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`graph: invalid store id "${rawId}"`)
    const nextId = makeSessionId(rawId)
    if (this.active && nextId === this.storeId) return this.state.snapshot()
    const run = this.writes.then(async () => {
      await this.ready
      await this.handle?.flush()
      this.handle?.close()
      this.handle = undefined
      this.storeId = nextId
      this.state = new GraphState(rawId)
      this.nextSeq = 0
      this.ready = this.open(this.ctx, nextId)
      await this.ready
      this.active = true
      const snap = this.state.snapshot()
      this.ctx.emit('graph/change', snap)
      return snap
    })
    this.writes = run.then(() => undefined)
    return run
  }

  async snapshot(): Promise<GraphSnapshot> {
    await this.ready
    if (!this.active) throw new Error('graph: no graph selected')
    return this.state.snapshot()
  }

  async addAgent(agent: AgentNode, root = false): Promise<void> {
    await this.commit([{ kind: 'agent/add', agent, ...(root ? { root: true } : {}) }])
  }

  async setStatus(agentId: SessionId, status: AgentStatus): Promise<void> {
    await this.commit([{ kind: 'agent/status', agentId, status }])
  }

  async addGroup(group: GroupNode): Promise<void> {
    await this.commit([{ kind: 'group/add', group }])
  }

  async addMember(groupId: string, agentId: SessionId): Promise<void> {
    await this.commit([{ kind: 'member/add', groupId, agentId }])
  }

  async addEdge(edge: GraphEdge): Promise<void> {
    await this.commit([{ kind: 'edge/add', edge }])
  }

  async commit(events: readonly GraphEvent[]): Promise<void> {
    if (events.length === 0) throw new Error('graph: cannot commit an empty event batch')
    if (!this.active) throw new Error('graph: no graph selected')
    const run = this.writes.then(async () => {
      await this.ready
      const next = this.state.clone()
      for (const event of events) next.apply(event)
      const records = events.map((event, index): StoredEvent => ({
        type: 'graph/event', seq: SessionSeq(this.nextSeq + index), time: Date.now(), data: event, ignorable: true,
      }))
      await this.handle!.append(records)
      this.state = next
      this.nextSeq += records.length
      this.ctx.emit('graph/change', this.state.snapshot())
    })
    this.writes = run
    return run
  }

  private async open(ctx: Context, storeId: SessionId): Promise<void> {
    const listed = (await ctx.sessionPersistence.list()).filter(item => item.header.id === storeId)
    if (listed.length > 1) throw new Error(`graph: duplicate store session "${storeId}"`)
    this.handle = listed.length === 0
      ? await ctx.sessionPersistence.create(this.header(storeId))
      : await ctx.sessionPersistence.open(storeId, 'write')
    const { events } = await this.handle.read()
    for (const event of events) {
      if (event.type !== 'graph/event' || event.ignorable !== true) throw new Error(`graph: invalid persisted event at seq ${event.seq}`)
      const stored = event as StoredEvent
      const next = this.state.clone()
      next.apply(stored.data)
      this.state = next
      this.nextSeq = event.seq + 1
    }
    await this.handle.flush()
  }

  private header(storeId: SessionId): SessionHeader {
    return { version: SESSION_FORMAT_VERSION, id: storeId, createdAt: Date.now(), isSeeded: false }
  }
}

export default GraphService
