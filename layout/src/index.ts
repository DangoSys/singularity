/**
 * Persist session canvas geometry and expose ctx.layout.
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
  private readonly ready: Promise<void>
  private readonly storeId: SessionId
  private handle: SessionHandle | undefined
  private state: LayoutState
  private nextSeq = 0
  private writes = Promise.resolve()

  constructor(ctx: Context, config: LayoutConfig = {}) {
    super(ctx, 'layout')
    const rawId = config.storeId ?? 'layout-state'
    if (!/^[A-Za-z0-9._-]+$/.test(rawId)) throw new Error(`layout: invalid store id "${rawId}"`)
    this.storeId = makeSessionId(rawId)
    this.state = new LayoutState(rawId)
    this.ready = this.open(ctx)
    ctx.effect(() => () => this.ready.then(() => this.handle?.close()), 'layout:persistence')
  }

  async snapshot(): Promise<LayoutSnapshot> {
    await this.ready
    return this.state.snapshot()
  }

  async get(sessionId: SessionId): Promise<CanvasNode> {
    await this.ready
    return this.state.get(sessionId)
  }

  async set(sessionId: SessionId, node: CanvasNode): Promise<void> {
    await this.commit([{ kind: 'node/set', sessionId, node }])
  }

  async remove(sessionId: SessionId): Promise<void> {
    await this.commit([{ kind: 'node/remove', sessionId }])
  }

  async commit(events: readonly LayoutEvent[]): Promise<void> {
    if (events.length === 0) throw new Error('layout: cannot commit an empty event batch')
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

  private async open(ctx: Context): Promise<void> {
    const listed = (await ctx.sessionPersistence.list()).filter(item => item.header.id === this.storeId)
    if (listed.length > 1) throw new Error(`layout: duplicate store session "${this.storeId}"`)
    this.handle = listed.length === 0
      ? await ctx.sessionPersistence.create(this.header())
      : await ctx.sessionPersistence.open(this.storeId, 'write')
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

  private header(): SessionHeader {
    return { version: SESSION_FORMAT_VERSION, id: this.storeId, createdAt: Date.now(), isSeeded: false }
  }
}

export default LayoutService
