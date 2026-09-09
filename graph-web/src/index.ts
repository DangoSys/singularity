/**
 * HTTP and SSE surface for the Singularity graph.
 * @module dsh-singularity-graph-web
 */

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@dangosys/dsh-env-builder'
import type {} from '@dangosys/dsh-singularity-graph'
import type {} from '@dangosys/dsh-singularity-graphs'
import type {} from '@dangosys/dsh-singularity-layout'
import type {} from '@dangosys/dsh-singularity-agent'
import { registerEvents } from './web/api/events.ts'
import { registerGraph } from './web/api/graph.ts'
import { registerGraphEnvs } from './web/api/graph-envs.ts'
import { registerGraphs } from './web/api/graphs.ts'
import { registerHitl } from './web/api/hitl.ts'
import { registerLayout } from './web/api/layout.ts'
import { registerMapStatic } from './web/api/map-static.ts'
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
export const inject = ['graph', 'layout', 'graphs', 'envBuilder', 'sessions', 'webServer', 'hitl']

export function apply(ctx: Context): void {
  const broadcast = new GraphBroadcast()
  ctx.on('graph/change', snapshot => broadcast.publish(snapshot))
  ctx.on('layout/change', snapshot => broadcast.publishLayout(snapshot))
  ctx.on('graphs/change', snapshot => broadcast.publishEvent('graphs', snapshot))
  ctx.on('hitl/change', pending => broadcast.publishEvent('hitl', { pending }))
  ctx.on('pr-chat/path', event => broadcast.publishEvent('pr-chat/path', event))
  ctx.on('pr-chat/sent', event => broadcast.publishEvent('pr-chat/sent', event))
  ctx.effect(() => {
    const graph = registerGraph(ctx)
    const layout = registerLayout(ctx)
    const graphs = registerGraphs(ctx)
    const graphEnvs = registerGraphEnvs(ctx)
    const hitl = registerHitl(ctx)
    const events = registerEvents(ctx, broadcast)
    const transcript = registerTranscript(ctx)
    const notices = registerNotices(ctx, broadcast)
    const map = registerMapStatic(ctx)
    return () => {
      graph()
      layout()
      graphs()
      graphEnvs()
      hitl()
      events()
      transcript()
      notices()
      map()
      broadcast.close()
    }
  }, 'web: routes')
}
