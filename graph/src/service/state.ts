import type { SessionId } from '@deepseek-ai/dsh-session'
import type { AgentNode, CanvasNode, GraphEdge, GraphEvent, GraphSnapshot, GroupNode } from '../types.ts'

function copy<T>(value: T): T {
  return structuredClone(value)
}

export class GraphState {
  private value: GraphSnapshot

  constructor(id: string, snapshot?: GraphSnapshot) {
    this.value = snapshot === undefined
      ? { version: 1, id, roots: [], agents: [], groups: [], edges: [] }
      : copy(snapshot)
  }

  clone(): GraphState {
    return new GraphState(this.value.id, this.value)
  }

  snapshot(): GraphSnapshot {
    return copy(this.value)
  }

  apply(event: GraphEvent): void {
    switch (event.kind) {
      case 'agent/add': this.addAgent(event.agent, event.root === true); return
      case 'agent/node': this.setNode(event.agentId, event.node); return
      case 'agent/status': this.status(event.agentId, event.status); return
      case 'group/add': this.addGroup(event.group); return
      case 'member/add': this.addMember(event.groupId, event.agentId); return
      case 'edge/add': this.addEdge(event.edge); return
      default: throw new Error(`graph: unknown event kind "${(event as { kind?: unknown }).kind}"`)
    }
  }

  private addAgent(agent: AgentNode, root: boolean): void {
    if (typeof agent.id !== 'string' || agent.id.length === 0) throw new Error('graph: agent id must be a non-empty string')
    if (typeof agent.name !== 'string' || agent.name.length === 0) throw new Error(`graph: agent "${agent.id}" name must be non-empty`)
    if (!['idle', 'running', 'waiting', 'done', 'failed'].includes(agent.status)) throw new Error(`graph: invalid status "${String(agent.status)}"`)
    if (agent.node !== undefined) this.node(agent.node, agent.id)
    if (this.value.agents.some(item => item.id === agent.id)) throw new Error(`graph: agent "${agent.id}" already exists`)
    if (agent.memberOf !== undefined || agent.routerFor !== undefined) throw new Error('graph: agent relationships must use group events')
    this.value = { ...this.value, agents: [...this.value.agents, copy(agent)], roots: root ? [...this.value.roots, agent.id] : this.value.roots }
  }

  private status(id: SessionId, status: AgentNode['status']): void {
    const agent = this.agent(id)
    if (agent.status === status) throw new Error(`graph: agent "${id}" already has status "${status}"`)
    this.value = { ...this.value, agents: this.value.agents.map(item => item.id === id ? { ...item, status } : item) }
  }

  private setNode(id: SessionId, node: CanvasNode): void {
    const agent = this.agent(id)
    this.node(node, id)
    this.value = { ...this.value, agents: this.value.agents.map(item => item.id === agent.id ? { ...item, node: copy(node) } : item) }
  }

  private addGroup(group: GroupNode): void {
    if (typeof group.id !== 'string' || group.id.length === 0) throw new Error('graph: group id must be a non-empty string')
    if (typeof group.transcriptId !== 'string' || group.transcriptId.length === 0) throw new Error(`graph: group "${group.id}" transcript id must be non-empty`)
    if (!Array.isArray(group.memberIds)) throw new Error(`graph: group "${group.id}" member ids must be an array`)
    if (this.value.groups.some(item => item.id === group.id)) throw new Error(`graph: group "${group.id}" already exists`)
    const router = this.agent(group.routerId)
    if (router.routerFor !== undefined) throw new Error(`graph: router "${group.routerId}" already leads a group`)
    if (group.memberIds.length !== 1 || group.memberIds[0] !== group.routerId) throw new Error('graph: a new group must contain exactly its router')
    if (this.value.groups.some(item => item.transcriptId === group.transcriptId)) throw new Error(`graph: transcript "${group.transcriptId}" already exists`)
    this.value = {
      ...this.value,
      groups: [...this.value.groups, copy(group)],
      agents: this.value.agents.map(item => item.id === group.routerId
        ? { ...item, routerFor: group.id }
        : item),
    }
  }

  private addMember(groupId: string, id: SessionId): void {
    if (typeof groupId !== 'string' || groupId.length === 0) throw new Error('graph: group id must be a non-empty string')
    if (typeof id !== 'string' || id.length === 0) throw new Error('graph: agent id must be a non-empty string')
    const group = this.group(groupId)
    const agent = this.agent(id)
    if (group.memberIds.includes(id)) throw new Error(`graph: agent "${id}" is already in group "${groupId}"`)
    if (agent.memberOf !== undefined) throw new Error(`graph: agent "${id}" already belongs to group "${agent.memberOf}"`)
    this.value = {
      ...this.value,
      groups: this.value.groups.map(item => item.id === groupId ? { ...item, memberIds: [...item.memberIds, id] } : item),
      agents: this.value.agents.map(item => item.id === id ? { ...item, memberOf: groupId } : item),
    }
  }

  private addEdge(edge: GraphEdge): void {
    if (typeof edge.id !== 'string' || edge.id.length === 0) throw new Error('graph: edge id must be a non-empty string')
    if (edge.kind !== 'spawn' && edge.kind !== 'handoff') throw new Error(`graph: invalid edge kind "${String(edge.kind)}"`)
    if (this.value.edges.some(item => item.id === edge.id)) throw new Error(`graph: edge "${edge.id}" already exists`)
    this.agent(edge.from)
    this.agent(edge.to)
    if (edge.from === edge.to || this.reaches(edge.to, edge.from)) throw new Error(`graph: edge "${edge.id}" creates a cycle`)
    this.value = { ...this.value, edges: [...this.value.edges, copy(edge)] }
  }

  private reaches(start: SessionId, target: SessionId): boolean {
    const seen = new Set<SessionId>()
    const pending = [start]
    while (pending.length > 0) {
      const current = pending.pop() as SessionId
      if (current === target) return true
      if (seen.has(current)) continue
      seen.add(current)
      for (const edge of this.value.edges) if (edge.from === current) pending.push(edge.to)
    }
    return false
  }

  private agent(id: SessionId): AgentNode {
    const agent = this.value.agents.find(item => item.id === id)
    if (agent === undefined) throw new Error(`graph: unknown agent "${id}"`)
    return agent
  }

  private group(id: string): GroupNode {
    const group = this.value.groups.find(item => item.id === id)
    if (group === undefined) throw new Error(`graph: unknown group "${id}"`)
    return group
  }

  private node(node: CanvasNode, agentId: SessionId): void {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error(`graph: agent "${agentId}" node position must be finite`)
    if (!Number.isFinite(node.width) || node.width <= 0 || !Number.isFinite(node.height) || node.height <= 0) {
      throw new Error(`graph: agent "${agentId}" node size must be positive`)
    }
    if (node.shape !== 'card' && node.shape !== 'circle' && node.shape !== 'diamond') throw new Error(`graph: agent "${agentId}" has invalid node shape`)
  }
}
