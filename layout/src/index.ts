/**
 * Persist canvas geometry for multiple Singularity graphs.
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
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'layout/event': LayoutEvent
  }
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    layout: LayoutService
  }
  interface Events {
    'layout/change'(snapshot: LayoutSnapshot): void
  }
}
type StoredEvent = SessionEvent<'layout/event'>
interface Entry {
  id: string
  sessionId: SessionId
  state: LayoutState
  handle?: SessionHandle
  nextSeq: number
  ready: Promise<void>
  writes: Promise<void>
}
function assertId(id: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('layout: invalid store id ' + id)
}
export class LayoutService extends Service {
  static inject = ['sessionPersistence']
  private readonly entries = new Map<string, Entry>()
  private activeId?: string
  private closing = false
  constructor(ctx: Context, config: LayoutConfig = {}) {
    super(ctx, 'layout')
    this.openEntry(config.storeId ?? 'layout-idle')
    ctx.effect(() => () => this.close(), 'layout:persistence')
  }
  async switchStore(id: string): Promise<LayoutSnapshot> {
    const entry = await this.entry(id)
    this.activeId = id
    const snap = entry.state.snapshot()
    this.ctx.emit('layout/change', snap)
    return snap
  }
  clearActive(): void {
    if (this.closing) throw new Error('layout: service is closing')
    this.activeId = undefined
  }
  async snapshot(): Promise<LayoutSnapshot> {
    return (await this.active()).state.snapshot()
  }
  async snapshotIn(id: string): Promise<LayoutSnapshot> {
    return (await this.entry(id)).state.snapshot()
  }
  async set(sessionId: SessionId, node: CanvasNode): Promise<void> {
    await this.setIn(this.activeIdOf(), sessionId, node)
  }
  async setIn(id: string, sessionId: SessionId, node: CanvasNode): Promise<void> {
    await this.commitIn(id, [{ kind: 'node/set', sessionId, node }])
  }
  async remove(sessionId: SessionId): Promise<void> {
    await this.removeIn(this.activeIdOf(), sessionId)
  }
  async removeIn(id: string, sessionId: SessionId): Promise<void> {
    await this.commitIn(id, [{ kind: 'node/remove', sessionId }])
  }
  async commit(events: readonly LayoutEvent[]): Promise<void> {
    await this.commitIn(this.activeIdOf(), events)
  }
  async commitIn(id: string, events: readonly LayoutEvent[]): Promise<void> {
    if (events.length === 0) throw new Error('layout: cannot commit an empty event batch')
    const entry = this.openEntry(id)
    const run = entry.writes.then(async () => {
      await entry.ready
      const next = entry.state.clone()
      for (const event of events) next.apply(event)
      const records = events.map((data, index): StoredEvent => ({
        type: 'layout/event',
        seq: SessionSeq(entry.nextSeq + index),
        time: Date.now(),
        data,
        ignorable: true,
      }))
      await entry.handle!.append(records)
      entry.state = next
      entry.nextSeq += records.length
      this.ctx.emit('layout/change', entry.state.snapshot())
    })
    entry.writes = run.then(
      () => undefined,
      () => undefined,
    )
    await run
  }
  private async active(): Promise<Entry> {
    return this.entry(this.activeIdOf())
  }
  private activeIdOf(): string {
    if (this.activeId === undefined) throw new Error('layout: no graph selected')
    return this.activeId
  }
  private async entry(id: string): Promise<Entry> {
    const entry = this.openEntry(id)
    await entry.ready
    return entry
  }
  private openEntry(id: string): Entry {
    if (this.closing) throw new Error('layout: service is closing')
    assertId(id)
    const existing = this.entries.get(id)
    if (existing) return existing
    const entry: Entry = {
      id,
      sessionId: makeSessionId(id),
      state: new LayoutState(id),
      nextSeq: 0,
      ready: Promise.resolve(),
      writes: Promise.resolve(),
    }
    entry.ready = this.open(entry)
    this.entries.set(id, entry)
    return entry
  }
  private async open(entry: Entry): Promise<void> {
    try {
      const listed = (await this.ctx.sessionPersistence.list()).filter(item => item.header.id === entry.sessionId)
      if (listed.length > 1) throw new Error('layout: duplicate store session ' + entry.id)
      entry.handle =
        listed.length === 0
          ? await this.ctx.sessionPersistence.create(this.header(entry.sessionId))
          : await this.ctx.sessionPersistence.open(entry.sessionId, 'write')
      const { events } = await entry.handle.read()
      for (const event of events) {
        if (event.type !== 'layout/event' || event.ignorable !== true)
          throw new Error('layout: invalid persisted event')
        const next = entry.state.clone()
        next.apply((event as StoredEvent).data)
        entry.state = next
        entry.nextSeq = event.seq + 1
      }
      await entry.handle.flush()
    } catch (error) {
      await entry.handle?.close()
      throw error
    }
  }
  private async close(): Promise<void> {
    this.closing = true
    const results = await Promise.allSettled(
      [...this.entries.values()].map(async entry => {
        await entry.ready
        await entry.writes
        await entry.handle?.close()
      }),
    )
    this.entries.clear()
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason
    }
  }
  private header(id: SessionId): SessionHeader {
    return { version: SESSION_FORMAT_VERSION, id, createdAt: Date.now(), isSeeded: false }
  }
}
export default LayoutService
