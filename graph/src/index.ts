/**
 * Persist agent topology for multiple Singularity graphs.
 * @module dsh-singularity-graph
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { SESSION_FORMAT_VERSION, SessionId as makeSessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionHandle } from '@deepseek-ai/dsh-session-persistence'
import type { AgentNode, AgentStatus, GraphConfig, GraphEdge, GraphEvent, GraphSnapshot, GroupNode } from './types.ts'
import { GraphState } from './service/state.ts'

export * from './types.ts'
export { GraphState } from './service/state.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'graph/event': GraphEvent
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    graph: GraphService
  }
  interface Events {
    'graph/change'(snapshot: GraphSnapshot): void
  }
}

type StoredEvent = SessionEvent<'graph/event'>

interface GraphStore {
  readonly id: string
  readonly sessionId: SessionId
  state: GraphState
  handle?: SessionHandle
  nextSeq: number
  ready: Promise<void>
  writes: Promise<void>
}

function assertStoreId(id: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(`graph: invalid store id "${id}"`)
}

export class GraphService extends Service {
  static inject = ['sessionPersistence']
  private readonly stores = new Map<string, GraphStore>()
  private activeId?: string
  private closing = false

  constructor(ctx: Context, config: GraphConfig = {}) {
    super(ctx, 'graph')
    const idle = config.storeId ?? 'graph-idle'
    this.load(idle)
    ctx.effect(() => () => this.close(), 'graph:persistence')
  }

  async switchStore(id: string): Promise<GraphSnapshot> {
    const store = await this.store(id)
    this.activeId = store.id
    const snapshot = store.state.snapshot()
    this.ctx.emit('graph/change', snapshot)
    return snapshot
  }

  clearActive(): void {
    if (this.closing) throw new Error('graph: service is closing')
    this.activeId = undefined
  }

  async snapshot(): Promise<GraphSnapshot> {
    return (await this.active()).state.snapshot()
  }
  async snapshotIn(id: string): Promise<GraphSnapshot> {
    return (await this.store(id)).state.snapshot()
  }

  async addAgent(agent: AgentNode, root = false): Promise<void> {
    await this.addAgentIn(this.activeStoreId(), agent, root)
  }
  async addAgentIn(storeId: string, agent: AgentNode, root = false): Promise<void> {
    await this.commitIn(storeId, [{ kind: 'agent/add', agent, ...(root ? { root: true } : {}) }])
  }
  async setStatus(agentId: SessionId, status: AgentStatus): Promise<void> {
    await this.setStatusIn(this.activeStoreId(), agentId, status)
  }
  async setStatusIn(storeId: string, agentId: SessionId, status: AgentStatus): Promise<void> {
    await this.commitIn(storeId, [{ kind: 'agent/status', agentId, status }])
  }
  async addGroup(group: GroupNode): Promise<void> {
    await this.addGroupIn(this.activeStoreId(), group)
  }
  async addGroupIn(storeId: string, group: GroupNode): Promise<void> {
    await this.commitIn(storeId, [{ kind: 'group/add', group }])
  }
  async addMember(groupId: string, agentId: SessionId): Promise<void> {
    await this.addMemberIn(this.activeStoreId(), groupId, agentId)
  }
  async addMemberIn(storeId: string, groupId: string, agentId: SessionId): Promise<void> {
    await this.commitIn(storeId, [{ kind: 'member/add', groupId, agentId }])
  }
  async addEdge(edge: GraphEdge): Promise<void> {
    await this.addEdgeIn(this.activeStoreId(), edge)
  }
  async addEdgeIn(storeId: string, edge: GraphEdge): Promise<void> {
    await this.commitIn(storeId, [{ kind: 'edge/add', edge }])
  }
  async commit(events: readonly GraphEvent[]): Promise<void> {
    await this.commitIn(this.activeStoreId(), events)
  }

  async commitIn(storeId: string, events: readonly GraphEvent[]): Promise<void> {
    if (events.length === 0) throw new Error('graph: cannot commit an empty event batch')
    const store = this.load(storeId)
    const run = store.writes.then(async () => {
      await store.ready
      const next = store.state.clone()
      for (const event of events) next.apply(event)
      const records = events.map((event, index): StoredEvent => ({
        type: 'graph/event',
        seq: SessionSeq(store.nextSeq + index),
        time: Date.now(),
        data: event,
        ignorable: true,
      }))
      await store.handle!.append(records)
      store.state = next
      store.nextSeq += records.length
      this.ctx.emit('graph/change', store.state.snapshot())
    })
    store.writes = run.then(
      () => undefined,
      () => undefined,
    )
    await run
  }

  private async active(): Promise<GraphStore> {
    return this.store(this.activeStoreId())
  }
  private activeStoreId(): string {
    if (this.activeId === undefined) throw new Error('graph: no graph selected')
    return this.activeId
  }
  private async store(id: string): Promise<GraphStore> {
    const store = this.load(id)
    await store.ready
    return store
  }
  private load(id: string): GraphStore {
    if (this.closing) throw new Error('graph: service is closing')
    assertStoreId(id)
    const existing = this.stores.get(id)
    if (existing !== undefined) return existing
    const store: GraphStore = {
      id,
      sessionId: makeSessionId(id),
      state: new GraphState(id),
      nextSeq: 0,
      ready: Promise.resolve(),
      writes: Promise.resolve(),
    }
    store.ready = this.open(store)
    this.stores.set(id, store)
    return store
  }
  private async open(store: GraphStore): Promise<void> {
    try {
      const listed = (await this.ctx.sessionPersistence.list()).filter(item => item.header.id === store.sessionId)
      if (listed.length > 1) throw new Error(`graph: duplicate store session "${store.id}"`)
      store.handle =
        listed.length === 0
          ? await this.ctx.sessionPersistence.create(this.header(store.sessionId))
          : await this.ctx.sessionPersistence.open(store.sessionId, 'write')
      const { events } = await store.handle.read()
      for (const event of events) {
        if (event.type !== 'graph/event' || event.ignorable !== true)
          throw new Error(`graph: invalid persisted event at seq ${event.seq}`)
        const next = store.state.clone()
        next.apply((event as StoredEvent).data)
        store.state = next
        store.nextSeq = event.seq + 1
      }
      await store.handle.flush()
    } catch (error) {
      await store.handle?.close()
      throw error
    }
  }
  private async close(): Promise<void> {
    this.closing = true
    const results = await Promise.allSettled(
      [...this.stores.values()].map(async store => {
        await store.ready
        await store.writes
        await store.handle?.close()
      }),
    )
    this.stores.clear()
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason
    }
  }
  private header(storeId: SessionId): SessionHeader {
    return { version: SESSION_FORMAT_VERSION, id: storeId, createdAt: Date.now(), isSeeded: false }
  }
}

export default GraphService
