import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { apply } from '../../graph-web/src/index.ts'
import { GraphBroadcast } from '../../graph-web/src/web/libs/broadcast.ts'

function mockRes() {
  const chunks: string[] = []
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    destroyed: false,
    writeHead(code: number, headers?: Record<string, string>) {
      this.statusCode = code
      if (headers) Object.assign(this.headers, headers)
    },
    write(chunk: string) {
      chunks.push(chunk)
      this.body = chunks.join('')
      return true
    },
    end(chunk?: string) {
      if (chunk !== undefined) chunks.push(chunk)
      this.body = chunks.join('')
    },
  }
}

function mockReq(method: string, url: string): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage & EventEmitter
  req.method = method
  req.url = url
  return req
}

describe('graph-web routes and SSE', () => {
  it('GET /singularity/graph returns the requested graph view', async () => {
    const snapshot = {
      version: 1 as const,
      id: 'graph-state',
      roots: ['root' as SessionId],
      agents: [
        {
          id: 'root' as SessionId,
          name: 'Singularity',
          status: 'idle' as const,
        },
      ],
      groups: [],
      edges: [],
    }
    const layout = {
      version: 1 as const,
      id: 'layout-state',
      nodes: { root: { x: 0, y: 0, width: 1, height: 1, shape: 'card' as const } },
    }
    const handlers = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void> | void>()
    const listeners = new Map<string, Set<(...args: never[]) => void>>()
    const effects: Array<() => void | (() => void) | Promise<void>> = []

    const ctx = {
      graph: { snapshot: async () => snapshot },
      layout: { snapshot: async () => layout },
      graphs: {
        view: async (id: string) => {
          expect(id).toBe('graph-a')
          return { meta: { id }, graph: snapshot, layout }
        },
        snapshot: async () => ({
          version: 1 as const,
          graphs: [
            {
              id: 'graph-a',
              name: 'Graph A',
              envId: 'project1',
              rootSessionId: 'root' as SessionId,
              graphStoreId: 'graph-state',
              layoutStoreId: 'layout-state',
              createdAt: 1,
              ready: true,
            },
          ],
          archives: [],
        }),
        list: async () => [],
      },
      envBuilder: {
        store: {
          list: () => [],
          get: (id: string) => {
            expect(id).toBe('project1')
            return {
              id,
              path: '/tmp/project1',
              running: true,
              sessionIds: ['root'],
              components: [
                { owner: 'DangoSys', repo: 'buckyball', url: '', dir: 'buckyball', status: 'ready' as const },
              ],
            }
          },
        },
      },
      hitl: { list: () => [] },
      sessions: { get: () => undefined },
      webServer: {
        register: ({
          kind,
          path,
          handler,
        }: {
          kind: 'exact' | 'prefix'
          path: string
          handler: (req: IncomingMessage, res: ServerResponse) => void
        }) => {
          const key = kind === 'exact' ? path : `${path}/*`
          handlers.set(key, handler)
          return () => handlers.delete(key)
        },
      },
      on(event: string, listener: (...args: never[]) => void) {
        const set = listeners.get(event) ?? new Set()
        set.add(listener)
        listeners.set(event, set)
        return () => set.delete(listener)
      },
      effect(run: () => void | (() => void) | Promise<void>) {
        effects.push(run)
        const cleanup = run()
        return typeof cleanup === 'function' ? cleanup : () => {}
      },
    }

    apply(ctx as never)
    expect(handlers.has('/singularity/graph')).toBe(true)
    expect(handlers.has('/singularity/layout')).toBe(true)
    expect(handlers.has('/singularity/events')).toBe(true)
    expect(handlers.has('/singularity/graphs')).toBe(true)
    expect(handlers.has('/singularity/graph-envs')).toBe(true)
    expect(handlers.has('/singularity/repo-check')).toBe(true)
    expect(handlers.has('/singularity/hitl')).toBe(true)
    expect(handlers.has('/singularity/transcript')).toBe(false)
    expect(handlers.has('/singularity/notices')).toBe(false)

    const res = mockRes()
    await handlers.get('/singularity/graph')!(
      mockReq('GET', '/singularity/graph?graphId=graph-a'),
      res as unknown as ServerResponse,
    )
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ meta: { id: 'graph-a' }, graph: snapshot, layout })

    const graphsRes = mockRes()
    await handlers.get('/singularity/graphs')!(
      mockReq('GET', '/singularity/graphs'),
      graphsRes as unknown as ServerResponse,
    )
    expect(graphsRes.statusCode).toBe(200)
    expect(JSON.parse(graphsRes.body).graphs[0].repos).toEqual(['DangoSys/buckyball'])
  })

  it('forwards named events onto SSE clients', () => {
    const broadcast = new GraphBroadcast({} as never)
    const res = mockRes()
    broadcast.clients.set(res as unknown as ServerResponse, { graph: {} as never, writes: Promise.resolve() })
    broadcast.publishEvent('pr-chat/path', {
      path: 'pr',
      target: { repo: 'DangoSys/buckyball', number: 7 },
    })
    expect(res.body).toContain('event: pr-chat/path')
    expect(res.body).toContain('"repo":"DangoSys/buckyball"')
  })
})
