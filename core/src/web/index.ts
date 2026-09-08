import type { IncomingMessage, ServerResponse } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { GraphSnapshot } from '../graph/types.ts'
import type {} from '@deepseek-ai/dsh-host-webserver'

interface PrBotPathEvent {
  readonly path: 'pr' | 'bot'
  readonly target: { readonly repo: string; readonly number: number } | { readonly sessionId: string }
}

interface PrBotSentEvent extends PrBotPathEvent {
  readonly result: unknown
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'pr-bot/path': (event: PrBotPathEvent) => void
    'pr-bot/sent': (event: PrBotSentEvent) => void
  }
}

export const name = 'graph-web'
export const inject = ['graph', 'sessions', 'webServer']

const GRAPH_PATH = '/singular/graph'
const EVENTS_PATH = '/singular/events'
const TRANSCRIPT_PATH = '/singular/transcript'
const NOTICES_PATH = '/singular/notices'

function send(res: ServerResponse, status: number, type: string, value: unknown): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof value === 'string' ? value : JSON.stringify(value))
}

export function apply(ctx: Context): void {
  const clients = new Set<ServerResponse>()
  const notices = new Set<ServerResponse>()
  let previousStatuses = new Map<SessionId, GraphSnapshot['agents'][number]['status']>()
  const publishEvent = (name: string, value: unknown): void => {
    const frame = `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`
    for (const res of clients) {
      if (res.destroyed) clients.delete(res)
      else res.write(frame)
    }
  }
  const publish = (snapshot: GraphSnapshot): void => {
    const frame = `event: graph\ndata: ${JSON.stringify(snapshot)}\n\n`
    for (const res of clients) {
      if (res.destroyed) clients.delete(res)
      else res.write(frame)
    }
    for (const agent of snapshot.agents) {
      const previous = previousStatuses.get(agent.id)
      const complete = previous === 'running' && agent.status === 'idle'
      const text = complete
        ? '已完成当前任务'
        : agent.status === 'done'
          ? '任务已完成'
          : agent.status === 'failed'
            ? '任务执行失败'
            : agent.status === 'waiting'
              ? '正在等待处理'
              : undefined
      if (text === undefined || previous === agent.status) continue
      const frame = `event: notice\ndata: ${JSON.stringify({ agentId: agent.id, status: agent.status, text })}\n\n`
      for (const res of notices) {
        if (res.destroyed) notices.delete(res)
        else res.write(frame)
      }
    }
    previousStatuses = new Map(snapshot.agents.map(agent => [agent.id, agent.status]))
  }
  ctx.on('graph/change', publish)
  ctx.on('pr-bot/path', event => publishEvent('pr-bot/path', event))
  ctx.on('pr-bot/sent', event => publishEvent('pr-bot/sent', event))
  ctx.effect(() => {
    const graph = ctx.webServer.register({ kind: 'exact', path: GRAPH_PATH, handler: async (req, res) => {
      if (req.method !== 'GET') { send(res, 405, 'text/plain; charset=utf-8', 'method not allowed'); return }
      send(res, 200, 'application/json; charset=utf-8', await ctx.graph.snapshot())
    }})
    const events = ctx.webServer.register({ kind: 'exact', path: EVENTS_PATH, handler: async (req, res) => {
      if (req.method !== 'GET') { send(res, 405, 'text/plain; charset=utf-8', 'method not allowed'); return }
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
      clients.add(res)
      req.on('close', () => clients.delete(res))
      res.write(`event: graph\ndata: ${JSON.stringify(await ctx.graph.snapshot())}\n\n`)
    }})
    const transcript = ctx.webServer.register({ kind: 'exact', path: TRANSCRIPT_PATH, handler: async (req, res) => {
      if (req.method !== 'GET') { send(res, 405, 'text/plain; charset=utf-8', 'method not allowed'); return }
      try {
        const groupId = new URL(req.url!, 'http://local').searchParams.get('group')
        if (groupId === null || groupId.length === 0) throw new Error('web: transcript requires group')
        const snapshot = await ctx.graph.snapshot()
        const group = snapshot.groups.find(item => item.id === groupId)
        if (group === undefined) throw new Error(`web: group "${groupId}" is not in graph`)
        const session = ctx.sessions.get(group.transcriptId)
        if (session === undefined) throw new Error(`web: transcript "${group.transcriptId}" is not live`)
        send(res, 200, 'application/json; charset=utf-8', { groupId, transcriptId: group.transcriptId, events: session.snapshotEvents() })
      } catch (error) {
        send(res, 400, 'text/plain; charset=utf-8', error instanceof Error ? error.message : String(error))
      }
    }})
    const noticeEvents = ctx.webServer.register({ kind: 'exact', path: NOTICES_PATH, handler: async (req, res) => {
      if (req.method !== 'GET') { send(res, 405, 'text/plain; charset=utf-8', 'method not allowed'); return }
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
      notices.add(res)
      req.on('close', () => notices.delete(res))
    }})
    return () => { graph(); events(); transcript(); noticeEvents(); for (const res of clients) res.end(); clients.clear(); for (const res of notices) res.end(); notices.clear() }
  }, 'web: routes')
}
