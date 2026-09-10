/**
 * Singularity agent runtime over the graph.
 * @module dsh-singularity-agent-runtime
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { cwd } from 'node:process'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-agent-presets'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@dangosys/dsh-singularity-layout'
import { DEFAULT_ROOT } from '@dangosys/dsh-singularity-layout'
import type { Agent, AgentHandle, ContentBlock, GraphEvent, RootRequest, SpawnRequest } from './types.ts'
export type { AgentOptions, CanvasNode, ContentBlock, RootRequest, SessionVisibility, SpawnRequest } from './types.ts'

export class AgentRuntime extends Service {
  static inject = ['agentDefaultModel', 'agentPresets', 'agents', 'graph', 'layout', 'sessions', 'sessionPersistence']
  private readonly owned = new Set<SessionId>()
  private readonly roots = new Set<SessionId>()
  private readonly handles = new Map<SessionId, AgentHandle>()

  constructor(ctx: Context) {
    super(ctx, 'agentRuntime')
    ctx.provide('sessionVisibility', {
      isVisible: sessionId => !this.owned.has(sessionId) || this.roots.has(sessionId),
    })
    ctx.on('agent/status', ({ agent, status }) => {
      if (this.owned.has(agent.id)) void ctx.graph.setStatus(agent.id, status)
    })
    ctx.effect(() => async () => {
      await Promise.all([...this.handles.values()].map(handle => handle.dispose()))
      for (const agent of ctx.agents.list()) if (this.owned.has(agent.id)) agent.cancel({ kind: 'disposed' })
      this.handles.clear(); this.owned.clear()
    }, 'agentRuntime: dispose')
  }

  async ensureRoot(sessionId: SessionId): Promise<AgentHandle> {
    const existing = this.handles.get(sessionId)
    if (existing !== undefined) return existing
    if (this.ctx.agents.get(sessionId) !== undefined) {
      throw new Error(`agent-runtime: root agent "${sessionId}" is already live`)
    }
    const snapshot = await this.ctx.graph.snapshot()
    const persisted = snapshot.agents.find(agent => agent.id === sessionId)
    if (persisted === undefined) throw new Error(`agent-runtime: root "${sessionId}" is not in graph`)
    if (!snapshot.roots.includes(sessionId)) throw new Error(`agent-runtime: "${sessionId}" is not a root`)
    if (persisted.status === 'running') await this.ctx.graph.setStatus(sessionId, 'idle')
    const headers = new Map((await this.ctx.sessionPersistence.list()).map(item => [item.header.id, item.header]))
    const agentPreset = headers.get(sessionId)?.agentPreset
    if (agentPreset === undefined) throw new Error(`agent-runtime: root session "${sessionId}" has no agent preset`)
    this.owned.add(sessionId)
    this.roots.add(sessionId)
    try {
      const handle = await this.ctx.agents.resume({
        resumeSessionId: sessionId,
        agentOptions: this.ctx.agentDefaultModel.currentSelection(),
        setup: async agentCtx => { await this.ctx.agentPresets.mount(agentCtx, agentPreset) },
      })
      this.handles.set(sessionId, handle)
      return handle
    } catch (error) {
      this.owned.delete(sessionId)
      this.roots.delete(sessionId)
      throw error
    }
  }

  async createRoot(request: RootRequest): Promise<AgentHandle> {
    this.owned.add(request.sessionId)
    const agentPreset = request.agentPreset ?? this.ctx.agentPresets.defaultId
    let handle: AgentHandle
    try {
      handle = await this.ctx.agents.create({
        sessionId: request.sessionId,
        meta: { cwd: cwd(), agentPreset },
        agentOptions: { ...this.ctx.agentDefaultModel.currentSelection(), ...request.agentOptions },
        setup: async agentCtx => { await this.ctx.agentPresets.mount(agentCtx, agentPreset) },
      })
    } catch (error) {
      this.owned.delete(request.sessionId); throw error
    }
    try {
      await this.ctx.graph.addAgent({ id: handle.agent.id, name: 'Singularity', status: 'idle' }, true)
      this.roots.add(handle.agent.id)
      this.handles.set(handle.agent.id, handle)
      return handle
    } catch (error) {
      this.owned.delete(request.sessionId); this.owned.delete(handle.agent.id); this.roots.delete(handle.agent.id); await handle.dispose(); throw error
    }
  }

  async spawn(parent: Agent, request: SpawnRequest): Promise<AgentHandle> {
    this.live(parent)
    this.owned.add(request.sessionId)
    let handle: AgentHandle
    try {
      handle = await parent.ctx.agents.create({
        sessionId: request.sessionId,
        meta: { parentSession: parent.id, origin: 'subagent' },
        agentOptions: { ...this.ctx.agentDefaultModel.currentSelection(), ...request.agentOptions },
        signal: request.signal,
      })
    } catch (error) {
      this.owned.delete(request.sessionId)
      throw error
    }
    try {
      const events: GraphEvent[] = [
        { kind: 'agent/add', agent: { id: handle.agent.id, name: request.name, status: 'idle' } },
        { kind: 'edge/add', edge: { id: `${parent.id}->${handle.agent.id}`, kind: 'spawn', from: parent.id, to: handle.agent.id } },
      ]
      await this.ctx.graph.commit(events)
      await this.ctx.layout.set(handle.agent.id, DEFAULT_ROOT)
      this.owned.add(handle.agent.id)
      this.handles.set(handle.agent.id, handle)
      handle.agent.followup(createUserMessage({ content: [...request.prompt], source: { kind: 'user' } }))
      return handle
    } catch (error) {
      this.owned.delete(request.sessionId); this.owned.delete(handle.agent.id)
      await handle.dispose()
      throw error
    }
  }

  async stopAgents(sessionIds: readonly SessionId[]): Promise<void> {
    for (const id of sessionIds) {
      const agent = this.ctx.agents.get(id)
      if (agent !== undefined) agent.cancel({ kind: 'disposed' })
      const handle = this.handles.get(id)
      if (handle === undefined) {
        this.owned.delete(id)
        this.roots.delete(id)
        continue
      }
      this.handles.delete(id)
      this.owned.delete(id)
      this.roots.delete(id)
      await handle.dispose()
    }
  }

  async prompt(agent: Agent, prompt: readonly ContentBlock[]): Promise<void> {
    this.live(agent)
    const snapshot = await this.ctx.graph.snapshot()
    if (snapshot.agents.every(item => item.id !== agent.id)) {
      throw new Error(`agent-runtime: agent "${agent.id}" is not in graph`)
    }
    agent.followup(createUserMessage({ content: [...prompt], source: { kind: 'user' } }))
  }

  private live(agent: Agent): void {
    if (this.ctx.agents.get(agent.id) !== agent) throw new Error(`agent-runtime: agent "${agent.id}" is not live`)
  }
}

export default AgentRuntime
