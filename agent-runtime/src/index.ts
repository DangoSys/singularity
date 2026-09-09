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
import type { SessionHandle } from '@deepseek-ai/dsh-session-persistence'
import type {} from '@dangosys/dsh-singularity-layout'
import type { Agent, AgentHandle, ContentBlock, GraphEvent, GraphSnapshot, GroupNode, Session, GroupHandle, GroupRequest, RelayRequest, RootRequest, SpawnRequest } from './types.ts'
export type { AgentOptions, CanvasNode, ContentBlock, GroupHandle, GroupRequest, RelayRequest, RootRequest, SessionVisibility, SpawnRequest } from './types.ts'

export class AgentRuntime extends Service {
  static inject = ['agentDefaultModel', 'agentPresets', 'agents', 'graph', 'layout', 'sessions', 'sessionPersistence']
  private readonly owned = new Set<SessionId>()
  private readonly roots = new Set<SessionId>()
  private readonly handles = new Map<SessionId, AgentHandle>()
  private readonly transcripts = new Map<SessionId, Session>()

  constructor(ctx: Context) {
    super(ctx, 'agentRuntime')
    ctx.provide('sessionVisibility', {
      isVisible: sessionId => !this.owned.has(sessionId) || this.roots.has(sessionId),
    })
    ctx.on('agent/status', ({ agent, status }) => {
      if (this.owned.has(agent.id)) void ctx.graph.setStatus(agent.id, status)
    })
    ctx.on('session/event', (session, event) => {
      const transcript = this.transcripts.get(session.id)
      if (transcript === undefined) return
      if (event.type === 'assistant/message') transcript.append('user/message', { ...event.data.message, role: 'user', source: { kind: 'group', agentId: session.id } }, { surfaceOp: 'append' })
      if (event.type === 'user/message' && event.data.source.kind === 'relay') {
        transcript.append('user/message', { ...event.data, source: { kind: 'group', agentId: event.data.source.from } }, { surfaceOp: 'append' })
      }
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

  async promoteRoot(agent: Agent): Promise<void> {
    this.live(agent)
    if (this.owned.has(agent.id)) throw new Error(`agent-runtime: agent "${agent.id}" is already owned`)
    this.owned.add(agent.id)
    this.roots.add(agent.id)
    try {
      await this.ctx.graph.addAgent({ id: agent.id, name: 'Singularity', status: 'idle' }, true)
    } catch (error) {
      this.owned.delete(agent.id)
      this.roots.delete(agent.id)
      throw error
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

  async destroySession(sessionId: string): Promise<void> {
    const id = SessionId(sessionId)
    const handle = this.handles.get(id) ?? await this.ctx.agents.resume({
      resumeSessionId: id,
      agentOptions: this.ctx.agentDefaultModel.currentSelection(),
    })
    this.handles.delete(id)
    this.owned.delete(id)
    this.roots.delete(id)
    await handle.dispose()
    await this.ctx.layout.remove(id)
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

  async createGroup(router: Agent, request: GroupRequest): Promise<GroupHandle> {
    this.live(router)
    const transcript = router.ctx.sessions.prepare(request.transcriptId)
    const detach = router.ctx.sessions.enter(transcript)
    let stored: SessionHandle | undefined
    const group: GroupNode = { id: request.id, routerId: router.id, transcriptId: request.transcriptId, memberIds: [router.id] }
    try {
      stored = await this.ctx.sessionPersistence.create(transcript.header)
      router.ctx.sessions.announce(transcript)
      await this.ctx.graph.addGroup(group)
      this.transcripts.set(router.id, transcript)
      const handle = stored
      router.ctx.effect(() => async () => {
        for (const [agentId, value] of this.transcripts) if (value === transcript) this.transcripts.delete(agentId)
        await handle.close()
        detach()
      }, `agent-runtime: group ${request.id}`)
      return { group, transcript }
    } catch (error) {
      await stored?.close(); detach(); throw error
    }
  }

  async addMember(groupId: string, member: Agent): Promise<void> {
    this.live(member)
    const snapshot = await this.ctx.graph.snapshot()
    const group = snapshot.groups.find(item => item.id === groupId)
    if (group === undefined) throw new Error(`agent-runtime: group "${groupId}" is not in graph`)
    const transcript = this.ctx.sessions.get(group.transcriptId)
    if (transcript === undefined) throw new Error(`agent-runtime: group transcript "${group.transcriptId}" is not live`)
    await this.ctx.graph.addMember(groupId, member.id)
    this.transcripts.set(member.id, transcript)
  }

  async handoff(parent: Agent, child: Agent, brief?: string): Promise<void> {
    this.live(parent)
    this.live(child)
    await this.ctx.graph.addEdge({
      id: `${parent.id}->${child.id}:handoff`, kind: 'handoff', from: parent.id, to: child.id, ...(brief === undefined ? {} : { brief }),
    })
  }

  async relay(request: RelayRequest): Promise<void> {
    this.live(request.from)
    this.live(request.to)
    const snapshot: GraphSnapshot = await this.ctx.graph.snapshot()
    const from = snapshot.agents.find(agent => agent.id === request.from.id)
    const to = snapshot.agents.find(agent => agent.id === request.to.id)
    if (from === undefined || to === undefined) throw new Error('agent-runtime: relay endpoint is not in graph')
    if (to.memberOf !== undefined && to.routerFor === undefined) {
      const targetGroup = snapshot.groups.find(group => group.id === to.memberOf)
      const sameGroup = from.memberOf === to.memberOf
      const targetRouter = targetGroup?.routerId === from.id
      if (!sameGroup && !targetRouter) throw new Error(`agent-runtime: agent "${to.id}" is hidden behind group "${to.memberOf}"`)
    }
    request.to.followup(createUserMessage({
      content: [...request.prompt],
      source: { kind: 'relay', from: request.from.id, to: request.to.id },
    }))
  }

  async prompt(router: Agent, prompt: readonly ContentBlock[]): Promise<void> {
    this.live(router)
    const snapshot = await this.ctx.graph.snapshot()
    const node = snapshot.agents.find(agent => agent.id === router.id)
    if (node === undefined) throw new Error(`agent-runtime: agent "${router.id}" is not in graph`)
    const message = createUserMessage({ content: [...prompt], source: { kind: 'user' } })
    if (node.routerFor === undefined) {
      if (!snapshot.roots.includes(router.id)) throw new Error(`agent-runtime: agent "${router.id}" is not a router`)
      router.followup(message)
      return
    }
    const group = snapshot.groups.find(item => item.id === node.routerFor)
    if (group === undefined) throw new Error(`agent-runtime: router group "${node.routerFor}" is not in graph`)
    const transcript = this.ctx.sessions.get(group.transcriptId)
    if (transcript === undefined) throw new Error(`agent-runtime: group transcript "${group.transcriptId}" is not live`)
    transcript.append('user/message', message, { surfaceOp: 'append' })
    router.followup(message)
  }

  private live(agent: Agent): void { if (this.ctx.agents.get(agent.id) !== agent) throw new Error(`agent-runtime: agent "${agent.id}" is not live`) }
}

export default AgentRuntime
