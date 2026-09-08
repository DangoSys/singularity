/**
 * HTTP and SSE surface for the Singularity graph.
 * @module dsh-singularity-graph-web
 */

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@dangosys/dsh-singularity-graph'
import { registerEvents } from './web/api/events.ts'
import { registerGraph } from './web/api/graph.ts'
import { registerNotices } from './web/api/notices.ts'
import { registerTranscript } from './web/api/transcript.ts'
import { GraphBroadcast } from './web/libs/broadcast.ts'

interface PrChatPathEvent {
  readonly path: 'pr' | 'bot'
  readonly target: { readonly repo: string; readonly number: number } | { readonly sessionId: string }
}

interface PrChatSentEvent extends PrChatPathEvent {
  readonly result: unknown
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'pr-chat/path': (event: PrChatPathEvent) => void
    'pr-chat/sent': (event: PrChatSentEvent) => void
  }
}

export const name = 'graph-web'
export const inject = ['graph', 'sessions', 'webServer']

export function apply(ctx: Context): void {
  const broadcast = new GraphBroadcast()
  ctx.on('graph/change', snapshot => broadcast.publish(snapshot))
  ctx.on('pr-chat/path', event => broadcast.publishEvent('pr-chat/path', event))
  ctx.on('pr-chat/sent', event => broadcast.publishEvent('pr-chat/sent', event))
  ctx.effect(() => {
    const graph = registerGraph(ctx)
    const events = registerEvents(ctx, broadcast)
    const transcript = registerTranscript(ctx)
    const notices = registerNotices(ctx, broadcast)
    return () => {
      graph()
      events()
      transcript()
      notices()
      broadcast.close()
    }
  }, 'web: routes')
}
