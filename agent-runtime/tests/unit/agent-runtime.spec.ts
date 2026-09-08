import { describe, expect, test } from 'vitest'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { AgentRuntime } from '../../src/index.ts'

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
        agents: roots.map(agentId => ({ id: agentId, name: 'Singularity', status: 'idle' as const })),
        groups: [],
        edges: [],
      }),
      addAgent: async (value: unknown) => { added.push(value) },
      setStatus: async () => {},
    },
    layout: {
      remove: async () => {},
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
  return { ctx, created, resumed, createOptions, resumeOptions, added }
}

describe('AgentRuntime root lifecycle', () => {
  test('does not auto-create a root when the graph is empty', async () => {
    const state = context([])
    new AgentRuntime(state.ctx as never)
    await Promise.resolve()
    await Promise.resolve()

    expect(state.created).toEqual([])
    expect(state.resumed).toEqual([])
    expect(state.added).toEqual([])
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
  })

  test('createRoot adds a Singularity agent without layout geometry', async () => {
    const state = context([])
    const runtime = new AgentRuntime(state.ctx as never)
    await Promise.resolve()
    await Promise.resolve()
    await runtime.createRoot({ sessionId: id('root') })
    expect(state.created).toEqual(['root'])
    expect(state.added).toEqual([{ id: id('root'), name: 'Singularity', status: 'idle' }])
  })
})
