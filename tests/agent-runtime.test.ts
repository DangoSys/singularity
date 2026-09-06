import { describe, expect, test } from 'bun:test'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { AgentRuntime } from '../src/agent/index.ts'

const id = (value: string) => value as SessionId

function agent(value: string): Agent {
  return { id: id(value) } as Agent
}

function context(roots: readonly SessionId[]) {
  const root = agent('root')
  const created: string[] = []
  const resumed: string[] = []
  const createOptions: unknown[] = []
  const resumeOptions: unknown[] = []
  const added: unknown[] = []
  const nodes: unknown[] = []
  const handle = (value: Agent): AgentHandle => ({
    agent: value,
    dispose: async () => {},
  })
  const ctx = {
    reflect: { provide: () => {} },
    provide: () => {},
    agentDefaultModel: { currentSelection: () => ({ provider: 'default-provider', model: 'default-model' }) },
    agents: {
      create: async (options: { sessionId: SessionId }) => {
        created.push(options.sessionId)
        createOptions.push(options)
        return handle(root)
      },
      resume: async (options: { resumeSessionId: SessionId }) => {
        resumed.push(options.resumeSessionId)
        resumeOptions.push(options)
        return handle(root)
      },
      get: () => undefined,
      list: () => [],
    },
    graph: {
      snapshot: async () => ({
        version: 1 as const,
        id: 'graph',
        roots,
        agents: roots.map(agentId => ({ id: agentId, name: 'Singular', status: 'idle' as const, node: { x: 80, y: 80, width: 168, height: 76, shape: 'card' as const } })),
        groups: [],
        edges: [],
      }),
      addAgent: async (value: unknown) => { added.push(value) },
      setNode: async (agentId: SessionId, node: unknown) => { nodes.push({ agentId, node }) },
      setStatus: async () => {},
    },
    sessions: {},
    sessionPersistence: {},
    on: () => {},
    effect: (execute: () => unknown) => {
      const value = execute()
      return async () => {
        if (typeof value === 'function') await value()
      }
    },
  }
  return { ctx, created, resumed, createOptions, resumeOptions, added, nodes }
}

describe('AgentRuntime root lifecycle', () => {
  test('creates the stable root when the graph has no roots', async () => {
    const state = context([])
    new AgentRuntime(state.ctx as never)
    await Promise.resolve()
    await Promise.resolve()

    expect(state.created).toEqual(['root'])
    expect(state.createOptions).toEqual([{
      sessionId: id('root'),
      meta: { cwd: process.cwd() },
      agentOptions: { provider: 'default-provider', model: 'default-model' },
    }])
    expect(state.resumed).toEqual([])
    expect(state.added).toEqual([{ id: id('root'), name: 'Singular', status: 'idle', node: { x: 80, y: 80, width: 168, height: 76, shape: 'card' } }])
  })

  test('resumes every persisted root without creating a replacement', async () => {
    const state = context([id('root')])
    new AgentRuntime(state.ctx as never)
    await Promise.resolve()
    await Promise.resolve()

    expect(state.created).toEqual([])
    expect(state.resumed).toEqual(['root'])
    expect(state.resumeOptions).toEqual([{
      resumeSessionId: id('root'),
      agentOptions: { provider: 'default-provider', model: 'default-model' },
    }])
    expect(state.nodes).toEqual([])
  })

  test('migrates a persisted root that predates node geometry', async () => {
    const state = context([id('root')])
    state.ctx.graph.snapshot = async () => ({
      version: 1 as const,
      id: 'graph',
      roots: [id('root')],
      agents: [{ id: id('root'), name: 'Singular', status: 'idle' }],
      groups: [],
      edges: [],
    }) as never
    new AgentRuntime(state.ctx as never)
    await Promise.resolve()
    await Promise.resolve()

    expect(state.resumed).toEqual(['root'])
    expect(state.nodes).toEqual([{
      agentId: id('root'),
      node: { x: 80, y: 80, width: 168, height: 76, shape: 'card' },
    }])
  })
})
