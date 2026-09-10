/**
 * Persist session canvas geometry and expose ctx.layout (switchable per graph).
 * @module dsh-singularity-layout
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { SESSION_FORMAT_VERSION, SessionId as makeSessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionHandle } from '@deepseek-ai/dsh-session-persistence'
import type { CanvasNode, LayoutConfig, LayoutEvent, LayoutSnapshot } from './types.ts'
import { LayoutState } from './service/state.ts'

export * from './types.ts'
export { LayoutState } from './service/state.ts'

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap { 'layout/event': LayoutEvent }
}

type StoredEvent = SessionEvent<'layout/event'>

declare module '@deepseek-ai/cordis' {
  interface Context { layout: LayoutService }
  interface Events { 'layout/change'(snapshot: LayoutSnapshot): void }
}

export class LayoutService extends Service {
  static inject = ['sessionPersistence']
  private ready: Promise<void>
  private storeId: SessionId
  private handle: SessionHandle | undefined
  private state: LayoutState
  private nextSeq = 0
  private writes = Promise.resolve()
  private active = false

  constructor(ctx: Context, config: LayoutConfig = {}) {
    super(ctx, 'layout')
    const rawId = config.storeId ?? 'layout-idle'
    if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`layout: invalid store id "${rawId}"`)
    this.storeId = makeSessionId(rawId)
    this.state = new LayoutState(rawId)
    this.ready = this.open(ctx, this.storeId)
    ctx.effect(() => () => this.ready.then(() => this.handle?.close()), 'layout:persistence')
  }

  async switchStore(rawId: string): Promise<LayoutSnapshot> {
    if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`layout: invalid store id "${rawId}"`)
    const nextId = makeSessionId(rawId)
    if (this.active && nextId === this.storeId) return this.state.snapshot()
    const run = this.writes.then(async () => {
      await this.ready
      await this.handle?.flush()
      this.handle?.close()
      this.handle = undefined
      this.storeId = nextId
      this.state = new LayoutState(rawId)
      this.nextSeq = 0
      this.ready = this.open(this.ctx, nextId)
      await this.ready
      this.active = true
      const snap = this.state.snapshot()
      this.ctx.emit('layout/change', snap)
      return snap
    })
    this.writes = run.then(() => undefined)
    return run
  }

  async snapshot(): Promise<LayoutSnapshot> {
    await this.ready
    if (!this.active) throw new Error('layout: no graph selected')
    return this.state.snapshot()
  }

  async set(sessionId: SessionId, node: CanvasNode): Promise<void> {
    await this.commit([{ kind: 'node/set', sessionId, node }])
  }

  async remove(sessionId: SessionId): Promise<void> {
    await this.commit([{ kind: 'node/remove', sessionId }])
  }

  async commit(events: readonly LayoutEvent[]): Promise<void> {
    if (events.length === 0) throw new Error('layout: cannot commit an empty event batch')
    if (!this.active) throw new Error('layout: no graph selected')
    const run = this.writes.then(async () => {
      await this.ready
      const next = this.state.clone()
      for (const event of events) next.apply(event)
      const records = events.map((event, index): StoredEvent => ({
        type: 'layout/event', seq: SessionSeq(this.nextSeq + index), time: Date.now(), data: event, ignorable: true,
      }))
      await this.handle!.append(records)
      this.state = next
      this.nextSeq += records.length
      this.ctx.emit('layout/change', this.state.snapshot())
    })
    this.writes = run
    return run
  }

  private async open(ctx: Context, storeId: SessionId): Promise<void> {
    const listed = (await ctx.sessionPersistence.list()).filter(item => item.header.id === storeId)
    if (listed.length > 1) throw new Error(`layout: duplicate store session "${storeId}"`)
    this.handle = listed.length === 0
      ? await ctx.sessionPersistence.create(this.header(storeId))
      : await ctx.sessionPersistence.open(storeId, 'write')
    const { events } = await this.handle.read()
    for (const event of events) {
      if (event.type !== 'layout/event' || event.ignorable !== true) throw new Error(`layout: invalid persisted event at seq ${event.seq}`)
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

export default LayoutService
