import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'

export type HitlKind = 'ask' | 'approve'

export interface HitlPending {
  readonly id: string
  readonly kind: HitlKind
  readonly prompt: string
  readonly sessionId: string
  readonly createdAt: number
}

export type HitlAnswer =
  | { readonly kind: 'ask'; readonly text: string }
  | { readonly kind: 'approve'; readonly decision: 'approve' | 'reject' }

declare module '@deepseek-ai/cordis' {
  interface Context { hitl: HitlService }
  interface Events {
    'hitl/change'(pending: readonly HitlPending[]): void
  }
}

interface Waiter {
  readonly pending: HitlPending
  readonly resolve: (answer: HitlAnswer) => void
  readonly reject: (error: Error) => void
}

export class HitlService extends Service {
  private readonly waiters = new Map<string, Waiter>()

  constructor(ctx: Context) {
    super(ctx, 'hitl')
  }

  list(): readonly HitlPending[] {
    return [...this.waiters.values()].map(w => w.pending)
  }

  ask(sessionId: string, prompt: string): Promise<string> {
    if (prompt.trim().length === 0) throw new Error('hitl: ask prompt is empty')
    return this.enqueue(sessionId, 'ask', prompt).then(answer => {
      if (answer.kind !== 'ask') throw new Error('hitl: expected ask answer')
      return answer.text
    })
  }

  approve(sessionId: string, prompt: string): Promise<'approve' | 'reject'> {
    if (prompt.trim().length === 0) throw new Error('hitl: approve prompt is empty')
    return this.enqueue(sessionId, 'approve', prompt).then(answer => {
      if (answer.kind !== 'approve') throw new Error('hitl: expected approve answer')
      return answer.decision
    })
  }

  answer(id: string, answer: HitlAnswer): void {
    const waiter = this.waiters.get(id)
    if (waiter === undefined) throw new Error(`hitl: unknown request "${id}"`)
    if (waiter.pending.kind !== answer.kind) {
      throw new Error(`hitl: kind mismatch for "${id}"`)
    }
    if (answer.kind === 'ask' && answer.text.trim().length === 0) {
      throw new Error('hitl: empty ask answer')
    }
    this.waiters.delete(id)
    waiter.resolve(answer)
    this.ctx.emit('hitl/change', this.list())
  }

  private enqueue(sessionId: string, kind: HitlKind, prompt: string): Promise<HitlAnswer> {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new Error('hitl: missing session id')
    }
    const id = randomUUID()
    const pending: HitlPending = { id, kind, prompt, sessionId, createdAt: Date.now() }
    const promise = new Promise<HitlAnswer>((resolve, reject) => {
      this.waiters.set(id, { pending, resolve, reject })
    })
    this.ctx.emit('hitl/change', this.list())
    return promise
  }
}

export default HitlService
