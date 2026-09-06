import type { IncomingMessage, ServerResponse } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { GraphSnapshot } from '../graph/types.ts'
import type { AgentRuntime } from '../agent/index.ts'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'graph-web'
export const inject = ['graph', 'agentRuntime', 'agents', 'sessions', 'webServer']

const GRAPH_PATH = '/singular/graph'
const EVENTS_PATH = '/singular/events'
const TRANSCRIPT_PATH = '/singular/transcript'
const CHAT_PATH = '/singular/chat'
const NOTICES_PATH = '/singular/notices'
const MESSAGE_PATH = '/singular/message'

function send(res: ServerResponse, status: number, type: string, value: unknown): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof value === 'string' ? value : JSON.stringify(value))
}

async function body(req: IncomingMessage): Promise<unknown> {
  let text = ''
  for await (const chunk of req) text += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
  return JSON.parse(text)
}

function request(value: unknown): { to: SessionId; content: readonly ContentBlock[] } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('web: request must be an object')
  const record = value as Record<string, unknown>
  if (typeof record.to !== 'string' || record.to.length === 0 || !Array.isArray(record.content)) throw new Error('web: request requires to and content')
  return { to: record.to as SessionId, content: record.content as ContentBlock[] }
}

function liveAgent(ctx: Context, id: SessionId): Agent {
  const agent = ctx.agents.get(id)
  if (agent === undefined) throw new Error(`web: agent "${id}" is not live`)
  return agent
}

export function apply(ctx: Context): void {
  const clients = new Set<ServerResponse>()
  const chats = new Map<SessionId, Set<ServerResponse>>()
  const notices = new Set<ServerResponse>()
  let previousStatuses = new Map<SessionId, GraphSnapshot['agents'][number]['status']>()
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
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'user/message' && event.type !== 'assistant/message') return
    const frame = `event: message\ndata: ${JSON.stringify(event)}\n\n`
    for (const res of chats.get(session.id) ?? []) {
      if (res.destroyed) chats.get(session.id)?.delete(res)
      else res.write(frame)
    }
  })
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
    const chat = ctx.webServer.register({ kind: 'exact', path: CHAT_PATH, handler: async (req, res) => {
      if (req.method !== 'GET') { send(res, 405, 'text/plain; charset=utf-8', 'method not allowed'); return }
      try {
        const query = new URL(req.url!, 'http://local').searchParams
        const agentId = query.get('agent')
        const groupId = query.get('group')
        if ((agentId === null) === (groupId === null)) throw new Error('web: chat requires exactly one agent or group')
        const snapshot = await ctx.graph.snapshot()
        const sessionId = agentId === null
          ? snapshot.groups.find(item => item.id === groupId)?.transcriptId
          : snapshot.agents.find(item => item.id === agentId)?.id
        if (sessionId === undefined) throw new Error('web: chat target is not in graph')
        const session = ctx.sessions.get(sessionId)
        if (session === undefined) throw new Error(`web: chat session "${sessionId}" is not live`)
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
        const listeners = chats.get(sessionId) ?? new Set<ServerResponse>()
        listeners.add(res)
        chats.set(sessionId, listeners)
        req.on('close', () => { listeners.delete(res); if (listeners.size === 0) chats.delete(sessionId) })
        for (const event of session.snapshotEvents()) {
          if (event.type === 'user/message' || event.type === 'assistant/message') res.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`)
        }
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
    const message = ctx.webServer.register({ kind: 'exact', path: MESSAGE_PATH, handler: async (req, res) => {
      if (req.method !== 'POST') { send(res, 405, 'text/plain; charset=utf-8', 'method not allowed'); return }
      try {
        const parsed = request(await body(req))
        await ctx.agentRuntime.prompt(liveAgent(ctx, parsed.to), parsed.content)
        send(res, 202, 'application/json; charset=utf-8', { accepted: true })
      } catch (error) {
        send(res, 400, 'text/plain; charset=utf-8', error instanceof Error ? error.message : String(error))
      }
    }})
    return () => { graph(); events(); transcript(); chat(); noticeEvents(); message(); for (const res of clients) res.end(); clients.clear(); for (const listeners of chats.values()) for (const res of listeners) res.end(); chats.clear(); for (const res of notices) res.end(); notices.clear() }
  }, 'web: routes')
}
